"""DSS (WSM + TOPSIS) service and API tests."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import dss


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def login(client: TestClient, phone: str = "+7 701 234 56 78") -> dict:
    r = client.post("/api/auth/login", json={"login": phone, "password": "qorgan2026"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def lab_problem():
    """The lab's base case (dss/data.py): income 350k, payments 100k, price 400k."""
    return dss.build_problem(None, [], 400_000)


def test_lab_matrix_matches_dss_folder():
    p = lab_problem()
    assert p["base"]["source"] == "demo"
    m = p["matrix"]
    assert m["A1"]["overpay"] == 32_000 and m["A1"]["debt_load"] == 38.9
    assert m["A5"]["overpay"] == 178_000 and m["A5"]["debt_load"] == 33.2
    assert abs(sum(c["weight"] for c in p["criteria"]) - 1) < 1e-9


def test_lab_ranking_matches_pandas_version():
    p = lab_problem()
    types = {c["key"]: c["type"] for c in p["criteria"]}
    weights = {c["key"]: c["weight"] for c in p["criteria"]}
    assert dss.validate(p["matrix"], types, weights) == []
    r = dss.run(p["matrix"], types, weights)
    assert [x["code"] for x in r["wsm"]] == ["A1", "A3", "A2", "A4", "A5", "A6"]
    assert [x["code"] for x in r["topsis"]] == ["A1", "A3", "A2", "A6", "A4", "A5"]
    assert r["wsm"][0]["score"] == pytest.approx(0.9411, abs=1e-3)
    assert r["topsis"][0]["closeness"] == pytest.approx(0.8932, abs=1e-3)
    assert r["summary"]["same_winner"] and not r["summary"]["identical_ranking"]
    assert r["summary"]["spearman_rho"] == pytest.approx(0.829, abs=1e-3)


def test_validate_catches_problems():
    p = lab_problem()
    types = {c["key"]: c["type"] for c in p["criteria"]}
    weights = {c["key"]: c["weight"] for c in p["criteria"]}
    bad = {code: dict(row) for code, row in p["matrix"].items()}
    bad["A2"]["rate"] = None
    assert any(e.startswith("missing_values:A2") for e in dss.validate(bad, types, weights))
    w = dict(weights)
    w["rate"] = 0.5
    assert any(e.startswith("weights_sum") for e in dss.validate(p["matrix"], types, w))


def test_problem_uses_user_profile(client):
    h = login(client)  # Айгерим (other test modules may have changed her credits — compare with the dashboard)
    m = client.get("/api/dashboard", headers=h).json()["metrics"]
    p = client.get("/api/dss/problem?price=400000", headers=h).json()
    assert p["base"]["source"] == "profile"
    assert p["base"]["payments"] == m["monthly_payments"] and p["base"]["income"] > 0
    assert p["matrix"]["A1"]["debt_load"] == round((m["monthly_payments"] + 36_000) / p["base"]["income"] * 100, 1)
    assert len(p["alternatives"]) == 6 and len(p["criteria"]) == 6


def test_rank_endpoint_and_errors(client):
    h = login(client)
    p = client.get("/api/dss/problem", headers=h).json()
    body = {"criteria": [{"key": c["key"], "type": c["type"], "weight": c["weight"]} for c in p["criteria"]], "matrix": p["matrix"]}
    r = client.post("/api/dss/rank", json=body, headers=h)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["summary"]["wsm_winner"] == data["wsm"][0]["code"]
    assert len(data["comparison"]) == 6

    body["criteria"][0]["weight"] = 0.9
    r = client.post("/api/dss/rank", json=body, headers=h)
    assert r.status_code == 400
    assert any(e.startswith("weights_sum") for e in r.json()["detail"]["errors"])

    r = client.get("/api/dss/problem")
    assert r.status_code == 401
