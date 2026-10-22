"""Credit bureau report: upload, review the recognised obligations, confirm the import."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.config import settings
from app.deps import CurrentUser, Repos, not_found
from app.models import Credit, CreditReport
from app.services import consents as consent_svc
from app.services import reports as report_svc
from app.services.notifications import notify

router = APIRouter(prefix="/reports", tags=["reports"])


def _view(r: CreditReport) -> dict:
    return r.model_dump()


@router.post("", status_code=201)
async def upload_report(user: CurrentUser, repos: Repos, file: UploadFile = File(...)):
    data = await file.read(settings.max_report_bytes + 1)
    today = date.today()
    report = CreditReport(id=uuid.uuid4().hex[:12], user_id=user.id, filename=file.filename or "report.pdf",
                          size_bytes=len(data), uploaded_at=datetime.now(), status="processed")
    try:
        report.obligations = report_svc.parse(data, settings.max_report_bytes, today)
    except report_svc.ReportError as e:
        report.status, report.error_code = "failed", e.code  # type: ignore[assignment]
        # A file we could not read is not kept (design: «Необработанный файл не сохраняется в твоем профиле»).
        return _view(report)
    # Uploading a report is the moment the user gives the credit-report consent.
    consent_svc.grant(repos, user.id, "credit_report")
    # TODO: Database — save report metadata; put the raw file in object storage (or discard it after parsing).
    repos.reports.save(report)
    return _view(report)


@router.get("/latest")
def latest_report(user: CurrentUser, repos: Repos):
    r = repos.reports.latest(user.id)
    return _view(r) if r else None


class ConfirmIn(BaseModel):
    obligation_ids: list[str]


@router.post("/{report_id}/confirm")
def confirm_report(report_id: str, body: ConfirmIn, user: CurrentUser, repos: Repos):
    report = repos.reports.get(user.id, report_id)
    if report is None or report.status != "processed":
        raise not_found("report_not_found")
    if report.confirmed:
        raise HTTPException(409, detail={"code": "report_already_confirmed"})
    now = datetime.now()
    # Replace credits that came from older reports; manual entries stay.
    repos.credits.delete_from_reports(user.id)
    added = 0
    for ob in report.obligations:
        if ob.id not in body.obligation_ids:
            continue
        fields = ob.model_dump(exclude={"id", "partial"})
        repos.credits.save(Credit(id=uuid.uuid4().hex[:12], user_id=user.id, source="report", report_id=report.id,
                                  data_as_of=now.date(), created_at=now, updated_at=now, report_values=fields, **fields))
        added += 1
    report.confirmed = True
    # TODO: Database — the deletes, inserts and the report update above belong in one transaction.
    repos.reports.save(report)
    profile = repos.profiles.get(user.id)
    profile.no_credits = False
    profile.onboarding_step = max(profile.onboarding_step, 4)
    repos.profiles.save(profile)
    manual = sum(1 for c in repos.credits.list(user.id) if c.source == "manual")
    notify(repos, user.id, "data", "report_processed", {"found": added, "manual": manual})
    return {"added": added, "credits": len(repos.credits.list(user.id))}
