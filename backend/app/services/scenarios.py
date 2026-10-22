"""Alternatives to a purchase: other terms, cheaper model, waiting, saving up."""

from __future__ import annotations

import math
from datetime import date

from app.models import Credit, FinancialProfile, FinancingKind, Purchase, RiskLevel
from app.services import finance as fin

RISK_ORDER: dict[RiskLevel, int] = {"low": 0, "medium": 1, "high": 2, "insufficient": 3}

# Conditional markups (shown to the user as assumptions under the scenarios table).
CREDIT_MARKUP_PER_YEAR = 0.14
MICROLOAN_MARKUP_PER_MONTH = 0.028
CARD_MARKUP_PER_MONTH = 0.025
INSTALLMENT_MARKUP = {24: 0.10, 36: 0.15}


def markup(kind: FinancingKind, term: int) -> float:
    if kind == "own":
        return 0.0
    if kind == "installment":
        return INSTALLMENT_MARKUP.get(term, 0.10 if term > 24 else 0.0)
    if kind == "credit":
        return CREDIT_MARKUP_PER_YEAR * term / 12
    if kind == "microloan":
        return MICROLOAN_MARKUP_PER_MONTH * term
    return CARD_MARKUP_PER_MONTH * term


def round_to(x: float, step: int = 100) -> int:
    return int(round(x / step) * step)


def floor_to(x: float, step: int) -> int:
    return int(math.floor(x / step) * step)


def monthly_payment(price: int, down: int, term: int, kind: FinancingKind, fees: int = 0) -> int:
    if kind == "own":
        return 0
    principal = max(price - down, 0)
    return round_to((principal * (1 + markup(kind, term)) + fees) / max(term, 1))


def total_cost(price: int, down: int, term: int, kind: FinancingKind, fees: int = 0) -> int:
    if kind == "own":
        return price + fees
    principal = max(price - down, 0)
    return round_to(principal * (1 + markup(kind, term)) + down + fees)


def cheaper_price(price: int) -> int:
    return max(floor_to(price * 0.5, 10_000), 10_000)


def closable_credit(credits: list[Credit], within_months: int = 6) -> Credit | None:
    """The expensive debt that ends soonest — closing it first frees money for the purchase."""
    candidates = []
    for c in credits:
        left = fin.remaining_payments(c)
        if c.status == "active" and left is not None and 0 < left <= within_months and fin.TYPE_COST_RANK[c.type] >= 4:
            candidates.append((left, -fin.TYPE_COST_RANK[c.type], c))
    if not candidates:
        return None
    candidates.sort(key=lambda t: (t[0], t[1]))
    return candidates[0][2]


def _option(code: str, profile: FinancialProfile, base_payments: int, price: int, kind: FinancingKind, term: int,
            down: int = 0, fees: int = 0, months_until: int = 0, monthly_override: int | None = None) -> dict:
    income = fin.income_total(profile)
    expenses = fin.expenses_total(profile)
    monthly = monthly_override if monthly_override is not None else monthly_payment(price, down, term, kind, fees)
    payments = base_payments + monthly
    load = fin.share(payments, income)
    free = income - expenses - payments
    return {
        "code": code,
        "kind": kind,
        "price": price,
        "term_months": term,
        "down_payment": down,
        "monthly_payment": monthly,
        "total_cost": total_cost(price, down, term, kind, fees) if monthly_override is None else monthly * term + down + fees,
        "payments": payments,
        "load": load,
        "free": free,
        "months_until_purchase": months_until,
        "risk": fin.risk_level(load, free, income),
        "new_debt": kind != "own",
    }


def save_plan(profile: FinancialProfile, credits: list[Credit], target: int, today: date) -> dict:
    """Close the closable debt first, then save up for `target` without a new loan."""
    income = fin.income_total(profile)
    expenses = fin.expenses_total(profile)
    payments = fin.payments_total(credits)
    free_now = income - expenses - payments
    closing = closable_credit(credits)
    pre_save = max(round_to(free_now * 0.3, 5_000), 0)
    if closing:
        close_in = fin.remaining_payments(closing) or 0
        freed = closing.monthly_payment
        post_save = freed + max(floor_to(free_now * 0.25, 5_000), 0)
    else:
        close_in, freed = 0, 0
        pre_save = post_save = max(floor_to(free_now * 0.5, 5_000), 0)

    months, saved = 0, 0
    feasible = post_save > 0
    while feasible and saved < target and months < 120:
        months += 1
        saved += pre_save if months <= close_in else post_save
    if saved < target:
        feasible = False

    payments_after = payments - freed
    free_after = income - expenses - payments_after - post_save
    close_month = fin.add_months(fin.month_start(today), close_in) if closing else None
    purchase_month = fin.add_months(fin.month_start(today), months) if feasible else None
    return {
        "code": "save",
        "kind": "own",
        "price": target,
        "term_months": 0,
        "down_payment": 0,
        "monthly_payment": 0,
        "saving_monthly": post_save,
        "pre_saving_monthly": pre_save,
        "total_cost": target,
        "payments": payments_after,
        "load": fin.share(payments_after, income),
        "free": free_after,
        "months_until_purchase": months if feasible else None,
        "risk": "low" if feasible else "high",
        "new_debt": False,
        "feasible": feasible,
        "closing_credit": {
            "id": closing.id, "organization": closing.organization, "type": closing.type,
            "remaining_payments": close_in, "monthly_payment": freed,
        } if closing else None,
        "close_month": close_month,
        "purchase_month": purchase_month,
        "saved_before_close": pre_save * close_in,
        "extra_saving": post_save - freed,
    }


