"""Domain entities.

These are the records the in-memory store keeps today.
TODO: Database — turn each entity below into an ORM table (SQLAlchemy model or similar)
with the same fields, plus foreign keys on `user_id` and indexes on the lookup columns
noted next to each class.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

Lang = Literal["ru", "kk"]
RiskLevel = Literal["low", "medium", "high", "insufficient"]
LoadZone = Literal["stable", "caution", "high"]

CreditType = Literal["cash_loan", "installment", "microloan", "credit_card", "auto_loan", "mortgage", "other"]
CreditSource = Literal["report", "manual"]
FinancingKind = Literal["credit", "installment", "microloan", "credit_card", "own"]
PurchaseCategory = Literal["smartphone", "appliances", "furniture", "car", "laptop", "other"]
ExpenseCategory = Literal["rent", "utilities", "food", "transport", "telecom", "other"]
IncomeFrequency = Literal["monthly", "irregular"]

NotificationCategory = Literal["payment", "load", "data", "goal", "recommendation"]
ConsentType = Literal["personal_data", "credit_report", "ai_analysis", "auto_update", "marketing_email", "terms"]


class User(BaseModel):
    # TODO: Database — table `users`; unique indexes on `phone` and `email`.
    id: str
    name: str
    surname: str | None = None
    phone: str  # normalized: +7XXXXXXXXXX
    email: str | None = None
    password_hash: str
    language: Lang = "ru"
    verified: bool = False
    avatar_color: str = "#14263D"
    created_at: datetime


class Income(BaseModel):
    id: str
    source: str
    amount: int = Field(ge=0)
    frequency: IncomeFrequency = "monthly"


class Expense(BaseModel):
    id: str
    category: ExpenseCategory
    label: str | None = None
    amount: int = Field(ge=0)


class FinancialProfile(BaseModel):
    # TODO: Database — table `financial_profiles` (1:1 with users) plus child tables
    # `incomes` and `expenses` (1:N, FK user_id).
    user_id: str
    incomes: list[Income] = []
    expenses: list[Expense] = []
    expenses_set: bool = False
    no_credits: bool = False
    incomes_updated_at: datetime | None = None
    expenses_updated_at: datetime | None = None
    onboarding_step: int = 1
    onboarding_completed: bool = False


class Credit(BaseModel):
    # TODO: Database — table `credits`; index on (user_id, status) and (user_id, next_payment_date).
    id: str
    user_id: str
    organization: str
    type: CreditType
    source: CreditSource
    report_id: str | None = None
    balance: int = Field(ge=0)
    monthly_payment: int = Field(ge=0)
    is_minimum_payment: bool = False
    original_amount: int | None = None
    rate: float | None = None  # % per year, if known
    payments_made: int = 0
    payments_total: int | None = None
    next_payment_date: date | None = None
    last_payment_date: date | None = None
    last_payment_amount: int | None = None
    overpayment: int | None = None  # total overpayment over the full term, ₸
    corrected_manually: bool = False
    corrected_fields: list[str] = []
    report_values: dict[str, Any] = {}  # values as read from the bureau report
    data_as_of: date
    status: Literal["active", "closed"] = "active"
    created_at: datetime
    updated_at: datetime


class ParsedObligation(BaseModel):
    id: str
    organization: str
    type: CreditType
    balance: int
    monthly_payment: int
    original_amount: int | None = None
    payments_made: int = 0
    payments_total: int | None = None
    next_payment_date: date | None = None
    last_payment_date: date | None = None
    overpayment: int | None = None
    is_minimum_payment: bool = False
    partial: bool = False  # recognised only partially; the user should check it


class CreditReport(BaseModel):
    # TODO: Database — table `credit_reports`; the uploaded file itself belongs in object storage,
    # only metadata here. Rows must be deleted when the `credit_report` consent is revoked.
    id: str
    user_id: str
    filename: str
    size_bytes: int
    uploaded_at: datetime
    status: Literal["processed", "failed"]
    error_code: Literal["no_text", "encrypted", "not_a_report", "not_pdf", "too_large"] | None = None
    obligations: list[ParsedObligation] = []
    confirmed: bool = False


class Purchase(BaseModel):
    title: str
    category: PurchaseCategory = "other"
    price: int = Field(ge=0)
    kind: FinancingKind
    down_payment: int = Field(default=0, ge=0)
    term_months: int = Field(default=12, ge=1, le=360)
    monthly_payment: int | None = Field(default=None, ge=0)  # None → calculated by qorgan
    fees: int = Field(default=0, ge=0)


class Reason(BaseModel):
    code: str
    params: dict[str, Any] = {}


class FinanceSnapshot(BaseModel):
    income: int
    expenses: int
    payments: int
    load: float  # share of income, 0..1+
    free: int
    credits_count: int


class Assessment(BaseModel):
    # TODO: Database — table `assessments` (purchase, before/after snapshots and reasons as JSONB);
    # index on (user_id, created_at desc) for the "История оценок" list.
    id: str
    user_id: str
    created_at: datetime
    purchase: Purchase
    monthly_payment: int
    monthly_auto: bool
    total_cost: int
    risk: RiskLevel
    before: FinanceSnapshot | None
    after: FinanceSnapshot | None
    reasons: list[Reason] = []
    missing: list[Literal["income", "expenses", "credits"]] = []
    alternative: dict[str, Any] | None = None
    softer_options: list[dict[str, Any]] = []
    tips: list[str] = []
    data_sources: dict[str, Any] = {}
    saved: bool = False


class Goal(BaseModel):
    # TODO: Database — table `goals` (FK user_id).
    id: str
    user_id: str
    kind: Literal["close_credit", "reduce_load", "save_for", "reserve", "custom"]
    title: str | None = None  # free text for custom goals
    params: dict[str, Any] = {}
    target_date: date | None = None
    current: float = 0
    target: float = 0
    status: Literal["active", "planned", "done"] = "active"
    source: Literal["system", "scenario", "user"] = "system"
    created_at: datetime


class PlanRecommendation(BaseModel):
    # TODO: Database — table `plan_recommendations` (FK user_id).
    id: str
    user_id: str
    code: str
    params: dict[str, Any] = {}
    status: Literal["pending", "accepted", "dismissed", "in_plan", "reminder_on"] = "pending"
    actions: list[Literal["accept", "dismiss", "remind"]] = ["accept", "dismiss"]
    created_at: datetime


class Notification(BaseModel):
    # TODO: Database — table `notifications`; index on (user_id, created_at desc) and (user_id, read).
    id: str
    user_id: str
    category: NotificationCategory
    code: str
    params: dict[str, Any] = {}
    created_at: datetime
    read: bool = False
    actions: list[dict[str, str]] = []  # [{code, to}] — `to` is an app route


class NotificationSettings(BaseModel):
    # TODO: Database — table `notification_settings` (1:1 with users).
    payment_reminders: bool = True
    load_changes: bool = True
    data_updates: bool = True
    goals_progress: bool = True
    recommendations: bool = True
    channel_app: bool = True  # always on
    channel_browser: bool = False
    channel_email: bool = True


class Consent(BaseModel):
    # TODO: Database — table `consents`; one row per (user_id, type).
    type: ConsentType
    required: bool
    status: Literal["active", "revoked", "not_connected", "off"]
    since: datetime | None = None
    revoked_at: datetime | None = None


class ConsentEvent(BaseModel):
    # TODO: Database — append-only table `consent_events` (audit log, never updated or deleted
    # except when the account itself is deleted).
    user_id: str
    type: ConsentType
    action: Literal["granted", "revoked"]
    at: datetime


class ChatBlock(BaseModel):
    type: Literal["steps", "verdict", "compare", "list"]
    data: dict[str, Any] = {}


class ChatLink(BaseModel):
    label: str
    to: str
    primary: bool = False


class ChatMessage(BaseModel):
    id: str
    role: Literal["user", "assistant"]
    text: str
    blocks: list[ChatBlock] = []
    links: list[ChatLink] = []
    suggestions: list[str] = []
    created_at: datetime
    pending: bool = False  # user question saved while the assistant was offline


class Conversation(BaseModel):
    # TODO: Database — tables `conversations` and `chat_messages` (FK conversation_id).
    id: str
    user_id: str
    created_at: datetime
    context: dict[str, Any] = {}  # e.g. {"check_id": "..."} for the panel on the check screen
    messages: list[ChatMessage] = []


class MonthlySnapshot(BaseModel):
    # TODO: Database — table `monthly_snapshots` (user_id, month) written by a monthly job;
    # feeds the debt and load history charts.
    month: date  # first day of the month
    debt: int
    load: float
    event: str | None = None  # e.g. "installment_added", "microloan_added"
    event_amount: int | None = None
