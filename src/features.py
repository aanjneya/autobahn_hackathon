from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from datetime import date, timedelta

import holidays

from load_holidays import (
    compute_brueckentage,
    compute_long_weekends,
    load_feiertage_at,
    load_feiertage_by,
    load_ferien_at,
    load_ferien_by,
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = PROJECT_ROOT / "data" / "processed"

OKTOBERFEST = {
    2023: ("2023-09-16", "2023-10-03"),
    2024: ("2024-09-21", "2024-10-06"),
    2025: ("2025-09-20", "2025-10-05"),
    2026: ("2026-09-19", "2026-10-04"),
    2027: ("2027-09-18", "2027-10-03"),
    2028: ("2028-09-16", "2028-10-03"),
    2029: ("2029-09-22", "2029-10-07"),
}

BLOCKABFERTIGUNG_TIROL: list[str] = [
    # 2023 (24 H1 + 17 H2)
    "2023-01-09", "2023-02-06", "2023-02-13", "2023-02-20", "2023-02-27",
    "2023-03-06", "2023-03-13", "2023-04-26", "2023-04-27", "2023-05-02",
    "2023-05-15", "2023-05-16", "2023-05-17", "2023-05-19", "2023-05-26",
    "2023-05-27", "2023-05-30", "2023-05-31", "2023-06-01", "2023-06-03",
    "2023-06-05", "2023-06-06", "2023-06-07", "2023-06-09",
    "2023-07-03", "2023-07-10", "2023-07-17", "2023-07-24", "2023-07-31",
    "2023-09-29", "2023-10-05", "2023-10-27", "2023-11-02", "2023-11-15",
    "2023-11-16", "2023-11-22", "2023-11-23", "2023-11-29", "2023-11-30",
    "2023-12-11", "2023-12-12",
    # 2024 (24 H1 + 16 H2)
    "2024-01-08", "2024-02-05", "2024-02-12", "2024-02-19", "2024-02-26",
    "2024-03-04", "2024-03-11", "2024-03-28", "2024-04-26", "2024-05-02",
    "2024-05-03", "2024-05-06", "2024-05-07", "2024-05-08", "2024-05-10",
    "2024-05-17", "2024-05-18", "2024-05-21", "2024-05-22", "2024-05-23",
    "2024-05-27", "2024-05-28", "2024-05-29", "2024-05-31",
    "2024-07-01", "2024-07-08", "2024-07-15", "2024-07-22", "2024-07-29",
    "2024-10-04", "2024-10-28", "2024-11-05", "2024-11-06", "2024-11-13",
    "2024-11-20", "2024-11-27", "2024-12-03", "2024-12-04", "2024-12-10",
    "2024-12-11",
    # 2025 (36 Tage)
    "2025-01-07", "2025-02-03", "2025-02-10", "2025-02-17", "2025-02-24",
    "2025-03-03", "2025-03-10", "2025-04-14", "2025-04-23", "2025-04-24",
    "2025-05-30", "2025-06-03", "2025-06-04", "2025-06-05", "2025-06-10",
    "2025-06-11", "2025-06-12", "2025-06-16", "2025-06-17", "2025-06-20",
    "2025-07-07", "2025-07-14", "2025-07-21", "2025-07-28",
    "2025-09-01", "2025-09-08", "2025-09-15", "2025-09-22", "2025-09-29",
    "2025-10-06", "2025-11-05", "2025-11-12", "2025-11-19", "2025-11-26",
    "2025-12-09",
    # 2026 (30 Tage)
    "2026-01-07", "2026-02-02", "2026-02-09", "2026-02-16", "2026-02-23",
    "2026-03-02", "2026-03-09", "2026-03-16", "2026-05-15", "2026-05-26",
    "2026-05-27", "2026-05-28", "2026-06-01", "2026-06-05", "2026-06-08",
    "2026-07-06", "2026-07-13", "2026-07-20", "2026-07-27", "2026-09-07",
    "2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05", "2026-10-27",
    "2026-11-04", "2026-11-11", "2026-11-18", "2026-11-25", "2026-12-09",
    # 2027-2029: noch nicht veröffentlicht (Tirol publiziert quartalsweise)
]


def predict_dosierung(year: int) -> list[date]:
    """Heuristik basierend auf dem beobachteten Muster 2023-2026:
    - Jeder Montag in Feb, Jul, Sep, Nov
    - Erste 2 Montage im März
    - Erster Montag in Jan und Mitte Dezember
    - Cluster (Mo + folgender Di) um Pfingstmontag und Fronleichnam
    """
    predicted: set[date] = set()
    feiertage_at = holidays.Austria(subdiv="5", years=[year])

    def mondays_in(month: int) -> list[date]:
        d, out = date(year, month, 1), []
        while d.month == month:
            if d.weekday() == 0:
                out.append(d)
            d += timedelta(days=1)
        return out

    for month in (2, 7, 9, 11):
        predicted.update(mondays_in(month))
    predicted.update(mondays_in(3)[:2])
    predicted.add(mondays_in(1)[0])
    predicted.add(mondays_in(12)[1])
    predicted.add(mondays_in(10)[-1])

    for d, name in feiertage_at.items():
        if "Pfingstmontag" in str(name) or "Fronleichnam" in str(name):
            wd = d.weekday()
            mon = d - timedelta(days=wd) if wd > 0 else d
            tue = mon + timedelta(days=1)
            predicted.update([mon, tue])

    return sorted(d for d in predicted if d.year == year)

MESSEN_MCH: list[tuple[str, str]] = [
    # IAA Mobility (ungerade Jahre, Sep)
    ("2023-09-05", "2023-09-10"),
    ("2025-09-09", "2025-09-14"),
    ("2027-09-07", "2027-09-12"),
    ("2029-09-09", "2029-09-14"),
    # BAU (ungerade Jahre, Jan)
    ("2023-01-17", "2023-01-22"),
    ("2025-01-13", "2025-01-17"),
    ("2027-01-18", "2027-01-23"),
    # Electronica (gerade Jahre, Nov)
    ("2024-11-12", "2024-11-15"),
    ("2026-11-17", "2026-11-20"),
    ("2028-11-14", "2028-11-17"),
    # ISPO (jährlich Jan/Feb)
    ("2023-01-28", "2023-01-31"),
    ("2026-02-02", "2026-02-05"),
    ("2027-02-07", "2027-02-10"),
    ("2028-01-26", "2028-01-29"),
    ("2029-02-03", "2029-02-06"),
    # Oktoberfest
    ("2023-09-16", "2023-10-03"),
    ("2024-09-21", "2024-10-06"),
    ("2025-09-20", "2025-10-05"),
    ("2026-09-19", "2026-10-04"),
    ("2027-09-18", "2027-10-03"),
    ("2028-09-16", "2028-10-01"),
    ("2029-09-20", "2029-10-05"),
]


def build_features(start: str, end: str) -> pd.DataFrame:
    dt = pd.date_range(start, end, freq="D")
    df = pd.DataFrame({"datum": dt})

    df["dow"] = df["datum"].dt.dayofweek
    df["month"] = df["datum"].dt.month
    df["week"] = df["datum"].dt.isocalendar().week.astype(int)
    df["is_weekend"] = (df["dow"] >= 5).astype(int)
    df["is_friday"] = (df["dow"] == 4).astype(int)
    df["is_sunday"] = (df["dow"] == 6).astype(int)
    df["sin_week"] = np.sin(2 * np.pi * df["week"] / 52)
    df["cos_week"] = np.cos(2 * np.pi * df["week"] / 52)

    feiertage_by = load_feiertage_by()
    feiertage_at = load_feiertage_at()
    brueckentage_by = compute_brueckentage(feiertage_by)
    brueckentage_at = compute_brueckentage(feiertage_at)
    long_we_by = compute_long_weekends(feiertage_by, brueckentage_by)
    long_we_at = compute_long_weekends(feiertage_at, brueckentage_at)
    ferien_by = load_ferien_by()
    ferien_at = load_ferien_at()

    d = df["datum"].dt.date
    d_plus1 = (df["datum"] + pd.Timedelta(days=1)).dt.date
    d_minus1 = (df["datum"] - pd.Timedelta(days=1)).dt.date

    df["is_feiertag_by"] = d.isin(feiertage_by).astype(int)
    df["is_feiertag_at"] = d.isin(feiertage_at).astype(int)
    df["is_pre_feiertag_by"] = d_plus1.isin(feiertage_by).astype(int)
    df["is_post_feiertag_by"] = d_minus1.isin(feiertage_by).astype(int)
    df["is_pre_feiertag_at"] = d_plus1.isin(feiertage_at).astype(int)
    df["is_post_feiertag_at"] = d_minus1.isin(feiertage_at).astype(int)
    df["is_brueckentag_by"] = d.isin(brueckentage_by).astype(int)
    df["is_brueckentag_at"] = d.isin(brueckentage_at).astype(int)
    df["is_long_weekend_by"] = d.isin(long_we_by).astype(int)
    df["is_long_weekend_at"] = d.isin(long_we_at).astype(int)
    df["is_ferien_by"] = d.isin(ferien_by).astype(int)
    df["is_ferien_at"] = d.isin(ferien_at).astype(int)
    df["is_ferien_overlap"] = (df["is_ferien_by"] & df["is_ferien_at"]).astype(int)

    # Ferien-Übergangstage: Reisewellen am Anfang und Ende der Ferien.
    df["is_ferien_start_by"] = (d.isin(ferien_by) & ~d_minus1.isin(ferien_by)).astype(int)
    df["is_ferien_end_by"] = (d.isin(ferien_by) & ~d_plus1.isin(ferien_by)).astype(int)
    df["is_ferien_start_at"] = (d.isin(ferien_at) & ~d_minus1.isin(ferien_at)).astype(int)
    df["is_ferien_end_at"] = (d.isin(ferien_at) & ~d_plus1.isin(ferien_at)).astype(int)
    # Wochenende direkt vor Ferienbeginn (Reisetag): Sa/So und Mo ist Ferienstart.
    d_plus2 = (df["datum"] + pd.Timedelta(days=2)).dt.date
    df["is_pre_ferien_weekend_by"] = (
        (df["dow"] >= 5)
        & (d_plus1.isin(ferien_by) | d_plus2.isin(ferien_by))
        & ~d.isin(ferien_by)
    ).astype(int)
    df["is_pre_ferien_weekend_at"] = (
        (df["dow"] >= 5)
        & (d_plus1.isin(ferien_at) | d_plus2.isin(ferien_at))
        & ~d.isin(ferien_at)
    ).astype(int)

    of_dates: set = set()
    for _, (s, e) in OKTOBERFEST.items():
        of_dates.update(pd.date_range(s, e).date)
    df["is_oktoberfest"] = d.isin(of_dates).astype(int)

    messe_dates: set = set()
    for s, e in MESSEN_MCH:
        messe_dates.update(pd.date_range(s, e).date)
    df["is_messe_mch"] = d.isin(messe_dates).astype(int)

    dosierung_dates = {pd.Timestamp(s).date() for s in BLOCKABFERTIGUNG_TIROL}
    for year in range(2027, 2030):
        dosierung_dates.update(predict_dosierung(year))
    df["is_dosierung"] = d.isin(dosierung_dates).astype(int)

    df["datum"] = df["datum"].dt.strftime("%Y-%m-%d")
    return df


if __name__ == "__main__":
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    train = build_features("2023-01-01", "2025-12-31")
    forecast = build_features("2026-01-01", "2029-12-31")

    train_path = OUT_DIR / "features.csv"
    forecast_path = OUT_DIR / "features_2026_2029.csv"
    train.to_csv(train_path, index=False)
    forecast.to_csv(forecast_path, index=False)

    print(f"features.csv:           {len(train)} rows, {train.shape[1]} cols → {train_path}")
    print(f"features_2026_2029.csv: {len(forecast)} rows, {forecast.shape[1]} cols → {forecast_path}")

    all_features = pd.concat([train, forecast])
    all_features["year"] = all_features["datum"].str[:4]

    print("\nMesse-Tage München pro Jahr (is_messe_mch=1):")
    for year, n in all_features.groupby("year")["is_messe_mch"].sum().items():
        print(f"  {year}: {n:>3} Tage")

    print("\nBlockabfertigungs-Tage Tirol pro Jahr (is_dosierung=1):")
    for year, n in all_features.groupby("year")["is_dosierung"].sum().items():
        print(f"  {year}: {n:>3} Tage")
