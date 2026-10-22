"""Ядро многокритериальной DSS: валидация, нормализация, WSM, TOPSIS, сравнение.

Pipeline:  Input -> validate -> normalize -> WSM -> TOPSIS -> ranking -> compare
"""

from __future__ import annotations

import numpy as np
import pandas as pd


class ValidationError(ValueError):
    """Исходные данные не прошли проверку."""


# ---------------------------------------------------------------- validation

def validate(matrix: pd.DataFrame, types: dict[str, str], weights: dict[str, float]) -> list[str]:
    """Проверяет матрицу, типы и веса. Возвращает список сообщений об ошибках (пустой — всё ок)."""
    errors: list[str] = []

    if matrix.empty:
        errors.append("Decision matrix пуста.")
        return errors

    # 1. Все ли альтернативы имеют значения по всем критериям / нет ли пропусков
    missing = matrix.isna()
    if missing.values.any():
        for alt, row in missing.iterrows():
            cols = list(row[row].index)
            if cols:
                errors.append(f"Пропущенные значения у {alt}: {cols}")

    # 2. Все ли критерии числовые
    for col in matrix.columns:
        if not pd.api.types.is_numeric_dtype(matrix[col]):
            errors.append(f"Критерий '{col}' не числовой (dtype={matrix[col].dtype}).")

    # 3. Совпадают ли наборы критериев в матрице, типах и весах
    cols = set(matrix.columns)
    if set(types) != cols:
        errors.append(f"Типы критериев не совпадают со столбцами матрицы: {sorted(set(types) ^ cols)}")
    if set(weights) != cols:
        errors.append(f"Веса не совпадают со столбцами матрицы: {sorted(set(weights) ^ cols)}")

    # 4. Типы только benefit/cost
    bad_types = {k: v for k, v in types.items() if v not in ("benefit", "cost")}
    if bad_types:
        errors.append(f"Недопустимые типы критериев (нужно benefit/cost): {bad_types}")

    # 5. Веса неотрицательные и в сумме дают 1
    if any(w < 0 for w in weights.values()):
        errors.append("Есть отрицательные веса.")
    total = float(sum(weights.values()))
    if not np.isclose(total, 1.0, atol=1e-6):
        errors.append(f"Сумма весов равна {total:.4f}, а должна быть 1.0.")

    # 6. Уникальные альтернативы
    if matrix.index.duplicated().any():
        errors.append("Есть повторяющиеся названия альтернатив.")

    return errors


def validate_or_raise(matrix: pd.DataFrame, types: dict[str, str], weights: dict[str, float]) -> None:
    errors = validate(matrix, types, weights)
    if errors:
        raise ValidationError("\n".join(errors))


# ------------------------------------------------------------- normalization

def normalize_linear(matrix: pd.DataFrame, types: dict[str, str]) -> pd.DataFrame:
    """Линейная нормализация для WSM (все значения попадают в (0, 1]).

    benefit: r = x / max(x)   — чем больше, тем лучше
    cost:    r = min(x) / x   — чем меньше, тем лучше
    """
    norm = pd.DataFrame(index=matrix.index, columns=matrix.columns, dtype=float)
    for col in matrix.columns:
        x = matrix[col].astype(float)
        if types[col] == "benefit":
            norm[col] = x / x.max()
        else:
            if (x <= 0).any():
                raise ValidationError(
                    f"Cost-критерий '{col}' содержит значения <= 0, нормализация min/x невозможна."
                )
            norm[col] = x.min() / x
    return norm


def normalize_vector(matrix: pd.DataFrame) -> pd.DataFrame:
    """Векторная нормализация для TOPSIS: r = x / sqrt(sum(x^2)).

    Направление критерия (benefit/cost) учитывается на шаге выбора идеальных решений.
    """
    x = matrix.astype(float)
    denom = np.sqrt((x ** 2).sum(axis=0))
    return x / denom


# ---------------------------------------------------------------------- WSM

def wsm(matrix: pd.DataFrame, types: dict[str, str], weights: dict[str, float]) -> pd.DataFrame:
    """Weighted Sum Model. Возвращает таблицу score + rank (1 — лучший)."""
    norm = normalize_linear(matrix, types)
    w = pd.Series(weights, dtype=float)[norm.columns]
    scores = (norm * w).sum(axis=1)
    out = pd.DataFrame({"score": scores})
    out["rank"] = out["score"].rank(ascending=False, method="min").astype(int)
    return out.sort_values("rank")


