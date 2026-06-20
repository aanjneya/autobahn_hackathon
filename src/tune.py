"""Optuna hyperparameter tuning for the LightGBM Stau classifier.

Optimises macro-F1 on a time-based holdout (train < VAL_YEAR, val == VAL_YEAR)
and writes the best params to data/processed/best_params.json. model.py
picks that file up automatically on the next run.

Usage:
    python src/tune.py --trials 50
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import optuna
import pandas as pd
from lightgbm import LGBMClassifier, early_stopping, log_evaluation
from sklearn.metrics import f1_score
from sklearn.utils.class_weight import compute_class_weight

from model import (
    CATEGORICAL_FEATURES,
    CLASSES,
    PROC,
    VAL_YEAR,
    make_target,
    prepare,
)

BEST_PATH = PROC / "best_params.json"


def objective(trial: optuna.Trial, X_tr, y_tr, X_va, y_va, sample_weight) -> float:
    params = dict(
        objective="multiclass",
        num_class=len(CLASSES),
        n_estimators=trial.suggest_int("n_estimators", 200, 1500),
        learning_rate=trial.suggest_float("learning_rate", 0.01, 0.15, log=True),
        num_leaves=trial.suggest_int("num_leaves", 15, 127),
        max_depth=trial.suggest_int("max_depth", -1, 12),
        min_child_samples=trial.suggest_int("min_child_samples", 5, 100),
        subsample=trial.suggest_float("subsample", 0.6, 1.0),
        colsample_bytree=trial.suggest_float("colsample_bytree", 0.5, 1.0),
        reg_alpha=trial.suggest_float("reg_alpha", 1e-4, 5.0, log=True),
        reg_lambda=trial.suggest_float("reg_lambda", 1e-4, 5.0, log=True),
        random_state=42,
        n_jobs=-1,
        verbose=-1,
    )
    model = LGBMClassifier(**params)
    model.fit(
        X_tr, y_tr,
        sample_weight=sample_weight,
        eval_set=[(X_va, y_va)],
        categorical_feature=CATEGORICAL_FEATURES,
        callbacks=[early_stopping(40), log_evaluation(0)],
    )
    pred = model.predict(X_va)
    return f1_score(y_va, pred, average="macro")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--trials", type=int, default=40)
    parser.add_argument("--timeout", type=int, default=None,
                        help="Optional time budget in seconds")
    args = parser.parse_args()

    train = pd.read_csv(PROC / "train.csv")
    year = pd.to_datetime(train["datum"]).dt.year
    tr, va = train[year < VAL_YEAR], train[year == VAL_YEAR]

    X_tr, y_tr = prepare(tr), make_target(tr["category"])
    X_va, y_va = prepare(va), make_target(va["category"])

    weights = compute_class_weight("balanced", classes=np.unique(y_tr), y=y_tr)
    weight_map = dict(zip(np.unique(y_tr), weights))
    sample_weight = y_tr.map(weight_map)

    study = optuna.create_study(
        direction="maximize",
        sampler=optuna.samplers.TPESampler(seed=42),
        pruner=optuna.pruners.MedianPruner(n_warmup_steps=10),
    )
    optuna.logging.set_verbosity(optuna.logging.WARNING)

    def cb(study, trial):
        print(f"[trial {trial.number:>3}] macro-F1 = {trial.value:.4f} "
              f"(best so far: {study.best_value:.4f})")

    study.optimize(
        lambda t: objective(t, X_tr, y_tr, X_va, y_va, sample_weight),
        n_trials=args.trials,
        timeout=args.timeout,
        callbacks=[cb],
    )

    print(f"\nBest macro-F1: {study.best_value:.4f}")
    print("Best params:")
    for k, v in study.best_params.items():
        print(f"  {k}: {v}")

    BEST_PATH.write_text(json.dumps(study.best_params, indent=2))
    print(f"\nSaved -> {BEST_PATH}")


if __name__ == "__main__":
    main()