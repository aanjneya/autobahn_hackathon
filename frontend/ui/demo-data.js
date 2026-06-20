/**
 * demo-data.js – Plausible Demodaten für den Fahrkalender
 *
 * Generiert synthetische Prognosen im gleichen Format wie model.py's forecast.csv:
 *   datum, strecke, richtung, time_slot, pred_category, prob_1..prob_5
 *
 * Stau-Muster orientieren sich an realen Mustern der A93:
 *   - Freitag Nachmittag Ri. Süd: hoch
 *   - Samstag Vormittag Ri. Süd: hoch (Ferienanreise)
 *   - Sonntag Nachmittag Ri. Nord: hoch (Rückreise)
 *   - Ferien + Feiertage: deutlich erhöht
 *   - Wochentage nachts: sehr gering
 */

// eslint-disable-next-line no-unused-vars
const DEMO_FORECAST = (() => {
  'use strict';

  const TIME_SLOTS = ['00-04', '04-08', '08-12', '12-16', '16-20', '20-24'];

  const CORRIDORS = {
    A93: {
      strecken: ['A93_Inntal', 'A93_Kiefersfelden', 'A93_Gletschergarten'],
      richtungen: ['Kufstein', 'Rosenheim']
    },
    A8: {
      strecken: ['A8_MQB25', 'A8_MQQ209', 'A8_MQQ213', 'A8_MQQ245', 'A8_MQQ37'],
      richtungen: ['München', 'Salzburg']
    }
  };

  // Direction labels for UI
  const DIRECTION_LABELS = {
    A93: { Kufstein: 'Richtung Kufstein (Süd)', Rosenheim: 'Richtung Rosenheim (Nord)' },
    A8: { München: 'Richtung München (West)', Salzburg: 'Richtung Salzburg (Ost)' }
  };

  // --- Known dates (simplified) ---
  const SCHOOL_HOLIDAYS_BY = new Set();
  const FEIERTAGE_BY = new Set();
  const OKTOBERFEST = new Set();
  const DOSIERUNG = new Set();

  function addDateRange(set, start, end) {
    const d = new Date(start);
    const e = new Date(end);
    while (d <= e) {
      set.add(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
  }

  // Schulferien Bayern (approximate)
  // 2026
  addDateRange(SCHOOL_HOLIDAYS_BY, '2026-02-16', '2026-02-20');  // Faschingsferien
  addDateRange(SCHOOL_HOLIDAYS_BY, '2026-03-30', '2026-04-10');  // Osterferien
  addDateRange(SCHOOL_HOLIDAYS_BY, '2026-05-26', '2026-06-05');  // Pfingstferien
  addDateRange(SCHOOL_HOLIDAYS_BY, '2026-07-30', '2026-09-14');  // Sommerferien
  addDateRange(SCHOOL_HOLIDAYS_BY, '2026-10-31', '2026-11-06');  // Herbstferien
  addDateRange(SCHOOL_HOLIDAYS_BY, '2026-12-23', '2026-12-31');  // Weihnachtsferien
  // 2027
  addDateRange(SCHOOL_HOLIDAYS_BY, '2027-01-01', '2027-01-08');
  addDateRange(SCHOOL_HOLIDAYS_BY, '2027-02-15', '2027-02-19');
  addDateRange(SCHOOL_HOLIDAYS_BY, '2027-03-22', '2027-04-02');
  addDateRange(SCHOOL_HOLIDAYS_BY, '2027-05-17', '2027-05-28');
  addDateRange(SCHOOL_HOLIDAYS_BY, '2027-07-29', '2027-09-13');
  addDateRange(SCHOOL_HOLIDAYS_BY, '2027-11-01', '2027-11-05');
  addDateRange(SCHOOL_HOLIDAYS_BY, '2027-12-24', '2027-12-31');
  // 2028
  addDateRange(SCHOOL_HOLIDAYS_BY, '2028-01-01', '2028-01-07');
  addDateRange(SCHOOL_HOLIDAYS_BY, '2028-02-21', '2028-02-25');
  addDateRange(SCHOOL_HOLIDAYS_BY, '2028-04-10', '2028-04-22');
  addDateRange(SCHOOL_HOLIDAYS_BY, '2028-06-05', '2028-06-16');
  addDateRange(SCHOOL_HOLIDAYS_BY, '2028-07-27', '2028-09-09');
  addDateRange(SCHOOL_HOLIDAYS_BY, '2028-10-30', '2028-11-03');
  addDateRange(SCHOOL_HOLIDAYS_BY, '2028-12-23', '2028-12-31');
  // 2029
  addDateRange(SCHOOL_HOLIDAYS_BY, '2029-01-01', '2029-01-05');
  addDateRange(SCHOOL_HOLIDAYS_BY, '2029-02-12', '2029-02-16');
  addDateRange(SCHOOL_HOLIDAYS_BY, '2029-03-26', '2029-04-07');
  addDateRange(SCHOOL_HOLIDAYS_BY, '2029-05-22', '2029-06-02');
  addDateRange(SCHOOL_HOLIDAYS_BY, '2029-07-30', '2029-09-10');
  addDateRange(SCHOOL_HOLIDAYS_BY, '2029-10-29', '2029-11-02');
  addDateRange(SCHOOL_HOLIDAYS_BY, '2029-12-24', '2029-12-31');

  // Feiertage (fixed + approximate moveable)
  function addYearlyFeiertage(year) {
    FEIERTAGE_BY.add(`${year}-01-01`);
    FEIERTAGE_BY.add(`${year}-01-06`);
    FEIERTAGE_BY.add(`${year}-05-01`);
    FEIERTAGE_BY.add(`${year}-08-15`);
    FEIERTAGE_BY.add(`${year}-10-03`);
    FEIERTAGE_BY.add(`${year}-11-01`);
    FEIERTAGE_BY.add(`${year}-12-25`);
    FEIERTAGE_BY.add(`${year}-12-26`);
  }
  [2026, 2027, 2028, 2029].forEach(addYearlyFeiertage);
  // Easter-dependent (approximate)
  FEIERTAGE_BY.add('2026-04-03'); FEIERTAGE_BY.add('2026-04-06'); // Karfreitag, Ostermontag
  FEIERTAGE_BY.add('2026-05-14'); FEIERTAGE_BY.add('2026-05-25'); // Himmelfahrt, Pfingstmontag
  FEIERTAGE_BY.add('2026-06-04'); // Fronleichnam
  FEIERTAGE_BY.add('2027-03-26'); FEIERTAGE_BY.add('2027-03-29');
  FEIERTAGE_BY.add('2027-05-06'); FEIERTAGE_BY.add('2027-05-17');
  FEIERTAGE_BY.add('2027-05-27');
  FEIERTAGE_BY.add('2028-04-14'); FEIERTAGE_BY.add('2028-04-17');
  FEIERTAGE_BY.add('2028-05-25'); FEIERTAGE_BY.add('2028-06-05');
  FEIERTAGE_BY.add('2028-06-15');
  FEIERTAGE_BY.add('2029-03-30'); FEIERTAGE_BY.add('2029-04-02');
  FEIERTAGE_BY.add('2029-05-10'); FEIERTAGE_BY.add('2029-05-21');
  FEIERTAGE_BY.add('2029-05-31');

  // Oktoberfest
  addDateRange(OKTOBERFEST, '2026-09-19', '2026-10-04');
  addDateRange(OKTOBERFEST, '2027-09-18', '2027-10-03');
  addDateRange(OKTOBERFEST, '2028-09-16', '2028-10-01');
  addDateRange(OKTOBERFEST, '2029-09-20', '2029-10-05');

  // Dosierung Tirol (approximate Mondays)
  ['2026-02-02', '2026-02-09', '2026-02-16', '2026-02-23', '2026-03-02', '2026-03-09',
    '2026-07-06', '2026-07-13', '2026-07-20', '2026-07-27',
    '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28',
    '2027-02-01', '2027-02-08', '2027-02-15', '2027-02-22', '2027-03-01', '2027-03-08',
    '2027-07-05', '2027-07-12', '2027-07-19', '2027-07-26',
    '2027-09-06', '2027-09-13', '2027-09-20', '2027-09-27',
  ].forEach(d => DOSIERUNG.add(d));

  // --- Pseudo-random seeded generator ---
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function generateForecasts() {
    const rows = [];
    const rng = mulberry32(42);

    for (let year = 2026; year <= 2029; year++) {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31);

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay(); // 0=Sun
        const month = d.getMonth(); // 0-11
        // Format as YYYY-MM-DD local time safely
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        const isWeekend = dow === 0 || dow === 6;
        const isFriday = dow === 5;
        const isSaturday = dow === 6;
        const isSunday = dow === 0;
        const isFerien = SCHOOL_HOLIDAYS_BY.has(dateStr);
        const isFeiertag = FEIERTAGE_BY.has(dateStr);
        const isOktoberfest = OKTOBERFEST.has(dateStr);
        const isDosierung = DOSIERUNG.has(dateStr);
        const isSummer = month >= 5 && month <= 8;

        for (const [corridor, config] of Object.entries(CORRIDORS)) {
          // Use first strecke as representative
          const strecke = config.strecken[0];
          for (const richtung of config.richtungen) {
            const isSouthbound = (corridor === 'A93' && richtung === 'Kufstein') ||
              (corridor === 'A8' && richtung === 'Salzburg');

            for (const slot of TIME_SLOTS) {
              const slotHour = parseInt(slot.split('-')[0]);

              // Base category (1 = free)
              let baseScore = 1.0;

              // Corridor specific patterns - EXTREMELY EXAGGERATED FOR DEMO PURPOSES
              if (corridor === 'A8') {
                // A8 is completely terrible on Fridays and Sundays, very bad in Summer
                if (isFriday || isSunday) baseScore += 2.5;
                if (isSummer) baseScore += 1.5;
                if (isOktoberfest) baseScore += 3.0; // Everything is dark red
              } else if (corridor === 'A93') {
                // A93 is generally very free (green), except for Saturdays and Dosierung
                baseScore -= 1.0;
                if (isSaturday) baseScore += 3.0;
                if (isDosierung) baseScore += 4.0;
              }

              // Time-of-day pattern
              if (slotHour >= 8 && slotHour < 20) baseScore += 0.5;

              // Weekend patterns
              if (isWeekend) baseScore += 0.3;

              // Ferien effect
              if (isFerien) {
                baseScore += 1.0;
              }

              // Feiertag
              if (isFeiertag) baseScore += 0.5;

              // Night damping
              if (slotHour < 4 || slotHour >= 20) baseScore *= 0.3;

              // Add noise (different for corridors)
              const noiseScale = corridor === 'A8' ? 1.2 : 0.7;
              baseScore += (rng() - 0.5) * noiseScale;

              // Clamp to 1-5
              const category = Math.max(1, Math.min(5, Math.round(baseScore)));

              // Generate probabilities (highest for predicted category)
              const probs = [0, 0, 0, 0, 0];
              let remaining = 1.0;
              const mainProb = 0.45 + rng() * 0.35;
              probs[category - 1] = mainProb;
              remaining -= mainProb;

              // Spread remaining across neighbors
              for (let i = 0; i < 5; i++) {
                if (i !== category - 1) {
                  const dist = Math.abs(i - (category - 1));
                  probs[i] = remaining * (dist === 1 ? 0.35 : 0.1) * (0.8 + rng() * 0.4);
                }
              }
              // Normalize
              const sum = probs.reduce((a, b) => a + b, 0);
              for (let i = 0; i < 5; i++) probs[i] = +(probs[i] / sum).toFixed(4);

              rows.push({
                datum: dateStr,
                strecke,
                richtung,
                time_slot: slot,
                pred_category: category,
                prob_1: probs[0],
                prob_2: probs[1],
                prob_3: probs[2],
                prob_4: probs[3],
                prob_5: probs[4],
                // Metadata for badges
                _isFerien: isFerien,
                _isFeiertag: isFeiertag,
                _isOktoberfest: isOktoberfest,
                _isDosierung: isDosierung,
                _isWeekend: isWeekend
              });
            }
          }
        }
      }
    }

    return { rows, corridors: CORRIDORS, directionLabels: DIRECTION_LABELS };
  }

  return generateForecasts();
})();
