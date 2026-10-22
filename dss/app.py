"""Streamlit-интерфейс DSS: пользователь меняет веса (и значения матрицы), результат пересчитывается.

    streamlit run app.py
"""

from __future__ import annotations

import pandas as pd
import streamlit as st

import data
import mcdm
import viz

st.set_page_config(page_title="DSS: выбор кредитного предложения", layout="wide")

st.title("DSS: выбор кредитного предложения")
st.caption(
    f"Покупка на {data.PURCHASE_AMOUNT:,} тг · доход {data.MONTHLY_INCOME:,} тг/мес · "
    f"текущие платежи {data.CURRENT_PAYMENTS:,} тг/мес. Методы: WSM и TOPSIS. Данные условные."
)

# ------------------------------------------------------------------ sidebar: веса
st.sidebar.header("Веса критериев")
st.sidebar.caption("Сумма должна быть равна 1.0. Кнопка ниже нормирует веса автоматически.")

KEYS = [f"w_{name}" for name in data.CRITERIA]
for name in data.CRITERIA:
    st.session_state.setdefault(f"w_{name}", float(data.WEIGHTS[name]))


def normalize_weights() -> None:
    """on_click: делит каждый вес на сумму. Колбэк выполняется до создания слайдеров, поэтому менять state можно."""
    total = sum(st.session_state[k] for k in KEYS)
    if total > 0:
        for k in KEYS:
            st.session_state[k] = round(st.session_state[k] / total, 4)


def reset_weights() -> None:
    for name, w in data.WEIGHTS.items():
        st.session_state[f"w_{name}"] = float(w)


raw: dict[str, float] = {}
for name, (ctype, unit, desc) in data.CRITERIA.items():
    raw[name] = st.sidebar.slider(
        f"{name} ({ctype}, {unit})",
        min_value=0.0, max_value=1.0, step=0.01,
        help=desc, key=f"w_{name}",
    )

total = sum(raw.values())
st.sidebar.metric("Сумма весов", f"{total:.2f}")
st.sidebar.button("Нормировать веса до 1.0", on_click=normalize_weights, disabled=total == 0)
st.sidebar.button("Сбросить к исходным", on_click=reset_weights)

weights = raw

# ---------------------------------------------------------- матрица (редактируемая)
st.subheader("1. Input: decision matrix")
with st.expander("Альтернативы", expanded=False):
    for code, name in data.ALTERNATIVES.items():
        st.write(f"**{code}** — {name}")

types_row = pd.DataFrame(
    {c: [data.CRITERIA_TYPES[c], data.CRITERIA_UNITS[c]] for c in data.CRITERIA},
    index=["тип", "единица"],
)
st.dataframe(types_row, width="stretch")

matrix = st.data_editor(
    data.DECISION_MATRIX.copy(),
    width="stretch",
    num_rows="fixed",
    key="matrix_editor",
)
matrix = matrix.apply(pd.to_numeric, errors="coerce")

# ------------------------------------------------------------------ validation
st.subheader("2. Data validation")
errors = mcdm.validate(matrix, data.CRITERIA_TYPES, weights)
if errors:
    for e in errors:
        st.error(e)
    st.stop()
st.success("Пропусков нет · все критерии числовые · сумма весов = 1 · все альтернативы заполнены")

result = mcdm.run_pipeline(matrix, data.CRITERIA_TYPES, weights)
s = result["summary"]

# ---------------------------------------------------------------- результаты
col_a, col_b, col_c = st.columns(3)
col_a.metric("Победитель WSM", s["wsm_winner"], data.ALTERNATIVES.get(s["wsm_winner"], ""))
col_b.metric("Победитель TOPSIS", s["topsis_winner"], data.ALTERNATIVES.get(s["topsis_winner"], ""))
col_c.metric("Спирмен ρ (WSM vs TOPSIS)", f"{s['spearman_rho']:.3f}",
             "рейтинги совпадают" if s["identical_ranking"] else f"отличаются: {', '.join(s['differing_alternatives'])}")

st.subheader("3. Normalization")
tab1, tab2 = st.tabs(["Линейная (для WSM)", "Векторная (для TOPSIS)"])
with tab1:
    st.dataframe(result["normalized_linear"].style.format("{:.4f}"), width="stretch")
with tab2:
    st.dataframe(result["topsis_steps"]["normalized"].style.format("{:.4f}"), width="stretch")

left, right = st.columns(2)
with left:
    st.subheader("4. WSM")
    st.dataframe(result["wsm"].style.format({"score": "{:.4f}"}), width="stretch")
with right:
    st.subheader("5. TOPSIS")
    st.dataframe(
        result["topsis"].style.format({"d_best": "{:.4f}", "d_worst": "{:.4f}", "closeness": "{:.4f}"}),
        width="stretch",
    )
    with st.expander("Промежуточные шаги TOPSIS"):
        st.write("Взвешенная нормализованная матрица")
        st.dataframe(result["topsis_steps"]["weighted"].style.format("{:.4f}"), width="stretch")
        ideals = pd.DataFrame(
            {"ideal best (A+)": result["topsis_steps"]["ideal_best"],
             "ideal worst (A-)": result["topsis_steps"]["ideal_worst"]}
        )
        st.dataframe(ideals.style.format("{:.4f}"), width="stretch")

st.subheader("6. Compare methods")
st.dataframe(
    result["comparison"].style.format({"WSM score": "{:.4f}", "TOPSIS closeness": "{:.4f}"}),
    width="stretch",
)

st.subheader("7. Visualization")
c1, c2 = st.columns(2)
with c1:
    st.pyplot(viz.bar_scores(result["comparison"], data.ALTERNATIVES), width="stretch")
    st.pyplot(viz.ranking_chart(result["comparison"]), width="stretch")
with c2:
    st.pyplot(viz.heatmap_matrix(result["normalized_linear"]), width="stretch")
