/**
 * Autobahn Fahrkalender — Layout nach offizieller PDF-Vorlage.
 * Lädt forecast.csv, aggregiert auf 4h-Blöcke pro (datum, strecke, richtung).
 */

// ────────────────────────────────────────────────────────────
// Konstanten
// ────────────────────────────────────────────────────────────

let MONTHS = (typeof I18n !== 'undefined') ? I18n.get('months').slice() : ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
let DOW_SHORT = (typeof I18n !== 'undefined') ? I18n.get('dow_short').slice() : ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
let SLOT_LABELS = (typeof I18n !== 'undefined') ? I18n.get('slot_labels').slice() : ['00-04 Uhr', '04-08 Uhr', '08-12 Uhr', '12-16 Uhr', '16-20 Uhr', '20-24 Uhr'];

function ROUTE_TEXT_FOR(strecke, richtung) {
  const map = { 'A93|Sued': 'route.a93_sued', 'A93|Nord': 'route.a93_nord', 'A8|Ost': 'route.a8_ost', 'A8|West': 'route.a8_west' };
  const base = map[strecke + '|' + richtung];
  if (!base) return { title: '', sub: '' };
  const t = (typeof I18n !== 'undefined') ? I18n.t : (k => k);
  return { title: t(base + '.title'), sub: t(base + '.sub') };
}
let ROUTE_TEXT = new Proxy({}, { get: (_, key) => { const parts = String(key).split('|'); return ROUTE_TEXT_FOR(parts[0], parts[1]); } });

// CSV richtung → kanonische Richtung (Sued/Nord/Ost/West)
const RICHTUNG_MAP = {
  'Kufstein': 'Sued',
  'Rosenheim': 'Nord',
  'Salzburg': 'Ost',
  'München': 'West',
  'Sued': 'Sued', 'Nord': 'Nord', 'Ost': 'Ost', 'West': 'West'
};

// strecke prefix → A93 / A8
function streckeToCorridor(strecke) {
  if (!strecke) return null;
  if (strecke.startsWith('A93')) return 'A93';
  if (strecke.startsWith('A8')) return 'A8';
  return null;
}

// Bayerische Feiertage 2026–2029 (per 'YYYY-MM-DD' → Name).
const HOLIDAYS = {
  // 2026
  '2026-01-01': 'Neujahr',
  '2026-01-06': 'Hl. Drei Könige',
  '2026-04-03': 'Karfreitag',
  '2026-04-06': 'Ostermontag',
  '2026-05-01': 'Tag der Arbeit',
  '2026-05-14': 'Christi Himmelfahrt',
  '2026-05-25': 'Pfingstmontag',
  '2026-06-04': 'Fronleichnam',
  '2026-08-15': 'Mariä Himmelfahrt',
  '2026-10-03': 'Tag d. Dt. Einheit',
  '2026-11-01': 'Allerheiligen',
  '2026-12-25': '1. Weihnachtstag',
  '2026-12-26': '2. Weihnachtstag',
  // 2027
  '2027-01-01': 'Neujahr',
  '2027-01-06': 'Hl. Drei Könige',
  '2027-03-26': 'Karfreitag',
  '2027-03-29': 'Ostermontag',
  '2027-05-01': 'Tag der Arbeit',
  '2027-05-06': 'Christi Himmelfahrt',
  '2027-05-17': 'Pfingstmontag',
  '2027-05-27': 'Fronleichnam',
  '2027-08-15': 'Mariä Himmelfahrt',
  '2027-10-03': 'Tag d. Dt. Einheit',
  '2027-11-01': 'Allerheiligen',
  '2027-12-25': '1. Weihnachtstag',
  '2027-12-26': '2. Weihnachtstag',
  // 2028
  '2028-01-01': 'Neujahr',
  '2028-01-06': 'Hl. Drei Könige',
  '2028-04-14': 'Karfreitag',
  '2028-04-17': 'Ostermontag',
  '2028-05-01': 'Tag der Arbeit',
  '2028-05-25': 'Christi Himmelfahrt',
  '2028-06-05': 'Pfingstmontag',
  '2028-06-15': 'Fronleichnam',
  '2028-08-15': 'Mariä Himmelfahrt',
  '2028-10-03': 'Tag d. Dt. Einheit',
  '2028-11-01': 'Allerheiligen',
  '2028-12-25': '1. Weihnachtstag',
  '2028-12-26': '2. Weihnachtstag',
  // 2029
  '2029-01-01': 'Neujahr',
  '2029-01-06': 'Hl. Drei Könige',
  '2029-03-30': 'Karfreitag',
  '2029-04-02': 'Ostermontag',
  '2029-05-01': 'Tag der Arbeit',
  '2029-05-10': 'Christi Himmelfahrt',
  '2029-05-21': 'Pfingstmontag',
  '2029-05-31': 'Fronleichnam',
  '2029-08-15': 'Mariä Himmelfahrt',
  '2029-10-03': 'Tag d. Dt. Einheit',
  '2029-11-01': 'Allerheiligen',
  '2029-12-25': '1. Weihnachtstag',
  '2029-12-26': '2. Weihnachtstag'
};

// ────────────────────────────────────────────────────────────
// State
// ────────────────────────────────────────────────────────────

const state = {
  strecke: (typeof NavState !== 'undefined' ? NavState.getStrecke() : 'A93'),
  richtung: (typeof NavState !== 'undefined' ? NavState.getRichtung() : 'Sued'),
  // Index des linken Detailmonats (0-basiert ab Januar 2026).
  // 0 = Jan 2026, 1 = Feb 2026, ... 12 = Jan 2027, ...
  monthIndex: 5, // Juni 2026 als sinnvoller Default (Feriensaison)
  data: {}, // key "YYYY-MM-DD|A93|Sued" → [c1, c2, c3, c4, c5, c6]
  reasons: {}, // key "YYYY-MM-DD|A93|Sued" → [ [r0..], [r1..], ... ] (6 4h-Blöcke)
  confidence: {}, // key "YYYY-MM-DD|A93|Sued" → [p0..p5] (Modell-Konfidenz je 4h-Block, 0..1)
  currentDayDs: null,
  dayAnchor: null // Tag-des-Monats, der bei Monats-Shifts erhalten bleibt
};

