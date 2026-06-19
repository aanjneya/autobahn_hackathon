"""Train a Stau-category classifier and forecast 2026-2029.

Pipeline position (final stage):
    pipeline.py -> labels.py -> features.py -> merge.py -> model.py

Reads  : data/processed/train.csv, data/processed/forecast_input.csv
Writes : data/processed/forecast.csv

Run    : python src/model.py
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier, early_stopping, log_evaluation
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
)
from sklearn.utils.class_weight import compute_class_weight

PROC = Path(__file__).resolve().parent.parent / "data" / "processed"

# --- Adjustable knobs ------------------------------------------------------
VAL_YEAR = 2025  # rows with year < VAL_YEAR train, year == VAL_YEAR validate
CLASSES = [1, 2, 3, 4, 5]  # ordered congestion categories (1 = frei, 5 = Stau)

LGBM_PARAMS = dict(
    objective="multiclass",
    num_class=len(CLASSES),
    n_estimators=400,
    learning_rate=0.05,
    num_leaves=31,
    max_depth=-1,
    min_child_samples=20,
    subsample=0.9,
    colsample_bytree=0.9,
    random_state=42,
    n_jobs=-1,
    verbose=-1,
)

NUMERIC_FEATURES = [
    "dow", "month", "week", "is_weekend", "is_friday", "is_sunday",
    "sin_week", "cos_week",
    "is_feiertag_by", "is_feiertag_at",
    "is_pre_feiertag_by", "is_post_feiertag_by",
    "is_pre_feiertag_at", "is_post_feiertag_at",
    "is_brueckentag_by", "is_brueckentag_at",
    "is_long_weekend_by", "is_long_weekend_at",
    "is_ferien_by", "is_ferien_at", "is_ferien_overlap",
    "is_oktoberfest", "is_messe_mch", "is_dosierung",
    "time_slot_idx",
]
CATEGORICAL_FEATURES = ["strecke", "richtung"]
FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES
# ---------------------------------------------------------------------------


def make_target(category: pd.Series) -> pd.Series:
    """Map ordered category 1..5 -> 0-indexed labels 0..4 for LightGBM.

    Swap this out to reframe the target (e.g. binary Stau vs. frei by
    returning ``(category >= 4).astype(int)``).
    """
    return category.astype(int) - 1


def label_to_category(label: np.ndarray) -> np.ndarray:
    """Inverse of make_target: 0..4 -> 1..5."""
    return label + 1


def prepare(df: pd.DataFrame) -> pd.DataFrame:
    """Select features and ensure categoricals have the right dtype."""
    X = df[FEATURES].copy()
    for col in CATEGORICAL_FEATURES:
        X[col] = X[col].astype("category")
    return X


def fit_model(X: pd.DataFrame, y: pd.Series, eval_set=None) -> LGBMClassifier:
    """Fit a class-weighted LGBMClassifier (optional early stopping)."""
    weights = compute_class_weight("balanced", classes=np.unique(y), y=y)
    weight_map = dict(zip(np.unique(y), weights))
    sample_weight = y.map(weight_map)

    model = LGBMClassifier(**LGBM_PARAMS)
    fit_kwargs = dict(
        sample_weight=sample_weight,
        categorical_feature=CATEGORICAL_FEATURES,
    )
    if eval_set is not None:
        fit_kwargs["eval_set"] = [eval_set]
        fit_kwargs["callbacks"] = [early_stopping(50), log_evaluation(0)]
    model.fit(X, y, **fit_kwargs)
    return model


def evaluate(train: pd.DataFrame) -> None:
    """Time-based holdout: train < VAL_YEAR, validate == VAL_YEAR."""
    year = pd.to_datetime(train["datum"]).dt.year
    tr, va = train[year < VAL_YEAR], train[year == VAL_YEAR]
    if va.empty:
        print(f"[warn] no rows for validation year {VAL_YEAR}; skipping eval.")
        return

    X_tr, y_tr = prepare(tr), make_target(tr["category"])
    X_va, y_va = prepare(va), make_target(va["category"])

    model = fit_model(X_tr, y_tr, eval_set=(X_va, y_va))
    pred = model.predict(X_va)

    print(f"\n=== Validation (train <{VAL_YEAR}: {len(tr)} rows, "
          f"val {VAL_YEAR}: {len(va)} rows) ===")
    print(f"accuracy : {accuracy_score(y_va, pred):.3f}")
    print(f"macro-F1 : {f1_score(y_va, pred, average='macro'):.3f}")
    baseline = y_va.value_counts(normalize=True).max()
    print(f"baseline (majority class): {baseline:.3f}")
    print("\nPer-class report (labels shown as category 1..5):")
    print(classification_report(
        label_to_category(y_va.to_numpy()),
        label_to_category(pred),
        labels=CLASSES, zero_division=0,
    ))
    print("Confusion matrix (rows = true 1..5, cols = pred 1..5):")
    print(confusion_matrix(
        label_to_category(y_va.to_numpy()),
        label_to_category(pred),
        labels=CLASSES,
    ))


def forecast(train: pd.DataFrame) -> pd.DataFrame:
    """Refit on all data, score forecast_input.csv -> forecast.csv."""
    X_all, y_all = prepare(train), make_target(train["category"])
    model = fit_model(X_all, y_all)

    scaffold = pd.read_csv(PROC / "forecast_input.csv")
    X_fc = prepare(scaffold)
    proba = model.predict_proba(X_fc)
    pred = label_to_category(np.asarray(model.classes_)[proba.argmax(axis=1)])

    out = scaffold[["datum", "strecke", "richtung", "time_slot"]].copy()
    out["pred_category"] = pred.astype(int)
    # model.classes_ are 0-indexed labels; map columns back to category 1..5.
    for col_idx, label in enumerate(model.classes_):
        out[f"prob_{label_to_category(label)}"] = proba[:, col_idx].round(4)

    out_path = PROC / "forecast.csv"
    out.to_csv(out_path, index=False)
    print(f"\nforecast.csv: {len(out)} rows -> {out_path}")
    print("\nPredicted category distribution (2026-2029):")
    print(out["pred_category"].value_counts().sort_index())

    print("\nFeature importances (top 12):")
    imp = pd.Series(model.feature_importances_, index=FEATURES)
    print(imp.sort_values(ascending=False).head(12).to_string())
    return out


def main() -> None:
    train = pd.read_csv(PROC / "train.csv")
    evaluate(train)
    forecast(train)


if __name__ == "__main__":
    main()
