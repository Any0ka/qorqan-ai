"""«Мои кредиты»: list, details, manual add / correct / delete, mark a payment as paid."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Literal

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from app.deps import CurrentUser, Repos, not_found
from app.models import Credit, CreditType
from app.services import finance as fin

router = APIRouter(prefix="/credits", tags=["credits"])

SortKey = Literal["next_payment", "balance", "payment"]


def _summary(credits, income: int, today: date) -> dict:
    upcoming = sorted((c for c in credits if c.next_payment_date), key=lambda c: c.next_payment_date)
    nxt = upcoming[0] if upcoming else None
    stale = [c for c in credits if (today - c.data_as_of).days > 30]
    return {
        "total_debt": fin.debt_total(credits),
        "count": len(credits),
        "monthly_payments": fin.payments_total(credits),
        "load": fin.share(fin.payments_total(credits), income),
        "next_payment": {
            "credit_id": nxt.id, "organization": nxt.organization, "type": nxt.type,
            "amount": nxt.monthly_payment, "date": nxt.next_payment_date,
            "days_until": (nxt.next_payment_date - today).days,
        } if nxt else None,
        "counts_by_type": {t: sum(1 for c in credits if c.type == t) for t in {c.type for c in credits}},
        "stale_count": len(stale),
        "oldest_data": min((c.data_as_of for c in credits), default=None),
    }


@router.get("")
def list_credits(
    user: CurrentUser,
    repos: Repos,
    type: CreditType | None = None,
    q: str | None = Query(default=None, max_length=80),
    sort: SortKey = "next_payment",
):
    today = date.today()
    credits = repos.credits.list(user.id)
    income = fin.income_total(repos.profiles.get(user.id))
    # TODO: Database — push filtering / search / sorting into the query (ILIKE on organization).
    items = [c for c in credits if (type is None or c.type == type) and (not q or q.lower() in c.organization.lower())]
    if sort == "balance":
        items.sort(key=lambda c: -c.balance)
    elif sort == "payment":
        items.sort(key=lambda c: -c.monthly_payment)
    else:
        items.sort(key=lambda c: c.next_payment_date or date.max)
    report = repos.reports.latest(user.id)
    return {
        "summary": _summary(credits, income, today),
        "items": [fin.credit_view(c, today, credits) for c in items],
        "report": {"id": report.id, "filename": report.filename, "uploaded_at": report.uploaded_at} if report else None,
        "no_credits": repos.profiles.get(user.id).no_credits,
    }


@router.get("/{credit_id}")
def get_credit(credit_id: str, user: CurrentUser, repos: Repos):
    c = repos.credits.get(user.id, credit_id)
    if c is None:
        raise not_found("credit_not_found")
    return fin.credit_view(c, date.today(), repos.credits.list(user.id))


class CreditIn(BaseModel):
    organization: str = Field(min_length=1, max_length=80)
    type: CreditType
    balance: int = Field(ge=0)
    monthly_payment: int = Field(ge=0)
    next_payment_date: date | None = None
    last_payment_date: date | None = None
    original_amount: int | None = Field(default=None, ge=0)
    rate: float | None = Field(default=None, ge=0, le=1000)
    is_minimum_payment: bool = False
    payments_total: int | None = Field(default=None, ge=1)
    payments_made: int = Field(default=0, ge=0)


class CreditPatch(BaseModel):
    organization: str | None = Field(default=None, min_length=1, max_length=80)
    type: CreditType | None = None
    balance: int | None = Field(default=None, ge=0)
    monthly_payment: int | None = Field(default=None, ge=0)
    next_payment_date: date | None = None
    last_payment_date: date | None = None
    original_amount: int | None = Field(default=None, ge=0)
    rate: float | None = Field(default=None, ge=0, le=1000)


@router.post("", status_code=201)
def add_credit(body: CreditIn, user: CurrentUser, repos: Repos):
    now = datetime.now()
    c = Credit(id=uuid.uuid4().hex[:12], user_id=user.id, source="manual", data_as_of=now.date(),
               created_at=now, updated_at=now, **body.model_dump())
    # TODO: Database — insert credit row.
    repos.credits.save(c)
    profile = repos.profiles.get(user.id)
    if profile.no_credits:
        profile.no_credits = False
        repos.profiles.save(profile)
    return fin.credit_view(c, now.date(), repos.credits.list(user.id))


@router.patch("/{credit_id}")
def update_credit(credit_id: str, body: CreditPatch, user: CurrentUser, repos: Repos):
    c = repos.credits.get(user.id, credit_id)
    if c is None:
        raise not_found("credit_not_found")
    changes = body.model_dump(exclude_unset=True)
    for field, value in changes.items():
        old = getattr(c, field)
        if old != value:
            if c.source == "report" and field not in c.report_values:
                c.report_values[field] = old
            if field not in c.corrected_fields:
                c.corrected_fields.append(field)
            setattr(c, field, value)
    if changes:
        c.corrected_manually = c.source == "report" or c.corrected_manually
        c.updated_at = datetime.now()
        c.data_as_of = date.today()
    # TODO: Database — update credit row; recalculation of plan/assessments reads fresh data on next request.
    repos.credits.save(c)
    credits = repos.credits.list(user.id)
    view = fin.credit_view(c, date.today(), credits)
    view["recalculated"] = {"load": fin.share(fin.payments_total(credits), fin.income_total(repos.profiles.get(user.id)))}
    return view


@router.delete("/{credit_id}", status_code=204)
def delete_credit(credit_id: str, user: CurrentUser, repos: Repos):
    if not repos.credits.delete(user.id, credit_id):
        raise not_found("credit_not_found")


@router.post("/{credit_id}/paid")
def mark_paid(credit_id: str, user: CurrentUser, repos: Repos):
    """«Отметить как оплачено»: moves the credit to its next payment."""
    c = repos.credits.get(user.id, credit_id)
    if c is None:
        raise not_found("credit_not_found")
    left = fin.remaining_payments(c)
    paid = c.last_payment_amount if (left == 1 and c.last_payment_amount) else c.monthly_payment
    c.payments_made += 1
    c.balance = max(c.balance - round(paid * fin.principal_share(c)), 0)
    if c.next_payment_date:
        c.next_payment_date = fin.add_months(c.next_payment_date, 1)
    if (c.payments_total and c.payments_made >= c.payments_total) or c.balance == 0:
        c.status, c.balance, c.next_payment_date = "closed", 0, None
    c.updated_at = datetime.now()
    # TODO: Database — update credit row and append to a `payments` history table.
    repos.credits.save(c)
    for n in repos.notifications.list(user.id):
        if n.code == "payment_due_soon" and n.params.get("credit_id") == c.id and not n.read:
            n.read = True
            repos.notifications.save(n)
    return fin.credit_view(c, date.today(), repos.credits.list(user.id, include_closed=True))


@router.post("/{credit_id}/close")
def mark_closed(credit_id: str, user: CurrentUser, repos: Repos):
    """«Отметить как погашенный»."""
    c = repos.credits.get(user.id, credit_id)
    if c is None:
        raise not_found("credit_not_found")
    c.status, c.balance, c.next_payment_date = "closed", 0, None
    c.updated_at = datetime.now()
    # TODO: Database — update credit row.
    repos.credits.save(c)
    return fin.credit_view(c, date.today(), repos.credits.list(user.id, include_closed=True))