// Kategorie → Klartext (gleiche Bezeichnungen wie die Legende im Footer).
let CAT_LABELS = (typeof I18n !== 'undefined') ? Object.assign({}, I18n.get('cat_labels')) : {0:'Keine Prognose',1:'Flüssiger Verkehr',2:'Verstärkter Verkehr',3:'Starker Verkehr',4:'Sehr starker Verkehr',5:'Stillstand'};

const BASE_YEAR = 2026;
const MIN_INDEX = 0;
const MAX_INDEX = (2029 - BASE_YEAR + 1) * 12 - 4; // 4 sichtbare Monate

// ────────────────────────────────────────────────────────────
// Boot
// ────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  setupEvents();
  setStandDate();
  try {
    await loadCsv();
  } catch (err) {
    console.warn('forecast.csv konnte nicht geladen werden, versuche Demo-Daten:', err);
    await loadDemo();
  }
  render();
});

function setupEvents() {
  // Route toggle buttons (have data-strecke)
  document.querySelectorAll('#toggle .toggle__btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#toggle .toggle__btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.strecke = btn.dataset.strecke;
      state.richtung = btn.dataset.richtung;
      if (typeof NavState !== 'undefined') NavState.save(state.strecke, state.richtung);
      render();
      if (isDayViewOpen() && state.currentDayDs) showDayDetailView(state.currentDayDs);
    });
  });
  document.getElementById('navPrev').addEventListener('click', () => {
    if (isDayViewOpen() && state.currentDayDs) {
      shiftDayViewByMonths(-1);
      return;
    }
    state.monthIndex = Math.max(MIN_INDEX, state.monthIndex - 1);
    render();
  });
  document.getElementById('navNext').addEventListener('click', () => {
    if (isDayViewOpen() && state.currentDayDs) {
      shiftDayViewByMonths(1);
      return;
    }
    state.monthIndex = Math.min(MAX_INDEX, state.monthIndex + 1);
    render();
  });
  document.getElementById('printBtn').addEventListener('click', () => window.print());
}

function setStandDate() {
  const lang = (typeof I18n !== 'undefined') ? I18n.lang() : 'de';
  const locale = lang === 'en' ? 'en-GB' : 'de-DE';
  const s = new Date().toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const raw = (typeof I18n !== 'undefined') ? I18n.t('footer.stand') : 'Stand –';
  const prefix = raw.replace(/[–\-]\s*$/, '').trim();
  document.getElementById('stand').textContent = prefix + ' ' + s;
}

// ────────────────────────────────────────────────────────────
// CSV laden + aggregieren
// ────────────────────────────────────────────────────────────

async function loadCsv() {
  const resp = await fetch('./forecast.csv');
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const text = await resp.text();
  parseCsv(text);
  if (Object.keys(state.data).length === 0) throw new Error('empty');
}

