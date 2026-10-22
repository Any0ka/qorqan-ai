"""Creating in-app notifications.

Texts are rendered by the frontend from `code` + `params`, so one record serves both languages.
TODO: Integration — a scheduler (cron / Celery beat) should create the payment reminders
three days before each due date and deliver email / browser push per the user's settings.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from app.db.repositories import Repositories
from app.models import Notification, NotificationCategory

SETTING_FOR_CATEGORY = {
    "payment": "payment_reminders",
    "load": "load_changes",
    "data": "data_updates",
    "goal": "goals_progress",
    "recommendation": "recommendations",
}


def notify(repos: Repositories, user_id: str, category: NotificationCategory, code: str,
           params: dict | None = None, actions: list[dict] | None = None, at: datetime | None = None,
           read: bool = False) -> Notification | None:
    settings = repos.notifications.get_settings(user_id)
    if not getattr(settings, SETTING_FOR_CATEGORY[category]):
        return None
    n = Notification(
        id=uuid.uuid4().hex[:12], user_id=user_id, category=category, code=code, params=params or {},
        actions=actions or [], created_at=at or datetime.now(), read=read,
    )
    # TODO: Database — insert the notification row.
    return repos.notifications.save(n)
