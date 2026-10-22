"""«Обзор», «Проверить решение», «Сценарии», «Финансовый план»."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.deps import CurrentUser, Repos, not_found
from app.models import Goal, Purchase
from app.services import assessment as assess_svc
from app.services import overview as overview_svc
from app.services import scenarios as sc

router = APIRouter(tags=["overview"])


@router.get("/dashboard")
def get_dashboard(user: CurrentUser, repos: Repos):
    return overview_svc.dashboard(repos, user.id, date.today())


# ------------------------------------------------------------------ checks


@router.post("/checks/preview")
def preview_check(body: Purchase, user: CurrentUser, repos: Repos):
    return assess_svc.preview(repos.profiles.get(user.id), repos.credits.list(user.id), body)


@router.post("/checks", status_code=201)
def create_check(body: Purchase, user: CurrentUser, repos: Repos):
    return assess_svc.assess(repos, user.id, body, date.today())


@router.get("/checks")
def list_checks(user: CurrentUser, repos: Repos, saved: bool = False):
    return [
        {"id": a.id, "created_at": a.created_at, "purchase": a.purchase, "risk": a.risk,
         "monthly_payment": a.monthly_payment, "saved": a.saved}
        for a in repos.assessments.list(user.id, saved_only=saved)
    ]


@router.get("/checks/latest")
def latest_check(user: CurrentUser, repos: Repos):
    items = repos.assessments.list(user.id)
    return items[0] if items else None


@router.get("/checks/{check_id}")
def get_check(check_id: str, user: CurrentUser, repos: Repos):
    a = repos.assessments.get(user.id, check_id)
    if a is None:
        raise not_found("check_not_found")
    return a


class SaveIn(BaseModel):
    saved: bool = True


@router.post("/checks/{check_id}/save")
def save_check(check_id: str, body: SaveIn, user: CurrentUser, repos: Repos):
    a = repos.assessments.get(user.id, check_id)
    if a is None:
        raise not_found("check_not_found")
    a.saved = body.saved
    # TODO: Database — UPDATE assessments SET saved = :saved
    return repos.assessments.save(a)


# ------------------------------------------------------------------ scenarios


@router.get("/scenarios")
def get_scenarios(user: CurrentUser, repos: Repos, check: str | None = None):
    a = repos.assessments.get(user.id, check) if check else next(iter(repos.assessments.list(user.id)), None)
    if a is None:
        return {"check": None, "scenarios": None}
    purchase = a.purchase.model_copy(update={"monthly_payment": a.monthly_payment})
    profile, credits = repos.profiles.get(user.id), repos.credits.list(user.id)
    data = sc.build(profile, credits, purchase, date.today())
    return {"check": {"id": a.id, "risk": a.risk, "purchase": a.purchase}, "scenarios": data,
            "updated_at": overview_svc.data_updated_at(profile, credits)}


class CustomIn(BaseModel):
    price: int = Field(ge=0)
    method: Literal["installment", "credit", "save"]
    term_months: int = Field(default=12, ge=1, le=120)
    down_payment: int = Field(default=0, ge=0)
    start: Literal["now", "later"] = "now"


@router.post("/scenarios/custom")
def custom_scenario(body: CustomIn, user: CurrentUser, repos: Repos):
    return sc.custom(repos.profiles.get(user.id), repos.credits.list(user.id), body.price, body.method,
                     body.term_months, body.down_payment, body.start, date.today())


class AddToPlanIn(BaseModel):
    check_id: str
    option: str = "save"


@router.post("/scenarios/add-to-plan", status_code=201)
def add_scenario_to_plan(body: AddToPlanIn, user: CurrentUser, repos: Repos):
    a = repos.assessments.get(user.id, body.check_id)
    if a is None:
        raise not_found("check_not_found")
    purchase = a.purchase.model_copy(update={"monthly_payment": a.monthly_payment})
    data = sc.build(repos.profiles.get(user.id), repos.credits.list(user.id), purchase, date.today())
    option = next((o for o in data["options"] if o["code"] == body.option), None)
    if option is None:
        raise not_found("option_not_found")
    existing = next((g for g in repos.goals.list(user.id)
                     if g.params.get("check_id") == a.id and g.params.get("option") == option["code"]), None)
    if existing:
        return existing
    goal = Goal(
        id=uuid.uuid4().hex[:12], user_id=user.id, kind="save_for", source="scenario",
        params={"item": a.purchase.category, "title": a.purchase.title, "option": option["code"], "check_id": a.id,
                "monthly": option.get("pre_saving_monthly") or option.get("saving_monthly") or option["monthly_payment"]},
        target_date=option.get("purchase_month"), current=0, target=option["price"], created_at=datetime.now(),
    )
    # TODO: Database — insert goal row.
    repos.goals.save(goal)
    return goal


# ------------------------------------------------------------------ plan


@router.get("/plan")
def get_plan(user: CurrentUser, repos: Repos):
    return overview_svc.plan(repos, user.id, date.today())


class GoalIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    target: int = Field(ge=0)
    current: int = Field(default=0, ge=0)
    target_date: date | None = None


class GoalPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    target: int | None = Field(default=None, ge=0)
    current: int | None = Field(default=None, ge=0)
    target_date: date | None = None
    status: Literal["active", "planned", "done"] | None = None


@router.post("/plan/goals", status_code=201)
def add_goal(body: GoalIn, user: CurrentUser, repos: Repos):
    goal = Goal(id=uuid.uuid4().hex[:12], user_id=user.id, kind="custom", source="user", title=body.title,
                target=body.target, current=body.current, target_date=body.target_date, created_at=datetime.now())
    # TODO: Database — insert goal row.
    return repos.goals.save(goal)


@router.patch("/plan/goals/{goal_id}")
def patch_goal(goal_id: str, body: GoalPatch, user: CurrentUser, repos: Repos):
    goal = repos.goals.get(user.id, goal_id)
    if goal is None:
        raise not_found("goal_not_found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(goal, k, v)
    # TODO: Database — update goal row.
    return repos.goals.save(goal)


@router.delete("/plan/goals/{goal_id}", status_code=204)
def delete_goal(goal_id: str, user: CurrentUser, repos: Repos):
    if not repos.goals.delete(user.id, goal_id):
        raise not_found("goal_not_found")


class RecommendationAction(BaseModel):
    action: Literal["accept", "dismiss", "remind"]


@router.post("/plan/recommendations/{rec_id}")
def act_on_recommendation(rec_id: str, body: RecommendationAction, user: CurrentUser, repos: Repos):
    rec = repos.recommendations.get(user.id, rec_id)
    if rec is None:
        raise not_found("recommendation_not_found")
    if body.action not in rec.actions:
        raise HTTPException(400, detail={"code": "action_not_available"})
    rec.status = {"accept": "accepted", "dismiss": "dismissed", "remind": "reminder_on"}[body.action]  # type: ignore[assignment]
    rec.actions = []
    # TODO: Database — update recommendation row.
    return repos.recommendations.save(rec)