// CSV-Zeile zerlegen, die in Anführungszeichen gesetzte Felder mit Kommas
// enthalten kann (z. B. die reason-Spalte: "[""A"", ""B""]"). "" → ".
function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { out.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

// reason-Zelle (JSON-Array) → Liste von Strings, tolerant gegenüber Müll.
function parseReason(cell) {
  if (!cell) return [];
  try {
    const arr = JSON.parse(cell);
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  } catch (e) {
    return [];
  }
}

function parseCsv(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return;
  const headers = splitCsvLine(lines[0]);
  const iDatum = headers.indexOf('datum');
  const iStrecke = headers.indexOf('strecke');
  const iRichtung = headers.indexOf('richtung');
  const iSlot = headers.indexOf('time_slot');
  const iCat = headers.indexOf('pred_category');
  const iReason = headers.indexOf('reason');
  const iProbCols = [1, 2, 3, 4, 5].map(k => headers.indexOf(`prob_${k}`));
  const iKfz = headers.indexOf('kfz_expected');

  // Falls schon im wide-Format (slot0..slot5)
  const iSlotCols = [0, 1, 2, 3, 4, 5].map(k => headers.indexOf(`slot${k}`));
  const wide = iSlotCols.every(i => i >= 0);

  const aggSum = {};
  const aggCnt = {};
  const confSum = {};
  const agg = {};
  const reasons = {};
  const confidence = {};
  const kfz = {};
  const hourly = {};
  for (let l = 1; l < lines.length; l++) {
    const cols = splitCsvLine(lines[l]);
    if (cols.length < 4) continue;
    const datum = cols[iDatum];
    const corridor = streckeToCorridor(cols[iStrecke]);
    if (!corridor) continue;
    const rich = RICHTUNG_MAP[cols[iRichtung]] || cols[iRichtung];
    if (!rich) continue;
    const key = `${datum}|${corridor}|${rich}`;
    if (!aggSum[key]) aggSum[key] = [0, 0, 0, 0, 0, 0];
    if (!aggCnt[key]) aggCnt[key] = [0, 0, 0, 0, 0, 0];
    if (!confSum[key]) confSum[key] = [0, 0, 0, 0, 0, 0];
    if (!agg[key]) agg[key] = [0, 0, 0, 0, 0, 0];

    if (wide) {
      for (let k = 0; k < 6; k++) {
        const c = parseInt(cols[iSlotCols[k]]);
        if (!isNaN(c) && c > agg[key][k]) agg[key][k] = c;
      }
    } else {
      const slot = cols[iSlot];
      const cat = parseInt(cols[iCat]);
      if (isNaN(cat) || !slot) continue;
      const startHour = parseInt(slot.split(':')[0]);
      if (isNaN(startHour)) continue;
      const block = Math.floor(startHour / 4);
      if (block < 0 || block > 5) continue;
      // First, track the MAX cat per 30-min slot across sub-segments.
      const slotKey = `${key}|${slot}`;
      if (!window.__slotMax) window.__slotMax = {};
      if (!window.__slotMaxConf) window.__slotMaxConf = {};
      
      const subStrecke = cols[iStrecke];
      if (!window.__segMax) window.__segMax = {};
      const segKey = `${key}|${block}|${subStrecke}`;
      if (!window.__segMax[segKey] || cat > window.__segMax[segKey]) {
        window.__segMax[segKey] = cat;
      }
      
      if (!window.__slotMax[slotKey] || cat > window.__slotMax[slotKey]) {
        window.__slotMax[slotKey] = cat;
        
        const iProb = iProbCols[cat - 1];
        if (iProb >= 0) {
          const p = parseFloat(cols[iProb]);
          if (!isNaN(p)) window.__slotMaxConf[slotKey] = p;
        }
      }
      
      // We will compute agg after the loop!

      // Gründe je 4h-Block sammeln (Vereinigung, ohne Duplikate).
      if (iReason >= 0) {
        const rs = parseReason(cols[iReason]);
        if (rs.length) {
          if (!reasons[key]) reasons[key] = [[], [], [], [], [], []];
          const bucket = reasons[key][block];
          for (const r of rs) if (!bucket.includes(r)) bucket.push(r);
        }
      }

      if (iKfz >= 0) {
        const val = parseInt(cols[iKfz]);
        if (!isNaN(val)) {
          if (!kfz[key]) kfz[key] = [0, 0, 0, 0, 0, 0];
          if (val > kfz[key][block]) kfz[key][block] = val;
        }
      }

      if (!hourly[key]) hourly[key] = [[], [], [], [], [], []];
      let hVal = 0;
      if (iKfz >= 0 && !isNaN(parseInt(cols[iKfz]))) hVal = parseInt(cols[iKfz]);
      
      const existing = hourly[key][block].find(x => x.slot === slot);
      if (existing) {
        if (cat > existing.cat) existing.cat = cat;
        if (hVal > existing.val) existing.val = hVal;
      } else {
        hourly[key][block].push({ slot: slot, cat: cat, val: hVal });
      }
    }
  }
  // Compute block averages from the 30-minute maximums
  if (window.__slotMax) {
    const blockSums = {};
    const blockCnts = {};
    const blockConfSums = {};
    const blockConfCnts = {};
    
    for (const sk in window.__slotMax) {
       const parts = sk.split('|');
       const baseKey = parts[0] + '|' + parts[1] + '|' + parts[2];
       const slotStr = parts[3];
       const startHour = parseInt(slotStr.split(':')[0]);
       const block = Math.floor(startHour / 4);
       
       if (!blockSums[baseKey]) {
          blockSums[baseKey] = [0,0,0,0,0,0];
          blockCnts[baseKey] = [0,0,0,0,0,0];
          blockConfSums[baseKey] = [0,0,0,0,0,0];
          blockConfCnts[baseKey] = [0,0,0,0,0,0];
       }
       const c = window.__slotMax[sk];
       const w = c; // simple linear weighting (Cat 5 is weighted 5x more than Cat 1)
       blockSums[baseKey][block] += c * w;
       blockCnts[baseKey][block] += w;
       
       if (window.__slotMaxConf[sk] != null) {
          blockConfSums[baseKey][block] += window.__slotMaxConf[sk];
          blockConfCnts[baseKey][block] += 1;
       }
    }
    
    for (const baseKey in blockSums) {
       for (let b=0; b<6; b++) {
          if (blockCnts[baseKey][b] > 0) {
             agg[baseKey][b] = Math.round(blockSums[baseKey][b] / blockCnts[baseKey][b]);
             if (blockConfCnts[baseKey][b] > 0) {
                if (!confidence[baseKey]) confidence[baseKey] = [null,null,null,null,null,null];
                confidence[baseKey][b] = blockConfSums[baseKey][b] / blockConfCnts[baseKey][b];
             }
          }
       }
    }
    window.__slotMax = null;
    window.__slotMaxConf = null;
  }
  
  state.data = agg;
  state.kfz = kfz;
  state.hourly = hourly;
  state.reasons = reasons;
  state.confidence = confidence;
}

async function loadDemo() {
  // Sehr einfacher Fallback: zufällige Demo-Daten.
  const corridors = [['A93', 'Sued'], ['A93', 'Nord'], ['A8', 'Ost'], ['A8', 'West']];
  const data = {};
  for (let y = 2026; y <= 2029; y++) {
    for (let m = 0; m < 12; m++) {
      const last = new Date(y, m + 1, 0).getDate();
      for (let d = 1; d <= last; d++) {
        const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isWE = [0, 6].includes(new Date(y, m, d).getDay());
        const isSummer = m >= 5 && m <= 8;
        for (const [s, r] of corridors) {
          const slots = [];
          for (let k = 0; k < 6; k++) {
            let p = 1;
            if (k >= 2 && k <= 4 && (isWE || isSummer)) p = Math.random() < 0.25 ? 3 : 2;
            if (isWE && isSummer && k === 3) p = Math.random() < 0.3 ? 4 : 3;
            slots.push(p);
          }
          data[`${dateStr}|${s}|${r}`] = slots;
        }
      }
    }
  }
  state.data = data;
  state.reasons = {}; // Demo-Daten haben keine Gründe.
  state.confidence = {}; // Demo-Daten haben keine Konfidenzwerte.
}

// ────────────────────────────────────────────────────────────
// Rendering
// ────────────────────────────────────────────────────────────

function render() {
  // Header-Route-Text
  const txt = ROUTE_TEXT[`${state.strecke}|${state.richtung}`];
  document.getElementById('hdrRoute').textContent = txt.title;
  document.getElementById('hdrSub').textContent = txt.sub;

  const mA = monthFromIndex(state.monthIndex);
  const mB = monthFromIndex(state.monthIndex + 1);
  const mC = monthFromIndex(state.monthIndex + 2);
  const mD = monthFromIndex(state.monthIndex + 3);

  document.getElementById('navLabelA').textContent = `${MONTHS[mA.m]} ${mA.y}`;
  document.getElementById('navLabelB').textContent = `${MONTHS[mB.m]} ${mB.y}`;

  renderDetail(document.getElementById('calA'), mA.y, mA.m);
  renderDetail(document.getElementById('calB'), mB.y, mB.m);

  Sidebar.render(mC, mD);
}

function monthFromIndex(idx) {
  if (idx < 0) return null;
  const total = BASE_YEAR * 12 + idx;
  const y = Math.floor(total / 12);
  const m = total % 12;
  if (y > 2029) return null;
  return { y, m };
}

function dateStr(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function lookup(ds) {
  return state.data[`${ds}|${state.strecke}|${state.richtung}`];
}

function renderDetail(container, year, month) {
  container.innerHTML = '';
  container.classList.remove('cal--empty');

  const hdr = document.createElement('div');
  hdr.className = 'cal__month';
  hdr.textContent = MONTHS[month];
  container.appendChild(hdr);

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  const thDay = document.createElement('th');
  thDay.className = 'col-day';
  trh.appendChild(thDay);
  SLOT_LABELS.forEach(lbl => {
    const th = document.createElement('th');
    th.className = 'col-slot';
    const sp = document.createElement('span');
    sp.textContent = lbl;
    th.appendChild(sp);
    trh.appendChild(th);
  });
  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const last = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= last; d++) {
    const ds = dateStr(year, month, d);
    const dow = new Date(year, month, d).getDay();
    const isWE = dow === 0 || dow === 6;
    const hol = HOLIDAYS[ds];
    const tr = document.createElement('tr');
    if (hol) tr.classList.add('is-holiday');
    else if (isWE) tr.classList.add('is-weekend');

    const tdDay = document.createElement('td');
    tdDay.className = 'cell-day';
    const numEl = document.createElement('span');
    numEl.className = 'cell-day__num';
    numEl.textContent = d;
    const dowEl = document.createElement('span');
    dowEl.className = 'cell-day__dow';
    dowEl.textContent = DOW_SHORT[dow];
    tdDay.appendChild(numEl);
    tdDay.appendChild(dowEl);
    tr.appendChild(tdDay);

    const slots = lookup(ds) || [0, 0, 0, 0, 0, 0];
    for (let k = 0; k < 6; k++) {
      const td = document.createElement('td');
      td.className = 'cell-slot cell-slot--clickable';
      const inner = document.createElement('div');
      inner.className = `cell-slot__inner cat-${slots[k] || 0}`;
      td.appendChild(inner);
      td.addEventListener('click', (ev) => {
        ev.stopPropagation();
        showReasonPopover(td, ds, k);
      });
      tr.appendChild(td);
    }
    let dSum = 0;
    let dCnt = 0;
    for (const c of slots) {
      if (c > 0) {
        dSum += c * c;
        dCnt += c;
      }
    }
    const overall = dCnt > 0 ? Math.round(dSum / dCnt) : 0;
    tr.addEventListener('mouseenter', () => Sidebar.updateMapColor(overall, ds));
    tr.addEventListener('mouseleave', () => Sidebar.updateMapColor(0, null));
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  container.appendChild(table);
}

// renderMini moved to sidebar.js

// ────────────────────────────────────────────────────────────
// Reason-Popover (Klick auf einen Zeitslot)
// ────────────────────────────────────────────────────────────

let popoverEl = null;

function getPopover() {
  if (popoverEl) return popoverEl;
  popoverEl = document.createElement('div');
  popoverEl.className = 'reason-popover';
  popoverEl.hidden = true;
  document.body.appendChild(popoverEl);
  // Klicks innerhalb des Popovers sollen es nicht schließen.
  popoverEl.addEventListener('click', (ev) => ev.stopPropagation());
  // Globale Schließ-Handler (einmalig).
  document.addEventListener('click', closeReasonPopover);
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') closeReasonPopover();
  });
  window.addEventListener('scroll', closeReasonPopover, true);
  window.addEventListener('resize', closeReasonPopover);
  return popoverEl;
}

