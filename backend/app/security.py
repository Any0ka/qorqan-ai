"""Password hashing, access tokens, phone normalisation."""

from __future__ import annotations

import base64
import hashlib
import hmac
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import jwt

from app.config import settings

_PBKDF2_ROUNDS = 240_000


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ROUNDS)
    return "pbkdf2_sha256${}${}${}".format(
        _PBKDF2_ROUNDS, base64.b64encode(salt).decode(), base64.b64encode(digest).decode()
    )


def verify_password(password: str, stored: str) -> bool:
    try:
        _, rounds, salt_b64, digest_b64 = stored.split("$")
    except ValueError:
        return False
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), base64.b64decode(salt_b64), int(rounds))
    return hmac.compare_digest(digest, base64.b64decode(digest_b64))


def password_ok(password: str) -> bool:
    """At least 8 characters and at least one digit (rule shown under the field)."""
    return len(password) >= 8 and any(ch.isdigit() for ch in password)


def create_access_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "jti": uuid.uuid4().hex,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=settings.jwt_ttl_hours)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


def normalize_phone(raw: str) -> str | None:
    """'701 234 56 78', '+7 (701) 234-56-78', '87012345678' → '+77012345678'."""
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 10:
        digits = "7" + digits
    elif len(digits) == 11 and digits[0] in "78":
        digits = "7" + digits[1:]
    else:
        return None
    return "+" + digits


def mask_phone(phone: str) -> str:
    """'+77012345678' → '+7 701 *** ** 78'."""
    d = phone.lstrip("+")
    return f"+{d[0]} {d[1:4]} *** ** {d[-2:]}"


def mask_email(email: str | None) -> str | None:
    if not email or "@" not in email:
        return email
    name, domain = email.split("@", 1)
    return f"{name[0]}***@{domain}"


def new_sms_code() -> str:
    return f"{secrets.randbelow(10_000):04d}"
