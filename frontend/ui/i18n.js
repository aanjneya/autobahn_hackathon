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
        5: 'Stillstand'
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
      'legend.cat5': 'Stillstand',
      'footer.stand': 'Stand –',
      'popover.close': 'Schließen',
      'popover.confidence': 'Konfidenz',
      'popover.volume': 'Volumen (Peak):',
      'popover.speed': 'Ø Geschwindigkeit:',
      'popover.kfz_per_h': 'Kfz/h',
      'popover.no_forecast': 'Keine Prognose verfügbar.',
      'popover.no_reason': 'Kein besonderer Grund – normaler Verkehr.',
      'dayview.map_label': 'Verlauf (30-Minuten Takt):',
      'dayview.hourly_label': '30-Minuten-Verlauf (gesamter Tag)',
      'dayview.factors': 'Einflussfaktoren',
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
        5: 'Standstill'
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
      'legend.cat5': 'Standstill',
      'footer.stand': 'As of –',
      'popover.close': 'Close',
      'popover.confidence': 'Confidence',
      'popover.volume': 'Volume (peak):',
      'popover.speed': 'Avg. speed:',
      'popover.kfz_per_h': 'veh/h',
      'popover.no_forecast': 'No forecast available.',
      'popover.no_reason': 'No specific reason — normal traffic.',
      'dayview.map_label': 'Course (30-minute intervals):',
      'dayview.hourly_label': '30-minute course (full day)',
      'dayview.factors': 'Influencing factors',
      'lang.label': 'Language',
      'lang.de': 'DE',
      'lang.en': 'EN'
    }
  };

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
    lang: function () { return current; },
    setLang: setLang,
    onChange: onChange,
    apply: apply,
    mountToggle: mountToggle
  };
})();