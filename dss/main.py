"""CLI-вариант DSS (Задание 4.2): веса задаются в коде (data.py) или через --weights.

    python main.py
    python main.py --weights rate=0.3,overpay=0.3,debt_load=0.2,approval=0.05,reliability=0.1,flexibility=0.05

Pipeline: Input -> Validation -> Normalization -> WSM -> TOPSIS -> Ranking -> Visualization.
Графики сохраняются в dss/output/.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

import data
import mcdm
import viz

OUTPUT_DIR = Path(__file__).resolve().parent / "output"

pd.set_option("display.width", 140)
pd.set_option("display.float_format", lambda v: f"{v:,.4f}")


def parse_weights(text: str | None) -> dict[str, float]:
    if not text:
        return dict(data.WEIGHTS)
    weights: dict[str, float] = {}
    for part in text.split(","):
        key, value = part.split("=")
        weights[key.strip()] = float(value)
    return weights


def section(title: str) -> None:
    print("\n" + "=" * 78)
    print(title)
    print("=" * 78)


def main() -> int:
    parser = argparse.ArgumentParser(description="Многокритериальная DSS: WSM + TOPSIS")
    parser.add_argument("--weights", help="веса через запятую: rate=0.2,overpay=0.25,...")
    parser.add_argument("--no-charts", action="store_true", help="не сохранять графики")
    args = parser.parse_args()

    matrix = data.DECISION_MATRIX
    types = data.CRITERIA_TYPES
    weights = parse_weights(args.weights)

    # ---------------------------------------------------------------- 1. Input
    section("1. INPUT — исходные данные")
    print("Альтернативы:")
    for code, name in data.ALTERNATIVES.items():
        print(f"  {code}: {name}")
    print("\nКритерии (тип, единица):")
    for name, (ctype, unit, desc) in data.CRITERIA.items():
        print(f"  {name:12s} {ctype:8s} {unit:12s} {desc}")
    print("\nDecision matrix:")
    print(matrix.to_string(float_format=lambda v: f"{v:g}"))
    print("\nВеса:")
    print(pd.Series(weights, name="weight").to_string())
    print(f"  сумма = {sum(weights.values()):.2f}")

    # ------------------------------------------------------- 2. Data validation
    section("2. DATA VALIDATION")
    errors = mcdm.validate(matrix, types, weights)
    if errors:
        print("Ошибки:")
        for e in errors:
            print("  -", e)
        return 1
    print("Пропусков нет, все критерии числовые, сумма весов = 1, все альтернативы заполнены. OK")

    result = mcdm.run_pipeline(matrix, types, weights)

    # ----------------------------------------------------------- 3. Normalization
    section("3. NORMALIZATION (линейная: benefit x/max, cost min/x)")
    print(result["normalized_linear"])

    # ------------------------------------------------------------------- 4. WSM
    section("4. WEIGHTED SUM MODEL")
    for alt, row in result["wsm"].iterrows():
        print(f"  {alt} → {row['score']:.3f}   (rank {int(row['rank'])})")
    print("\nРейтинг WSM:", " > ".join(result["wsm"].index))

    # ---------------------------------------------------------------- 5. TOPSIS
    section("5. TOPSIS")
    steps = result["topsis_steps"]
    print("5.1 Векторная нормализация:")
    print(steps["normalized"])
    print("\n5.2 Взвешенная нормализованная матрица:")
    print(steps["weighted"])
    print("\n5.3 Ideal best (A+):")
    print(steps["ideal_best"].to_string())
    print("\n5.4 Ideal worst (A-):")
    print(steps["ideal_worst"].to_string())
    print("\n5.5-5.7 Расстояния, closeness, рейтинг:")
    print(result["topsis"])
    for alt, row in result["topsis"].iterrows():
        print(f"  {alt} → {row['closeness']:.3f}   (rank {int(row['rank'])})")
    print("\nРейтинг TOPSIS:", " > ".join(result["topsis"].index))

    # --------------------------------------------------------- 6. Compare methods
    section("6. COMPARE METHODS")
    print(result["comparison"][["WSM score", "WSM rank", "TOPSIS closeness", "TOPSIS rank", "Rank diff"]])
    s = result["summary"]
    print(f"\nПобедитель WSM: {s['wsm_winner']}, победитель TOPSIS: {s['topsis_winner']} → "
          f"{'одинаковый' if s['same_winner'] else 'РАЗНЫЙ'}")
    print(f"Рейтинги полностью совпадают: {'да' if s['identical_ranking'] else 'нет'}; "
          f"отличаются позиции: {s['differing_alternatives'] or '—'}")
    print(f"Корреляция Спирмена между рангами: {s['spearman_rho']:.3f}")

    # ----------------------------------------------------------- 7. Visualization
    if not args.no_charts:
        section("7. VISUALIZATION")
        OUTPUT_DIR.mkdir(exist_ok=True)
        figs = {
            "scores_bar.png": viz.bar_scores(result["comparison"], data.ALTERNATIVES),
            "normalized_heatmap.png": viz.heatmap_matrix(result["normalized_linear"]),
            "ranking_slope.png": viz.ranking_chart(result["comparison"]),
        }
        for name, fig in figs.items():
            path = OUTPUT_DIR / name
            fig.savefig(path, dpi=150)
            print("  сохранено:", path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
