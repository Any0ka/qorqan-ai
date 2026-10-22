"""Demo accounts, loaded into memory on startup.

TODO: Database — move this into a fixtures/seed script that runs against a dev database
(e.g. `python -m app.seed`), never on production startup.

All demo passwords: qorgan2026
  +7 701 234 56 78  Айгерим — full profile, high debt load (main design scenario)
  +7 701 555 01 01  Мадина  — new account without data
  +7 701 777 00 00  Ерлан   — low load: purchases come out green / yellow
  +7 701 999 00 00  Данияр  — overdue microloan and a stale credit report
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, time, timedelta

from app.db.repositories import Repositories
from app.models import (
    Consent, ConsentEvent, Conversation, Credit, CreditReport, Expense, FinancialProfile, Goal, Income,
    MonthlySnapshot, ParsedObligation, PlanRecommendation, Purchase, User,
)
from app.security import hash_password
from app.services import assistant
from app.services import assessment as assess_svc
from app.services import finance as fin
from app.services.notifications import notify

DEMO_PASSWORD = "qorgan2026"


def _id() -> str:
    return uuid.uuid4().hex[:12]


def _at(d: date, hh: int = 10, mm: int = 0) -> datetime:
    return datetime.combine(d, time(hh, mm))


def _user(repos: Repositories, name: str, surname: str, phone: str, email: str | None, color: str, created: date) -> User:
    u = User(id=_id(), name=name, surname=surname, phone=phone, email=email, password_hash=hash_password(DEMO_PASSWORD),
             verified=True, avatar_color=color, created_at=_at(created))
    return repos.users.save(u)


def _consents(repos: Repositories, user_id: str, since: date, report_at: date | None, ai: bool = True,
              report_revoked: bool = False) -> None:
    def save(c: Consent):
        repos.consents.save(user_id, c)

    save(Consent(type="personal_data", required=True, status="active", since=_at(since)))
    repos.consents.add_event(ConsentEvent(user_id=user_id, type="personal_data", action="granted", at=_at(since)))
    if ai:
        save(Consent(type="ai_analysis", required=False, status="active", since=_at(since, 10, 5)))
        repos.consents.add_event(ConsentEvent(user_id=user_id, type="ai_analysis", action="granted", at=_at(since, 10, 5)))
    else:
        save(Consent(type="ai_analysis", required=False, status="off"))
    if report_at:
        save(Consent(type="credit_report", required=False, status="active", since=_at(report_at)))
        repos.consents.add_event(ConsentEvent(user_id=user_id, type="credit_report", action="granted", at=_at(report_at)))
    else:
        save(Consent(type="credit_report", required=False, status="off"))
    save(Consent(type="auto_update", required=False, status="not_connected"))
    save(Consent(type="marketing_email", required=False, status="off"))


def _credit(user_id: str, org: str, type_: str, source: str, balance: int, payment: int, as_of: date, **kw) -> Credit:
    now = _at(as_of)
    return Credit(id=_id(), user_id=user_id, organization=org, type=type_, source=source, balance=balance,
                  monthly_payment=payment, data_as_of=as_of, created_at=now, updated_at=now, **kw)


def _standard_profile(user_id: str, at: date) -> FinancialProfile:
    return FinancialProfile(
        user_id=user_id,
        incomes=[Income(id=_id(), source="Зарплата", amount=400_000, frequency="monthly"),
                 Income(id=_id(), source="Подработка", amount=50_000, frequency="irregular")],
        expenses=[Expense(id=_id(), category="rent", amount=90_000), Expense(id=_id(), category="utilities", amount=18_000),
                  Expense(id=_id(), category="food", amount=45_000), Expense(id=_id(), category="transport", amount=12_000),
                  Expense(id=_id(), category="telecom", amount=10_000), Expense(id=_id(), category="other", amount=0)],
        expenses_set=True, incomes_updated_at=_at(at, 12, 40), expenses_updated_at=_at(at, 12, 44),
        onboarding_step=4, onboarding_completed=True,
    )


def seed_aigerim(repos: Repositories, today: date) -> User:
    data_day = today - timedelta(days=3)
    since = today - timedelta(days=67)
    u = _user(repos, "Айгерим", "Сапарова", "+77012345678", "aigerim@mail.kz", "#14263D", since)
    repos.profiles.save(_standard_profile(u.id, data_day))

    report_id = _id()
    d = lambda days: today + timedelta(days=days)  # noqa: E731
    micro = _credit(u.id, "МФО C", "microloan", "report", 110_000, 45_000, data_day, report_id=report_id,
                    original_amount=180_000, payments_made=2, payments_total=5, overpayment=25_000,
                    next_payment_date=d(3), last_payment_date=fin.add_months(d(3), 2), last_payment_amount=25_000)
    credits = [
        micro,
        _credit(u.id, "Банк A", "cash_loan", "report", 850_000, 52_000, data_day, report_id=report_id,
                original_amount=1_200_000, payments_made=9, payments_total=30, overpayment=360_000, next_payment_date=d(8)),
        _credit(u.id, "Банк B", "installment", "manual", 420_000, 35_000, data_day, original_amount=525_000,
                payments_made=3, payments_total=15, overpayment=0, next_payment_date=d(11)),
        _credit(u.id, "Банк B", "credit_card", "report", 130_000, 20_000, data_day, report_id=report_id,
                is_minimum_payment=True, next_payment_date=d(15)),
        _credit(u.id, "Банк D", "auto_loan", "report", 1_940_000, 58_000, data_day, report_id=report_id,
                original_amount=2_900_000, payments_made=22, payments_total=60, overpayment=580_000, next_payment_date=d(19)),
    ]
    for c in credits:
        repos.credits.save(c)
    repos.reports.save(CreditReport(
        id=report_id, user_id=u.id, filename="kreditnyi-otchet-14-10.pdf", size_bytes=1_260_000,
        uploaded_at=_at(data_day, 12, 30), status="processed", confirmed=True,
        obligations=[ParsedObligation(id=c.id, organization=c.organization, type=c.type, balance=c.balance,
                                      monthly_payment=c.monthly_payment) for c in credits if c.source == "report"],
    ))
    _consents(repos, u.id, since, data_day)

    m0 = fin.month_start(today)
    history = [(5, 3_495_000, 0.38, None, None), (4, 3_345_000, 0.39, None, None),
               (3, 3_720_000, 0.46, "installment_added", 525_000), (2, 3_750_000, 0.47, "microloan_added", 180_000),
               (1, 3_600_000, 0.47, None, None)]
    repos.snapshots.replace(u.id, [MonthlySnapshot(month=fin.add_months(m0, -k), debt=debt, load=load, event=ev, event_amount=amt)
                                   for k, debt, load, ev, amt in history])
    repos.plan_meta.save(u.id, {"started_at": today - timedelta(days=78), "start_debt": 3_720_000})

    close_month = fin.add_months(m0, 3)
    for g in (
        Goal(id=_id(), user_id=u.id, kind="close_credit", params={"credit_id": micro.id, "organization": "МФО C", "credit_type": "microloan"},
             target_date=micro.last_payment_date, current=2, target=5, created_at=_at(since)),
        Goal(id=_id(), user_id=u.id, kind="reduce_load", params={"start_load": 0.47, "starts": close_month},
             target_date=fin.add_months(m0, 7), current=0.47, target=0.35, created_at=_at(since)),
        Goal(id=_id(), user_id=u.id, kind="save_for", params={"item": "smartphone", "monthly": 20_000}, source="scenario",
             target_date=fin.add_months(m0, 9), current=0, target=420_000, created_at=_at(data_day)),
        Goal(id=_id(), user_id=u.id, kind="reserve", params={"after": "smartphone"}, status="planned", target=150_000,
             created_at=_at(data_day)),
    ):
        repos.goals.save(g)
    for i, r in enumerate((
        PlanRecommendation(id=_id(), user_id=u.id, code="no_new_credit_until", params={"month": close_month}, created_at=_at(data_day)),
        PlanRecommendation(id=_id(), user_id=u.id, code="card_extra_payment",
                           params={"amount": 20_000, "from": close_month, "until": fin.add_months(m0, 6)},
                           status="in_plan", actions=[], created_at=_at(data_day)),
        PlanRecommendation(id=_id(), user_id=u.id, code="update_income_monthly", params={}, actions=["remind"], created_at=_at(data_day)),
    )):
        r.created_at += timedelta(minutes=i)
        repos.recommendations.save(r)

    _seed_notifications(repos, u.id, today, micro)

    check = assess_svc.assess(repos, u.id, Purchase(title="Смартфон", category="smartphone", price=840_000, kind="installment",
                                                    term_months=12), today)
    check.created_at = _at(today - timedelta(days=1), 19, 10)
    check.saved = True
    repos.assessments.save(check)

    profile = repos.profiles.get(u.id)
    ctx = assistant.Context(profile, repos.credits.list(u.id), check, allowed=True, today=today)
    convo = Conversation(id=_id(), user_id=u.id, created_at=_at(today - timedelta(days=1), 19, 20))
    greeting = assistant.greeting(ctx, "ru")
    convo.messages.append(greeting)
    for q in ("Какой кредит лучше погасить первым?", "А смартфон за 840 000 ₸ в рассрочку на 12 месяцев — потяну?"):
        convo.messages.append(assistant.ChatMessage(id=_id(), role="user", text=q, created_at=datetime.now()))
        convo.messages.append(assistant.reply(q, ctx, "ru"))
    repos.conversations.save(convo)
    return u


def _seed_notifications(repos: Repositories, user_id: str, today: date, micro: Credit) -> None:
    notify(repos, user_id, "payment", "payment_due_soon",
           {"credit_id": micro.id, "organization": micro.organization, "credit_type": micro.type,
            "amount": micro.monthly_payment, "date": micro.next_payment_date.isoformat(), "days": 3},
           [{"code": "open_credit", "to": f"/credits?id={micro.id}"}, {"code": "mark_paid", "to": f"credit:{micro.id}"}],
           at=_at(today, 9, 0))
    notify(repos, user_id, "payment", "payments_higher_next_month",
           {"extra": 20_000, "reason": "auto_insurance", "total": 230_000, "usual": 210_000},
           [{"code": "view_budget", "to": "/dashboard"}], at=_at(today, 8, 30))
    notify(repos, user_id, "recommendation", "plan_recommendation_new",
           {"amount": 20_000, "from": fin.add_months(fin.month_start(today), 3).isoformat(),
            "until": fin.add_months(fin.month_start(today), 6).isoformat()},
           [{"code": "open_plan", "to": "/plan"}], at=_at(today, 8, 0))
    notify(repos, user_id, "load", "load_high_streak",
           {"months": 3, "load": 0.47, "credit_id": micro.id, "organization": micro.organization, "credit_type": micro.type},
           at=_at(today - timedelta(days=2)), read=True)
    notify(repos, user_id, "data", "confirm_irregular_income", {"source": "Подработка"},
           [{"code": "update_income", "to": "/profile?section=finance"}], at=_at(today - timedelta(days=3)), read=True)
    notify(repos, user_id, "goal", "goal_progress",
           {"goal": "close_credit", "organization": micro.organization, "credit_type": micro.type, "done": 2, "total": 5,
            "last_date": micro.last_payment_date.isoformat()}, at=_at(today - timedelta(days=5)), read=True)
    notify(repos, user_id, "data", "report_processed", {"found": 4, "manual": 1}, at=_at(today - timedelta(days=9)), read=True)


def seed_madina(repos: Repositories, today: date) -> User:
    u = _user(repos, "Мадина", "Жумабаева", "+77015550101", None, "#2E4A6B", today - timedelta(days=1))
    repos.profiles.save(FinancialProfile(user_id=u.id))
    _consents(repos, u.id, today - timedelta(days=1), None, ai=False)
    return u


def seed_erlan(repos: Repositories, today: date) -> User:
    data_day = today - timedelta(days=2)
    u = _user(repos, "Ерлан", "Касымов", "+77017770000", "erlan@mail.kz", "#456285", today - timedelta(days=40))
    repos.profiles.save(FinancialProfile(
        user_id=u.id,
        incomes=[Income(id=_id(), source="Зарплата", amount=520_000)],
        expenses=[Expense(id=_id(), category="rent", amount=120_000), Expense(id=_id(), category="utilities", amount=15_000),
                  Expense(id=_id(), category="food", amount=60_000), Expense(id=_id(), category="transport", amount=10_000),
                  Expense(id=_id(), category="telecom", amount=5_000)],
        expenses_set=True, incomes_updated_at=_at(data_day), expenses_updated_at=_at(data_day),
        onboarding_step=4, onboarding_completed=True,
    ))
    report_id = _id()
    repos.credits.save(_credit(u.id, "Банк D", "auto_loan", "report", 1_480_000, 62_000, data_day, report_id=report_id,
                               original_amount=2_400_000, payments_made=18, payments_total=48, overpayment=576_000,
                               next_payment_date=today + timedelta(days=12)))
    repos.reports.save(CreditReport(id=report_id, user_id=u.id, filename="report.pdf", size_bytes=980_000,
                                    uploaded_at=_at(data_day), status="processed", confirmed=True))
    _consents(repos, u.id, today - timedelta(days=40), data_day)
    return u


def seed_daniyar(repos: Repositories, today: date) -> User:
    stale_day = today - timedelta(days=50)
    u = _user(repos, "Данияр", "Ахметов", "+77019990000", "daniyar@mail.kz", "#0D7C78", today - timedelta(days=90))
    repos.profiles.save(_standard_profile(u.id, today - timedelta(days=4)))
    report_id = _id()
    d = lambda days: today + timedelta(days=days)  # noqa: E731
    for c in (
        _credit(u.id, "МФО C", "microloan", "report", 155_000, 45_000, stale_day, report_id=report_id, original_amount=180_000,
                payments_made=1, payments_total=5, overpayment=25_000, next_payment_date=d(-4), last_payment_amount=25_000),
        _credit(u.id, "Банк A", "cash_loan", "report", 930_000, 52_000, stale_day, report_id=report_id, next_payment_date=d(8)),
        _credit(u.id, "Банк B", "installment", "manual", 420_000, 35_000, today - timedelta(days=4), payments_made=3,
                payments_total=15, next_payment_date=d(11)),
        _credit(u.id, "Банк B", "credit_card", "report", 125_000, 20_000, stale_day, report_id=report_id,
                is_minimum_payment=True, next_payment_date=d(15)),
        _credit(u.id, "Банк D", "auto_loan", "report", 1_980_000, 58_000, stale_day, report_id=report_id, next_payment_date=d(19)),
    ):
        repos.credits.save(c)
    repos.reports.save(CreditReport(id=report_id, user_id=u.id, filename="otchet-08.pdf", size_bytes=1_100_000,
                                    uploaded_at=_at(stale_day), status="processed", confirmed=True))
    _consents(repos, u.id, today - timedelta(days=90), stale_day)
    return u


def seed(repos: Repositories, today: date | None = None) -> None:
    today = today or date.today()
    if repos.users.get_by_phone("+77012345678"):
        return
    seed_aigerim(repos, today)
    seed_madina(repos, today)
    seed_erlan(repos, today)
    seed_daniyar(repos, today)
