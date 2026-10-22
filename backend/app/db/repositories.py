"""Repositories: the only code that reads or writes stored data.

Every method returns copies, so callers must `save()` what they change —
the same contract a database-backed implementation will have.

TODO: Database — reimplement each repository on a real database session
(e.g. SQLAlchemy `Session`), keeping these method names and return types.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import TypeVar

from pydantic import BaseModel

from app.db.memory import MemoryStore, PendingVerification, store
from app.models import (
    Assessment,
    Consent,
    ConsentEvent,
    ConsentType,
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

M = TypeVar("M", bound=BaseModel)


def _copy(item: M | None) -> M | None:
    return item.model_copy(deep=True) if item is not None else None


class _Repo:
    def __init__(self, s: MemoryStore):
        self.s = s


class UserRepo(_Repo):
    def get(self, user_id: str) -> User | None:
        # TODO: Database — SELECT * FROM users WHERE id = :user_id
        return _copy(self.s.users.get(user_id))

    def get_by_phone(self, phone: str) -> User | None:
        # TODO: Database — SELECT ... WHERE phone = :phone (unique index)
        return _copy(next((u for u in self.s.users.values() if u.phone == phone), None))

    def get_by_email(self, email: str) -> User | None:
        # TODO: Database — SELECT ... WHERE lower(email) = lower(:email) (unique index)
        email = email.strip().lower()
        return _copy(next((u for u in self.s.users.values() if (u.email or "").lower() == email), None))

    def save(self, user: User) -> User:
        # TODO: Database — INSERT ... ON CONFLICT (id) DO UPDATE
        with self.s.lock:
            self.s.users[user.id] = _copy(user)
        return user

    def delete_with_all_data(self, user_id: str) -> None:
        # TODO: Database — DELETE FROM users WHERE id = :user_id with ON DELETE CASCADE on every
        # child table; also delete uploaded report files from object storage.
        s = self.s
        with s.lock:
            s.users.pop(user_id, None)
            s.profiles.pop(user_id, None)
            s.notification_settings.pop(user_id, None)
            s.consents.pop(user_id, None)
            s.snapshots.pop(user_id, None)
            s.plan_meta.pop(user_id, None)
            s.consent_events[:] = [e for e in s.consent_events if e.user_id != user_id]
            for table in (s.credits, s.reports, s.assessments, s.goals, s.recommendations, s.notifications, s.conversations):
                for key in [k for k, v in table.items() if v.user_id == user_id]:
                    del table[key]


class ProfileRepo(_Repo):
    def get(self, user_id: str) -> FinancialProfile:
        # TODO: Database — SELECT profile with its incomes and expenses (joined / selectinload)
        profile = self.s.profiles.get(user_id)
        return _copy(profile) if profile else FinancialProfile(user_id=user_id)

    def save(self, profile: FinancialProfile) -> FinancialProfile:
        # TODO: Database — upsert the profile row and replace its income/expense child rows in one transaction
        with self.s.lock:
            self.s.profiles[profile.user_id] = _copy(profile)
        return profile


class CreditRepo(_Repo):
    def list(self, user_id: str, include_closed: bool = False) -> list[Credit]:
        # TODO: Database — SELECT * FROM credits WHERE user_id = :user_id [AND status = 'active']
        items = [c for c in self.s.credits.values() if c.user_id == user_id and (include_closed or c.status == "active")]
        items.sort(key=lambda c: (c.next_payment_date or date.max, c.created_at))
        return [_copy(c) for c in items]

    def get(self, user_id: str, credit_id: str) -> Credit | None:
        # TODO: Database — SELECT ... WHERE id = :credit_id AND user_id = :user_id
        c = self.s.credits.get(credit_id)
        return _copy(c) if c and c.user_id == user_id else None

    def save(self, credit: Credit) -> Credit:
        # TODO: Database — INSERT ... ON CONFLICT (id) DO UPDATE
        with self.s.lock:
            self.s.credits[credit.id] = _copy(credit)
        return credit

    def delete(self, user_id: str, credit_id: str) -> bool:
        # TODO: Database — DELETE FROM credits WHERE id = :credit_id AND user_id = :user_id
        with self.s.lock:
            c = self.s.credits.get(credit_id)
            if c and c.user_id == user_id:
                del self.s.credits[credit_id]
                return True
        return False

    def delete_from_reports(self, user_id: str) -> int:
        # TODO: Database — DELETE FROM credits WHERE user_id = :user_id AND source = 'report'
        with self.s.lock:
            ids = [k for k, c in self.s.credits.items() if c.user_id == user_id and c.source == "report"]
            for k in ids:
                del self.s.credits[k]
        return len(ids)


class ReportRepo(_Repo):
    def get(self, user_id: str, report_id: str) -> CreditReport | None:
        # TODO: Database — SELECT ... WHERE id = :report_id AND user_id = :user_id
        r = self.s.reports.get(report_id)
        return _copy(r) if r and r.user_id == user_id else None

    def latest(self, user_id: str, only_processed: bool = True) -> CreditReport | None:
        # TODO: Database — SELECT ... WHERE user_id = :user_id [AND status='processed'] ORDER BY uploaded_at DESC LIMIT 1
        items = [r for r in self.s.reports.values() if r.user_id == user_id and (not only_processed or r.status == "processed")]
        return _copy(max(items, key=lambda r: r.uploaded_at)) if items else None

    def save(self, report: CreditReport) -> CreditReport:
        # TODO: Database — upsert metadata; store the file itself in object storage, not in the DB
        with self.s.lock:
            self.s.reports[report.id] = _copy(report)
        return report

    def delete_all(self, user_id: str) -> int:
        # TODO: Database — DELETE FROM credit_reports WHERE user_id = :user_id (+ delete stored files)
        with self.s.lock:
            ids = [k for k, r in self.s.reports.items() if r.user_id == user_id]
            for k in ids:
                del self.s.reports[k]
        return len(ids)


class AssessmentRepo(_Repo):
    def get(self, user_id: str, assessment_id: str) -> Assessment | None:
        # TODO: Database — SELECT ... WHERE id = :id AND user_id = :user_id
        a = self.s.assessments.get(assessment_id)
        return _copy(a) if a and a.user_id == user_id else None

    def list(self, user_id: str, saved_only: bool = False) -> list[Assessment]:
        # TODO: Database — SELECT ... WHERE user_id = :user_id [AND saved] ORDER BY created_at DESC
        items = [a for a in self.s.assessments.values() if a.user_id == user_id and (a.saved or not saved_only)]
        items.sort(key=lambda a: a.created_at, reverse=True)
        return [_copy(a) for a in items]

    def save(self, assessment: Assessment) -> Assessment:
        # TODO: Database — INSERT ... ON CONFLICT (id) DO UPDATE
        with self.s.lock:
            self.s.assessments[assessment.id] = _copy(assessment)
        return assessment


class GoalRepo(_Repo):
    def list(self, user_id: str) -> list[Goal]:
        # TODO: Database — SELECT * FROM goals WHERE user_id = :user_id ORDER BY target_date NULLS LAST
        items = [g for g in self.s.goals.values() if g.user_id == user_id]
        items.sort(key=lambda g: (g.status == "planned", g.target_date or date.max, g.created_at))
        return [_copy(g) for g in items]

    def get(self, user_id: str, goal_id: str) -> Goal | None:
        # TODO: Database — SELECT ... WHERE id = :goal_id AND user_id = :user_id
        g = self.s.goals.get(goal_id)
        return _copy(g) if g and g.user_id == user_id else None

    def save(self, goal: Goal) -> Goal:
        # TODO: Database — INSERT ... ON CONFLICT (id) DO UPDATE
        with self.s.lock:
            self.s.goals[goal.id] = _copy(goal)
        return goal

    def delete(self, user_id: str, goal_id: str) -> bool:
        # TODO: Database — DELETE FROM goals WHERE id = :goal_id AND user_id = :user_id
        with self.s.lock:
            g = self.s.goals.get(goal_id)
            if g and g.user_id == user_id:
                del self.s.goals[goal_id]
                return True
        return False


class RecommendationRepo(_Repo):
    def list(self, user_id: str) -> list[PlanRecommendation]:
        # TODO: Database — SELECT * FROM plan_recommendations WHERE user_id = :user_id ORDER BY created_at
        items = [r for r in self.s.recommendations.values() if r.user_id == user_id]
        items.sort(key=lambda r: r.created_at)
        return [_copy(r) for r in items]

    def get(self, user_id: str, rec_id: str) -> PlanRecommendation | None:
        # TODO: Database — SELECT ... WHERE id = :rec_id AND user_id = :user_id
        r = self.s.recommendations.get(rec_id)
        return _copy(r) if r and r.user_id == user_id else None

    def save(self, rec: PlanRecommendation) -> PlanRecommendation:
        # TODO: Database — INSERT ... ON CONFLICT (id) DO UPDATE
        with self.s.lock:
            self.s.recommendations[rec.id] = _copy(rec)
        return rec


class NotificationRepo(_Repo):
    def list(self, user_id: str) -> list[Notification]:
        # TODO: Database — SELECT ... WHERE user_id = :user_id ORDER BY created_at DESC (paginate)
        items = [n for n in self.s.notifications.values() if n.user_id == user_id]
        items.sort(key=lambda n: n.created_at, reverse=True)
        return [_copy(n) for n in items]

    def get(self, user_id: str, notification_id: str) -> Notification | None:
        # TODO: Database — SELECT ... WHERE id = :id AND user_id = :user_id
        n = self.s.notifications.get(notification_id)
        return _copy(n) if n and n.user_id == user_id else None

    def save(self, n: Notification) -> Notification:
        # TODO: Database — INSERT ... ON CONFLICT (id) DO UPDATE
        with self.s.lock:
            self.s.notifications[n.id] = _copy(n)
        return n

    def mark_all_read(self, user_id: str) -> None:
        # TODO: Database — UPDATE notifications SET read = true WHERE user_id = :user_id AND NOT read
        with self.s.lock:
            for n in self.s.notifications.values():
                if n.user_id == user_id:
                    n.read = True

    def unread_count(self, user_id: str) -> int:
        # TODO: Database — SELECT count(*) ... WHERE user_id = :user_id AND NOT read
        return sum(1 for n in self.s.notifications.values() if n.user_id == user_id and not n.read)

    def get_settings(self, user_id: str) -> NotificationSettings:
        # TODO: Database — SELECT * FROM notification_settings WHERE user_id = :user_id
        return _copy(self.s.notification_settings.get(user_id)) or NotificationSettings()

    def save_settings(self, user_id: str, settings: NotificationSettings) -> NotificationSettings:
        # TODO: Database — upsert notification_settings row
        with self.s.lock:
            self.s.notification_settings[user_id] = _copy(settings)
        return settings


class ConsentRepo(_Repo):
    def list(self, user_id: str) -> dict[str, Consent]:
        # TODO: Database — SELECT * FROM consents WHERE user_id = :user_id
        return {k: _copy(v) for k, v in self.s.consents.get(user_id, {}).items()}

    def get(self, user_id: str, consent_type: ConsentType) -> Consent | None:
        # TODO: Database — SELECT ... WHERE user_id = :user_id AND type = :type
        return _copy(self.s.consents.get(user_id, {}).get(consent_type))

    def save(self, user_id: str, consent: Consent) -> Consent:
        # TODO: Database — upsert on (user_id, type)
        with self.s.lock:
            self.s.consents[user_id][consent.type] = _copy(consent)
        return consent

    def add_event(self, event: ConsentEvent) -> None:
        # TODO: Database — INSERT INTO consent_events (append-only audit log)
        with self.s.lock:
            self.s.consent_events.append(_copy(event))

    def events(self, user_id: str) -> list[ConsentEvent]:
        # TODO: Database — SELECT ... WHERE user_id = :user_id ORDER BY at DESC
        items = [e for e in self.s.consent_events if e.user_id == user_id]
        items.sort(key=lambda e: e.at, reverse=True)
        return [_copy(e) for e in items]


class ConversationRepo(_Repo):
    def list(self, user_id: str) -> list[Conversation]:
        # TODO: Database — SELECT conversations (without messages) WHERE user_id = :user_id ORDER BY created_at DESC
        items = [c for c in self.s.conversations.values() if c.user_id == user_id]
        items.sort(key=lambda c: c.created_at, reverse=True)
        return [_copy(c) for c in items]

    def get(self, user_id: str, conversation_id: str) -> Conversation | None:
        # TODO: Database — SELECT conversation + its chat_messages ordered by created_at
        c = self.s.conversations.get(conversation_id)
        return _copy(c) if c and c.user_id == user_id else None

    def save(self, conversation: Conversation) -> Conversation:
        # TODO: Database — upsert the conversation and insert new chat_messages rows
        with self.s.lock:
            self.s.conversations[conversation.id] = _copy(conversation)
        return conversation


class SnapshotRepo(_Repo):
    def list(self, user_id: str) -> list[MonthlySnapshot]:
        # TODO: Database — SELECT * FROM monthly_snapshots WHERE user_id = :user_id ORDER BY month
        return [_copy(s) for s in sorted(self.s.snapshots.get(user_id, []), key=lambda s: s.month)]

    def replace(self, user_id: str, items: list[MonthlySnapshot]) -> None:
        # TODO: Database — written by a scheduled monthly job, not by request handlers
        with self.s.lock:
            self.s.snapshots[user_id] = [_copy(s) for s in items]


class PlanMetaRepo(_Repo):
    def get(self, user_id: str) -> dict:
        # TODO: Database — column(s) on financial_profiles or a `plans` table: started_at, start_debt
        return dict(self.s.plan_meta.get(user_id, {}))

    def save(self, user_id: str, meta: dict) -> None:
        # TODO: Database — upsert plan row
        with self.s.lock:
            self.s.plan_meta[user_id] = dict(meta)


class VerificationRepo(_Repo):
    def add(self, v: PendingVerification) -> None:
        # TODO: Database — store in Redis with TTL instead of process memory
        with self.s.lock:
            self.s.verifications[v.id] = v

    def get(self, verification_id: str) -> PendingVerification | None:
        # TODO: Database — GET from Redis
        return self.s.verifications.get(verification_id)

    def delete(self, verification_id: str) -> None:
        # TODO: Database — DEL from Redis
        with self.s.lock:
            self.s.verifications.pop(verification_id, None)


class TokenRepo(_Repo):
    def revoke(self, jti: str) -> None:
        # TODO: Database — store revoked token ids (Redis set with TTL = token lifetime)
        with self.s.lock:
            self.s.revoked_tokens.add(jti)

    def is_revoked(self, jti: str) -> bool:
        # TODO: Database — SISMEMBER revoked_tokens :jti
        return jti in self.s.revoked_tokens


class Repositories:
    def __init__(self, s: MemoryStore):
        self.users = UserRepo(s)
        self.profiles = ProfileRepo(s)
        self.credits = CreditRepo(s)
        self.reports = ReportRepo(s)
        self.assessments = AssessmentRepo(s)
        self.goals = GoalRepo(s)
        self.recommendations = RecommendationRepo(s)
        self.notifications = NotificationRepo(s)
        self.consents = ConsentRepo(s)
        self.conversations = ConversationRepo(s)
        self.snapshots = SnapshotRepo(s)
        self.plan_meta = PlanMetaRepo(s)
        self.verifications = VerificationRepo(s)
        self.tokens = TokenRepo(s)


_repos = Repositories(store)


def get_repositories() -> Repositories:
    """FastAPI dependency.

    TODO: Database — open a DB session per request here (yield it, commit on success,
    roll back on error) and build the repositories on top of that session.
    """
    return _repos


def now() -> datetime:
    return datetime.now()