def build(profile: FinancialProfile, credits: list[Credit], purchase: Purchase, today: date) -> dict:
    payments = fin.payments_total(credits)
    p = purchase
    kind: FinancingKind = p.kind if p.kind != "own" else "installment"
    fixed_monthly = p.monthly_payment if p.kind != "own" else None
    original = _option("original", profile, payments, p.price, p.kind, p.term_months, p.down_payment, p.fees,
                       monthly_override=fixed_monthly)

    longer_term = 24 if p.term_months < 24 else 36
    longer = _option("longer_term", profile, payments, p.price, kind, longer_term, p.down_payment, p.fees)
    cheap_price = cheaper_price(p.price)
    cheaper = _option("cheaper", profile, payments, cheap_price, kind, p.term_months)

    closing = closable_credit(credits)
    if closing:
        wait_months = fin.remaining_payments(closing) or 3
        wait = _option("wait", profile, payments - closing.monthly_payment, cheap_price, kind, p.term_months,
                       months_until=wait_months)
        wait["closing_credit"] = {"id": closing.id, "organization": closing.organization, "type": closing.type}
    else:
        down = round_to(p.price * 0.3, 10_000)
        wait = _option("down_payment", profile, payments, p.price, kind, p.term_months, down=down)

    save = save_plan(profile, credits, cheap_price, today)
    options = [original, longer, cheaper, wait, save]

    feasible = [o for o in options if o.get("feasible", True) and o["code"] != "original"]
    recommended = min(feasible, key=lambda o: (RISK_ORDER[o["risk"]], o["months_until_purchase"] or 0), default=None)
    for o in options:
        o["recommended"] = recommended is not None and o["code"] == recommended["code"]

    return {
        "purchase": p.model_dump(),
        "base": {
            "income": fin.income_total(profile),
            "expenses": fin.expenses_total(profile),
            "payments": payments,
        },
        "options": options,
        "recommended": recommended["code"] if recommended else None,
        "path": path_steps(save) if recommended and recommended["code"] == "save" else None,
        "assumptions": {
            "installment_markup_24": INSTALLMENT_MARKUP[24],
            "credit_markup_min": round(markup("credit", 6), 3),
            "credit_markup_max": round(markup("credit", 24), 3),
        },
    }


def path_steps(save: dict) -> list[dict]:
    """The "recommended path" timeline for a save-up scenario."""
    steps = []
    if save["closing_credit"]:
        steps.append({
            "code": "close_and_save",
            "until": fin.add_months(save["close_month"], -1),
            "organization": save["closing_credit"]["organization"],
            "credit_type": save["closing_credit"]["type"],
            "saving": save["pre_saving_monthly"],
            "saved": save["saved_before_close"],
            "saved_by": save["close_month"],
        })
        steps.append({
            "code": "save_more",
            "from": save["close_month"],
            "load": save["load"],
            "freed": save["closing_credit"]["monthly_payment"],
            "extra": save["extra_saving"],
            "saving": save["saving_monthly"],
        })
    else:
        steps.append({"code": "save_monthly", "saving": save["saving_monthly"]})
    if save["purchase_month"]:
        steps.append({"code": "buy", "month": save["purchase_month"], "price": save["price"], "free": save["free"]})
    return steps


def custom(profile: FinancialProfile, credits: list[Credit], price: int, method: str, term: int, down: int,
           start: str, today: date) -> dict:
    """"Собери свой вариант" — recalculated on every change."""
    payments = fin.payments_total(credits)
    if method == "save":
        result = save_plan(profile, credits, max(price - down, 0), today)
        result["advice"] = "save_no_new_debt" if result["feasible"] else "save_not_feasible"
        return result
    kind: FinancingKind = "credit" if method == "credit" else "installment"
    closing = closable_credit(credits) if start == "later" else None
    base = payments - (closing.monthly_payment if closing else 0)
    months_until = (fin.remaining_payments(closing) or 3) if closing else (3 if start == "later" else 0)
    result = _option("custom", profile, base, price, kind, term, down, months_until=months_until)
    result["advice"] = {"high": "too_big", "medium": "ok_after_closing" if start == "later" else "ok_small_reserve", "low": "safe"}[result["risk"]]
    return result
