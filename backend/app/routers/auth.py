"""Registration with SMS confirmation, login, password recovery."""

from __future__ import annotations

import time
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.config import settings
from app.db.memory import PendingVerification
from app.deps import Repos, get_token_payload
from app.models import FinancialProfile, User
from app.security import (
    create_access_token, hash_password, mask_phone, new_sms_code, normalize_phone, password_ok, verify_password,
)
from app.services import consents as consent_svc

router = APIRouter(prefix="/auth", tags=["auth"])

CODE_TTL_SECONDS = 300
RESEND_AFTER_SECONDS = 45
MAX_CODE_ATTEMPTS = 5


class RegisterConsents(BaseModel):
    terms: bool
    personal_data: bool
    marketing: bool = False


class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    phone: str
    password: str
    consents: RegisterConsents
    language: str = "ru"


class VerifyIn(BaseModel):
    verification_id: str
    code: str = Field(min_length=4, max_length=4)


class LoginIn(BaseModel):
    login: str  # phone or email
    password: str


class RecoverIn(BaseModel):
    phone: str


class RecoverConfirmIn(BaseModel):
    verification_id: str
    code: str = Field(min_length=4, max_length=4)
    new_password: str


class ResendIn(BaseModel):
    verification_id: str


def _error(code: str, http: int = status.HTTP_400_BAD_REQUEST, **extra) -> HTTPException:
    return HTTPException(http, detail={"code": code, **extra})


def _start_verification(repos: Repos, phone: str, purpose: str, user_id: str | None) -> dict:
    v = PendingVerification(id=uuid.uuid4().hex, phone=phone, code=new_sms_code(), purpose=purpose, user_id=user_id,
                            expires_at=time.time() + CODE_TTL_SECONDS)
    repos.verifications.add(v)
    # TODO: Integration — send `v.code` by SMS through the provider instead of exposing it.
    out = {"verification_id": v.id, "phone_masked": mask_phone(phone), "resend_after": RESEND_AFTER_SECONDS}
    if settings.expose_dev_codes:
        out["dev_code"] = v.code
    return out


def _check_code(repos: Repos, verification_id: str, code: str, purpose: str) -> PendingVerification:
    v = repos.verifications.get(verification_id)
    if v is None or v.purpose != purpose or v.expires_at < time.time():
        raise _error("code_expired")
    if v.attempts >= MAX_CODE_ATTEMPTS:
        raise _error("too_many_attempts", status.HTTP_429_TOO_MANY_REQUESTS)
    if v.code != code:
        v.attempts += 1
        repos.verifications.add(v)
        raise _error("code_invalid", attempts_left=MAX_CODE_ATTEMPTS - v.attempts)
    repos.verifications.delete(v.id)
    return v


def _session(user: User) -> dict:
    return {"access_token": create_access_token(user.id), "token_type": "bearer", "user_id": user.id}


@router.post("/register", status_code=201)
def register(body: RegisterIn, repos: Repos):
    phone = normalize_phone(body.phone)
    if not phone:
        raise _error("phone_invalid")
    if not password_ok(body.password):
        raise _error("password_weak")
    if not (body.consents.terms and body.consents.personal_data):
        raise _error("consents_required")
    existing = repos.users.get_by_phone(phone)
    if existing and existing.verified:
        raise _error("phone_taken", status.HTTP_409_CONFLICT)

    now = datetime.now()
    user = existing or User(id=uuid.uuid4().hex[:12], name=body.name.strip(), phone=phone,
                            password_hash="", created_at=now)
    user.name = body.name.strip()
    user.password_hash = hash_password(body.password)
    user.language = "kk" if body.language == "kk" else "ru"
    # TODO: Database — insert user + profile + consents in a single transaction.
    repos.users.save(user)
    repos.profiles.save(FinancialProfile(user_id=user.id))
    consent_svc.ensure_defaults(repos, user.id, now, marketing=body.consents.marketing)
    return _start_verification(repos, phone, "register", user.id)


@router.post("/verify")
def verify(body: VerifyIn, repos: Repos):
    v = _check_code(repos, body.verification_id, body.code, "register")
    user = repos.users.get(v.user_id or "")
    if user is None:
        raise _error("user_not_found", status.HTTP_404_NOT_FOUND)
    user.verified = True
    repos.users.save(user)
    return _session(user)


@router.post("/resend")
def resend(body: ResendIn, repos: Repos):
    v = repos.verifications.get(body.verification_id)
    if v is None:
        raise _error("code_expired")
    repos.verifications.delete(v.id)
    return _start_verification(repos, v.phone, v.purpose, v.user_id)


@router.post("/login")
def login(body: LoginIn, repos: Repos):
    ident = body.login.strip()
    user = repos.users.get_by_email(ident) if "@" in ident else None
    if user is None:
        phone = normalize_phone(ident)
        user = repos.users.get_by_phone(phone) if phone else None
    if user is None or not user.verified or not verify_password(body.password, user.password_hash):
        raise _error("invalid_credentials", status.HTTP_401_UNAUTHORIZED)
    return _session(user)


@router.post("/recover")
def recover(body: RecoverIn, repos: Repos):
    phone = normalize_phone(body.phone)
    if not phone:
        raise _error("phone_invalid")
    user = repos.users.get_by_phone(phone)
    # Same answer whether or not the number is registered, so the endpoint can't be used to probe accounts.
    return _start_verification(repos, phone, "recover", user.id if user else None)


@router.post("/recover/confirm")
def recover_confirm(body: RecoverConfirmIn, repos: Repos):
    if not password_ok(body.new_password):
        raise _error("password_weak")
    v = _check_code(repos, body.verification_id, body.code, "recover")
    user = repos.users.get(v.user_id or "")
    if user is None:
        raise _error("code_invalid")
    user.password_hash = hash_password(body.new_password)
    repos.users.save(user)
    return _session(user)


@router.post("/logout", status_code=204)
def logout(repos: Repos, payload: dict = Depends(get_token_payload)):
    repos.tokens.revoke(payload.get("jti", ""))
