import re

import pandas as pd
from pathlib import Path

PROC = Path(__file__).resolve().parent.parent / "data" / "processed"

def _build_time_slots() -> list[str]:
    slots = []
    for h in range(24):
        start = f"{h:02d}:00"
        mid = f"{h:02d}:30"
        end = "00:00" if h == 23 else f"{h + 1:02d}:00"
        slots.append(f"{start}-{mid}")
        slots.append(f"{mid}-{end}")
    return slots


TIME_SLOTS = _build_time_slots()

# A93 measurement stations, keyed by the substring that identifies them in
# the raw device id -> human-readable site name.
A93_SITES = {
    "kiefersfelden": "Kiefersfelden",
    "inntal": "Inntal",
    "gletschergarten": "Gletschergarten",
}

# Sensoren mit struktureller Geschwindigkeitsbegrenzung (Tempolimit, nicht Stau).
# Diese werden bei der Aggregation ausgeschlossen, damit ihre künstlich
# niedrigen Werte nicht als Stau gewertet werden.
EXCLUDED_DEVICES = {
    "MQDZ_Kiefersfelden_(S)_Ro,DE1,2",  # A93 Kiefersfelden/Rosenheim, ~60 km/h Mittel = dauerhaftes Tempolimit
}


def device_to_site(device: str) -> tuple[str, str] | None:
    """Map a sensor device id to its own (strecke, richtung), keeping each
    physical measurement station distinct instead of collapsing all sensors
    on a corridor into one route+direction.

    richtung is named after the destination city (matches the frontend's
    convention) rather than compass points: Kufstein/Rosenheim for A93,
    München/Salzburg for A8.
    """
    s = str(device)
    sl = s.lower()
    for key, name in A93_SITES.items():
        if key in sl:
            richtung = "Kufstein" if "kff" in sl else "Rosenheim"
            return (f"A93_{name}", richtung)
    if "sbg" in sl or "mch" in sl:
        site = re.split(r"_(?:Mch|Sbg)", s, maxsplit=1, flags=re.IGNORECASE)[0]
        richtung = "Salzburg" if "sbg" in sl else "München"
        return (f"A8_{site}", richtung)
    return None


def build_train() -> pd.DataFrame:
    labels = pd.read_csv(PROC / "daily_labels.csv")
    excluded_n = labels["devices"].isin(EXCLUDED_DEVICES).sum()
    if excluded_n:
        print(f"[merge] excluded {excluded_n} rows from "
              f"{len(EXCLUDED_DEVICES)} tempolimit sensor(s)")
    labels = labels[~labels["devices"].isin(EXCLUDED_DEVICES)]
    routes = labels["devices"].apply(device_to_site)
    labels = labels.assign(
        strecke=routes.apply(lambda r: r[0] if r else None),
        richtung=routes.apply(lambda r: r[1] if r else None),
    ).dropna(subset=["strecke"])

    agg = (
        labels.groupby(["date", "strecke", "richtung", "time_slot"])["category"]
        .max()
        .reset_index()
        .rename(columns={"date": "datum"})
    )
    feats = pd.read_csv(PROC / "features.csv")
    train = agg.merge(feats, on="datum", how="inner")
    train["time_slot_idx"] = train["time_slot"].map({s: i for i, s in enumerate(TIME_SLOTS)})
    train.to_csv(PROC / "train.csv", index=False)
    return train


def known_routes() -> list[tuple[str, str]]:
    """All (strecke, richtung) pairs with real sensor data, derived from the
    actual device list rather than hardcoded, so it stays in sync with
    whatever stations exist (minus excluded tempolimit sensors)."""
    devices = pd.read_csv(PROC / "daily_labels.csv", usecols=["devices"])["devices"].unique()
    devices = [d for d in devices if d not in EXCLUDED_DEVICES]
    routes = {device_to_site(d) for d in devices}
    routes.discard(None)
    return sorted(routes)


def build_forecast_scaffold() -> pd.DataFrame:
    feats = pd.read_csv(PROC / "features_2026_2029.csv")
    rows = []
    for strecke, richtung in known_routes():
        for i, slot in enumerate(TIME_SLOTS):
            tmp = feats.copy()
            tmp["strecke"] = strecke
            tmp["richtung"] = richtung
            tmp["time_slot"] = slot
            tmp["time_slot_idx"] = i
            rows.append(tmp)
    scaffold = pd.concat(rows, ignore_index=True)
    scaffold.to_csv(PROC / "forecast_input.csv", index=False)
    return scaffold


if __name__ == "__main__":
    train = build_train()
    scaffold = build_forecast_scaffold()
    print(f"train.csv:          {len(train)} rows")
    print(f"forecast_input.csv: {len(scaffold)} rows")
    print("\nCategory distribution in train:")
    print(train["category"].value_counts().sort_index())
    print("\nRows per route in train:")
    print(train.groupby(["strecke", "richtung"]).size())
