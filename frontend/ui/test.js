const DEMO_FORECAST = require('./demo-data.js');
console.log(DEMO_FORECAST.rows.length);

const state = {
  corridor: 'A93',
  direction: 'Kufstein',
  year: 2026,
  forecasts: DEMO_FORECAST.rows,
  corridorsDef: DEMO_FORECAST.corridors,
  directionLabels: DEMO_FORECAST.directionLabels
};

function applyFilters(corridor, direction) {
  state.corridor = corridor;
  state.direction = direction;
  const filteredData = state.forecasts.filter(row => {
    const targetStrecke = state.corridorsDef[state.corridor].strecken[0];
    const rowYear = parseInt(row.datum.split('-')[0]);
    return row.strecke === targetStrecke && row.richtung === state.direction && rowYear === state.year;
  });

  const dataByDate = {};
  filteredData.forEach(row => {
    if (!dataByDate[row.datum]) {
      dataByDate[row.datum] = { maxCategory: 1, sumCategory: 0 };
    }
    dataByDate[row.datum].maxCategory = Math.max(dataByDate[row.datum].maxCategory, row.pred_category);
    dataByDate[row.datum].sumCategory += row.pred_category;
  });
  
  let stau = 0;
  Object.values(dataByDate).forEach(d => { if (d.maxCategory >= 4) stau++; });
  console.log(`Corridor: ${corridor}, Direction: ${direction}, Stau days: ${stau}`);
}

applyFilters('A93', 'Kufstein');
applyFilters('A8', 'München');
