"""End-to-end API tests against the in-memory store and demo seed.

The expected numbers are the ones shown in the qorgan design for the demo user Айгерим.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def login(client: TestClient, phone: str = "+7 701 234 56 78") -> dict:
    r = client.post("/api/auth/login", json={"login": phone, "password": "qorgan2026"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_dashboard_matches_design(client):
    h = login(client)
    d = client.get("/api/dashboard", headers=h).json()
    m = d["metrics"]
    assert d["state"] == "complete"
    assert m["total_debt"] == 3_450_000
    assert m["monthly_payments"] == 210_000
    assert round(m["load"] * 100) == 47
    assert m["free"] == 65_000
    assert m["zone"] == "high"
    assert d["load_change"]["pp"] == 9
    assert d["recommendation"]["code"] == "refrain_new_credit"
    assert round(d["relief"]["load_after"] * 100) == 37
    assert [u["amount"] for u in d["upcoming"]] == [45_000, 52_000, 35_000, 20_000, 58_000]


def test_check_red_with_safe_alternative(client):
    h = login(client)
    body = {"title": "Смартфон", "category": "smartphone", "price": 840_000, "kind": "installment", "term_months": 12}
    pre = client.post("/api/checks/preview", json=body, headers=h).json()
    assert pre["monthly_payment"] == 70_000 and round(pre["new_payment_share"] * 100) == 16
    a = client.post("/api/checks", json=body, headers=h).json()
    assert a["risk"] == "high"
    assert a["after"]["payments"] == 280_000
    assert round(a["after"]["load"] * 100) == 62
    assert a["after"]["free"] == -5_000
    assert [r["code"] for r in a["reasons"]] == ["load_already_high", "free_negative", "borrow_to_pay"]
    alt = a["alternative"]
    assert alt["code"] == "save" and alt["months_until_purchase"] == 9 and round(alt["load"] * 100) == 37

    s = client.get(f"/api/scenarios?check={a['id']}", headers=h).json()["scenarios"]
    by = {o["code"]: o for o in s["options"]}
    assert by["longer_term"]["monthly_payment"] == 38_500 and by["longer_term"]["total_cost"] == 924_000
    assert round(by["cheaper"]["load"] * 100) == 54 and by["cheaper"]["free"] == 30_000
    assert round(by["wait"]["load"] * 100) == 44 and by["wait"]["risk"] == "medium" and by["wait"]["free"] == 75_000
    assert by["save"]["free"] == 50_000 and by["save"]["risk"] == "low"
    assert s["recommended"] == "save"


def test_green_and_yellow_for_low_load_user(client):
    h = login(client, "+77017770000")
    green = client.post("/api/checks", headers=h, json={"title": "Ноутбук", "category": "laptop", "price": 450_000,
                                                         "kind": "installment", "term_months": 6}).json()
    assert green["risk"] == "low" and green["monthly_payment"] == 75_000
    yellow = client.post("/api/checks", headers=h, json={"title": "Холодильник", "category": "appliances",
                                                          "price": 1_200_000, "kind": "installment", "term_months": 12}).json()
    assert yellow["risk"] == "medium"


def test_new_user_insufficient_data(client):
    h = login(client, "+77015550101")
    assert client.get("/api/dashboard", headers=h).json()["state"] == "new"
    client.put("/api/me/incomes", headers=h, json={"incomes": [{"source": "Зарплата", "amount": 450_000}]})
    a = client.post("/api/checks", headers=h, json={"title": "Смартфон", "price": 840_000, "kind": "installment",
                                                     "term_months": 12}).json()
    assert a["risk"] == "insufficient" and a["missing"] == ["expenses", "credits"]
    assert client.get("/api/me/financial", headers=h).json()["completeness"]["percent"] == 40


def test_overdue_and_stale(client):
    h = login(client, "+77019990000")
    items = client.get("/api/credits", headers=h).json()["items"]
    micro = next(c for c in items if c["type"] == "microloan")
    assert micro["status"] == "overdue" and micro["overdue_days"] == 4 and micro["stale"]


def test_register_verify_flow(client):
    r = client.post("/api/auth/register", json={"name": "Тест", "phone": "701 000 11 22", "password": "secret123",
                                                 "consents": {"terms": True, "personal_data": True}})
    assert r.status_code == 201
    v = r.json()
    bad = client.post("/api/auth/verify", json={"verification_id": v["verification_id"], "code": "0000" if v["dev_code"] != "0000" else "1111"})
    assert bad.status_code == 400
    ok = client.post("/api/auth/verify", json={"verification_id": v["verification_id"], "code": v["dev_code"]})
    assert ok.status_code == 200 and ok.json()["access_token"]


def test_report_upload_scan_fails_text_pdf_imports(client):
    h = login(client, "+77015550101")
    scan = b"%PDF-1.4\n1 0 obj << /Type /XObject /Subtype /Image >> endobj"
    r = client.post("/api/reports", headers=h, files={"file": ("skan.pdf", scan, "application/pdf")}).json()
    assert r["status"] == "failed" and r["error_code"] == "no_text"
    text_pdf = b"%PDF-1.4\n1 0 obj << /Type /Font /Subtype /Type1 >> endobj"
    r = client.post("/api/reports", headers=h, files={"file": ("otchet.pdf", text_pdf, "application/pdf")}).json()
    assert r["status"] == "processed" and len(r["obligations"]) == 4
    done = client.post(f"/api/reports/{r['id']}/confirm", headers=h,
                       json={"obligation_ids": [o["id"] for o in r["obligations"]]}).json()
    assert done["added"] == 4


def test_revoke_credit_report_consent_deletes_report_credits(client):
    h = login(client)
    impact = client.get("/api/consents/credit_report/impact", headers=h).json()
    assert impact == {"credits_to_delete": 4, "manual_left": 1}
    res = client.post("/api/consents/credit_report/revoke", headers=h).json()
    assert res["summary"]["deleted_credits"] == 4 and res["summary"]["remaining_manual"] == 1
    assert len(client.get("/api/credits", headers=h).json()["items"]) == 1


def test_ai_chat_answers(client):
    h = login(client, "+77017770000")
    convo = client.post("/api/ai/conversations", headers=h, json={}).json()
    res = client.post(f"/api/ai/conversations/{convo['id']}/messages", headers=h,
                      json={"text": "Какой кредит лучше погасить первым?"})
    assert res.status_code == 200
    assert res.json()["answer"]["blocks"][0]["type"] == "steps"
    kk = client.post(f"/api/ai/conversations/{convo['id']}/messages?lang=kk", headers=h,
                     json={"text": "Ай сайынғы төлемді қалай азайтуға болады?"}).json()
    assert "тәсілдер" in kk["answer"]["text"]
