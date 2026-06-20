"""Run the full pipeline end-to-end.

Order: pipeline (clean raw -> clean) -> labels -> features -> merge -> model.

Usage:
    python run_all.py              # full run incl. raw cleaning
    python run_all.py --skip-clean # skip pipeline.py (use existing data/clean/*)
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
sys.path.insert(0, str(SRC))


def step(name: str, fn) -> None:
    print(f"\n{'=' * 70}\n[STEP] {name}\n{'=' * 70}")
    t0 = time.time()
    fn()
    print(f"[done] {name} in {time.time() - t0:.1f}s")


def run_pipeline() -> None:
    from pipeline import process_directory

    raw_root = ROOT / "data" / "raw"
    clean_root = ROOT / "data" / "clean"

    jobs = [
        ("2023-2025_1min_2+0_v", "1min_traffic"),
        ("DAUZ_2+0_1h_2023-2026", "dauz_1h"),
        ("lt_und_fbt", "lt_fbt"),
    ]
    for sub, dtype in jobs:
        in_dir = raw_root / sub
        out_dir = clean_root / sub
        if not in_dir.exists():
            print(f"[skip] {sub}: no raw dir at {in_dir}")
            continue
        process_directory(str(in_dir), str(out_dir), dtype)


def run_labels() -> None:
    from labels import generate_daily_labels

    in_dir = ROOT / "data" / "clean" / "2023-2025_1min_2+0_v"
    out_file = ROOT / "data" / "processed" / "daily_labels.csv"
    generate_daily_labels(str(in_dir), str(out_file))


def run_features() -> None:
    import runpy

    runpy.run_path(str(SRC / "features.py"), run_name="__main__")


def run_merge() -> None:
    from merge import build_forecast_scaffold, build_train

    train = build_train()
    scaffold = build_forecast_scaffold()
    print(f"train.csv:          {len(train)} rows")
    print(f"forecast_input.csv: {len(scaffold)} rows")


def run_climatology() -> None:
    from climatology import main as clim_main

    clim_main()


def run_model() -> dict:
    """Run evaluation + forecast, return summary metrics."""
    import numpy as np
    import pandas as pd
    from sklearn.metrics import (
        accuracy_score,
        classification_report,
        confusion_matrix,
        f1_score,
    )

    from model import (
        CLASSES,
        PROC,
        VAL_YEAR,
        fit_model,
        forecast,
        label_to_category,
        make_target,
        prepare,
    )

    train = pd.read_csv(PROC / "train.csv")
    fc_input = pd.read_csv(PROC / "forecast_input.csv")
    year = pd.to_datetime(train["datum"]).dt.year
    tr, va = train[year < VAL_YEAR], train[year == VAL_YEAR]

    X_tr, y_tr = prepare(tr), make_target(tr["category"])
    X_va, y_va = prepare(va), make_target(va["category"])
    model = fit_model(X_tr, y_tr, eval_set=(X_va, y_va))
    pred = model.predict(X_va)

    acc = accuracy_score(y_va, pred)
    macro_f1 = f1_score(y_va, pred, average="macro")
    weighted_f1 = f1_score(y_va, pred, average="weighted")
    baseline = y_va.value_counts(normalize=True).max()

    print(f"\n=== Validation (train <{VAL_YEAR}: {len(tr)} rows, "
          f"val {VAL_YEAR}: {len(va)} rows) ===")
    print(f"accuracy : {acc:.3f}")
    print(f"macro-F1 : {macro_f1:.3f}")
    print(f"baseline (majority class): {baseline:.3f}")
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

    per_class_f1 = f1_score(y_va, pred, average=None, labels=np.arange(len(CLASSES)))
    fc = forecast(train, fc_input)

    return {
        "train_rows": len(tr),
        "val_rows": len(va),
        "accuracy": acc,
        "macro_f1": macro_f1,
        "weighted_f1": weighted_f1,
        "baseline": baseline,
        "per_class_f1": dict(zip(CLASSES, per_class_f1)),
        "train_class_dist": train["category"].value_counts().sort_index().to_dict(),
        "forecast_class_dist": fc["pred_category"].value_counts().sort_index().to_dict(),
        "forecast_rows": len(fc),
    }


def print_summary(metrics: dict, total_seconds: float) -> None:
    print(f"\n{'#' * 70}\n# SUMMARY\n{'#' * 70}")
    print(f"Runtime          : {total_seconds:.1f}s")
    print(f"Train rows       : {metrics['train_rows']:,}")
    print(f"Validation rows  : {metrics['val_rows']:,}")
    print(f"Forecast rows    : {metrics['forecast_rows']:,}")
    print()
    print(f"Accuracy         : {metrics['accuracy']:.3f}")
    print(f"Macro-F1         : {metrics['macro_f1']:.3f}")
    print(f"Weighted-F1      : {metrics['weighted_f1']:.3f}")
    print(f"Baseline (maj.)  : {metrics['baseline']:.3f}")
    print(f"Lift vs baseline : {metrics['accuracy'] - metrics['baseline']:+.3f}")
    print()
    print("Per-class F1:")
    for cls, f1 in metrics["per_class_f1"].items():
        print(f"  Klasse {cls}: {f1:.3f}")
    print()
    print(f"{'Klasse':<8}{'Train':>12}{'Forecast':>14}")
    for cls in metrics["per_class_f1"].keys():
        tr_n = metrics["train_class_dist"].get(cls, 0)
        fc_n = metrics["forecast_class_dist"].get(cls, 0)
        print(f"{cls:<8}{tr_n:>12,}{fc_n:>14,}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-clean", action="store_true",
                        help="Skip raw->clean step (pipeline.py)")
    parser.add_argument("--tune", type=int, default=0, metavar="TRIALS",
                        help="Run Optuna with N trials before model step (e.g. --tune 40)")
    args = parser.parse_args()

    t0 = time.time()
    if not args.skip_clean:
        step("pipeline (raw -> clean)", run_pipeline)
    else:
        print("[info] skipping pipeline step")
    step("labels", run_labels)
    step("features", run_features)
    step("merge", run_merge)
    step("climatology (DAUZ + lt_fbt)", run_climatology)

    if args.tune > 0:
        from tune import main as tune_main
        import sys as _sys
        orig_argv = _sys.argv
        _sys.argv = ["tune.py", "--trials", str(args.tune)]
        try:
            step(f"optuna tuning ({args.tune} trials)", tune_main)
        finally:
            _sys.argv = orig_argv

    print(f"\n{'=' * 70}\n[STEP] model\n{'=' * 70}")
    tm = time.time()
    metrics = run_model()
    print(f"[done] model in {time.time() - tm:.1f}s")

    print_summary(metrics, time.time() - t0)


if __name__ == "__main__":
    main()