"""Visualise output/forecast.csv.

Generates four plots into output/plots/:
  1. heatmap_<route>.png  - weekday x slot mean predicted category per route
  2. daily_max.png        - daily worst-Stau category over time, per route
  3. monthly_stau.png     - share of slots in category >= 4 per month per route
  4. class_distribution.png - bar chart of predicted class counts per route

Usage:
    python src/plot_forecast.py
    python src/plot_forecast.py --route A93 --richtung Sued
"""
from __future__ import annotations

import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
FORECAST = ROOT / "output" / "forecast_2026.csv"
PLOTS = ROOT / "output" / "plots"

WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
STAU_THRESHOLD = 4  # category >= 4 counts as Stau


def slot_sort_key(s: str) -> tuple[int, int]:
    """'17:30-18:00' -> (17, 30) for ordering."""
    start = s.split("-")[0]
    h, m = start.split(":") if ":" in start else (start, "00")
    return int(h), int(m)


def load() -> pd.DataFrame:
    df = pd.read_csv(FORECAST)
    df["datum"] = pd.to_datetime(df["datum"])
    df["weekday"] = df["datum"].dt.dayofweek
    df["month"] = df["datum"].dt.to_period("M").dt.to_timestamp()
    return df


def plot_heatmap(df: pd.DataFrame, route: str, richtung: str) -> Path:
    sub = df[(df["strecke"] == route) & (df["richtung"] == richtung)]
    pivot = sub.pivot_table(
        index="time_slot", columns="weekday",
        values="pred_category", aggfunc="mean",
    )
    slots = sorted(pivot.index, key=slot_sort_key)
    pivot = pivot.reindex(slots)

    fig, ax = plt.subplots(figsize=(8, 12))
    im = ax.imshow(pivot.values, aspect="auto", cmap="RdYlGn_r", vmin=1, vmax=5)
    ax.set_xticks(range(7))
    ax.set_xticklabels(WEEKDAYS)
    ax.set_yticks(range(len(slots)))
    ax.set_yticklabels(slots, fontsize=7)
    ax.set_title(f"Mittlere Stau-Kategorie {route} {richtung} (2026-2029)")
    ax.set_xlabel("Wochentag")
    ax.set_ylabel("Zeitslot")
    fig.colorbar(im, ax=ax, label="Kategorie (1 frei -> 5 Stau)")
    fig.tight_layout()
    out = PLOTS / f"heatmap_{route}_{richtung}.png"
    fig.savefig(out, dpi=110)
    plt.close(fig)
    return out


def plot_daily_max(df: pd.DataFrame) -> Path:
    daily = (df.groupby(["datum", "strecke", "richtung"])["pred_category"]
             .max().reset_index())
    fig, ax = plt.subplots(figsize=(14, 5))
    for (s, r), grp in daily.groupby(["strecke", "richtung"]):
        ax.plot(grp["datum"], grp["pred_category"].rolling(7).mean(),
                label=f"{s} {r}", linewidth=1)
    ax.set_title("Tageswert (7-Tage-Mittel) der maximalen Stau-Kategorie")
    ax.set_ylabel("Max-Kategorie (geglättet)")
    ax.set_xlabel("Datum")
    ax.set_ylim(1, 5)
    ax.legend(loc="upper right")
    ax.grid(alpha=0.3)
    fig.tight_layout()
    out = PLOTS / "daily_max.png"
    fig.savefig(out, dpi=110)
    plt.close(fig)
    return out


def plot_monthly_stau(df: pd.DataFrame) -> Path:
    df = df.copy()
    df["is_stau"] = (df["pred_category"] >= STAU_THRESHOLD).astype(int)
    monthly = (df.groupby(["month", "strecke", "richtung"])["is_stau"]
               .mean().reset_index())
    fig, ax = plt.subplots(figsize=(14, 5))
    for (s, r), grp in monthly.groupby(["strecke", "richtung"]):
        ax.plot(grp["month"], grp["is_stau"] * 100,
                label=f"{s} {r}", marker="o", markersize=3)
    ax.set_title(f"Anteil Stau-Slots pro Monat (Kategorie ≥ {STAU_THRESHOLD})")
    ax.set_ylabel("Stau-Anteil [%]")
    ax.set_xlabel("Monat")
    ax.legend()
    ax.grid(alpha=0.3)
    fig.tight_layout()
    out = PLOTS / "monthly_stau.png"
    fig.savefig(out, dpi=110)
    plt.close(fig)
    return out


def plot_class_distribution(df: pd.DataFrame) -> Path:
    counts = (df.groupby(["strecke", "richtung", "pred_category"])
              .size().unstack(fill_value=0))
    fig, ax = plt.subplots(figsize=(10, 5))
    counts.plot(kind="bar", stacked=False, ax=ax,
                colormap="RdYlGn_r", edgecolor="black")
    ax.set_title("Verteilung der vorhergesagten Klassen pro Route (2026-2029)")
    ax.set_ylabel("Anzahl Slots")
    ax.set_xlabel("Route")
    ax.legend(title="Kategorie", loc="upper right")
    plt.xticks(rotation=30, ha="right")
    fig.tight_layout()
    out = PLOTS / "class_distribution.png"
    fig.savefig(out, dpi=110)
    plt.close(fig)
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--route", type=str, default=None)
    parser.add_argument("--richtung", type=str, default=None)
    args = parser.parse_args()

    PLOTS.mkdir(parents=True, exist_ok=True)
    df = load()

    if args.route and args.richtung:
        pairs = [(args.route, args.richtung)]
    else:
        pairs = df.groupby(["strecke", "richtung"]).size().index.tolist()

    saved = []
    for s, r in pairs:
        saved.append(plot_heatmap(df, s, r))
    saved.append(plot_daily_max(df))
    saved.append(plot_monthly_stau(df))
    saved.append(plot_class_distribution(df))

    print("Created plots:")
    for p in saved:
        print(f"  -> {p}")


if __name__ == "__main__":
    main()