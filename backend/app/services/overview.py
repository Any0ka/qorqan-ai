"""«Обзор» (dashboard) and «Финансовый план»."""

from __future__ import annotations

from datetime import date

from app.db.repositories import Repositories
from app.models import Credit, FinancialProfile, Goal
from app.services import finance as fin
from app.services import scenarios as sc

PLAN_TARGET_LOAD = 0.35
CARD_EXTRA_PAYMENT = 20_000


def _credit_label(c: Credit) -> dict:
    return {"credit_id": c.id, "organization": c.organization, "type": c.type}


def data_updated_at(profile: FinancialProfile, credits: list[Credit]):
    stamps = [d for d in (profile.incomes_updated_at, profile.expenses_updated_at) if d]
    stamps += [c.updated_at for c in credits]
    return max(stamps) if stamps else None


def relief(credits: list[Credit], income: int) -> dict | None:
    """The credit whose closing lowers the load fastest, and the load after it closes."""
    closing = sc.closable_credit(credits)
    if not closing:
        return None
    payments = fin.payments_total(credits)
    return {
        **_credit_label(closing),
        "remaining": fin.remaining_payments(closing),
        "end_date": fin.end_date(closing),
        "load_after": fin.share(payments - closing.monthly_payment, income),
        "freed": closing.monthly_payment,
    }


def dashboard(repos: Repositories, user_id: str, today: date) -> dict:
    profile = repos.profiles.get(user_id)
    credits = repos.credits.list(user_id)
    comp = fin.completeness(profile, credits)
    snap = fin.snapshot(profile, credits)
    zone = fin.load_zone(snap.load)
    income = snap.income

    history = repos.snapshots.list(user_id)
    load_change = None
    if history:
        first = history[0]
        load_change = {"pp": fin.pct(snap.load) - fin.pct(first.load), "since": first.month}

    rel = relief(credits, income) if comp.state == "complete" else None
    recommendation = None
    if comp.state == "complete" and credits:
        if zone == "high":
            recommendation = {"code": "refrain_new_credit", "params": rel or {}}
        elif zone == "caution":
            recommendation = {"code": "careful_new_credit", "params": {"free": snap.free, **(rel or {})}}
        else:
            recommendation = {"code": "stable_keep_reserve", "params": {"free": snap.free}}

    # Debt: actual months from snapshots + forecast without new debt.
    debt_series = [
        {"month": h.month, "debt": h.debt, "kind": "actual", "event": h.event, "event_amount": h.event_amount}
        for h in history
    ]
    now_month = fin.month_start(today)
    if credits:
        if not debt_series or debt_series[-1]["month"] != now_month:
            debt_series.append({"month": now_month, "debt": fin.debt_total(credits), "kind": "actual", "event": None, "event_amount": None})
        else:
            debt_series[-1]["debt"] = fin.debt_total(credits)
        for point in fin.forecast(credits, 6)[1:]:
            debt_series.append({
                "month": fin.add_months(now_month, point["i"]), "debt": point["debt"], "kind": "forecast",
                "event": None, "event_amount": None,
            })
    load_series = [{"month": h.month, "load": h.load} for h in history]
    if credits and income:
        if load_series and load_series[-1]["month"] == now_month:
            load_series[-1]["load"] = snap.load
        else:
            load_series.append({"month": now_month, "load": snap.load})

    upcoming = []
    for c in credits:
        if c.next_payment_date:
            upcoming.append({
                **_credit_label(c),
                "date": c.next_payment_date,
                "amount": c.monthly_payment,
                "days_until": (c.next_payment_date - today).days,
                "is_minimum": c.is_minimum_payment,
            })
    upcoming.sort(key=lambda u: u["date"])

    expensive = fin.most_expensive(credits)
    split = sorted(
        (
            {**_credit_label(c), "amount": c.monthly_payment, "share": fin.share(c.monthly_payment, snap.payments),
             "most_expensive": bool(expensive and expensive.id == c.id and fin.TYPE_COST_RANK[c.type] >= 5)}
            for c in credits
        ),
        key=lambda s: -s["amount"],
    )

    return {
        "state": comp.state,
        "completeness": {
            "income": comp.income, "expenses": comp.expenses, "credits": comp.credits,
            "percent": comp.percent, "steps_done": comp.steps_done, "missing": comp.missing,
        },
        "no_credits": profile.no_credits,
        "updated_at": data_updated_at(profile, credits),
        "sources": {
            "credits_from_report": any(c.source == "report" for c in credits),
            "credits_manual": any(c.source == "manual" for c in credits),
            "incomes_manual": comp.income,
        },
        "metrics": {
            "income": income,
            "expenses": snap.expenses,
            "monthly_payments": snap.payments,
            "total_debt": fin.debt_total(credits),
            "load": snap.load,
            "free": snap.free,
            "credits_count": snap.credits_count,
            "zone": zone,
            "free_before_credits": income - snap.expenses,
        },
        "load_change": load_change,
        "recommendation": recommendation,
        "relief": rel,
        "debt_series": debt_series,
        "load_series": load_series,
        "upcoming": upcoming,
        "split": split,
    }


