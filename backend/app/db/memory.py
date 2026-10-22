"""Process-memory stand-in for the database.

TODO: Database — delete this module once the repositories are backed by a real database.
It has no durability, no transactions across requests and no isolation between workers:
run the API with a single worker while it is in use.
"""

from __future__ import annotations

import threading
from collections import defaultdict
from dataclasses import dataclass, field

from app.models import (
    Assessment,
    ConsentEvent,
    Consent,
    Conversation,
    Credit,
    CreditReport,
    FinancialProfile,
    Goal,
    MonthlySnapshot,
    Notification,
    NotificationSettings,
    PlanRecommendation,
    User,
)


@dataclass
class PendingVerification:
    id: str
    phone: str
    code: str
    purpose: str  # "register" | "recover"
    user_id: str | None
    expires_at: float
    attempts: int = 0


@dataclass
class MemoryStore:
    # TODO: Database — each attribute below corresponds to one table.
    lock: threading.RLock = field(default_factory=threading.RLock)
    users: dict[str, User] = field(default_factory=dict)
    profiles: dict[str, FinancialProfile] = field(default_factory=dict)
    credits: dict[str, Credit] = field(default_factory=dict)
    reports: dict[str, CreditReport] = field(default_factory=dict)
    assessments: dict[str, Assessment] = field(default_factory=dict)
    goals: dict[str, Goal] = field(default_factory=dict)
    recommendations: dict[str, PlanRecommendation] = field(default_factory=dict)
    notifications: dict[str, Notification] = field(default_factory=dict)
    notification_settings: dict[str, NotificationSettings] = field(default_factory=dict)
    consents: dict[str, dict[str, Consent]] = field(default_factory=lambda: defaultdict(dict))
    consent_events: list[ConsentEvent] = field(default_factory=list)
    conversations: dict[str, Conversation] = field(default_factory=dict)
    snapshots: dict[str, list[MonthlySnapshot]] = field(default_factory=lambda: defaultdict(list))
    plan_meta: dict[str, dict] = field(default_factory=dict)
    # TODO: Database — sessions and SMS verifications fit a TTL store (Redis) better than SQL.
    verifications: dict[str, PendingVerification] = field(default_factory=dict)
    revoked_tokens: set[str] = field(default_factory=set)


store = MemoryStore()
