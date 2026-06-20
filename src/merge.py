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
ROUTES = [("A93", "Sued"), ("A93", "Nord"), ("A8", "Ost"), ("A8", "West")]

# Sensoren mit struktureller Geschwindigkeitsbegrenzung (Tempolimit, nicht Stau).
# Diese werden bei der Aggregation pro Route ausgeschlossen, damit ihre
# künstlich niedrigen Werte nicht die ganze Strecke runterziehen.
EXCLUDED_DEVICES = {
    "MQDZ_Kiefersfelden_(S)_Ro,DE1,2",  # A93 Nord, ~60 km/h Mittel = dauerhaftes Tempolimit
}


def device_to_route(device: str) -> tuple[str, str] | None:
    s = str(device).lower()
    if "kiefersfelden" in s or "inntal" in s or "gletschergarten" in s:
        return ("A93", "Sued") if "kff" in s else ("A93", "Nord")
    if "sbg" in s:
        return ("A8", "Ost")
    if "mch" in s:
        return ("A8", "West")
    return None


def build_train() -> pd.DataFrame:
    labels = pd.read_csv(PROC / "daily_labels.csv")
    excluded_n = labels["devices"].isin(EXCLUDED_DEVICES).sum()
    if excluded_n:
        print(f"[merge] excluded {excluded_n} rows from "
              f"{len(EXCLUDED_DEVICES)} tempolimit sensor(s)")
    labels = labels[~labels["devices"].isin(EXCLUDED_DEVICES)]
    routes = labels["devices"].apply(device_to_route)
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


def build_forecast_scaffold() -> pd.DataFrame:
    feats = pd.read_csv(PROC / "features_2026_2029.csv")
    rows = []
    for strecke, richtung in ROUTES:
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
