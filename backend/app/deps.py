"""Shared FastAPI dependencies."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.db.repositories import Repositories, get_repositories
from app.models import Lang, User
from app.security import decode_access_token

_bearer = HTTPBearer(auto_error=False)

Repos = Annotated[Repositories, Depends(get_repositories)]


def get_current_user(
    repos: Repos,
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> User:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail={"code": "not_authenticated"})
    payload = decode_access_token(creds.credentials)
    if not payload or repos.tokens.is_revoked(payload.get("jti", "")):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail={"code": "invalid_token"})
    user = repos.users.get(payload["sub"])
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail={"code": "user_not_found"})
    return user


def get_token_payload(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> dict:
    payload = decode_access_token(creds.credentials) if creds else None
    if not payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail={"code": "invalid_token"})
    return payload


def get_lang(
    lang: Annotated[Lang | None, Query()] = None,
    accept_language: Annotated[str | None, Header()] = None,
) -> Lang:
    if lang:
        return lang
    if accept_language and accept_language.lower().startswith(("kk", "kz")):
        return "kk"
    return "ru"


CurrentUser = Annotated[User, Depends(get_current_user)]
RequestLang = Annotated[Lang, Depends(get_lang)]


def not_found(code: str = "not_found") -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, detail={"code": code})