# ------------------------------------------------------------------ plan


def _priority_advice(c: Credit, rank: int) -> str:
    if c.type == "microloan":
        return "pay_on_schedule_close"
    if c.type == "credit_card":
        return "pay_above_minimum"
    if c.type in ("cash_loan", "other"):
        return "early_repay_later"
    return "keep_schedule"


def _goal_view(g: Goal, credits: list[Credit], load: float) -> dict:
    view = g.model_dump()
    if g.kind == "close_credit":
        c = next((c for c in credits if c.id == g.params.get("credit_id")), None)
        if c and c.payments_total:
            view["current"], view["target"] = c.payments_made, c.payments_total
        elif c is None:
            view["status"] = "done"
            view["current"] = view["target"] = g.target or 1
    elif g.kind == "reduce_load":
        view["current"] = load
    view["progress"] = 0.0
    if g.kind == "reduce_load":
        start = g.params.get("start_load", load)
        span = start - g.target
        view["progress"] = max(0.0, min(1.0, (start - load) / span)) if span > 0 else 1.0
    elif view["target"]:
        view["progress"] = max(0.0, min(1.0, view["current"] / view["target"]))
    return view


def plan(repos: Repositories, user_id: str, today: date) -> dict:
    profile = repos.profiles.get(user_id)
    credits = repos.credits.list(user_id)
    snap = fin.snapshot(profile, credits)
    income = snap.income
    meta = repos.plan_meta.get(user_id)
    now_month = fin.month_start(today)

    card = next((c for c in credits if c.type == "credit_card"), None)
    closing = sc.closable_credit(credits)
    extra_from = fin.remaining_payments(closing) if closing else 0
    extra = {card.id: CARD_EXTRA_PAYMENT} if card else {}
    fc = fin.forecast(credits, 12, extra=extra, extra_from=extra_from or 0)

    load_path = [{"month": fin.add_months(now_month, p["i"]), "load": fin.share(p["payments"], income)} for p in fc]
    target_month = next((p["month"] for p in load_path if p["load"] <= PLAN_TARGET_LOAD), None)

    upcoming = sorted((c for c in credits if c.next_payment_date), key=lambda c: c.next_payment_date)
    next_step = None
    if upcoming:
        c = upcoming[0]
        next_step = {**_credit_label(c), "amount": c.monthly_payment, "date": c.next_payment_date,
                     "days_until": (c.next_payment_date - today).days}

    ranked = sorted(credits, key=lambda c: (fin.TYPE_COST_RANK[c.type], fin.cost_key(c)), reverse=True)
    priorities = []
    for i, c in enumerate(ranked, start=1):
        priorities.append({
            **_credit_label(c),
            "rank": i,
            "advice": _priority_advice(c, i),
            "end_date": fin.end_date(c),
            "remaining": fin.remaining_payments(c),
            "extra": CARD_EXTRA_PAYMENT if c.type == "credit_card" else None,
            "extra_from": fin.add_months(now_month, extra_from) if (c.type == "credit_card" and closing) else None,
        })

    start_debt = meta.get("start_debt", fin.debt_total(credits))
    started_at = meta.get("started_at")
    return {
        "started_at": started_at,
        "recalculated_at": data_updated_at(profile, credits),
        "progress": {
            "start_debt": start_debt,
            "debt": fin.debt_total(credits),
            "debt_change": fin.debt_total(credits) - start_debt,
            "months_since_start": ((today - started_at).days / 30.4) if started_at else 0,
            "load": snap.load,
            "target_load": PLAN_TARGET_LOAD,
            "target_month": target_month,
            "load_path": load_path,
            "relief": relief(credits, income),
        },
        "next_step": next_step,
        "forecast": [{"month": fin.add_months(now_month, p["i"]), "debt": p["debt"]} for p in fc],
        "priorities": priorities,
        "goals": [_goal_view(g, credits, snap.load) for g in repos.goals.list(user_id)],
        "recommendations": [r.model_dump() for r in repos.recommendations.list(user_id)],
    }
