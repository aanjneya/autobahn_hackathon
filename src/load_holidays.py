from __future__ import annotations

import warnings
from datetime import date, datetime, timedelta
from pathlib import Path

import holidays
from icalendar import Calendar

YEARS = range(2023, 2030)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ICS_DIR = PROJECT_ROOT / "data" / "ics"


def load_feiertage_by() -> set[date]:
    return set(holidays.Germany(state="BY", years=YEARS).keys())


def load_feiertage_at() -> set[date]:
    return set(holidays.Austria(subdiv="5", years=YEARS).keys())


def load_ferien_by() -> set[date]:
    return _load_ics_by_keyword(["bayern"])


def load_ferien_at() -> set[date]:
    return _load_ics_by_keyword(["salzburg", "tirol"])


def _load_ics_by_keyword(keywords: list[str]) -> set[date]:
    if not ICS_DIR.exists():
        warnings.warn(f"ICS-Verzeichnis nicht gefunden: {ICS_DIR}")
        return set()

    files: list[Path] = []
    for kw in keywords:
        files.extend(p for p in ICS_DIR.glob("*.ics") if kw.lower() in p.name.lower())

    if not files:
        warnings.warn(f"Keine ICS-Dateien gefunden für {keywords} in {ICS_DIR}")
        return set()

    days: set[date] = set()
    for f in files:
        days.update(_parse_ics(f))
    return days


def _parse_ics(path: Path) -> set[date]:
    days: set[date] = set()
    with path.open("rb") as fh:
        cal = Calendar.from_ical(fh.read())

    for component in cal.walk("VEVENT"):
        start = component.get("DTSTART").dt
        end_field = component.get("DTEND")
        end = end_field.dt if end_field is not None else start

        start_date = start.date() if isinstance(start, datetime) else start
        end_date = end.date() if isinstance(end, datetime) else end

        if end_date <= start_date:
            days.add(start_date)
            continue

        current = start_date
        while current < end_date:
            days.add(current)
            current += timedelta(days=1)
    return days


if __name__ == "__main__":
    feiertage_by = load_feiertage_by()
    feiertage_at = load_feiertage_at()
    ferien_by = load_ferien_by()
    ferien_at = load_ferien_at()

    print(f"Feiertage Bayern:      {len(feiertage_by):>5} Tage")
    print(f"Feiertage Österreich:  {len(feiertage_at):>5} Tage")
    print(f"Schulferien Bayern:    {len(ferien_by):>5} Tage")
    print(f"Schulferien AT (S+T):  {len(ferien_at):>5} Tage")

    # test
