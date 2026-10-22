import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import data  # noqa: E402
import mcdm  # noqa: E402


@pytest.fixture
def small():
    matrix = pd.DataFrame(
        {"price": [100.0, 200.0], "quality": [5.0, 10.0]},
        index=["X", "Y"],
    )
    types = {"price": "cost", "quality": "benefit"}
    weights = {"price": 0.5, "quality": 0.5}
    return matrix, types, weights


def test_validate_ok_on_default_data():
    assert mcdm.validate(data.DECISION_MATRIX, data.CRITERIA_TYPES, data.WEIGHTS) == []


def test_validate_catches_missing_values(small):
    matrix, types, weights = small
    matrix = matrix.copy()
    matrix.loc["X", "price"] = np.nan
    errors = mcdm.validate(matrix, types, weights)
    assert any("Пропущенные" in e for e in errors)


def test_validate_catches_non_numeric(small):
    matrix, types, weights = small
    matrix = matrix.copy()
    matrix["price"] = ["cheap", "expensive"]
    errors = mcdm.validate(matrix, types, weights)
    assert any("не числовой" in e for e in errors)


def test_validate_catches_bad_weight_sum(small):
    matrix, types, _ = small
    errors = mcdm.validate(matrix, types, {"price": 0.7, "quality": 0.5})
    assert any("Сумма весов" in e for e in errors)


def test_validate_catches_missing_criterion_in_weights(small):
    matrix, types, _ = small
    errors = mcdm.validate(matrix, types, {"price": 1.0})
    assert any("Веса не совпадают" in e for e in errors)


def test_linear_normalization_direction(small):
    matrix, types, _ = small
    norm = mcdm.normalize_linear(matrix, types)
    # cost: min/x -> дешёвый X получает 1
    assert norm.loc["X", "price"] == 1.0 and norm.loc["Y", "price"] == 0.5
    # benefit: x/max -> качественный Y получает 1
    assert norm.loc["Y", "quality"] == 1.0 and norm.loc["X", "quality"] == 0.5
    assert ((norm > 0) & (norm <= 1)).all().all()


def test_vector_normalization_unit_columns(small):
    matrix, _, _ = small
    norm = mcdm.normalize_vector(matrix)
    assert np.allclose((norm ** 2).sum(axis=0), 1.0)


def test_wsm_scores_and_ranks(small):
    matrix, types, weights = small
    res = mcdm.wsm(matrix, types, weights)
    assert np.isclose(res.loc["X", "score"], 0.75)
    assert np.isclose(res.loc["Y", "score"], 0.75)
    assert set(res["rank"]) == {1}  # ничья


def test_topsis_closeness_in_unit_interval():
    res, steps = mcdm.topsis(data.DECISION_MATRIX, data.CRITERIA_TYPES, data.WEIGHTS)
    assert ((res["closeness"] >= 0) & (res["closeness"] <= 1)).all()
    assert sorted(res["rank"]) == list(range(1, len(res) + 1))
    # идеальное лучшее по cost-критерию — минимум взвешенного столбца
    assert steps["ideal_best"]["rate"] == steps["weighted"]["rate"].min()
    assert steps["ideal_best"]["reliability"] == steps["weighted"]["reliability"].max()


def test_dominant_alternative_wins_in_both_methods():
    matrix = pd.DataFrame(
        {"price": [100.0, 150.0, 200.0], "quality": [9.0, 7.0, 5.0], "time": [1.0, 2.0, 3.0]},
        index=["best", "mid", "worst"],
    )
    types = {"price": "cost", "quality": "benefit", "time": "cost"}
    weights = {"price": 0.4, "quality": 0.4, "time": 0.2}
    res = mcdm.run_pipeline(matrix, types, weights)
    assert res["summary"]["wsm_winner"] == "best"
    assert res["summary"]["topsis_winner"] == "best"
    assert res["summary"]["identical_ranking"]
    assert res["summary"]["spearman_rho"] == 1.0


def test_pipeline_raises_on_invalid(small):
    matrix, types, _ = small
    with pytest.raises(mcdm.ValidationError):
        mcdm.run_pipeline(matrix, types, {"price": 0.9, "quality": 0.9})
