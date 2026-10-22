"""Multi-criteria DSS: which bank offer to take for a purchase (WSM + TOPSIS).

qorgan answers "can I afford it?"; this module answers the next question, "where should I borrow?".
Pure Python on purpose — no numpy/pandas in the API. The same maths lives in the lab folder `dss/`
(pandas version); keep the two in sync.

Pipeline: build the decision matrix for the user → validate → normalize → WSM → TOPSIS → compare.
"""

from __future__ import annotations

import math
from typing import Literal

from app.models import Credit, FinancialProfile
from app.services import finance as fin

CriterionType = Literal["benefit", "cost"]

# Demo fallback when the profile has no income yet (the lab's base case).
DEMO_INCOME = 350_000
DEMO_PAYMENTS = 100_000
DEFAULT_PRICE = 400_000

# ------------------------------------------------------------------ problem definition

# Offers are conditional (order of magnitude of the KZ market, not live bank tariffs).
# markup — total overpayment as a share of the financed sum over the whole term.
OFFERS: list[dict] = [
    {"code": "A1", "bank": "Kaspi", "kind": "installment", "term": 12, "rate": 15.5, "markup": 0.08,
     "approval": 5, "reliability": 9, "flexibility": 7},
    {"code": "A2", "bank": "Halyk", "kind": "credit", "term": 24, "rate": 22.5, "markup": 0.245,
     "approval": 30, "reliability": 9, "flexibility": 8},
    {"code": "A3", "bank": "Freedom", "kind": "credit", "term": 18, "rate": 19.9, "markup": 0.1625,
     "approval": 15, "reliability": 7, "flexibility": 6},
    {"code": "A4", "bank": "ForteBank", "kind": "credit", "term": 24, "rate": 24.8, "markup": 0.27,
     "approval": 60, "reliability": 8, "flexibility": 9},
    {"code": "A5", "bank": "BCC", "kind": "credit", "term": 36, "rate": 27.0, "markup": 0.445,
     "approval": 120, "reliability": 8, "flexibility": 7},
    {"code": "A6", "bank": "Home Credit", "kind": "credit", "term": 12, "rate": 35.0, "markup": 0.195,
     "approval": 10, "reliability": 6, "flexibility": 5},
]

KIND_LABEL = {
    "installment": {"ru": "рассрочка", "kk": "бөліп төлеу"},
    "credit": {"ru": "кредит", "kk": "несие"},
}

CRITERIA: list[dict] = [
    {"key": "rate", "type": "cost", "weight": 0.20, "unit": {"ru": "% годовых", "kk": "% жылдық"},
     "label": {"ru": "ГЭСВ", "kk": "ЖТСМ"},
     "hint": {"ru": "годовая эффективная ставка", "kk": "жылдық тиімді сыйақы мөлшерлемесі"}},
    {"key": "overpay", "type": "cost", "weight": 0.25, "unit": {"ru": "₸", "kk": "₸"},
     "label": {"ru": "Переплата", "kk": "Артық төлем"},
     "hint": {"ru": "проценты, комиссии и наценка за весь срок", "kk": "бүкіл мерзімдегі пайыздар, комиссиялар және үстеме"}},
    {"key": "debt_load", "type": "cost", "weight": 0.25, "unit": {"ru": "%", "kk": "%"},
     "label": {"ru": "Нагрузка после сделки", "kk": "Мәмiледен кейінгі жүктеме"},
     "hint": {"ru": "(текущие платежи + новый платёж) ÷ доход", "kk": "(ағымдағы төлемдер + жаңа төлем) ÷ табыс"}},
    {"key": "approval", "type": "cost", "weight": 0.05, "unit": {"ru": "мин", "kk": "мин"},
     "label": {"ru": "Время одобрения", "kk": "Мақұлдау уақыты"},
     "hint": {"ru": "от заявки до решения банка", "kk": "өтінімнен банк шешіміне дейін"}},
    {"key": "reliability", "type": "benefit", "weight": 0.15, "unit": {"ru": "баллы 1–10", "kk": "балл 1–10"},
     "label": {"ru": "Надёжность банка", "kk": "Банк сенімділігі"},
     "hint": {"ru": "рейтинг, отзывы, срок на рынке", "kk": "рейтинг, пікірлер, нарықтағы мерзімі"}},
    {"key": "flexibility", "type": "benefit", "weight": 0.10, "unit": {"ru": "баллы 1–10", "kk": "балл 1–10"},
     "label": {"ru": "Гибкость условий", "kk": "Шарттардың икемділігі"},
     "hint": {"ru": "досрочное погашение, отсрочка, рефинансирование", "kk": "мерзімінен бұрын өтеу, кейінге қалдыру, қайта қаржыландыру"}},
]


