"""Визуализации DSS (matplotlib). Каждая функция возвращает Figure, чтобы её можно было
и сохранить в PNG (main.py), и показать в Streamlit (app.py)."""

from __future__ import annotations

import matplotlib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

matplotlib.rcParams.update(
    {
        "font.family": "DejaVu Sans",
        "axes.spines.top": False,
        "axes.spines.right": False,
        "axes.edgecolor": "#c3c2b7",
        "axes.labelcolor": "#52514e",
        "xtick.color": "#52514e",
        "ytick.color": "#52514e",
        "axes.grid": True,
        "grid.color": "#e6e5e0",
        "grid.linewidth": 0.6,
        "axes.axisbelow": True,
        "figure.facecolor": "#fcfcfb",
        "axes.facecolor": "#fcfcfb",
    }
)

COLOR_WSM = "#2a78d6"     # категориальный слот 1
COLOR_TOPSIS = "#eb6834"  # категориальный слот 2
TEXT = "#0b0b0b"
MUTED = "#52514e"


def bar_scores(comparison: pd.DataFrame, labels: dict[str, str] | None = None) -> plt.Figure:
    """Bar chart итоговых score: WSM score и TOPSIS closeness рядом по каждой альтернативе."""
    table = comparison.sort_values("WSM rank")
    alts = list(table.index)
    x = np.arange(len(alts))
    width = 0.38

    fig, ax = plt.subplots(figsize=(9, 4.6), constrained_layout=True)
    b1 = ax.bar(x - width / 2 - 0.01, table["WSM score"], width, color=COLOR_WSM, label="WSM score")
    b2 = ax.bar(x + width / 2 + 0.01, table["TOPSIS closeness"], width, color=COLOR_TOPSIS,
                label="TOPSIS closeness")
    for bars in (b1, b2):
        for bar in bars:
            ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.012,
                    f"{bar.get_height():.3f}", ha="center", va="bottom", fontsize=8.5, color=MUTED)

    ax.set_xticks(x)
    ax.set_xticklabels([f"{a}\n{labels[a].split(' — ')[0]}" if labels else a for a in alts], fontsize=9)
    ax.set_ylim(0, 1.08)
    ax.set_ylabel("Итоговая оценка (0–1)")
    ax.set_title("Итоговые оценки альтернатив: WSM и TOPSIS", loc="left", color=TEXT, fontsize=12)
    ax.grid(axis="x", visible=False)
    ax.legend(frameon=False, loc="upper right")
    return fig


def heatmap_matrix(normalized: pd.DataFrame, title: str = "Нормализованная decision matrix") -> plt.Figure:
    """Heatmap нормализованной матрицы: одна последовательная шкала, 1 = лучшее значение по критерию."""
    fig, ax = plt.subplots(figsize=(8, 4.2), constrained_layout=True)
    data = normalized.values.astype(float)
    im = ax.imshow(data, cmap="Blues", vmin=0, vmax=1, aspect="auto")
    ax.set_xticks(range(normalized.shape[1]), labels=normalized.columns, fontsize=9)
    ax.set_yticks(range(normalized.shape[0]), labels=normalized.index, fontsize=9)
    ax.grid(False)
    for i in range(data.shape[0]):
        for j in range(data.shape[1]):
            v = data[i, j]
            ax.text(j, i, f"{v:.2f}", ha="center", va="center", fontsize=8.5,
                    color="#f0efec" if v > 0.62 else TEXT)
    cbar = fig.colorbar(im, ax=ax, fraction=0.04, pad=0.02)
    cbar.set_label("0 — хуже … 1 — лучше", fontsize=8.5)
    ax.set_title(title, loc="left", color=TEXT, fontsize=12)
    return fig


def ranking_chart(comparison: pd.DataFrame) -> plt.Figure:
    """Slope chart рангов: WSM rank слева, TOPSIS rank справа, 1 — лучший (наверху)."""
    table = comparison.sort_values("WSM rank")
    n = len(table)
    fig, ax = plt.subplots(figsize=(6.5, 4.4), constrained_layout=True)
    for alt, row in table.iterrows():
        changed = row["WSM rank"] != row["TOPSIS rank"]
        ax.plot([0, 1], [row["WSM rank"], row["TOPSIS rank"]],
                color=COLOR_TOPSIS if changed else COLOR_WSM, linewidth=2, alpha=0.9,
                marker="o", markersize=7, markeredgecolor="#fcfcfb", markeredgewidth=1.5)
        ax.text(-0.04, row["WSM rank"], f"{alt}  ({int(row['WSM rank'])})", ha="right", va="center",
                fontsize=9.5, color=TEXT)
        ax.text(1.04, row["TOPSIS rank"], f"({int(row['TOPSIS rank'])})  {alt}", ha="left", va="center",
                fontsize=9.5, color=TEXT)
    ax.set_xlim(-0.45, 1.45)
    ax.set_ylim(n + 0.5, 0.5)
    ax.set_xticks([0, 1], labels=["WSM rank", "TOPSIS rank"], fontsize=10)
    ax.set_yticks(range(1, n + 1))
    ax.set_ylabel("Ранг (1 — лучший)")
    ax.grid(axis="x", visible=False)
    ax.set_title("Сравнение рейтингов: оранжевым — ранг изменился", loc="left", color=TEXT, fontsize=12)
    return fig
