"""«Уведомления»: feed, read state, delivery settings."""

from __future__ import annotations

from fastapi import APIRouter

from app.deps import CurrentUser, Repos, not_found
from app.models import NotificationCategory, NotificationSettings

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications(user: CurrentUser, repos: Repos, category: NotificationCategory | None = None):
    items = repos.notifications.list(user.id)
    counts = {c: sum(1 for n in items if n.category == c) for c in ("payment", "load", "data", "goal", "recommendation")}
    if category:
        items = [n for n in items if n.category == category]
    return {"items": items, "total": sum(counts.values()), "counts": counts,
            "unread": repos.notifications.unread_count(user.id)}


@router.post("/{notification_id}/read")
def mark_read(notification_id: str, user: CurrentUser, repos: Repos):
    n = repos.notifications.get(user.id, notification_id)
    if n is None:
        raise not_found("notification_not_found")
    n.read = True
    # TODO: Database — UPDATE notifications SET read = true WHERE id = :id
    return repos.notifications.save(n)


@router.post("/read-all", status_code=204)
def read_all(user: CurrentUser, repos: Repos):
    repos.notifications.mark_all_read(user.id)


@router.get("/settings")
def get_settings(user: CurrentUser, repos: Repos):
    return repos.notifications.get_settings(user.id)


@router.put("/settings")
def put_settings(body: NotificationSettings, user: CurrentUser, repos: Repos):
    body.channel_app = True  # in-app delivery cannot be turned off
    # TODO: Database — upsert notification_settings row.
    return repos.notifications.save_settings(user.id, body)
