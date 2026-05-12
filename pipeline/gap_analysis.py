"""
Gap analysis — schedule, budget, and scope-creep variance.

Inputs come from Supabase via `data_collector.fetch(org_id)`. Outputs are
appended to the report state under `state["variance"]`.
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd


@dataclass
class Variance:
    project_code: str
    schedule_days: float        # +ve = behind, -ve = ahead
    budget_pct: float           # +ve = over budget
    scope_creep_pct: float      # added milestones since baseline / total


def schedule_variance(milestones: pd.DataFrame) -> pd.Series:
    """Average days slipped across completed and in-progress milestones."""
    df = milestones.copy()
    df["actual_or_today"] = pd.to_datetime(df["actual_date"]).fillna(pd.Timestamp.utcnow())
    df["planned"] = pd.to_datetime(df["planned_date"])
    df["slip_days"] = (df["actual_or_today"] - df["planned"]).dt.days
    return df.groupby("project_id")["slip_days"].mean()


def budget_variance(projects: pd.DataFrame) -> pd.Series:
    """(spent - planned share of budget) / budget — assumes linear plan."""
    df = projects.copy()
    today = pd.Timestamp.utcnow().normalize()
    df["start"] = pd.to_datetime(df["start_date"])
    df["target"] = pd.to_datetime(df["target_date"])
    df["pct_elapsed"] = ((today - df["start"]) / (df["target"] - df["start"])).clip(0, 1)
    df["expected_spend"] = df["budget_usd"] * df["pct_elapsed"]
    df["over_pct"] = (df["spent_usd"] - df["expected_spend"]) / df["budget_usd"].replace(0, pd.NA)
    return df.set_index("id")["over_pct"]


def scope_creep(milestones: pd.DataFrame, baseline_count: dict[str, int]) -> pd.Series:
    """Added milestones vs. baseline — needs a baseline count per project."""
    by_proj = milestones.groupby("project_id").size()
    out = {}
    for pid, current in by_proj.items():
        base = baseline_count.get(pid, current)
        out[pid] = (current - base) / max(1, base)
    return pd.Series(out)


def compute(projects: pd.DataFrame, milestones: pd.DataFrame, baseline_count: dict[str, int]) -> list[Variance]:
    sched = schedule_variance(milestones)
    budget = budget_variance(projects)
    creep = scope_creep(milestones, baseline_count)

    rows: list[Variance] = []
    for _, p in projects.iterrows():
        rows.append(
            Variance(
                project_code=p["code"],
                schedule_days=float(sched.get(p["id"], 0.0) or 0.0),
                budget_pct=float(budget.get(p["id"], 0.0) or 0.0),
                scope_creep_pct=float(creep.get(p["id"], 0.0) or 0.0),
            )
        )
    return rows
