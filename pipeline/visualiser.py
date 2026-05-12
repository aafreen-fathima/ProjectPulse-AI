"""
Visualiser — Plotly charts that get embedded into the weekly report deck.

All renders return PNG bytes via kaleido so python-pptx can drop them
straight into slides.
"""

from __future__ import annotations

import io

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go


def _to_png(fig: go.Figure, w: int = 1200, h: int = 600) -> bytes:
    return fig.to_image(format="png", width=w, height=h, scale=2)


def risk_heatmap(scores: pd.DataFrame) -> bytes:
    """Project × week heatmap of risk scores."""
    pivot = scores.pivot(index="project_code", columns="week", values="score")
    fig = px.imshow(
        pivot,
        color_continuous_scale=[(0, "#22c55e"), (0.6, "#f59e0b"), (1, "#ef4444")],
        zmin=0,
        zmax=1,
        aspect="auto",
        labels={"color": "Risk score"},
    )
    fig.update_layout(template="plotly_white", title="Portfolio risk heatmap (last 8 weeks)")
    return _to_png(fig)


def burndown(milestones: pd.DataFrame, project_code: str) -> bytes:
    """Cumulative milestones planned vs. completed for one project."""
    df = milestones.sort_values("planned_date")
    df["planned_cum"] = range(1, len(df) + 1)
    df["actual_cum"] = df["actual_date"].notna().cumsum()
    fig = go.Figure()
    fig.add_scatter(x=df["planned_date"], y=df["planned_cum"], name="Planned", mode="lines+markers")
    fig.add_scatter(x=df["planned_date"], y=df["actual_cum"], name="Actual", mode="lines+markers")
    fig.update_layout(template="plotly_white", title=f"{project_code} — burndown")
    return _to_png(fig)


def budget_waterfall(rows: list[dict]) -> bytes:
    """Per-project budget variance waterfall."""
    fig = go.Figure(
        go.Waterfall(
            x=[r["project_code"] for r in rows],
            y=[r["budget_pct"] for r in rows],
            measure=["relative"] * len(rows),
            connector={"line": {"color": "#94a3b8"}},
        )
    )
    fig.update_layout(template="plotly_white", title="Budget variance by project")
    return _to_png(fig)


def risk_trend(history: pd.DataFrame) -> bytes:
    """Portfolio-level risk trend over time."""
    fig = px.line(history, x="week", y="avg_score", markers=True)
    fig.add_hline(y=0.7, line_dash="dash", line_color="#ef4444", annotation_text="High")
    fig.add_hline(y=0.45, line_dash="dash", line_color="#f59e0b", annotation_text="Medium")
    fig.update_layout(template="plotly_white", title="Avg portfolio risk — 12-week trend")
    return _to_png(fig)


def buf(b: bytes) -> io.BytesIO:
    """Convenience for python-pptx, which prefers a BytesIO."""
    return io.BytesIO(b)
