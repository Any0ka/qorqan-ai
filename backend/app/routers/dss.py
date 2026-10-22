"""«Выбор банка» — multi-criteria ranking of credit offers (WSM + TOPSIS)."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.deps import CurrentUser, Repos, RequestLang
from app.services import dss

router = APIRouter(prefix="/dss", tags=["dss"])


@router.get("/problem")
def get_problem(user: CurrentUser, repos: Repos, lang: RequestLang, price: int = Query(dss.DEFAULT_PRICE, ge=10_000, le=50_000_000)):
    """Default decision matrix for the signed-in user: offers × criteria, with the preliminary weights."""
    return dss.build_problem(repos.profiles.get(user.id), repos.credits.list(user.id), price, lang)


class CriterionIn(BaseModel):
    key: str = Field(min_length=1, max_length=40)
    type: Literal["benefit", "cost"]
    weight: float = Field(ge=0, le=1)


class RankIn(BaseModel):
    criteria: list[CriterionIn] = Field(min_length=1)
    matrix: dict[str, dict[str, float | None]] = Field(min_length=2)


@router.post("/rank")
def rank(body: RankIn, user: CurrentUser):
    """Validate → normalize → WSM → TOPSIS → compare. 400 with `errors` when the input is inconsistent."""
    types = {c.key: c.type for c in body.criteria}
    weights = {c.key: c.weight for c in body.criteria}
    errors = dss.validate(body.matrix, types, weights)
    if errors:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail={"code": "dss_invalid", "errors": errors})
    matrix = {code: {k: float(v) for k, v in row.items() if k in types} for code, row in body.matrix.items()}
    return dss.run(matrix, types, weights)