def _title(o: dict, lang: str) -> str:
    return f"{o['bank']} — {KIND_LABEL[o['kind']][lang]} ({o['term']} {'мес' if lang == 'ru' else 'ай'})"


def build_problem(profile: FinancialProfile | None, credits: list[Credit], price: int, lang: str = "ru") -> dict:
    """Decision matrix for this user: overpayment and debt load depend on the price and the profile."""
    income = fin.income_total(profile) if profile else 0
    payments = fin.payments_total(credits)
    source = "profile"
    if income <= 0:
        income, payments, source = DEMO_INCOME, DEMO_PAYMENTS, "demo"

    alternatives, matrix = [], {}
    for o in OFFERS:
        overpay = round(price * o["markup"])
        monthly = round((price + overpay) / o["term"])
        load = round((payments + monthly) / income * 100, 1)
        alternatives.append({"code": o["code"], "title": _title(o, lang), "bank": o["bank"], "kind": o["kind"],
                             "term": o["term"], "monthly_payment": monthly})
        matrix[o["code"]] = {
            "rate": o["rate"], "overpay": overpay, "debt_load": load, "approval": o["approval"],
            "reliability": o["reliability"], "flexibility": o["flexibility"],
        }
    criteria = [{"key": c["key"], "type": c["type"], "weight": c["weight"], "unit": c["unit"][lang],
                 "label": c["label"][lang], "hint": c["hint"][lang]} for c in CRITERIA]
    return {
        "base": {"price": price, "income": income, "payments": payments, "source": source,
                 "load_now": round(payments / income * 100, 1), "max_load": 45.0},
        "alternatives": alternatives,
        "criteria": criteria,
        "matrix": matrix,
    }


# ------------------------------------------------------------------ validation

def validate(matrix: dict[str, dict[str, float]], types: dict[str, CriterionType], weights: dict[str, float]) -> list[str]:
    errors: list[str] = []
    if not matrix:
        return ["empty_matrix"]
    keys = set(types)
    if set(weights) != keys:
        errors.append("weights_criteria_mismatch")
    for code, row in matrix.items():
        missing = sorted(k for k in keys if k not in row or row[k] is None)
        if missing:
            errors.append(f"missing_values:{code}:{','.join(missing)}")
        for k, v in row.items():
            if isinstance(v, bool) or not isinstance(v, (int, float)) or (isinstance(v, float) and not math.isfinite(v)):
                errors.append(f"not_numeric:{code}:{k}")
            elif types.get(k) == "cost" and v <= 0:
                errors.append(f"cost_not_positive:{code}:{k}")
    if any(w < 0 for w in weights.values()):
        errors.append("negative_weight")
    total = sum(weights.values())
    if abs(total - 1.0) > 1e-6:
        errors.append(f"weights_sum:{total:.4f}")
    bad = [k for k, t in types.items() if t not in ("benefit", "cost")]
    if bad:
        errors.append("bad_type:" + ",".join(bad))
    return errors


# ------------------------------------------------------------------ normalization

def normalize_linear(matrix: dict[str, dict[str, float]], types: dict[str, CriterionType]) -> dict[str, dict[str, float]]:
    """WSM: benefit x/max, cost min/x. Every value ends up in (0, 1]."""
    out = {code: {} for code in matrix}
    for k, t in types.items():
        col = [row[k] for row in matrix.values()]
        hi, lo = max(col), min(col)
        for code, row in matrix.items():
            out[code][k] = (row[k] / hi if hi else 0.0) if t == "benefit" else (lo / row[k])
    return out


def normalize_vector(matrix: dict[str, dict[str, float]], keys: list[str]) -> dict[str, dict[str, float]]:
    """TOPSIS: x / sqrt(sum x²) per column."""
    out = {code: {} for code in matrix}
    for k in keys:
        norm = math.sqrt(sum(row[k] ** 2 for row in matrix.values()))
        for code, row in matrix.items():
            out[code][k] = row[k] / norm if norm else 0.0
    return out


# ------------------------------------------------------------------ methods

