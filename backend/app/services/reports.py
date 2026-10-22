"""Credit bureau report upload.

TODO: Integration — real parsing of the bureau PDF (text extraction + the bureau's table
layout). Until then `parse()` validates the file and, for a readable text PDF, returns
a fixed sample of obligations so the confirm-and-import flow can be exercised end to end.
"""

from __future__ import annotations

import uuid
from datetime import date

from app.models import ParsedObligation
from app.services import finance as fin


class ReportError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def check_pdf(data: bytes, max_bytes: int) -> None:
    if len(data) > max_bytes:
        raise ReportError("too_large")
    if not data.startswith(b"%PDF"):
        raise ReportError("not_pdf")
    if b"/Encrypt" in data:
        raise ReportError("encrypted")
    # A scan or a photo saved as PDF carries images but no fonts, so there is no text to read.
    if b"/Font" not in data:
        raise ReportError("no_text")


def parse(data: bytes, max_bytes: int, today: date) -> list[ParsedObligation]:
    check_pdf(data, max_bytes)
    # TODO: Integration — extract the obligations from the PDF text instead of this sample.
    nxt = lambda days: date.fromordinal(today.toordinal() + days)  # noqa: E731
    return [
        ParsedObligation(id=uuid.uuid4().hex[:8], organization="Банк D", type="auto_loan", balance=1_940_000,
                         monthly_payment=58_000, original_amount=2_900_000, payments_made=22, payments_total=60,
                         overpayment=580_000, next_payment_date=nxt(19)),
        ParsedObligation(id=uuid.uuid4().hex[:8], organization="Банк A", type="cash_loan", balance=850_000,
                         monthly_payment=52_000, original_amount=1_200_000, payments_made=9, payments_total=30,
                         overpayment=360_000, next_payment_date=nxt(8)),
        ParsedObligation(id=uuid.uuid4().hex[:8], organization="МФО C", type="microloan", balance=110_000,
                         monthly_payment=45_000, original_amount=180_000, payments_made=2, payments_total=5,
                         overpayment=25_000, next_payment_date=nxt(3),
                         last_payment_date=fin.add_months(nxt(3), 2)),
        ParsedObligation(id=uuid.uuid4().hex[:8], organization="Банк B", type="credit_card", balance=130_000,
                         monthly_payment=20_000, is_minimum_payment=True, next_payment_date=nxt(15)),
    ]
