"""
Risk model — XGBoost classifier with SHAP explanations.

Features (per project, computed weekly):
    task_age          : median age of open tasks, days
    velocity_trend    : slope of last-4-sprint velocity (negative = bad)
    dependency_depth  : count of upstream dependencies still open
    sentiment_score   : -1..1, NLP over Slack + retro notes
    budget_burn_rate  : actual / planned spend at this milestone
    days_to_milestone : days until next planned milestone
    schedule_variance : days of slip on the most recent milestone

Target:
    1 if the project missed its next milestone by >7 days, else 0.

Trained nightly on the rolling 26-week window. Reported metric: F1
(target > 0.78). MLflow logs every run.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

import mlflow
import numpy as np
import pandas as pd
import shap
import xgboost as xgb
from sklearn.metrics import f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split

log = logging.getLogger(__name__)

FEATURES = [
    "task_age",
    "velocity_trend",
    "dependency_depth",
    "sentiment_score",
    "budget_burn_rate",
    "days_to_milestone",
    "schedule_variance",
]


@dataclass
class RiskScore:
    project_id: str
    score: float
    severity: str
    shap_features: list[dict] = field(default_factory=list)


def severity_for(score: float) -> str:
    if score >= 0.85:
        return "critical"
    if score >= 0.7:
        return "high"
    if score >= 0.45:
        return "medium"
    return "low"


def train(df: pd.DataFrame, *, log_to_mlflow: bool = True) -> xgb.XGBClassifier:
    """Train the XGBoost classifier on a labelled dataframe."""
    X, y = df[FEATURES], df["label"]
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)

    model = xgb.XGBClassifier(
        n_estimators=300,
        max_depth=4,
        learning_rate=0.07,
        subsample=0.85,
        colsample_bytree=0.8,
        objective="binary:logistic",
        eval_metric="aucpr",
        tree_method="hist",
        n_jobs=4,
    )
    model.fit(X_tr, y_tr, eval_set=[(X_te, y_te)], verbose=False)

    pred = (model.predict_proba(X_te)[:, 1] >= 0.5).astype(int)
    metrics = {
        "f1": f1_score(y_te, pred),
        "precision": precision_score(y_te, pred, zero_division=0),
        "recall": recall_score(y_te, pred, zero_division=0),
        "auc": roc_auc_score(y_te, model.predict_proba(X_te)[:, 1]),
    }
    log.info("trained risk model: %s", metrics)

    if log_to_mlflow:
        with mlflow.start_run(run_name="risk-xgboost"):
            mlflow.log_params(model.get_params())
            mlflow.log_metrics(metrics)
            mlflow.xgboost.log_model(model, artifact_path="model")

    return model


def score_projects(model: xgb.XGBClassifier, df: pd.DataFrame) -> list[RiskScore]:
    """Score live projects + attach top-3 SHAP feature contributions."""
    X = df[FEATURES]
    probs = model.predict_proba(X)[:, 1]

    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X)

    scores: list[RiskScore] = []
    for i, (_, row) in enumerate(df.iterrows()):
        contribs = sorted(
            (
                {"feature": f, "contribution": float(shap_values[i][j])}
                for j, f in enumerate(FEATURES)
            ),
            key=lambda d: abs(d["contribution"]),
            reverse=True,
        )[:3]
        scores.append(
            RiskScore(
                project_id=str(row["project_id"]),
                score=float(probs[i]),
                severity=severity_for(float(probs[i])),
                shap_features=contribs,
            )
        )
    return scores


def synthetic_training_set(n: int = 500, *, seed: int = 7) -> pd.DataFrame:
    """Toy generator for bootstrapping before real history exists."""
    rng = np.random.default_rng(seed)
    df = pd.DataFrame(
        {
            "task_age":          rng.gamma(2.0, 4.0, n),
            "velocity_trend":    rng.normal(0.0, 0.4, n),
            "dependency_depth":  rng.poisson(2.0, n),
            "sentiment_score":   rng.normal(0.2, 0.35, n).clip(-1, 1),
            "budget_burn_rate":  rng.normal(0.7, 0.25, n).clip(0, 2),
            "days_to_milestone": rng.integers(1, 90, n),
            "schedule_variance": rng.normal(2.0, 6.0, n),
        }
    )
    logits = (
        0.18 * df["task_age"] / 8
        - 1.6 * df["velocity_trend"]
        + 0.35 * df["dependency_depth"]
        - 1.1 * df["sentiment_score"]
        + 1.4 * (df["budget_burn_rate"] - 0.8)
        + 0.04 * df["schedule_variance"]
        - 0.012 * df["days_to_milestone"]
    )
    df["label"] = (1 / (1 + np.exp(-logits)) > rng.random(n)).astype(int)
    return df
