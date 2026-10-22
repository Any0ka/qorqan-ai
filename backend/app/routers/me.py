"""The signed-in user: account, financial profile (incomes, expenses), onboarding, data export."""

from __future__ import annotations

import json
import uuid
from datetime import date, datetime
from typing import Literal

from fastapi import APIRouter, HTTPException, Response
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, Field

from app.deps import CurrentUser, Repos
from app.models import Expense, ExpenseCategory, Income, IncomeFrequency, Lang
from app.security import mask_email, mask_phone
from app.services import finance as fin

router = APIRouter(prefix="/me", tags=["me"])


def _initials(name: str, surname: str | None) -> str:
    return (name[:1] + (surname or "")[:1]).upper()


def user_view(repos: Repos, user) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "surname": user.surname,
        "initials": _initials(user.name, user.surname),
        "phone": user.phone,
        "phone_masked": mask_phone(user.phone),
        "email": user.email,
        "email_masked": mask_email(user.email),
        "language": user.language,
        "avatar_color": user.avatar_color,
        "created_at": user.created_at,
        "unread_notifications": repos.notifications.unread_count(user.id),
    }


@router.get("")
def get_me(user: CurrentUser, repos: Repos):
    return user_view(repos, user)


class MePatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    surname: str | None = Field(default=None, max_length=80)
    email: str | None = None
    language: Lang | None = None


@router.patch("")
def patch_me(body: MePatch, user: CurrentUser, repos: Repos):
    data = body.model_dump(exclude_unset=True)
    if "email" in data and data["email"]:
        other = repos.users.get_by_email(data["email"])
        if other and other.id != user.id:
            raise HTTPException(409, detail={"code": "email_taken"})
    for k, v in data.items():
        setattr(user, k, v)
    repos.users.save(user)
    return user_view(repos, user)


# ------------------------------------------------------------ financial profile


def financial_view(repos: Repos, user_id: str) -> dict:
    profile = repos.profiles.get(user_id)
    credits = repos.credits.list(user_id)
    comp = fin.completeness(profile, credits)
    snap = fin.snapshot(profile, credits)
    return {
        **profile.model_dump(),
        "income_total": snap.income,
        "expenses_total": snap.expenses,
        "payments_total": snap.payments,
        "free": snap.free,
        "load": snap.load,
        "zone": fin.load_zone(snap.load),
        "credits_count": snap.credits_count,
        "credits_from_report": sum(1 for c in credits if c.source == "report"),
        "credits_manual": sum(1 for c in credits if c.source == "manual"),
        "completeness": {"income": comp.income, "expenses": comp.expenses, "credits": comp.credits,
                         "percent": comp.percent, "steps_done": comp.steps_done, "missing": comp.missing,
                         "state": comp.state},
    }


@router.get("/financial")
def get_financial(user: CurrentUser, repos: Repos):
    return financial_view(repos, user.id)


class IncomeIn(BaseModel):
    id: str | None = None
    source: str = Field(min_length=1, max_length=80)
    amount: int = Field(ge=0, le=1_000_000_000)
    frequency: IncomeFrequency = "monthly"


class IncomesIn(BaseModel):
    incomes: list[IncomeIn]


@router.put("/incomes")
def put_incomes(body: IncomesIn, user: CurrentUser, repos: Repos):
    profile = repos.profiles.get(user.id)
    profile.incomes = [Income(id=i.id or uuid.uuid4().hex[:8], source=i.source, amount=i.amount, frequency=i.frequency)
                       for i in body.incomes if i.amount > 0 or i.source]
    profile.incomes_updated_at = datetime.now()
    profile.onboarding_step = max(profile.onboarding_step, 2)
    # TODO: Database — replace the user's income rows in one transaction.
    repos.profiles.save(profile)
    return financial_view(repos, user.id)


class ExpenseIn(BaseModel):
    category: ExpenseCategory
    label: str | None = None
    amount: int = Field(ge=0, le=1_000_000_000)


class ExpensesIn(BaseModel):
    expenses: list[ExpenseIn]


@router.put("/expenses")
def put_expenses(body: ExpensesIn, user: CurrentUser, repos: Repos):
    profile = repos.profiles.get(user.id)
    profile.expenses = [Expense(id=uuid.uuid4().hex[:8], category=e.category, label=e.label, amount=e.amount) for e in body.expenses]
    profile.expenses_set = True
    profile.expenses_updated_at = datetime.now()
    profile.onboarding_step = max(profile.onboarding_step, 3)
    # TODO: Database — replace the user's expense rows in one transaction.
    repos.profiles.save(profile)
    return financial_view(repos, user.id)


class NoCreditsIn(BaseModel):
    no_credits: bool = True


@router.post("/no-credits")
def set_no_credits(body: NoCreditsIn, user: CurrentUser, repos: Repos):
    profile = repos.profiles.get(user.id)
    profile.no_credits = body.no_credits
    if body.no_credits:
        profile.onboarding_step = max(profile.onboarding_step, 4)
    repos.profiles.save(profile)
    return financial_view(repos, user.id)


class OnboardingIn(BaseModel):
    step: int = Field(ge=1, le=4)
    completed: bool = False
    reset: bool = False  # allow moving the saved step backwards


@router.patch("/onboarding")
def patch_onboarding(body: OnboardingIn, user: CurrentUser, repos: Repos):
    profile = repos.profiles.get(user.id)
    profile.onboarding_step = body.step if body.reset else max(profile.onboarding_step, body.step)
    if body.completed:
        profile.onboarding_completed = True
        meta = repos.plan_meta.get(user.id)
        if not meta.get("started_at"):
            credits = repos.credits.list(user.id)
            repos.plan_meta.save(user.id, {"started_at": date.today(), "start_debt": fin.debt_total(credits)})
    repos.profiles.save(profile)
    return financial_view(repos, user.id)


# ------------------------------------------------------------ data rights


@router.get("/export")
def export_data(user: CurrentUser, repos: Repos):
    """«Скачать мои данные» — everything stored about the user as JSON."""
    # TODO: Database — for large accounts generate the export asynchronously and email a link.
    payload = {
        "exported_at": datetime.now(),
        "user": user.model_dump(exclude={"password_hash"}),
        "financial_profile": repos.profiles.get(user.id).model_dump(),
        "credits": [c.model_dump() for c in repos.credits.list(user.id, include_closed=True)],
        "assessments": [a.model_dump() for a in repos.assessments.list(user.id)],
        "goals": [g.model_dump() for g in repos.goals.list(user.id)],
        "consents": [c.model_dump() for c in repos.consents.list(user.id).values()],
        "consent_history": [e.model_dump() for e in repos.consents.events(user.id)],
        "notifications": [n.model_dump() for n in repos.notifications.list(user.id)],
        "conversations": [c.model_dump() for c in repos.conversations.list(user.id)],
    }
    body = json.dumps(jsonable_encoder(payload), ensure_ascii=False, indent=2)
    return Response(content=body, media_type="application/json",
                    headers={"Content-Disposition": 'attachment; filename="qorgan-my-data.json"'})


class DeleteIn(BaseModel):
    confirm: Literal["DELETE"]


@router.post("/delete", status_code=204)
def delete_account(body: DeleteIn, user: CurrentUser, repos: Repos):
    # TODO: Database — cascade delete of every row owned by the user (see UserRepo.delete_with_all_data).
    repos.users.delete_with_all_data(user.id)
