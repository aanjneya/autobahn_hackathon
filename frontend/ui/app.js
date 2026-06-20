/**
 * app.js – Die Hauptlogik für den Autobahn Fahrkalender
 */

// Global close function for the onclick handler in HTML
window.closeDetailPanel = function () {
  const panel = document.getElementById('detailPanel');
  if (panel) panel.classList.add('hidden');
  document.querySelectorAll('.day-cell.selected').forEach(cell => cell.classList.remove('selected'));
};

document.addEventListener('DOMContentLoaded', () => {
  // --- Constants ---
  const CORRIDORS_DEF = {
    A93: {
      strecken: ['A93_Inntal', 'A93_Kiefersfelden', 'A93_Gletschergarten'],
      richtungen: ['Kufstein', 'Rosenheim']
    },
    A8: {
      strecken: ['A8_MQB25', 'A8_MQQ209', 'A8_MQQ213', 'A8_MQQ245', 'A8_MQQ37'],
      richtungen: ['München', 'Salzburg']
    }
  };

  const DIRECTION_LABELS = {
    A93: { Kufstein: 'Richtung Kufstein (Süd)', Rosenheim: 'Richtung Rosenheim (Nord)' },
    A8: { München: 'Richtung München (West)', Salzburg: 'Richtung Salzburg (Ost)' }
  };

  function isFerien(d) {
    const month = d.getMonth() + 1;
    const day = d.getDate();
    if (month === 8) return true;
    if (month === 12 && day > 23) return true;
    return false;
  }

  function isOktoberfest(d) {
    const month = d.getMonth() + 1;
    const day = d.getDate();
    if (month === 9 && day > 18) return true;
    if (month === 10 && day < 5) return true;
    return false;
  }

  function isDosierung(d) {
    const dow = d.getDay(); // 0=Sun, 1=Mon
    const month = d.getMonth() + 1;
    return dow === 1 && [2, 3, 7, 9].includes(month);
  }

  // --- State ---
  const state = {
    corridor: 'A93',
    site: CORRIDORS_DEF.A93.strecken[0],
    direction: 'Kufstein',
    year: 2026,
    forecasts: [],
    filteredData: [],
    corridorsDef: CORRIDORS_DEF,
    directionLabels: DIRECTION_LABELS
  };

  // Strip the 'A93_'/'A8_' prefix for a short display label, e.g. 'A93_Inntal' -> 'Inntal'.
  function siteLabel(strecke) {
    return strecke.replace(/^A\d+_/, '');
  }

  // --- DOM Elements ---
  const elements = {
    corridorSelect: document.getElementById('corridorSelect'),
    siteSelect: document.getElementById('siteSelect'),
    directionSelect: document.getElementById('directionSelect'),
    yearTabs: document.getElementById('yearTabs'),
    calendarGrid: document.getElementById('calendarGrid'),
    detailPanel: document.getElementById('detailPanel'),
    detailClose: document.getElementById('detailClose'),
    detailDate: document.getElementById('detailDate'),
    detailBadges: document.getElementById('detailBadges'),
    slotBars: document.getElementById('slotBars'),
    statTotalDays: document.getElementById('statTotalDays'),
    statFreeDays: document.getElementById('statFreeDays'),
    statStauDays: document.getElementById('statStauDays'),
    statCriticalDays: document.getElementById('statCriticalDays'),
    criticalSection: document.getElementById('criticalSection'),
    criticalList: document.getElementById('criticalList'),
    demoBanner: document.getElementById('demoBanner')
  };

  // --- Initialize ---
  function init() {
    // 1. Load Data
    loadData();

    // 2. Setup Event Listeners
    setupEventListeners();
  }

  async function loadData() {
    try {
      const response = await fetch('forecast.csv');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const csvText = await response.text();

      const lines = csvText.trim().split('\n');
      const headers = lines[0].split(',');
      const rows = [];

      const idxDatum = headers.indexOf('datum');
      const idxStrecke = headers.indexOf('strecke');
      const idxRichtung = headers.indexOf('richtung');
      const idxSlot = headers.indexOf('time_slot');
      const idxCat = headers.indexOf('pred_category');

      const idxProb1 = headers.indexOf('prob_1');
      const idxProb2 = headers.indexOf('prob_2');
      const idxProb3 = headers.indexOf('prob_3');
      const idxProb4 = headers.indexOf('prob_4');
      const idxProb5 = headers.indexOf('prob_5');

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length < 5) continue;

        const datumStr = cols[idxDatum];
        const [y, m, d] = datumStr.split('-');
        const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        const dow = dateObj.getDay();

        rows.push({
          datum: datumStr,
          strecke: cols[idxStrecke],
          richtung: cols[idxRichtung],
          time_slot: cols[idxSlot],
          pred_category: parseInt(cols[idxCat]),
          prob_1: parseFloat(cols[idxProb1]),
          prob_2: parseFloat(cols[idxProb2]),
          prob_3: parseFloat(cols[idxProb3]),
          prob_4: parseFloat(cols[idxProb4]),
          prob_5: parseFloat(cols[idxProb5]),
          // Metadata for UI
          _isWeekend: dow === 0 || dow === 6,
          _isFeiertag: false, // simplified
          _isFerien: isFerien(dateObj),
          _isOktoberfest: isOktoberfest(dateObj),
          _isDosierung: isDosierung(dateObj)
        });
      }

      state.forecasts = rows;

      updateDirectionSelect();
      updateSiteSelect();
      applyFilters();
    } catch (err) {
      console.error("Failed to load forecast.csv:", err);
      alert("Fehler beim Laden der Daten (forecast.csv). Siehe Konsole.");
    }
  }

  function setupEventListeners() {
    elements.corridorSelect.addEventListener('change', (e) => {
      state.corridor = e.target.value;
      updateDirectionSelect();
      updateSiteSelect();
      applyFilters();
    });

    elements.directionSelect.addEventListener('change', (e) => {
      state.direction = e.target.value;
      updateSiteSelect();
      applyFilters();
    });

    elements.siteSelect.addEventListener('change', (e) => {
      state.site = e.target.value;
      applyFilters();
    });

    elements.yearTabs.addEventListener('click', (e) => {
      if (e.target.classList.contains('year-tab')) {
        // Update active tab
        Array.from(elements.yearTabs.children).forEach(tab => tab.classList.remove('active'));
        e.target.classList.add('active');

        state.year = parseInt(e.target.dataset.year);
        applyFilters();
      }
    });
  }

  // --- Filtering ---
  function updateDirectionSelect() {
    const corridorDef = state.corridorsDef[state.corridor];
    const labels = state.directionLabels[state.corridor];

    // Welche Richtungen existieren für den gewählten Korridor überhaupt?
    const availableForCorridor = state.forecasts.length
      ? corridorDef.richtungen.filter(r =>
          state.forecasts.some(row =>
            corridorDef.strecken.includes(row.strecke) && row.richtung === r))
      : corridorDef.richtungen;
    const richtungen = availableForCorridor.length ? availableForCorridor : corridorDef.richtungen;

    const currentSelection = elements.directionSelect.value;
    elements.directionSelect.innerHTML = '';
    richtungen.forEach((richtung, index) => {
      const option = document.createElement('option');
      option.value = richtung;
      option.textContent = labels[richtung];
      elements.directionSelect.appendChild(option);

      if (richtung === currentSelection) {
        option.selected = true;
        state.direction = richtung;
      } else if (index === 0 && !richtungen.includes(currentSelection)) {
        option.selected = true;
        state.direction = richtung;
      }
    });
  }

  function updateSiteSelect() {
    const corridorDef = state.corridorsDef[state.corridor];

    // Messstellen, die für (Korridor, Richtung) tatsächlich Daten haben.
    const availableForPair = state.forecasts.length
      ? corridorDef.strecken.filter(s =>
          state.forecasts.some(row => row.strecke === s && row.richtung === state.direction))
      : corridorDef.strecken;
    const strecken = availableForPair.length ? availableForPair : corridorDef.strecken;

    const currentSelection = elements.siteSelect.value;
    elements.siteSelect.innerHTML = '';
    strecken.forEach((strecke, index) => {
      const option = document.createElement('option');
      option.value = strecke;
      option.textContent = siteLabel(strecke);
      elements.siteSelect.appendChild(option);

      if (strecke === currentSelection) {
        option.selected = true;
        state.site = strecke;
      } else if (index === 0 && !strecken.includes(currentSelection)) {
        option.selected = true;
        state.site = strecke;
      }
    });
  }

  function applyFilters() {
    // Filter the huge forecast array down to what we need right now
    state.filteredData = state.forecasts.filter(row => {
      const targetStrecke = state.site;
      const rowYear = parseInt(row.datum.split('-')[0]);

      return row.strecke === targetStrecke &&
        row.richtung === state.direction &&
        rowYear === state.year;
    });

    // Group by date
    const dataByDate = {};
    state.filteredData.forEach(row => {
      if (!dataByDate[row.datum]) {
        dataByDate[row.datum] = {
          slots: [],
          maxCategory: 1,
          sumCategory: 0,
          _isFerien: row._isFerien,
          _isFeiertag: row._isFeiertag,
          _isOktoberfest: row._isOktoberfest,
          _isDosierung: row._isDosierung,
          _isWeekend: row._isWeekend
        };
      }
      dataByDate[row.datum].slots.push(row);
      dataByDate[row.datum].maxCategory = Math.max(dataByDate[row.datum].maxCategory, row.pred_category);
      dataByDate[row.datum].sumCategory += row.pred_category;
    });

    renderCalendar(dataByDate);
    updateStats(dataByDate);
    renderCriticalDays(dataByDate);
    elements.detailPanel.classList.add('hidden'); // Hide detail panel on filter change
  }

  // --- Rendering ---
  function renderCalendar(dataByDate) {
    elements.calendarGrid.innerHTML = '';

    const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    const weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

    for (let month = 0; month < 12; month++) {
      const monthCard = document.createElement('div');
      monthCard.className = 'month-card';

      // Header
      const header = document.createElement('div');
      header.className = 'month-card__header';
      header.textContent = months[month];
      monthCard.appendChild(header);

      // Weekdays
      const weekdaysGrid = document.createElement('div');
      weekdaysGrid.className = 'month-card__weekdays';
      weekdays.forEach(wd => {
        const wdEl = document.createElement('div');
        wdEl.className = 'month-card__weekday';
        wdEl.textContent = wd;
        weekdaysGrid.appendChild(wdEl);
      });
      monthCard.appendChild(weekdaysGrid);

      // Days
      const daysGrid = document.createElement('div');
      daysGrid.className = 'month-card__days';

      const firstDay = new Date(state.year, month, 1);
      const lastDay = new Date(state.year, month + 1, 0);

      // Pad empty days at start of month (adjust for Monday start)
      let startDow = firstDay.getDay() - 1;
      if (startDow === -1) startDow = 6; // Sunday is 0 -> 6

      for (let i = 0; i < startDow; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'day-cell day-cell--empty';
        daysGrid.appendChild(emptyDay);
      }

      // Actual days
      for (let d = 1; d <= lastDay.getDate(); d++) {
        const currentDate = new Date(state.year, month, d);
        // Format as YYYY-MM-DD local time ignoring timezone offset issues
        const dateStr = `${state.year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayData = dataByDate[dateStr];

        const dayCell = document.createElement('div');

        // Determine category for the day (we use maxCategory for worst-case coloring)
        const cat = dayData ? dayData.maxCategory : 0;

        let className = `day-cell day-cell--cat-${cat}`;
        if (dayData && dayData._isWeekend) className += ' is-weekend';
        dayCell.className = className;
        dayCell.textContent = d;
        dayCell.dataset.date = dateStr;

        if (dayData) {
          // Badges
          if (dayData._isFerien || dayData._isFeiertag || dayData._isDosierung || dayData._isOktoberfest) {
            const badge = document.createElement('div');
            badge.className = 'day-cell__badge';
            dayCell.appendChild(badge);
          }

          // Click handler
          dayCell.addEventListener('click', () => {
            document.querySelectorAll('.day-cell.selected').forEach(c => c.classList.remove('selected'));
            dayCell.classList.add('selected');
            showDetailPanel(dateStr, dayData);
          });
        }

        daysGrid.appendChild(dayCell);
      }

      monthCard.appendChild(daysGrid);
      elements.calendarGrid.appendChild(monthCard);
    }
  }

  function showDetailPanel(dateStr, dayData) {
    // Date formatting
    const dateObj = new Date(dateStr);
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    elements.detailDate.textContent = dateObj.toLocaleDateString('de-DE', options);

    // Badges
    elements.detailBadges.innerHTML = '';
    const createBadge = (text, type) => `<span class="badge badge--${type}">${text}</span>`;
    let badgesHTML = '';
    if (dayData._isFerien) badgesHTML += createBadge('Schulferien', 'ferien');
    if (dayData._isFeiertag) badgesHTML += createBadge('Feiertag', 'feiertag');
    if (dayData._isDosierung) badgesHTML += createBadge('Blockabfertigung', 'dosierung');
    if (dayData._isOktoberfest) badgesHTML += createBadge('Oktoberfest', 'oktoberfest');
    if (dayData._isWeekend) badgesHTML += createBadge('Wochenende', 'weekend');
    elements.detailBadges.innerHTML = badgesHTML;

    // Slots
    elements.slotBars.className = 'slot-columns';
    elements.slotBars.innerHTML = '';
    // Sort slots chronologically
    const sortedSlots = [...dayData.slots].sort((a, b) => a.time_slot.localeCompare(b.time_slot));

    sortedSlots.forEach(slot => {
      const cat = slot.pred_category;
      const probKey = `prob_${cat}`;
      const confidence = (slot[probKey] * 100).toFixed(0);

      // Visual height (min 15% so it's visible, max 100%)
      const height = 15 + ((cat - 1) / 4) * 85;

      const slotHTML = `
        <div class="slot-col">
          <div class="slot-col__track">
            <div class="slot-col__fill slot-bar__fill--${cat}" style="height: ${height}%;"></div>
          </div>
          <div class="slot-col__category slot-bar__category--${cat}">${cat}</div>
          <div class="slot-col__label">${slot.time_slot.replace('-', '-\n')}</div>
          <div class="slot-col__confidence">${confidence}%</div>
        </div>
      `;
      elements.slotBars.insertAdjacentHTML('beforeend', slotHTML);
    });

    elements.detailPanel.classList.remove('hidden');

    // Scroll to panel
    elements.detailPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function updateStats(dataByDate) {
    let total = 0, free = 0, stau = 0, critical = 0;

    Object.values(dataByDate).forEach(day => {
      total++;
      if (day.maxCategory === 1) free++;
      if (day.maxCategory >= 4) stau++;
      if (day.maxCategory === 5) critical++;
    });

    elements.statTotalDays.textContent = total;
    elements.statFreeDays.textContent = free;
    elements.statStauDays.textContent = stau;
    elements.statCriticalDays.textContent = critical;
  }

  function renderCriticalDays(dataByDate) {
    elements.criticalList.innerHTML = '';

    // Find days with maxCategory >= 4, sort by sumCategory (severity)
    const criticalDays = Object.entries(dataByDate)
      .filter(([date, data]) => data.maxCategory >= 4)
      .map(([date, data]) => ({ date, data }))
      .sort((a, b) => b.data.sumCategory - a.data.sumCategory)
      .slice(0, 15); // Top 15

    if (criticalDays.length === 0) {
      elements.criticalSection.style.display = 'none';
      return;
    }

    elements.criticalSection.style.display = 'block';

    criticalDays.forEach(item => {
      const dateObj = new Date(item.date);
      const formatOpts = { weekday: 'short', day: '2-digit', month: '2-digit' };
      const shortDate = dateObj.toLocaleDateString('de-DE', formatOpts);
      const cat = item.data.maxCategory;

      const chip = document.createElement('div');
      chip.className = `critical-chip critical-chip--${cat}`;
      chip.innerHTML = `<span>⚠️</span> ${shortDate}`;

      chip.addEventListener('click', () => {
        // Find and click the corresponding day cell
        const cell = document.querySelector(`.day-cell[data-date="${item.date}"]`);
        if (cell) cell.click();
      });

      elements.criticalList.appendChild(chip);
    });
  }

  // Boot
  init();
});
