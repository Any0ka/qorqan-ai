"""«Проверить решение»: the qorgan assessment of a new credit or installment."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from app.db.repositories import Repositories
from app.models import Assessment, Credit, FinancialProfile, Purchase, Reason
from app.services import finance as fin
from app.services import scenarios as sc


def resolve_monthly(p: Purchase) -> tuple[int, bool]:
    if p.kind == "own":
        return 0, True
    if p.monthly_payment is not None and p.monthly_payment > 0:
        return p.monthly_payment, False
    return sc.monthly_payment(p.price, p.down_payment, p.term_months, p.kind, p.fees), True


def preview(profile: FinancialProfile, credits: list[Credit], p: Purchase) -> dict:
    """Live numbers under the form («Предварительно»)."""
    monthly, auto = resolve_monthly(p)
    comp = fin.completeness(profile, credits)
    before = fin.snapshot(profile, credits)
    after = fin.snapshot(profile, credits, extra_payment=monthly)
    return {
        "monthly_payment": monthly,
        "monthly_auto": auto,
        "total_cost": sc.total_cost(p.price, p.down_payment, p.term_months, p.kind, p.fees) if auto else monthly * p.term_months + p.down_payment + p.fees,
        "new_payment_share": fin.share(monthly, before.income),
        "before": before.model_dump(),
        "after": after.model_dump(),
        "complete": not comp.missing,
        "missing": comp.missing,
    }


def _reasons(risk: str, before, after, p: Purchase, credits: list[Credit]) -> list[Reason]:
    out: list[Reason] = []
    income = before.income
    if risk == "high":
        if before.load >= fin.LOAD_HIGH_MIN:
            out.append(Reason(code="load_already_high", params={"load": before.load, "safe": fin.LOAD_STABLE_MAX, "high": fin.LOAD_HIGH_MIN}))
        elif after.load >= fin.LOAD_HIGH_MIN:
            out.append(Reason(code="load_becomes_high", params={"load": after.load, "high": fin.LOAD_HIGH_MIN}))
        if after.free < 0:
            out.append(Reason(code="free_negative", params={"free": after.free}))
        elif fin.share(after.free, income) < fin.FREE_HIGH_MAX:
            out.append(Reason(code="free_too_low", params={"free": after.free, "share": fin.share(after.free, income)}))
        expensive = fin.most_expensive(credits)
        if expensive and fin.TYPE_COST_RANK[expensive.type] >= 5 and fin.share(after.free, income) < fin.FREE_OK_MIN:
            out.append(Reason(code="borrow_to_pay", params={
                "credit_id": expensive.id, "organization": expensive.organization,
                "credit_type": expensive.type, "remaining": fin.remaining_payments(expensive),
            }))
        if len(out) < 3 and after.load >= fin.LOAD_HIGH_MIN and before.load < fin.LOAD_HIGH_MIN:
            out.append(Reason(code="long_commitment", params={"months": p.term_months, "load": after.load}))
    elif risk == "medium":
        if after.load > fin.LOAD_STABLE_MAX:
            out.append(Reason(code="load_caution", params={"load": after.load, "safe": fin.LOAD_STABLE_MAX}))
        out.append(Reason(code="free_drop", params={"delta": before.free - after.free, "free": after.free}))
        if p.term_months >= 6 and p.kind != "own":
            out.append(Reason(code="long_commitment", params={"months": p.term_months, "load": after.load}))
    return out[:3]


def _tips(p: Purchase) -> list[str]:
    tips = []
    if p.kind == "installment":
        tips.append("check_hidden_fees")
    elif p.kind != "own":
        tips.append("check_full_cost")
    tips.append("set_reminders")
    tips.append("no_new_credit_during_term")
    return tips


def _data_sources(profile: FinancialProfile, credits: list[Credit], repos: Repositories, user_id: str) -> dict:
    report = repos.reports.latest(user_id)
    return {
        "income_updated_at": profile.incomes_updated_at,
        "expenses_updated_at": profile.expenses_updated_at,
        "credits_from_report": sum(1 for c in credits if c.source == "report"),
        "credits_manual": sum(1 for c in credits if c.source == "manual"),
        "report_date": report.uploaded_at if report else None,
    }


def assess(repos: Repositories, user_id: str, p: Purchase, today: date) -> Assessment:
    profile = repos.profiles.get(user_id)
    credits = repos.credits.list(user_id)
    monthly, auto = resolve_monthly(p)
    comp = fin.completeness(profile, credits)
    total = sc.total_cost(p.price, p.down_payment, p.term_months, p.kind, p.fees) if auto else monthly * p.term_months + p.down_payment + p.fees

    a = Assessment(
        id=uuid.uuid4().hex[:12],
        user_id=user_id,
        created_at=datetime.now(),
        purchase=p,
        monthly_payment=monthly,
        monthly_auto=auto,
        total_cost=total,
        risk="insufficient",
        before=None,
        after=None,
        data_sources=_data_sources(profile, credits, repos, user_id),
    )
    if comp.missing:
        a.missing = comp.missing  # type: ignore[assignment]
        if comp.income:
            income = fin.income_total(profile)
            a.reasons = [Reason(code="new_payment_share", params={"share": fin.share(monthly, income), "monthly": monthly})]
        # TODO: Database — persist the assessment (repos.assessments.save below writes to memory).
        return repos.assessments.save(a)

    before = fin.snapshot(profile, credits)
    after = fin.snapshot(profile, credits, extra_payment=monthly)
    a.before, a.after = before, after
    if p.kind == "own":
        a.risk = "low" if fin.share(before.free, before.income) >= fin.FREE_HIGH_MAX else "medium"
    else:
        a.risk = fin.risk_level(after.load, after.free, after.income)
    a.reasons = _reasons(a.risk, before, after, p, credits)

    options = sc.build(profile, credits, p.model_copy(update={"monthly_payment": monthly}), today)
    if a.risk == "high" and options["recommended"]:
        rec = next(o for o in options["options"] if o["code"] == options["recommended"])
        a.alternative = {
            "code": rec["code"],
            "months_until_purchase": rec["months_until_purchase"],
            "load": rec["load"],
            "free": rec["free"],
            "price": rec["price"],
            "term_months": rec["term_months"],
            "saving_monthly": rec.get("saving_monthly"),
            "new_debt": rec["new_debt"],
            "closing_credit": rec.get("closing_credit"),
        }
    elif a.risk == "medium":
        softer = [o for o in options["options"] if o["code"] != "original" and o["load"] < after.load and o.get("feasible", True)]
        softer.sort(key=lambda o: (sc.RISK_ORDER[o["risk"]], o["months_until_purchase"] or 0))
        a.softer_options = [
            {k: o.get(k) for k in ("code", "price", "monthly_payment", "load", "free", "total_cost", "term_months",
                                    "months_until_purchase", "risk", "recommended")}
            for o in softer[:2]
        ]
        if a.softer_options:
            a.softer_options[0]["recommended"] = True
    elif a.risk == "low":
        a.tips = _tips(p)

    if p.kind != "own" and a.risk == "low":
        a.reasons.append(Reason(code="after_term", params={"months": p.term_months, "load": before.load}))

    # TODO: Database — persist the assessment.
    return repos.assessments.save(a)
