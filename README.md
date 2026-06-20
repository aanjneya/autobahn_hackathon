# Autobahn Hackathon — Traffic Forecast

Forecasts highway congestion ("Stau") severity for 2026–2029 on two Alpine corridors, using historical sensor data, calendar effects, and a LightGBM classifier.

## What it does

The pipeline predicts a congestion category (1 = free-flowing, 5 = severe Stau) for each combination of:

- **Route & direction**: A8 Munich–Salzburg (Ost/West), A93 Kiefersfelden–Munich (Nord/Sued)
- **Day**: every day from 2026-01-01 to 2029-12-31
- **Time slot**: 6 fixed 4-hour blocks per day (`00-04`, `04-08`, `08-12`, `12-16`, `16-20`, `20-24`)

It's trained on 2023–2025 historical sensor data (vehicle counts and average speed) plus calendar/event features — public holidays, school breaks, Oktoberfest, Munich trade fairs, and Tyrolean "Dosierung" (Blockabfertigung) traffic-control days for both Bavaria and Austria.

## Pipeline

Five stages run in sequence, each reading the previous stage's output:

```
data/raw/*.csv
   │  pipeline.py   — clean raw 1-minute sensor data, interpolate gaps, aggregate into 30-min time blocks
   ▼
data/clean/*.csv
   │  labels.py      — map average speed (v_kfz) to a Stau category (1: ≥80 km/h ... 5: <25 km/h)
   ▼
data/processed/daily_labels.csv
   │  features.py    — build day-level calendar/event features for 2023-2029 (load_holidays.py supplies
   │                    public holidays + school breaks from data/ics/)
   ▼
data/processed/features.csv, features_2026_2029.csv
   │  merge.py        — map sensor devices to routes/directions, join labels with features → train.csv;
   │                    build the 2026-2029 prediction scaffold → forecast_input.csv
   ▼
data/processed/train.csv, forecast_input.csv
   │  model.py        — train a multiclass LightGBM classifier, validate on 2025, forecast 2026-2029
   ▼
output/forecast.csv
```

Run it end to end:

```bash
python src/pipeline.py
python src/labels.py
python src/features.py
python src/merge.py
python src/model.py
```

`data/raw/` is gitignored and not included in this repo — populate it with the raw sensor CSV exports before running `pipeline.py`.

## Setup

Requires Python 3 (developed against 3.14).

```bash
pip install -r requirements.txt
```

Dependencies: `pandas`, `numpy`, `scikit-learn`, `lightgbm`, `holidays`, `icalendar`.

## Repo layout

```
src/            pipeline stages (pipeline.py, labels.py, features.py, merge.py, model.py, load_holidays.py)
data/raw/       raw sensor exports (gitignored, not included)
data/clean/     cleaned/aggregated sensor data (output of pipeline.py)
data/processed/ ML-ready features, labels, train/forecast tables
data/ics/       school-holiday calendars (Bavaria, Salzburg, Tirol)
output/         final forecast.csv (gitignored)
frontend/       React calendar viewer (fahrkalender.jsx) — in progress
```

## Data dictionary (key columns)

- `train.csv` / `forecast_input.csv`: `datum`, `strecke` (A8/A93), `richtung` (Ost/West/Nord/Sued), `time_slot`, `time_slot_idx`, calendar features (`dow`, `month`, `week`, `is_feiertag_by/at`, `is_ferien_by/at`, `is_oktoberfest`, `is_messe_mch`, `is_dosierung`, ...)
- `train.csv` additionally has the ground-truth `category` (1–5)
- `output/forecast.csv`: `datum`, `strecke`, `richtung`, `time_slot`, `pred_category` (1–5), `prob_1`...`prob_5`

## Model

`LGBMClassifier` (multiclass, 5 classes, class-weighted for imbalance), trained on 2023–2024 data and validated on 2025 as a time-based holdout. Running `model.py` prints accuracy, macro-F1, a per-class report, a confusion matrix, and the top feature importances before writing the final forecast.