function closeReasonPopover() {
  if (popoverEl) popoverEl.hidden = true;
}

function formatReasonDate(ds) {
  const [y, m, d] = ds.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return `${DOW_SHORT[dow]} ${d}. ${MONTHS[m - 1]} ${y}`;
}

function showReasonPopover(anchorEl, ds, k) {
  const pop = getPopover();
  const cat = (lookup(ds) || [])[k] || 0;
  const key = `${ds}|${state.strecke}|${state.richtung}`;
  const rs = (state.reasons[key] || [])[k] || [];
  const conf = (state.confidence[key] || [])[k];
  const kfzVal = (state.kfz && state.kfz[key]) ? state.kfz[key][k] : null;

  pop.innerHTML = '';

  const close = document.createElement('button');
  close.className = 'reason-popover__close';
  close.setAttribute('aria-label', (typeof I18n !== 'undefined') ? I18n.t('popover.close') : 'Schließen');
  close.textContent = '×';
  close.addEventListener('click', closeReasonPopover);
  pop.appendChild(close);

  const title = document.createElement('div');
  title.className = 'reason-popover__title';
  title.textContent = `${formatReasonDate(ds)} · ${SLOT_LABELS[k]}`;
  pop.appendChild(title);

  const sev = document.createElement('div');
  sev.className = 'reason-popover__severity';
  const sw = document.createElement('span');
  sw.className = `reason-popover__swatch cat-${cat}`;
  const sevLbl = document.createElement('span');
  sevLbl.textContent = CAT_LABELS[cat] || CAT_LABELS[0];
  sev.appendChild(sw);
  sev.appendChild(sevLbl);
  pop.appendChild(sev);

  if (conf != null && cat > 0) {
    const pct = Math.round(conf * 100);
    const confEl = document.createElement('div');
    confEl.className = 'reason-popover__confidence';
    const confLbl = document.createElement('span');
    confLbl.textContent = (typeof I18n !== 'undefined') ? I18n.t('popover.confidence') : 'Konfidenz';
    const bar = document.createElement('span');
    bar.className = 'reason-popover__confidence-bar';
    const fill = document.createElement('span');
    fill.className = 'reason-popover__confidence-fill';
    fill.style.width = `${pct}%`;
    bar.appendChild(fill);
    const val = document.createElement('span');
    val.className = 'reason-popover__confidence-value';
    val.textContent = `${pct}%`;
    confEl.appendChild(confLbl);
    confEl.appendChild(bar);
    confEl.appendChild(val);
    pop.appendChild(confEl);
  }

  if (kfzVal) {
    const kfzEl = document.createElement('div');
    kfzEl.className = 'reason-popover__confidence';
    kfzEl.innerHTML = '<span>' + ((typeof I18n !== 'undefined') ? I18n.t('popover.volume') : 'Volumen (Peak):') + '</span><span style="margin-left:auto; font-weight:bold;">~' + kfzVal + ' ' + ((typeof I18n !== 'undefined') ? I18n.t('popover.kfz_per_h') : 'Kfz/h') + '</span>';
    pop.appendChild(kfzEl);
  }

  const speedMap = {1: "> 100 km/h", 2: "80 - 100 km/h", 3: "60 - 80 km/h", 4: "40 - 60 km/h", 5: "< 40 km/h"};
  if (cat > 0) {
    const spdEl = document.createElement('div');
    spdEl.className = 'reason-popover__confidence';
    spdEl.innerHTML = '<span>' + ((typeof I18n !== 'undefined') ? I18n.t('popover.speed') : 'Ø Geschwindigkeit:') + '</span><span style="margin-left:auto; font-weight:bold;">' + speedMap[cat] + '</span>';
    pop.appendChild(spdEl);
  if (rs.length) {
    const ul = document.createElement('ul');
    ul.className = 'reason-popover__list';
    for (const r of rs) {
      const li = document.createElement('li');
      li.textContent = (typeof I18n !== "undefined" && I18n.tReason) ? I18n.tReason(r) : r;
      ul.appendChild(li);
    }
    pop.appendChild(ul);
  } else {
    const note = document.createElement('div');
    note.className = 'reason-popover__note';
    note.textContent = cat === 0
      ? ((typeof I18n !== 'undefined') ? I18n.t('popover.no_forecast') : 'Keine Prognose verfügbar.')
      : ((typeof I18n !== 'undefined') ? I18n.t('popover.no_reason') : 'Kein besonderer Grund – normaler Verkehr.');
    pop.appendChild(note);
  }
  }

  let tips = [];
  
  const _t = (k, fb) => (typeof I18n !== 'undefined') ? I18n.t(k) : fb;
  if (cat === 5 && conf >= 0.8) {
      tips.push({ text: _t('popover.measure_action', 'Dosierung / LKW-Verbot aktivieren'), title: _t('popover.measure_label', '🚧 Maßnahme empfohlen:'), color: "#721c24", bg: "#f8d7da" });
  } else if (cat === 4) {
      tips.push({ text: _t('tip.vba.text', 'Stauwarnung & Tempolimits vorbereiten'), title: _t('tip.vba.title', '⚠️ VBA-Schaltung:'), color: "#856404", bg: "#fff3cd" });
  } else if (cat <= 2) {
      const daySlots = lookup(ds) || [0, 0, 0, 0, 0, 0];
      let safeForWork = Math.max(...daySlots) <= 2;
      if (safeForWork) {
          tips.push({ text: _t('tip.maintenance.text', 'Ideal für Tagesbaustellen & Sperrungen'), title: _t('tip.maintenance.title', '✅ Wartungsfenster:'), color: "#155724", bg: "#d4edda" });
      }
  }

  const rsStr = rs.join(',');
  if (rsStr.includes('Oktoberfest') || rsStr.includes('Ferienbeginn')) {
      tips.push({ text: _t('tip.police.text', 'Polizei & Pannenhilfe aufstocken'), title: _t('tip.police.title', '🚓 Einsatzplanung:'), color: "#0c5460", bg: "#d1ecf1" });
  }
  if (key.includes('A8') && key.includes('München') && (rsStr.includes('Ferienende') || rsStr.includes('Rückreise'))) {
      tips.push({ text: _t('tip.border.text', 'Mit Bundespolizei abstimmen'), title: _t('tip.border.title', '🛂 Grenzkontrolle:'), color: "#721c24", bg: "#f8d7da" });
  }

  for (const t of tips) {
    const authEl = document.createElement('div');
    authEl.className = 'reason-popover__confidence premium-tip';
    authEl.style.color = t.color;
    authEl.style.backgroundColor = t.bg;
    authEl.style.padding = '4px 8px';
    authEl.style.borderRadius = '4px';
    authEl.style.marginTop = '8px';
    authEl.style.flexDirection = 'column';
    authEl.style.alignItems = 'flex-start';
    authEl.innerHTML = `<span style="font-size:10px;">${t.title}</span><span style="font-weight:bold; font-size:12px; margin-top: 2px;">${t.text}</span>`;
    pop.appendChild(authEl);
  }

  const moreBtn = document.createElement('button');
  moreBtn.className = 'reason-popover__more';
  moreBtn.type = 'button';
  moreBtn.textContent = (typeof I18n !== 'undefined') ? I18n.t('popover.more_info') : 'Mehr Infos →';
  moreBtn.addEventListener('click', () => {
    closeReasonPopover();
    showDayDetailView(ds);
  });
  pop.appendChild(moreBtn);


  const hourlyData = (state.hourly && state.hourly[key]) ? state.hourly[key][k] : null;
  if (hourlyData && hourlyData.length > 0) {
    const mapContainer = document.createElement('div');
    mapContainer.style.marginTop = '12px';
    
    const mapLbl = document.createElement('div');
    mapLbl.textContent = (typeof I18n !== 'undefined') ? I18n.t('dayview.map_label') : 'Verlauf (30-Minuten Takt):';
    mapLbl.style.fontSize = '11px';
    mapLbl.style.color = '#888';
    mapLbl.style.marginBottom = '4px';
    mapContainer.appendChild(mapLbl);

    const mapEl = document.createElement('div');
    mapEl.style.display = 'flex';
    mapEl.style.width = '100%';
    mapEl.style.gap = '1px';
    mapEl.style.overflow = 'hidden';

    // Sort to ensure chronological order
    hourlyData.sort((a, b) => a.slot.localeCompare(b.slot));
    
    const colors = {1: '#95c258', 2: '#c5cf3a', 3: '#efa82a', 4: '#e8624a', 5: '#b3271a'};

    for (const h of hourlyData) {
      const col = document.createElement('div');
      col.style.flex = '1';
      col.style.display = 'flex';
      col.style.flexDirection = 'column';
      col.style.alignItems = 'center';

      const bar = document.createElement('div');
      bar.style.width = '75%';
      bar.style.height = '36px';
      bar.style.borderRadius = '3px';
      bar.style.backgroundColor = colors[h.cat] || '#eee';
      bar.title = h.slot + ' (~' + h.val + ' Kfz/h)';
      
      const lbl = document.createElement('div');
      lbl.style.fontSize = '7.5px';
      lbl.style.color = '#777';
      lbl.style.marginTop = '2px';
      lbl.textContent = h.slot.split('-')[0]; // only show start time (e.g. 16:00)
      
      col.appendChild(bar);
      col.appendChild(lbl);
      mapEl.appendChild(col);
    }
    mapContainer.appendChild(mapEl);
    pop.appendChild(mapContainer);
  }

  // Positionieren: unterhalb der Zelle, im Viewport gehalten.
  pop.hidden = false;

    const A8_NODES = ['München', 'Holzkirchen', 'Siegsdorf', 'Teisendorf', 'Salzburg'];
  const A8_EDGES = [
    ['A8_MQB25', 'A8_MQQ37'],
    ['A8_MQQ209'],
    ['A8_MQQ213'],
    ['A8_MQQ245']
  ];
  
  const A93_NODES = ['Rosenheim', 'Inntal', 'Gletschergarten', 'Kiefersfelden'];
  const A93_EDGES = [
    ['A93_Inntal'],
    ['A93_Gletschergarten'],
    ['A93_Kiefersfelden']
  ];

  let activeEdges = [];
  let nodes = state.strecke === 'A8' ? A8_NODES : A93_NODES;
  let edges = state.strecke === 'A8' ? A8_EDGES : A93_EDGES;

  for (let i = 0; i < edges.length; i++) {
     let isActive = false;
     let maxCat = 0;
     for (const det of edges[i]) {
         const segKey = `${key}|${k}|${det}`;
         const cat = window.__segMax ? (window.__segMax[segKey] || 0) : 0;
         if (cat >= 3) { 
             isActive = true; 
             if(cat > maxCat) maxCat = cat; 
         }
     }
     activeEdges.push({ active: isActive, cat: maxCat });
  }

  let mergedStretches = [];
  let startIdx = -1;
  let currentMaxCat = 0;

  for (let i = 0; i <= activeEdges.length; i++) {
     if (i < activeEdges.length && activeEdges[i].active) {
         if (startIdx === -1) {
             startIdx = i;
             currentMaxCat = activeEdges[i].cat;
         } else {
             if (activeEdges[i].cat > currentMaxCat) currentMaxCat = activeEdges[i].cat;
         }
     } else {
         if (startIdx !== -1) {
             let endIdx = i;
             let strName = `${nodes[startIdx]} - ${nodes[endIdx]}`;
             if (state.richtung === 'Nord' || state.richtung === 'West') {
                 strName = `${nodes[endIdx]} - ${nodes[startIdx]}`;
             }
             mergedStretches.push({ name: strName, cat: currentMaxCat });
             startIdx = -1;
             currentMaxCat = 0;
         }
     }
  }

  if (mergedStretches.length > 0) {
      const segWrap = document.createElement('div');
      segWrap.className = 'stau-hotspot-container';
      
      const title = document.createElement('div');
      title.className = 'stau-hotspot-title';
      title.innerHTML = '<span style="font-size: 14px; margin-right: 6px;">📍</span> Stau-Hotspots auf der Strecke:';
      segWrap.appendChild(title);
      
      for (const stretch of mergedStretches) {
          const row = document.createElement('div');
          row.className = 'stau-hotspot-row';
          
          const dot = document.createElement('div');
          dot.className = `stau-hotspot-dot cat-${stretch.cat}`;
          dot.style.boxShadow = '0 0 0 2px rgba(255,255,255,0.8)';
          
          const name = document.createElement('span');
          name.className = 'stau-hotspot-text';
          name.textContent = stretch.name;
          
          row.appendChild(dot);
          row.appendChild(name);
          segWrap.appendChild(row);
      }
      pop.appendChild(segWrap);
  }

  const rect = anchorEl.getBoundingClientRect();

  const sx = window.pageXOffset;
  const sy = window.pageYOffset;
  const pw = pop.offsetWidth;
  const ph = pop.offsetHeight;
  const margin = 8;

  const anchorCenter = rect.left + rect.width / 2 + sx;
  let left = anchorCenter - pw / 2;
  left = Math.max(sx + margin, Math.min(left, sx + window.innerWidth - pw - margin));

  let top = rect.bottom + sy + 6;
  let above = false;
  if (rect.bottom + ph + 6 > window.innerHeight) {
    top = rect.top + sy - ph - 6;
    above = true;
  }

  pop.style.left = `${Math.round(left)}px`;
  pop.style.top = `${Math.round(top)}px`;
  pop.classList.toggle('reason-popover--above', above);

  // Pfeil horizontal auf die Zellenmitte ausrichten.
  const arrowLeft = Math.max(12, Math.min(anchorCenter - left, pw - 12));
  pop.style.setProperty('--arrow-left', `${Math.round(arrowLeft)}px`);
}