# ------------------------------------------------------------------- TOPSIS

def topsis(
    matrix: pd.DataFrame, types: dict[str, str], weights: dict[str, float]
) -> tuple[pd.DataFrame, dict]:
    """TOPSIS. Возвращает (таблица с d+, d-, closeness, rank) и словарь промежуточных шагов."""
    # 1. нормализация (векторная)
    norm = normalize_vector(matrix)
    # 2. взвешивание
    w = pd.Series(weights, dtype=float)[norm.columns]
    weighted = norm * w
    # 3-4. идеальное лучшее и идеальное худшее решения
    ideal_best = pd.Series(index=weighted.columns, dtype=float)
    ideal_worst = pd.Series(index=weighted.columns, dtype=float)
    for col in weighted.columns:
        if types[col] == "benefit":
            ideal_best[col], ideal_worst[col] = weighted[col].max(), weighted[col].min()
        else:
            ideal_best[col], ideal_worst[col] = weighted[col].min(), weighted[col].max()
    # 5. евклидовы расстояния до идеалов
    d_best = np.sqrt(((weighted - ideal_best) ** 2).sum(axis=1))
    d_worst = np.sqrt(((weighted - ideal_worst) ** 2).sum(axis=1))
    # 6. коэффициент близости к идеальному решению
    closeness = d_worst / (d_best + d_worst)
    # 7. рейтинг
    out = pd.DataFrame({"d_best": d_best, "d_worst": d_worst, "closeness": closeness})
    out["rank"] = out["closeness"].rank(ascending=False, method="min").astype(int)
    steps = {
        "normalized": norm,
        "weighted": weighted,
        "ideal_best": ideal_best,
        "ideal_worst": ideal_worst,
    }
    return out.sort_values("rank"), steps


# ------------------------------------------------------------------ compare

def compare(wsm_result: pd.DataFrame, topsis_result: pd.DataFrame) -> pd.DataFrame:
    """Сводная таблица: WSM score/rank и TOPSIS closeness/rank по каждой альтернативе."""
    table = pd.DataFrame(
        {
            "WSM score": wsm_result["score"],
            "WSM rank": wsm_result["rank"],
            "TOPSIS closeness": topsis_result["closeness"],
            "TOPSIS rank": topsis_result["rank"],
        }
    )
    table["Rank diff"] = (table["WSM rank"] - table["TOPSIS rank"]).abs()
    return table.sort_values("WSM rank")


def compare_summary(table: pd.DataFrame) -> dict:
    """Ответы на вопросы задания: одинаковый ли победитель, отличаются ли рейтинги, корреляция Спирмена."""
    wsm_winner = table["WSM rank"].idxmin()
    topsis_winner = table["TOPSIS rank"].idxmin()
    same_winner = wsm_winner == topsis_winner
    identical = bool((table["WSM rank"] == table["TOPSIS rank"]).all())
    # Спирмен = Пирсон по рангам (scipy не нужен)
    rho = float(table["WSM rank"].astype(float).corr(table["TOPSIS rank"].astype(float)))
    return {
        "wsm_winner": wsm_winner,
        "topsis_winner": topsis_winner,
        "same_winner": same_winner,
        "identical_ranking": identical,
        "differing_alternatives": list(table.index[table["Rank diff"] > 0]),
        "spearman_rho": rho,
    }


# ------------------------------------------------------------- full pipeline

def run_pipeline(matrix: pd.DataFrame, types: dict[str, str], weights: dict[str, float]) -> dict:
    """Input -> validate -> normalize -> WSM -> TOPSIS -> compare. Возвращает все промежуточные результаты."""
    validate_or_raise(matrix, types, weights)
    wsm_res = wsm(matrix, types, weights)
    topsis_res, topsis_steps = topsis(matrix, types, weights)
    table = compare(wsm_res, topsis_res)
    return {
        "matrix": matrix,
        "normalized_linear": normalize_linear(matrix, types),
        "wsm": wsm_res,
        "topsis": topsis_res,
        "topsis_steps": topsis_steps,
        "comparison": table,
        "summary": compare_summary(table),
    }
