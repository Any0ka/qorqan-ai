"""Core money maths shared by every screen.

qorgan scale (design system, "Шкала qorgan"):
  * low    — debt load up to 30% and at least 20% of income left free
  * medium — load 30–45% or 10–20% of income left free
  * high   — load from 45% or less than 10% of income left free

Debt load = monthly credit payments ÷ income.
Free money = income − mandatory expenses − credit payments.
"""

from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date

from app.config import settings
from app.models import Credit, CreditType, FinanceSnapshot, FinancialProfile, LoadZone, RiskLevel

LOAD_STABLE_MAX = 0.30
LOAD_HIGH_MIN = 0.45
FREE_OK_MIN = 0.20
FREE_HIGH_MAX = 0.10

# Rough cost ranking when a credit has no explicit overpayment data (higher = more expensive).
TYPE_COST_RANK: dict[CreditType, int] = {
    "microloan": 6,
    "credit_card": 5,
    "cash_loan": 4,
    "other": 3,
    "auto_loan": 2,
    "mortgage": 1,
    "installment": 0,
}

# Share of a monthly payment that goes to principal, by type (used for forecasts).
PRINCIPAL_SHARE: dict[CreditType, float] = {
    "installment": 1.0,
    "microloan": 0.85,
    "credit_card": 0.75,
    "cash_loan": 0.72,
    "auto_loan": 0.70,
    "mortgage": 0.50,
    "other": 0.75,
}


def add_months(d: date, months: int) -> date:
    m = d.month - 1 + months
    y = d.year + m // 12
    m = m % 12 + 1
    return date(y, m, min(d.day, calendar.monthrange(y, m)[1]))


def month_start(d: date) -> date:
    return d.replace(day=1)


def income_total(profile: FinancialProfile) -> int:
    return sum(i.amount for i in profile.incomes)


def expenses_total(profile: FinancialProfile) -> int:
    return sum(e.amount for e in profile.expenses)


def payments_total(credits: list[Credit]) -> int:
    return sum(c.monthly_payment for c in credits if c.status == "active")


def debt_total(credits: list[Credit]) -> int:
    return sum(c.balance for c in credits if c.status == "active")


def load_zone(load: float) -> LoadZone:
    if load >= LOAD_HIGH_MIN:
        return "high"
    if load > LOAD_STABLE_MAX:
        return "caution"
    return "stable"


def risk_level(load: float, free: int, income: int) -> RiskLevel:
    if income <= 0:
        return "insufficient"
    free_share = free / income
    if load >= LOAD_HIGH_MIN or free_share < FREE_HIGH_MAX:
        return "high"
    if load > LOAD_STABLE_MAX or free_share < FREE_OK_MIN:
        return "medium"
    return "low"


def share(part: int, whole: int) -> float:
    return part / whole if whole > 0 else 0.0


def pct(x: float) -> int:
    """0.4666 → 47 (what the UI prints)."""
    return round(x * 100)


@dataclass
class Completeness:
    income: bool
    expenses: bool
    credits: bool

    @property
    def percent(self) -> int:
        return (40 if self.income else 0) + (30 if self.expenses else 0) + (30 if self.credits else 0)

    @property
    def steps_done(self) -> int:
        return sum((self.income, self.expenses, self.credits))

    @property
    def missing(self) -> list[str]:
        return [k for k, ok in (("income", self.income), ("expenses", self.expenses), ("credits", self.credits)) if not ok]

    @property
    def state(self) -> str:
        if self.steps_done == 0:
            return "new"
        if self.steps_done < 3:
            return "partial"
        return "complete"


def completeness(profile: FinancialProfile, credits: list[Credit]) -> Completeness:
    return Completeness(
        income=income_total(profile) > 0,
        expenses=profile.expenses_set,
        credits=bool(credits) or profile.no_credits,
    )


def snapshot(profile: FinancialProfile, credits: list[Credit], extra_payment: int = 0, payments_override: int | None = None) -> FinanceSnapshot:
    income = income_total(profile)
    expenses = expenses_total(profile)
    payments = (payments_total(credits) if payments_override is None else payments_override) + extra_payment
    active = [c for c in credits if c.status == "active"]
    return FinanceSnapshot(
        income=income,
        expenses=expenses,
        payments=payments,
        load=share(payments, income),
        free=income - expenses - payments,
        credits_count=len(active),
    )


# ---------------------------------------------------------------- credits


