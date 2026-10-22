"""Consents: what the user allowed, and what changes when they revoke it."""

from __future__ import annotations

from datetime import datetime

from app.db.repositories import Repositories
from app.models import Consent, ConsentEvent, ConsentType

# Display order and whether each consent can be revoked on its own.
CONSENT_ORDER: list[tuple[ConsentType, bool]] = [
    ("personal_data", True),
    ("credit_report", False),
    ("ai_analysis", False),
    ("auto_update", False),
    ("marketing_email", False),
]


def ensure_defaults(repos: Repositories, user_id: str, at: datetime, marketing: bool = False) -> None:
    """Consents every account starts with (asked at registration)."""
    existing = repos.consents.list(user_id)
    defaults = {
        "personal_data": Consent(type="personal_data", required=True, status="active", since=at),
        "credit_report": Consent(type="credit_report", required=False, status="off"),
        "ai_analysis": Consent(type="ai_analysis", required=False, status="off"),
        "auto_update": Consent(type="auto_update", required=False, status="not_connected"),
        "marketing_email": Consent(type="marketing_email", required=False, status="active" if marketing else "off",
                                   since=at if marketing else None),
    }
    for t, c in defaults.items():
        if t not in existing:
            repos.consents.save(user_id, c)
            if c.status == "active":
                repos.consents.add_event(ConsentEvent(user_id=user_id, type=t, action="granted", at=at))


def is_active(repos: Repositories, user_id: str, consent_type: ConsentType) -> bool:
    c = repos.consents.get(user_id, consent_type)
    return bool(c and c.status == "active")


def grant(repos: Repositories, user_id: str, consent_type: ConsentType) -> Consent:
    at = datetime.now()
    c = repos.consents.get(user_id, consent_type) or Consent(type=consent_type, required=False, status="off")
    if c.status != "active":
        c.status, c.since, c.revoked_at = "active", at, None
        repos.consents.save(user_id, c)
        repos.consents.add_event(ConsentEvent(user_id=user_id, type=consent_type, action="granted", at=at))
    return c


def revoke(repos: Repositories, user_id: str, consent_type: ConsentType) -> dict:
    """Revoke and apply the consequences. Returns a summary of what changed."""
    at = datetime.now()
    c = repos.consents.get(user_id, consent_type)
    if c is None or c.status != "active":
        return {"changed": False}
    c.status, c.revoked_at = ("revoked" if consent_type == "credit_report" else "off"), at
    repos.consents.save(user_id, c)
    repos.consents.add_event(ConsentEvent(user_id=user_id, type=consent_type, action="revoked", at=at))

    summary: dict = {"changed": True, "type": consent_type}
    if consent_type == "credit_report":
        # TODO: Database — run both deletes in one transaction.
        summary["deleted_credits"] = repos.credits.delete_from_reports(user_id)
        summary["deleted_reports"] = repos.reports.delete_all(user_id)
        summary["remaining_manual"] = len(repos.credits.list(user_id))
    return summary


def impact(repos: Repositories, user_id: str, consent_type: ConsentType) -> dict:
    """What revoking would change — shown in the confirmation dialog before the user confirms."""
    if consent_type == "credit_report":
        credits = repos.credits.list(user_id)
        return {
            "credits_to_delete": sum(1 for c in credits if c.source == "report"),
            "manual_left": sum(1 for c in credits if c.source == "manual"),
        }
    return {}
