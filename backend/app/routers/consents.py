"""«Согласия и разрешения»."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.deps import CurrentUser, Repos
from app.models import ConsentType
from app.services import consents as consent_svc

router = APIRouter(prefix="/consents", tags=["consents"])


def _list(repos: Repos, user_id: str) -> dict:
    current = repos.consents.list(user_id)
    report = repos.reports.latest(user_id)
    credits = repos.credits.list(user_id)
    items = []
    for t, _ in consent_svc.CONSENT_ORDER:
        c = current.get(t)
        if c is None:
            continue
        item = c.model_dump()
        if t == "credit_report":
            item["details"] = {"credits_from_report": sum(1 for x in credits if x.source == "report"),
                               "report_date": report.uploaded_at if report else None}
        items.append(item)
    return {"items": items, "history": [e.model_dump() for e in repos.consents.events(user_id)]}


@router.get("")
def list_consents(user: CurrentUser, repos: Repos):
    return _list(repos, user.id)


@router.get("/{consent_type}/impact")
def revoke_impact(consent_type: ConsentType, user: CurrentUser, repos: Repos):
    return consent_svc.impact(repos, user.id, consent_type)


@router.post("/{consent_type}/revoke")
def revoke(consent_type: ConsentType, user: CurrentUser, repos: Repos):
    c = repos.consents.get(user.id, consent_type)
    if c and c.required:
        raise HTTPException(400, detail={"code": "consent_required_revoke_via_account_deletion"})
    summary = consent_svc.revoke(repos, user.id, consent_type)
    return {"summary": summary, **_list(repos, user.id)}


@router.post("/{consent_type}/grant")
def grant(consent_type: ConsentType, user: CurrentUser, repos: Repos):
    if consent_type == "auto_update":
        raise HTTPException(400, detail={"code": "auto_update_unavailable"})
    consent_svc.grant(repos, user.id, consent_type)
    return _list(repos, user.id)
