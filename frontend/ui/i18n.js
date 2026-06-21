// i18n.js — central translation module
// Must be loaded BEFORE app*.js so I18n is available at top-level const init.

(function () {
  const STORAGE_KEY = 'autobahn.lang';

  const dict = {
    de: {
      months: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
        'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
      dow_short: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
      slot_labels: ['00-04 Uhr', '04-08 Uhr', '08-12 Uhr', '12-16 Uhr', '16-20 Uhr', '20-24 Uhr'],
      cat_labels: {
        0: 'Keine Prognose',
        1: 'Flüssiger Verkehr',
        2: 'Verstärkter Verkehr',
        3: 'Starker Verkehr',
        4: 'Sehr starker Verkehr',
        5: 'Potentieller Stillstand'
      },
      'app.title': 'FAHRKALENDER',
      'app.print': '🖨️ Drucken',
      'mode.standard': 'Standard',
      'mode.tourist': 'Tourist',
      'mode.resident': 'Anwohner',
      'mode.logistics': 'Logistik',
      'mode.tourism': 'Tourismus',
      'mode.authority': 'Behörde',
      'route.a93_sued': 'A93 Richtung Süden',
      'route.a93_nord': 'A93 Richtung Norden',
      'route.a8_ost': 'A8 Richtung Osten',
      'route.a8_west': 'A8 Richtung Westen',
      'route.a93_sued.title': 'A93 RICHTUNG SÜDEN',
      'route.a93_nord.title': 'A93 RICHTUNG NORDEN',
      'route.a8_ost.title': 'A8 RICHTUNG OSTEN',
      'route.a8_west.title': 'A8 RICHTUNG WESTEN',
      'route.a93_sued.sub': 'Rosenheim, München, Deutschland → Brenner, Italien – Kufstein, Innsbruck, Österreich',
      'route.a93_nord.sub': 'Kufstein, Innsbruck, Österreich → Rosenheim, München, Deutschland',
      'route.a8_ost.sub': 'München → Salzburg',
      'route.a8_west.sub': 'Salzburg → München',
      'nav.prev': 'Zurück',
      'nav.next': 'Vor',
      'legend.weekend': 'Wochenende',
      'legend.holiday': 'Feiertag',
      'legend.cat1': 'Flüssiger Verkehr',
      'legend.cat2': 'Verstärkter Verkehr',
      'legend.cat3': 'Starker Verkehr',
      'legend.cat4': 'Sehr starker Verkehr',
      'legend.cat5': 'Potentieller Stillstand',
      'footer.stand': 'Stand –',
      'popover.close': 'Schließen',
      'popover.confidence': 'Konfidenz',
      'popover.volume': 'Volumen (Peak):',
      'popover.speed': 'Min. Geschwindigkeit:',
      'popover.kfz_per_h': 'Kfz/h',
      'popover.no_forecast': 'Keine Prognose verfügbar.',
      'popover.no_reason': 'Kein besonderer Grund – normaler Verkehr.',
      'dayview.map_label': 'Verlauf (30-Minuten Takt):',
      'dayview.hourly_label': '30-Minuten-Verlauf (gesamter Tag)',
      'dayview.factors': 'Einflussfaktoren',
      'dayview.back': '← Zurück zur Übersicht',
      'dayview.day_max': 'Tages-Maximum',
      'dayview.prev_day': '‹ Vorheriger Tag',
      'dayview.next_day': 'Nächster Tag ›',
      'popover.more_info': 'Mehr Infos →',
      'popover.measure_label': '🚧 Maßnahme empfohlen:',
      'popover.measure_action': 'Dosierung / LKW-Verbot aktivieren',
      'tip.vba.title': '⚠️ VBA-Schaltung:',
      'tip.vba.text': 'Stauwarnung & Tempolimits vorbereiten',
      'tip.maintenance.title': '✅ Wartungsfenster:',
      'tip.maintenance.text': 'Ideal für Tagesbaustellen & Sperrungen',
      'tip.police.title': '🚓 Einsatzplanung:',
      'tip.police.text': 'Polizei & Pannenhilfe aufstocken',
      'tip.border.title': '🛂 Grenzkontrolle:',
      'tip.border.text': 'Mit Bundespolizei abstimmen',
      'tip.logistics.title': '⏱️ Erwarteter Zeitverlust:',
      'tip.logistics.min': 'Min',
      'tip.resident.title': '⚠️ Schleichverkehr-Risiko:',
      'tip.resident.text': 'Hoch (Dorfstraßen meiden)',
      'tip.tourism.title': '🛎️ Rezeptions-Auslastung:',
      'tip.tourism.text': 'Extrem hoch (Personal planen!)',
      'tip.tourist.title': '💡 Tipp:',
      'tip.tourist.depart_before_or_after': 'Fahren Sie vor {a} oder nach {b} Uhr ab.',
      'tip.tourist.depart_before': 'Fahren Sie idealerweise vor {a} Uhr ab.',
      'tip.tourist.depart_after': 'Fahren Sie idealerweise nach {a} Uhr ab.',
      'tip.tourist.check_detail': 'Prüfen Sie den detaillierten 30-Minuten-Verlauf.',
      'tip.tourist.other_day': 'Suchen Sie einen anderen Reisetag.',
      'lang.label': 'Sprache',
      'lang.de': 'DE',
      'lang.en': 'EN'
    },
    en: {
      months: ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'],
      dow_short: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      slot_labels: ['00-04', '04-08', '08-12', '12-16', '16-20', '20-24'],
      cat_labels: {
        0: 'No forecast',
        1: 'Free flow',
        2: 'Increased traffic',
        3: 'Heavy traffic',
        4: 'Very heavy traffic',
        5: 'Potential standstill'
      },
      'app.title': 'TRAVEL CALENDAR',
      'app.print': '🖨️ Print',
      'mode.standard': 'Standard',
      'mode.tourist': 'Tourist',
      'mode.resident': 'Resident',
      'mode.logistics': 'Logistics',
      'mode.tourism': 'Tourism',
      'mode.authority': 'Authority',
      'route.a93_sued': 'A93 Southbound',
      'route.a93_nord': 'A93 Northbound',
      'route.a8_ost': 'A8 Eastbound',
      'route.a8_west': 'A8 Westbound',
      'route.a93_sued.title': 'A93 SOUTHBOUND',
      'route.a93_nord.title': 'A93 NORTHBOUND',
      'route.a8_ost.title': 'A8 EASTBOUND',
      'route.a8_west.title': 'A8 WESTBOUND',
      'route.a93_sued.sub': 'Rosenheim, Munich, Germany → Brenner, Italy – Kufstein, Innsbruck, Austria',
      'route.a93_nord.sub': 'Kufstein, Innsbruck, Austria → Rosenheim, Munich, Germany',
      'route.a8_ost.sub': 'Munich → Salzburg',
      'route.a8_west.sub': 'Salzburg → Munich',
      'nav.prev': 'Back',
      'nav.next': 'Next',
      'legend.weekend': 'Weekend',
      'legend.holiday': 'Public holiday',
      'legend.cat1': 'Free flow',
      'legend.cat2': 'Increased traffic',
      'legend.cat3': 'Heavy traffic',
      'legend.cat4': 'Very heavy traffic',
      'legend.cat5': 'Potential standstill',
      'footer.stand': 'As of –',
      'popover.close': 'Close',
      'popover.confidence': 'Confidence',
      'popover.volume': 'Volume (peak):',
      'popover.speed': 'Min. speed:',
      'popover.kfz_per_h': 'veh/h',
      'popover.no_forecast': 'No forecast available.',
      'popover.no_reason': 'No specific reason — normal traffic.',
      'dayview.map_label': 'Course (30-minute intervals):',
      'dayview.hourly_label': '30-minute course (full day)',
      'dayview.factors': 'Influencing factors',
      'dayview.back': '← Back to overview',
      'dayview.day_max': 'Daily maximum',
      'dayview.prev_day': '‹ Previous day',
      'dayview.next_day': 'Next day ›',
      'popover.more_info': 'More info →',
      'popover.measure_label': '🚧 Action recommended:',
      'popover.measure_action': 'Activate metering / HGV ban',
      'tip.vba.title': '⚠️ Variable signs:',
      'tip.vba.text': 'Prepare jam warnings & speed limits',
      'tip.maintenance.title': '✅ Maintenance window:',
      'tip.maintenance.text': 'Ideal for daytime works & closures',
      'tip.police.title': '🚓 Operational planning:',
      'tip.police.text': 'Increase police & breakdown assistance',
      'tip.border.title': '🛂 Border control:',
      'tip.border.text': 'Coordinate with federal police',
      'tip.logistics.title': '⏱️ Expected delay:',
      'tip.logistics.min': 'min',
      'tip.resident.title': '⚠️ Rat-run risk:',
      'tip.resident.text': 'High (avoid village roads)',
      'tip.tourism.title': '🛎️ Reception load:',
      'tip.tourism.text': 'Extremely high (plan staffing!)',
      'tip.tourist.title': '💡 Tip:',
      'tip.tourist.depart_before_or_after': 'Depart before {a} or after {b}.',
      'tip.tourist.depart_before': 'Ideally depart before {a}.',
      'tip.tourist.depart_after': 'Ideally depart after {a}.',
      'tip.tourist.check_detail': 'Check the detailed 30-minute course.',
      'tip.tourist.other_day': 'Pick another travel day.',
      'lang.label': 'Language',
      'lang.de': 'DE',
      'lang.en': 'EN'
    }
  };

  // Verkehrs-„reasons" aus dem Modell. Schlüssel = exakter DE-String aus
  // forecast.csv, Wert = Übersetzung. Unbekannte Reasons werden unverändert
  // durchgereicht.
  const reasonMap = {
    en: {
      'Berufsverkehr': 'Commuter traffic',
      'Blockabfertigung Tirol': 'Block clearance Tyrol',
      'Feiertag': 'Public holiday',
      'Ferienbeginn': 'Start of school holidays',
      'Ferienende (Rückreiseverkehr)': 'End of holidays (return traffic)',
      'Ferienverkehr': 'Holiday traffic',
      'Hohes Verkehrsaufkommen': 'High traffic volume',
      'Messe München': 'Munich trade fair',
      'Oktoberfest': 'Oktoberfest',
      'Tag vor Feiertag (Kurzurlauber)': 'Day before holiday (short-break travellers)',
      'Verlängertes Wochenende': 'Long weekend',
      'Vorferien-Wochenende': 'Pre-holiday weekend',
      'Wochenendpendler': 'Weekend commuters',
      'Wochenendverkehr': 'Weekend traffic',
    },
  };

  function tReason(s) {
    if (!s) return s;
    if (current === 'de') return s;
    const m = reasonMap[current];
    return (m && m[s] !== undefined) ? m[s] : s;
  }

  const listeners = [];
  let current = 'de';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'de' || saved === 'en') current = saved;
  } catch (_) {}

  function get(key) {
    const d = dict[current];
    return (d && d[key] !== undefined) ? d[key] : (dict.de[key] !== undefined ? dict.de[key] : key);
  }

  function setLang(lang) {
    if (lang !== 'de' && lang !== 'en') return;
    if (lang === current) return;
    current = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) {}
    document.documentElement.setAttribute('lang', lang);
    apply();
    for (const fn of listeners) {
      try { fn(lang); } catch (e) { console.error(e); }
    }
  }

  function onChange(fn) {
    if (typeof fn === 'function') listeners.push(fn);
  }

  function apply(root) {
    const scope = root || document;
    // Text content
    scope.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = get(key);
    });
    // Attributes: data-i18n-attr="title:popover.close,aria-label:popover.close"
    scope.querySelectorAll('[data-i18n-attr]').forEach(el => {
      const spec = el.getAttribute('data-i18n-attr');
      spec.split(',').forEach(pair => {
        const [attr, key] = pair.split(':').map(s => s.trim());
        if (attr && key) el.setAttribute(attr, get(key));
      });
    });
    // <title> tag
    const titleKey = document.documentElement.getAttribute('data-i18n-title');
    if (titleKey) document.title = get(titleKey);
  }

  function mountToggle(target) {
    const host = target || document.querySelector('.hdr__right > div') || document.querySelector('.hdr__right') || document.body;
    if (host.querySelector('.lang-toggle')) return;
    const wrap = document.createElement('div');
    wrap.className = 'lang-toggle';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', get('lang.label'));
    wrap.innerHTML =
      '<button type="button" class="lang-toggle__btn" data-lang="de">' + get('lang.de') + '</button>' +
      '<button type="button" class="lang-toggle__btn" data-lang="en">' + get('lang.en') + '</button>';
    wrap.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => setLang(btn.dataset.lang));
    });
    host.insertBefore(wrap, host.firstChild);
    updateToggleState();
    onChange(updateToggleState);
  }

  function updateToggleState() {
    document.querySelectorAll('.lang-toggle__btn').forEach(b => {
      b.classList.toggle('is-active', b.dataset.lang === current);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.documentElement.setAttribute('lang', current);
    apply();
    mountToggle();
  });

  window.I18n = {
    get: get,
    t: get,
    tReason: tReason,
    lang: function () { return current; },
    setLang: setLang,
    onChange: onChange,
    apply: apply,
    mountToggle: mountToggle
  };
})();