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
    return {d for d in days if d.year in YEARS}


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


def compute_brueckentage(feiertage: set[date]) -> set[date]:
    """Werktag (Mo-Fr) der zwischen Feiertag und Wochenende klemmt."""
    brueckentage: set[date] = set()
    for f in feiertage:
        # Feiertag Dienstag → Montag ist Brückentag
        if f.weekday() == 1:
            brueckentage.add(f - timedelta(days=1))
        # Feiertag Donnerstag → Freitag ist Brückentag
        elif f.weekday() == 3:
            brueckentage.add(f + timedelta(days=1))
    return {d for d in brueckentage if d not in feiertage and d.weekday() < 5}


def compute_long_weekends(
    feiertage: set[date], brueckentage: set[date] | None = None
) -> set[date]:
    """Tage, die zu einem zusammenhängenden Block von ≥3 freien Tagen gehören
    (Sa/So + Feiertag + optional Brückentag)."""
    if brueckentage is None:
        brueckentage = compute_brueckentage(feiertage)

    if not feiertage:
        return set()

    frei = set(feiertage) | set(brueckentage)
    start = min(feiertage) - timedelta(days=2)
    end = max(feiertage) + timedelta(days=2)

    def is_frei(d: date) -> bool:
        return d.weekday() >= 5 or d in frei

    long_we: set[date] = set()
    current_block: list[date] = []
    d = start
    while d <= end:
        if is_frei(d):
            current_block.append(d)
        else:
            if len(current_block) >= 3 and any(
                b.weekday() >= 5 for b in current_block
            ) and any(b in frei for b in current_block):
                long_we.update(current_block)
            current_block = []
        d += timedelta(days=1)
    if len(current_block) >= 3:
        long_we.update(current_block)
    return long_we


if __name__ == "__main__":
    feiertage_by = load_feiertage_by()
    feiertage_at = load_feiertage_at()
    ferien_by = load_ferien_by()
    ferien_at = load_ferien_at()

    brueckentage_by = compute_brueckentage(feiertage_by)
    brueckentage_at = compute_brueckentage(feiertage_at)
    long_we_by = compute_long_weekends(feiertage_by, brueckentage_by)
    long_we_at = compute_long_weekends(feiertage_at, brueckentage_at)

    print(f"Feiertage Bayern:        {len(feiertage_by):>5} Tage")
    print(f"Feiertage Österreich:    {len(feiertage_at):>5} Tage")
    print(f"Schulferien Bayern:      {len(ferien_by):>5} Tage")
    print(f"Schulferien AT (S+T):    {len(ferien_at):>5} Tage")
    print(f"Brückentage Bayern:      {len(brueckentage_by):>5} Tage")
    print(f"Brückentage Österreich:  {len(brueckentage_at):>5} Tage")
    print(f"Lange Wochenenden BY:    {len(long_we_by):>5} Tage")
    print(f"Lange Wochenenden AT:    {len(long_we_at):>5} Tage")

    print("\nBeispiel Brückentage Bayern 2026:")
    for d in sorted(d for d in brueckentage_by if d.year == 2026):
        print(f"  {d} ({d.strftime('%A')})")

    # test

    tag = date(2026, 12, 28)

    print(tag in feiertage_by)
    print(tag in ferien_by)
    print(tag in feiertage_by or tag in ferien_by)