def _ranks(scores: dict[str, float]) -> dict[str, int]:
    ordered = sorted(scores.values(), reverse=True)
    return {code: 1 + ordered.index(s) for code, s in scores.items()}  # ties share the best rank


def wsm(matrix, types, weights) -> tuple[list[dict], dict]:
    norm = normalize_linear(matrix, types)
    scores = {code: sum(norm[code][k] * weights[k] for k in weights) for code in matrix}
    ranks = _ranks(scores)
    rows = [{"code": c, "score": round(s, 4), "rank": ranks[c]} for c, s in scores.items()]
    return sorted(rows, key=lambda r: r["rank"]), norm


def topsis(matrix, types, weights) -> tuple[list[dict], dict]:
    keys = list(weights)
    norm = normalize_vector(matrix, keys)
    weighted = {code: {k: norm[code][k] * weights[k] for k in keys} for code in matrix}
    best, worst = {}, {}
    for k in keys:
        col = [weighted[c][k] for c in matrix]
        best[k], worst[k] = (max(col), min(col)) if types[k] == "benefit" else (min(col), max(col))
    rows = []
    for code in matrix:
        d_best = math.sqrt(sum((weighted[code][k] - best[k]) ** 2 for k in keys))
        d_worst = math.sqrt(sum((weighted[code][k] - worst[k]) ** 2 for k in keys))
        closeness = d_worst / (d_best + d_worst) if d_best + d_worst else 0.0
        rows.append({"code": code, "d_best": round(d_best, 4), "d_worst": round(d_worst, 4), "closeness": round(closeness, 4)})
    ranks = _ranks({r["code"]: r["closeness"] for r in rows})
    for r in rows:
        r["rank"] = ranks[r["code"]]
    steps = {"normalized": norm, "weighted": weighted, "ideal_best": best, "ideal_worst": worst}
    return sorted(rows, key=lambda r: r["rank"]), steps


def _spearman(a: dict[str, int], b: dict[str, int]) -> float:
    """Spearman ρ = Pearson correlation of the ranks."""
    codes = list(a)
    n = len(codes)
    if n < 2:
        return 1.0
    xa = [a[c] for c in codes]
    xb = [b[c] for c in codes]
    ma, mb = sum(xa) / n, sum(xb) / n
    cov = sum((x - ma) * (y - mb) for x, y in zip(xa, xb))
    va = math.sqrt(sum((x - ma) ** 2 for x in xa))
    vb = math.sqrt(sum((y - mb) ** 2 for y in xb))
    return round(cov / (va * vb), 4) if va and vb else 1.0


def run(matrix: dict[str, dict[str, float]], types: dict[str, CriterionType], weights: dict[str, float]) -> dict:
    """Full pipeline; call `validate` first."""
    wsm_rows, norm_linear = wsm(matrix, types, weights)
    topsis_rows, steps = topsis(matrix, types, weights)
    w_by = {r["code"]: r for r in wsm_rows}
    t_by = {r["code"]: r for r in topsis_rows}
    comparison = sorted(
        [{"code": c, "wsm_score": w_by[c]["score"], "wsm_rank": w_by[c]["rank"],
          "topsis_closeness": t_by[c]["closeness"], "topsis_rank": t_by[c]["rank"],
          "rank_diff": abs(w_by[c]["rank"] - t_by[c]["rank"])} for c in matrix],
        key=lambda r: r["wsm_rank"],
    )
    w_ranks = {c: w_by[c]["rank"] for c in matrix}
    t_ranks = {c: t_by[c]["rank"] for c in matrix}
    summary = {
        "wsm_winner": wsm_rows[0]["code"],
        "topsis_winner": topsis_rows[0]["code"],
        "same_winner": wsm_rows[0]["code"] == topsis_rows[0]["code"],
        "identical_ranking": all(w_ranks[c] == t_ranks[c] for c in matrix),
        "differing": [c for c in matrix if w_ranks[c] != t_ranks[c]],
        "spearman_rho": _spearman(w_ranks, t_ranks),
    }
    return {
        "normalized_linear": norm_linear,
        "normalized_vector": steps["normalized"],
        "weighted": steps["weighted"],
        "ideal_best": steps["ideal_best"],
        "ideal_worst": steps["ideal_worst"],
        "wsm": wsm_rows,
        "topsis": topsis_rows,
        "comparison": comparison,
        "summary": summary,
    }
