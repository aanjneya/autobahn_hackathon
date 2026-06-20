"""Build climatology features from DAUZ + lt_fbt clean data.

DAUZ provides historical traffic volumes per device (kfz_h, sv_h) in 4h slots.
lt_fbt provides air/road temperatures from one station (AD Rosenheim).

We aggregate them to expected values keyed by (strecke, richtung, month,
weekday, slot_4h) resp. (month, weekday, slot_4h) and merge into both
train.csv and forecast_input.csv. That way 2026-2029 rows get historically
plausible feature values via the same lookup.

Reads :  data/clean/DAUZ_2+0_1h_2023-2026/*.csv
         data/clean/lt_und_fbt/*.csv
         data/processed/train.csv
         data/processed/forecast_input.csv
Writes:  data/processed/train.csv          (overwrites with extra cols)
         data/processed/forecast_input.csv (overwrites with extra cols)
"""
from __future__ import annotations

import glob
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
CLEAN = ROOT / "data" / "clean"
PROC = ROOT / "data" / "processed"

DAUZ_DIR = CLEAN / "DAUZ_2+0_1h_2023-2026"
LT_FBT_DIR = CLEAN / "lt_und_fbt"
TRAFFIC_1MIN_DIR = CLEAN / "2023-2025_1min_2+0_v"  # fallback source if DAUZ missing

sys.path.insert(0, str(Path(__file__).resolve().parent))
from merge import device_to_site as device_to_route  # noqa: E402