// Map logic moved to sidebar.js

// ────────────────────────────────────────────────────────────
// Tag-Detailansicht (Behörden-Modus) — ersetzt Monatsgrid
// ────────────────────────────────────────────────────────────

let dayViewEl = null;
function getDayView() {
  if (dayViewEl) return dayViewEl;
  dayViewEl = document.createElement('section');
  dayViewEl.className = 'day-view';
  dayViewEl.hidden = true;
  const grid = document.querySelector('.grid');
  grid.parentNode.insertBefore(dayViewEl, grid.nextSibling);
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') closeDayView();
  });
  return dayViewEl;
}
function closeDayView() {
  state.currentDayDs = null;
  state.dayAnchor = null;
  if (!dayViewEl) return;
  dayViewEl.hidden = true;
  const grid = document.querySelector('.grid');
  if (grid) grid.style.display = '';
  try { render(); } catch (_) {}
}

// Verschiebt die Day-View um ±n Monate, ohne den Tag-des-Monats über
// mehrere Sprünge zu verlieren (z. B. 31. Jan → 28. Feb → 31. Mär statt 28.).
function shiftDayViewByMonths(delta) {
  if (!state.currentDayDs) return;
  const [y, m, d] = state.currentDayDs.split('-').map(Number);
  if (state.dayAnchor == null) state.dayAnchor = d;
  const target = new Date(y, m - 1 + delta, 1);
  const ty = target.getFullYear();
  const tm = target.getMonth();
  // Grenzen einhalten (forecast endet 31.12.2029).
  if (ty < BASE_YEAR || ty > 2029) return;
  const lastDay = new Date(ty, tm + 1, 0).getDate();
  const day = Math.min(state.dayAnchor, lastDay);
  const newDs = `${ty}-${String(tm + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  // Kalender unter der Day-View mit dem Ziel-Monat in Sync halten.
  const newIdx = (ty - BASE_YEAR) * 12 + tm;
  state.monthIndex = Math.max(MIN_INDEX, Math.min(MAX_INDEX, newIdx));
  showDayDetailView(newDs);
}
function isDayViewOpen() {
  return !!(dayViewEl && !dayViewEl.hidden);
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function showDayDetailView(ds) {
  closeReasonPopover();
  state.currentDayDs = ds;
  if (state.dayAnchor == null) {
    state.dayAnchor = parseInt(ds.split('-')[2], 10);
  }
  const view = getDayView();
  const grid = document.querySelector('.grid');
  if (grid) grid.style.display = 'none';
  const slots = lookup(ds) || [0, 0, 0, 0, 0, 0];
  const key = `${ds}|${state.strecke}|${state.richtung}`;
  const reasonsArr = state.reasons[key] || [];
  const confArr = state.confidence[key] || [];
  const kfzArr = (state.kfz && state.kfz[key]) || [];
  const hourlyArr = (state.hourly && state.hourly[key]) || [];
  const hol = HOLIDAYS[ds];
  const worst = Math.max(...slots);
  const speedMap = { 1: '> 100 km/h', 2: '80–100 km/h', 3: '60–80 km/h', 4: '40–60 km/h', 5: '< 40 km/h' };
  const txt = ROUTE_TEXT[`${state.strecke}|${state.richtung}`] || { title: '', sub: '' };

  const shiftDate = (delta) => {
    const [y, m, d] = ds.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + delta);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  };

  view.innerHTML = `
    <div class="day-view__head">
      <button class="day-view__back" type="button">${(typeof I18n !== 'undefined') ? I18n.t('dayview.back') : '← Zurück zur Übersicht'}</button>
      <div class="day-view__head-text">
        <div class="day-view__date">${formatReasonDate(ds)}${hol ? ' · <span class="day-view__hol">' + escapeHtml(hol) + '</span>' : ''}</div>
        <div class="day-view__sub">${escapeHtml(txt.title)} — ${escapeHtml(txt.sub)}</div>
      </div>
      <div class="day-view__worst">
        <span class="day-view__swatch cat-${worst}"></span>
        <div>
          <div class="day-view__worst-label">${(typeof I18n !== 'undefined') ? I18n.t('dayview.day_max') : 'Tages-Maximum'}</div>
          <div class="day-view__worst-cat">${CAT_LABELS[worst]}</div>
        </div>
      </div>
    </div>
    <div class="day-view__daynav">
      <button class="day-view__navbtn" type="button" data-dir="-1">${(typeof I18n !== 'undefined') ? I18n.t('dayview.prev_day') : '‹ Vorheriger Tag'}</button>
      <button class="day-view__navbtn" type="button" data-dir="1">${(typeof I18n !== 'undefined') ? I18n.t('dayview.next_day') : 'Nächster Tag ›'}</button>
    </div>
    <div class="day-view__slots"></div>
    <div class="day-view__hourly"></div>
  `;
  view.querySelector('.day-view__back').addEventListener('click', closeDayView);
  view.querySelectorAll('.day-view__navbtn').forEach(btn => {
    btn.addEventListener('click', () => {
      const newDs = shiftDate(parseInt(btn.dataset.dir, 10));
      // Day-Arrow = expliziter Tagwechsel → Anker auf neuen Tag setzen.
      state.dayAnchor = parseInt(newDs.split('-')[2], 10);
      showDayDetailView(newDs);
    });
  });

  const slotsCt = view.querySelector('.day-view__slots');
  for (let k = 0; k < 6; k++) {
    const cat = slots[k] || 0;
    const reasons = reasonsArr[k] || [];
    const conf = confArr[k];
    const kfz = kfzArr[k];
    const card = document.createElement('div');
    card.className = 'day-view__slot';
    card.innerHTML = `
      <div class="day-view__slot-bar cat-${cat}"></div>
      <div class="day-view__slot-head">
        <div class="day-view__slot-time">${SLOT_LABELS[k]}</div>
        <div class="day-view__slot-cat">${CAT_LABELS[cat]}</div>
      </div>
      <div class="day-view__slot-stats">
        ${cat > 0 ? `<div><span>${(typeof I18n !== 'undefined') ? I18n.t('popover.speed').replace(/:$/, '') : 'Ø Geschwindigkeit'}</span><b>${speedMap[cat]}</b></div>` : ''}
        ${kfz ? `<div><span>${(typeof I18n !== 'undefined') ? I18n.t('popover.volume').replace(/:$/, '') : 'Volumen (Peak)'}</span><b>~${kfz} ${(typeof I18n !== 'undefined') ? I18n.t('popover.kfz_per_h') : 'Kfz/h'}</b></div>` : ''}
        ${conf != null ? `<div><span>${(typeof I18n !== 'undefined') ? I18n.t('popover.confidence') : 'Konfidenz'}</span><b>${Math.round(conf * 100)} %</b></div>` : ''}
      </div>
      <div class="day-view__slot-reasons-label">${(typeof I18n !== 'undefined') ? I18n.t('dayview.factors') : 'Einflussfaktoren'}</div>
      <ul class="day-view__slot-reasons">
        ${reasons.length ? reasons.map(r => `<li>${escapeHtml((typeof I18n !== "undefined" && I18n.tReason) ? I18n.tReason(r) : r)}</li>`).join('') : '<li class="day-view__slot-note">' + (cat === 0 ? ((typeof I18n !== 'undefined') ? I18n.t('popover.no_forecast').replace(/\.$/, '') : 'Keine Prognose') : ((typeof I18n !== 'undefined') ? I18n.t('popover.no_reason').split(/[–—.]/)[0].trim() : 'Kein besonderer Grund')) + '</li>'}
      </ul>
    `;
    slotsCt.appendChild(card);
  }

  const allHours = [];
  for (let k = 0; k < 6; k++) {
    const h = hourlyArr[k];
    if (h) allHours.push(...h);
  }
  if (allHours.length) {
    allHours.sort((a, b) => a.slot.localeCompare(b.slot));
    const colors = { 1: '#95c258', 2: '#cfdb1f', 3: '#efa82a', 4: '#e8624a', 5: '#b3271a' };
    const hCt = view.querySelector('.day-view__hourly');
    hCt.innerHTML = '<div class="day-view__hourly-label">' + ((typeof I18n !== "undefined") ? I18n.t("dayview.hourly_label") : "30-Minuten-Verlauf (gesamter Tag)") + '</div><div class="day-view__hourly-bars"></div><div class="day-view__hourly-ticks"></div>';
    const bars = hCt.querySelector('.day-view__hourly-bars');
    const ticks = hCt.querySelector('.day-view__hourly-ticks');
    const maxVal = Math.max(...allHours.map(h => h.val || 0)) || 1;
    const positiveVals = allHours.filter(h => h.val > 0).map(h => h.val);
    const minVal = positiveVals.length ? Math.min(...positiveVals) : 0;
    const kfzRange = maxVal - minVal;
    // Fallback: wenn kfz_expected im Tagesverlauf konstant ist (z. B. A8),
    // skaliere die Balkenhöhe stattdessen nach Verkehrskategorie (1–5).
    const useCatScale = kfzRange < Math.max(1, maxVal * 0.05);
    const range = Math.max(1, kfzRange);
    for (const h of allHours) {
      const v = h.val || 0;
      let height;
      if (useCatScale) {
        const c = Math.max(0, Math.min(5, h.cat || 0));
        height = c > 0 ? Math.round(15 + ((c - 1) / 4) * 80) : 4;
      } else {
        const norm = v > 0 ? (v - minVal) / range : 0;
        height = v > 0 ? Math.round(10 + norm * 85) : 4;
      }
      const bar = document.createElement('div');
      bar.className = 'day-view__hourly-bar';
      bar.style.background = colors[h.cat] || '#eee';
      bar.style.height = `${height}%`;
      bar.title = `${h.slot} · ~${h.val} Kfz/h`;
      bars.appendChild(bar);

      const tick = document.createElement('div');
      tick.className = 'day-view__hourly-tick';
      tick.textContent = h.slot.split('-')[0];
      ticks.appendChild(tick);
    }
  }

  const wasVisible = !view.hidden;
  view.hidden = false;
  // Nach ganz oben scrollen, damit Header + Monatspfeile (navPrev/navNext)
  // sichtbar bleiben — sonst kann der User die Monatsnavigation nicht erreichen.
  if (!wasVisible) window.scrollTo({ top: 0, behavior: 'smooth' });
  updateNavLabelsForDayView(ds);
}

function updateNavLabelsForDayView(ds) {
  const labelA = document.getElementById('navLabelA');
  const labelB = document.getElementById('navLabelB');
  const [y, m, d] = ds.split('-').map(Number);
  const anchor = (state.dayAnchor != null) ? state.dayAnchor : d;
  // Vorheriger / nächster Monat, jeweils mit dem Anker-Tag (geclampt
  // auf die Monatslänge), damit der User sieht, wohin ‹ und › springen.
  const fmt = (date) => {
    const dd = date.getDate();
    const mm = MONTHS[date.getMonth()];
    return `${dd}. ${mm} ${date.getFullYear()}`;
  };
  const prev = new Date(y, m - 2, 1);
  const prevLast = new Date(prev.getFullYear(), prev.getMonth() + 1, 0).getDate();
  prev.setDate(Math.min(anchor, prevLast));
  const next = new Date(y, m, 1);
  const nextLast = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(anchor, nextLast));
  if (labelA) labelA.textContent = (prev.getFullYear() >= BASE_YEAR) ? fmt(prev) : '—';
  if (labelB) labelB.textContent = (next.getFullYear() <= 2029) ? fmt(next) : '—';
}

function shiftDsByMonths(ds, delta) {
  const [y, m, d] = ds.split('-').map(Number);
  const dt = new Date(y, m - 1 + delta, 1);
  // Klemmen auf gültigen Tag im Zielmonat.
  const lastDay = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  dt.setDate(Math.min(d, lastDay));
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function dsToMonthIndex(ds) {
  const [y, m] = ds.split('-').map(Number);
  return (y - BASE_YEAR) * 12 + (m - 1);
}


// ── i18n: re-localize dynamic content on language change ───────
if (typeof I18n !== 'undefined') {
  I18n.onChange(function () {
    MONTHS = I18n.get('months').slice();
    DOW_SHORT = I18n.get('dow_short').slice();
    SLOT_LABELS = I18n.get('slot_labels').slice();
    CAT_LABELS = Object.assign({}, I18n.get('cat_labels'));
    try { setStandDate(); } catch (_) {}
    try { render(); } catch (_) {}
    try { if (typeof isDayViewOpen === 'function' && isDayViewOpen() && state.currentDayDs) showDayDetailView(state.currentDayDs); } catch (_) {}
  });
}