def remaining_payments(c: Credit) -> int | None:
    if c.payments_total is not None:
        return max(c.payments_total - c.payments_made, 0)
    if c.type == "credit_card" or c.monthly_payment <= 0:
        return None
    return -(-c.balance // c.monthly_payment)  # ceil


def overpayment_rate(c: Credit) -> float | None:
    if c.overpayment is not None and c.original_amount:
        return c.overpayment / c.original_amount
    return None


def cost_key(c: Credit) -> tuple[float, int]:
    """Sort key: most expensive debt first.

    Explicit overpayment data is normalised per month so a 14% overpayment over 5 months
    (microloan) ranks above 14% over 5 years (auto loan).
    """
    rate = overpayment_rate(c)
    months = c.payments_total or 12
    monthly_rate = (rate / months) if rate is not None else None
    return (monthly_rate if monthly_rate is not None else -1.0, TYPE_COST_RANK[c.type])


def most_expensive(credits: list[Credit]) -> Credit | None:
    active = [c for c in credits if c.status == "active"]
    if not active:
        return None
    return max(active, key=lambda c: (TYPE_COST_RANK[c.type] >= 5, cost_key(c)))


def schedule(c: Credit, limit: int = 12) -> list[dict]:
    """Upcoming payments: [{date, amount, last}]."""
    if c.status != "active" or not c.next_payment_date:
        return []
    left = remaining_payments(c)
    count = min(left if left is not None else limit, limit)
    items = []
    for i in range(count):
        is_last = left is not None and i == left - 1
        amount = c.last_payment_amount if (is_last and c.last_payment_amount) else c.monthly_payment
        items.append({"date": add_months(c.next_payment_date, i), "amount": amount, "last": is_last})
    return items


def end_date(c: Credit) -> date | None:
    if c.last_payment_date:
        return c.last_payment_date
    left = remaining_payments(c)
    if left and c.next_payment_date:
        return add_months(c.next_payment_date, left - 1)
    return None


def credit_view(c: Credit, today: date, all_credits: list[Credit]) -> dict:
    """Credit plus everything the UI derives from it."""
    days_until = (c.next_payment_date - today).days if c.next_payment_date else None
    overdue_days = -days_until if (days_until is not None and days_until < 0 and c.status == "active") else 0
    expensive = most_expensive(all_credits)
    flags: list[str] = []
    if expensive and expensive.id == c.id and TYPE_COST_RANK[c.type] >= 5:
        flags.append("most_expensive")
    if days_until is not None and 0 <= days_until <= 3:
        flags.append("due_soon")
    stale = (today - c.data_as_of).days > settings.stale_after_days
    if c.status == "closed":
        status = "closed"
    elif overdue_days:
        status = "overdue"
    elif "most_expensive" in flags:
        status = "attention"
    else:
        status = "active"
    left = remaining_payments(c)
    return {
        **c.model_dump(),
        "status": status,
        "days_until_next": days_until,
        "overdue_days": overdue_days,
        "flags": flags,
        "stale": stale,
        "remaining_payments": left,
        "overpayment_rate": overpayment_rate(c),
        "end_date": end_date(c),
        "schedule": schedule(c),
    }


# ---------------------------------------------------------------- forecasts


def principal_share(c: Credit) -> float:
    if c.overpayment is not None and c.original_amount:
        return c.original_amount / (c.original_amount + c.overpayment)
    return PRINCIPAL_SHARE[c.type]


def forecast(credits: list[Credit], months: int, extra: dict[str, int] | None = None, extra_from: int = 0) -> list[dict]:
    """Month-by-month debt and payments with no new debt.

    `extra` maps credit id → additional monthly payment applied from month index `extra_from`.
    Returns [{i, debt, payments}] for i = 0 (now) .. months.
    """
    state = []
    for c in credits:
        if c.status != "active":
            continue
        state.append({"c": c, "balance": float(c.balance), "left": remaining_payments(c)})
    out = [{"i": 0, "debt": round(sum(s["balance"] for s in state)), "payments": sum(s["c"].monthly_payment for s in state)}]
    for i in range(1, months + 1):
        for s in state:
            c: Credit = s["c"]
            if s["balance"] <= 0:
                continue
            pay = c.monthly_payment + ((extra or {}).get(c.id, 0) if i > extra_from else 0)
            s["balance"] -= pay * principal_share(c)
            if s["left"] is not None:
                s["left"] -= 1
                if s["left"] <= 0:
                    s["balance"] = 0
            s["balance"] = max(s["balance"], 0)
        payments = sum(
            s["c"].monthly_payment for s in state if s["balance"] > 0 and (s["left"] is None or s["left"] > 0)
        )
        out.append({"i": i, "debt": round(sum(s["balance"] for s in state)), "payments": payments})
    return out