def slot_to_4h_bucket(slot: str) -> str:
    """Map '17:00-17:30' or '17:30-18:00' -> '16-20'.

    DAUZ/lt_fbt clean files use buckets '00-04', '04-08', '08-12', '12-16',
    '16-20', '20-24'. The 4h start is hour // 4 * 4.
    """
    if "-" not in slot:
        return slot
    start = slot.split("-")[0]
    if ":" in start:
        h = int(start.split(":")[0])
    else:
        h = int(start)
    bucket_start = (h // 4) * 4
    bucket_end = bucket_start + 4
    return f"{bucket_start:02d}-{bucket_end:02d}"


def _load_dauz() -> pd.DataFrame:
    files = glob.glob(str(DAUZ_DIR / "*.csv"))
    parts = []
    for f in files:
        df = pd.read_csv(f)
        if not {"devices", "date", "time_slot", "kfz_h", "sv_h"}.issubset(df.columns):
            continue
        parts.append(df)
    if not parts:
        raise FileNotFoundError(f"No DAUZ files found in {DAUZ_DIR}")
    df = pd.concat(parts, ignore_index=True)
    routes = df["devices"].apply(device_to_route)
    df = df.assign(
        strecke=routes.apply(lambda r: r[0] if r else None),
        richtung=routes.apply(lambda r: r[1] if r else None),
    ).dropna(subset=["strecke"])
    df["date"] = pd.to_datetime(df["date"])
    df["weekday"] = df["date"].dt.dayofweek
    df["month"] = df["date"].dt.month
    df["sv_share"] = np.where(df["kfz_h"] > 0, df["sv_h"] / df["kfz_h"], 0.0)
    df["slot_4h"] = df["time_slot"].apply(slot_to_4h_bucket)
    return df


def _load_lt_fbt() -> pd.DataFrame:
    """Combine lt and fbt files on (date, time_slot)."""
    parts_lt, parts_fbt = [], []
    for f in glob.glob(str(LT_FBT_DIR / "*.csv")):
        df = pd.read_csv(f)
        if "lt" in df.columns:
            parts_lt.append(df[["date", "time_slot", "lt"]])
        elif "fbt" in df.columns:
            parts_fbt.append(df[["date", "time_slot", "fbt"]])
    lt = pd.concat(parts_lt, ignore_index=True) if parts_lt else pd.DataFrame()
    fbt = pd.concat(parts_fbt, ignore_index=True) if parts_fbt else pd.DataFrame()
    if lt.empty and fbt.empty:
        raise FileNotFoundError(f"No lt_fbt files in {LT_FBT_DIR}")
    merged = lt.merge(fbt, on=["date", "time_slot"], how="outer") if not lt.empty and not fbt.empty else (lt if not lt.empty else fbt)
    merged["date"] = pd.to_datetime(merged["date"])
    merged["month"] = merged["date"].dt.month
    merged["weekday"] = merged["date"].dt.dayofweek
    merged["slot_4h"] = merged["time_slot"].apply(slot_to_4h_bucket)
    return merged


def _load_traffic_1min_as_dauz() -> pd.DataFrame:
    """Fallback: aggregate the 30-min q_kfz / q_lkw from the 1min cleaned files
    into a DAUZ-shaped DataFrame (columns: devices, date, time_slot, kfz_h, sv_h).

    q_kfz is the vehicle count in a 30-min slot, so kfz_h = q_kfz * 2.
    """
    files = glob.glob(str(TRAFFIC_1MIN_DIR / "*.csv"))
    parts = []
    needed = {"devices", "date", "time_slot", "q_kfz"}
    for f in files:
        df = pd.read_csv(f)
        if not needed.issubset(df.columns):
            continue
        df = df.dropna(subset=["q_kfz"])
        out = pd.DataFrame({
            "devices": df["devices"],
            "date": df["date"],
            "time_slot": df["time_slot"],
            "kfz_h": df["q_kfz"].astype(float) * 2.0,
            "sv_h": (df["q_lkw"].astype(float) * 2.0) if "q_lkw" in df.columns else 0.0,
        })
        parts.append(out)
    if not parts:
        raise FileNotFoundError(
            f"No 1min traffic files found in {TRAFFIC_1MIN_DIR} either"
        )
    df = pd.concat(parts, ignore_index=True)
    routes = df["devices"].apply(device_to_route)
    df = df.assign(
        strecke=routes.apply(lambda r: r[0] if r else None),
        richtung=routes.apply(lambda r: r[1] if r else None),
    ).dropna(subset=["strecke"])
    df["date"] = pd.to_datetime(df["date"])
    df["weekday"] = df["date"].dt.dayofweek
    df["month"] = df["date"].dt.month
    df["sv_share"] = np.where(df["kfz_h"] > 0, df["sv_h"] / df["kfz_h"], 0.0)
    df["slot_4h"] = df["time_slot"].apply(slot_to_4h_bucket)
    return df


def build_dauz_climatology() -> pd.DataFrame:
    """Per (strecke, richtung, month, weekday, slot_4h)
    -> kfz_expected, sv_expected, sv_share_expected.

    Prefers DAUZ; falls back to aggregated 1min traffic data when DAUZ
    is not present.
    """
    try:
        df = _load_dauz()
    except FileNotFoundError as e:
        print(f"  [climatology] DAUZ missing ({e}); "
              f"falling back to 1min traffic data.")
        df = _load_traffic_1min_as_dauz()
    grp = df.groupby(["strecke", "richtung", "month", "weekday", "slot_4h"]).agg(
        kfz_expected=("kfz_h", "mean"),
        sv_expected=("sv_h", "mean"),
        sv_share_expected=("sv_share", "mean"),
    ).reset_index()
    return grp


_SLOT_4H_CENTERS = {  # Mittelpunkt jedes 4h-Buckets in Stunden
    "00-04": 2.0, "04-08": 6.0, "08-12": 10.0,
    "12-16": 14.0, "16-20": 18.0, "20-24": 22.0,
}


def _slot_center_hour(slot: str) -> float:
    """Mittelpunkt eines 30-Min-Slots, z. B. '17:00-17:30' -> 17.25."""
    start = slot.split("-")[0]
    h, m = start.split(":")
    return int(h) + (int(m) + 15) / 60.0


def build_dauz_climatology_30min(
    dauz_clim_4h: pd.DataFrame,
) -> pd.DataFrame | None:
    """Per (strecke, richtung, month, weekday, time_slot).

    Wird durch periodische lineare Interpolation der 4h-Climatology auf
    die 48 Halbstunden-Slots erzeugt. Damit haben benachbarte Slots eine
    glatte Kurve statt eines Treppenprofils.
    """
    from merge import TIME_SLOTS  # lokal, vermeidet Kreis-Import beim Modul-Load

    if dauz_clim_4h is None or dauz_clim_4h.empty:
        return None

    anchor_hours = np.array(
        [_SLOT_4H_CENTERS[s] for s in ["00-04", "04-08", "08-12",
                                       "12-16", "16-20", "20-24"]]
    )
    # Periodisch: 22:00 < 02:00+24 < ...
    xp = np.concatenate([anchor_hours - 24, anchor_hours, anchor_hours + 24])
    slot_centers = np.array([_slot_center_hour(s) for s in TIME_SLOTS])
    value_cols = ["kfz_expected", "sv_expected", "sv_share_expected"]

    out_rows = []
    for keys, sub in dauz_clim_4h.groupby(
        ["strecke", "richtung", "month", "weekday"], sort=False,
    ):
        sub = sub.set_index("slot_4h").reindex(
            ["00-04", "04-08", "08-12", "12-16", "16-20", "20-24"]
        )
        interp = {}
        for col in value_cols:
            vals = sub[col].to_numpy(dtype=float)
            if np.isnan(vals).all():
                interp[col] = np.zeros(len(TIME_SLOTS))
                continue
            # Lücken zwischen Buckets ggf. mit Bucket-Mittelwert füllen.
            mean = np.nanmean(vals)
            vals = np.where(np.isnan(vals), mean, vals)
            yp = np.concatenate([vals, vals, vals])  # periodisch
            interp[col] = np.interp(slot_centers, xp, yp)
        strecke, richtung, month, weekday = keys
        for i, slot in enumerate(TIME_SLOTS):
            out_rows.append({
                "strecke": strecke,
                "richtung": richtung,
                "month": month,
                "weekday": weekday,
                "time_slot": slot,
                **{c: interp[c][i] for c in value_cols},
            })
    return pd.DataFrame(out_rows)


def build_weather_climatology() -> pd.DataFrame:
    """Per (month, weekday, slot_4h)
    -> lt_expected, fbt_expected, fbt_below_0_prob."""
    df = _load_lt_fbt()
    df["fbt_below_0"] = (df.get("fbt", pd.Series(np.nan, index=df.index)) < 0).astype(float)
    agg = {}
    if "lt" in df.columns:
        agg["lt_expected"] = ("lt", "mean")
    if "fbt" in df.columns:
        agg["fbt_expected"] = ("fbt", "mean")
        agg["fbt_below_0_prob"] = ("fbt_below_0", "mean")
    grp = df.groupby(["month", "weekday", "slot_4h"]).agg(**agg).reset_index()
    return grp


def _add_lookup_keys(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["slot_4h"] = df["time_slot"].apply(slot_to_4h_bucket)
    if "month" not in df.columns or "dow" not in df.columns:
        dt = pd.to_datetime(df["datum"])
        df["month"] = dt.dt.month
        df["dow"] = dt.dt.dayofweek
    df["weekday"] = df["dow"]
    return df


def enrich(df: pd.DataFrame, dauz_clim: pd.DataFrame,
           weather_clim: pd.DataFrame,
           dauz_clim_30min: pd.DataFrame | None = None) -> pd.DataFrame:
    traffic_cols = ["kfz_expected", "sv_expected", "sv_share_expected"]
    cols_to_drop = traffic_cols + ["lt_expected", "fbt_expected",
                                   "fbt_below_0_prob", "slot_4h"]
    df = df.drop(columns=[c for c in cols_to_drop if c in df.columns])

    df = _add_lookup_keys(df)

    if dauz_clim_30min is not None and not dauz_clim_30min.empty:
        df = df.merge(
            dauz_clim_30min,
            on=["strecke", "richtung", "month", "weekday", "time_slot"],
            how="left",
        )
        # Fehlende 30-Min-Zellen mit 4h-Climatology auffüllen.
        coarse = dauz_clim.rename(columns={
            c: c + "_4h" for c in traffic_cols if c in dauz_clim.columns
        })
        df = df.merge(
            coarse,
            on=["strecke", "richtung", "month", "weekday", "slot_4h"],
            how="left",
        )
        for c in traffic_cols:
            if c in df.columns and (c + "_4h") in df.columns:
                df[c] = df[c].fillna(df[c + "_4h"])
                df = df.drop(columns=[c + "_4h"])
    else:
        df = df.merge(
            dauz_clim,
            on=["strecke", "richtung", "month", "weekday", "slot_4h"],
            how="left",
        )

    df = df.merge(
        weather_clim,
        on=["month", "weekday", "slot_4h"],
        how="left",
    )

    new_cols = [c for c in dauz_clim.columns if c not in
                ("strecke", "richtung", "month", "weekday", "slot_4h")]
    new_cols += [c for c in weather_clim.columns if c not in
                 ("month", "weekday", "slot_4h")]
    for c in new_cols:
        if c not in df.columns:
            continue
        med = df[c].median()
        if pd.isna(med):
            med = 0.0
        df[c] = df[c].fillna(med)

    df = df.drop(columns=["slot_4h", "weekday"])
    return df


def main() -> None:
    print("Building DAUZ climatology...")
    try:
        dauz_clim = build_dauz_climatology()
        print(f"  -> {len(dauz_clim)} (route, month, weekday, slot_4h) cells")
    except FileNotFoundError as e:
        print(f"  [skip] {e}")
        dauz_clim = None

    print("Building 30-min traffic climatology (interpolated from 4h)...")
    dauz_clim_30min = build_dauz_climatology_30min(dauz_clim)
    if dauz_clim_30min is not None:
        print(f"  -> {len(dauz_clim_30min)} (route, month, weekday, time_slot) cells")
    else:
        print("  [skip] no 1min traffic data available")

    print("Building weather climatology...")
    try:
        weather_clim = build_weather_climatology()
        print(f"  -> {len(weather_clim)} (month, weekday, slot) cells")
    except FileNotFoundError as e:
        print(f"  [skip] {e}")
        weather_clim = None

    if dauz_clim is None and weather_clim is None:
        print("[climatology] no source data available — "
              "adding placeholder columns filled with 0.")

    if dauz_clim is None:
        dauz_clim = pd.DataFrame(
            columns=["strecke", "richtung", "month", "weekday", "slot_4h",
                     "kfz_expected", "sv_expected", "sv_share_expected"]
        )
    if weather_clim is None:
        weather_clim = pd.DataFrame(
            columns=["month", "weekday", "slot_4h",
                     "lt_expected", "fbt_expected", "fbt_below_0_prob"]
        )

    for fname in ("train.csv", "forecast_input.csv"):
        path = PROC / fname
        if not path.exists():
            print(f"  [skip] {fname}: not found at {path}")
            continue
        df = pd.read_csv(path)
        before = df.shape[1]
        df = enrich(df, dauz_clim, weather_clim, dauz_clim_30min)
        df.to_csv(path, index=False)
        added = df.shape[1] - before
        print(f"  {fname}: +{added} cols, {len(df)} rows -> {path}")


if __name__ == "__main__":
    main()