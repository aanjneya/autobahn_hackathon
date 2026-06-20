// sidebar.js
// Handles the Map and the Mini-Calendar rendering.
// This file relies on global variables declared in app*.js:
// state, lookup, dateStr, MONTHS, DOW_SHORT, HOLIDAYS

const Sidebar = {
  renderMini: function(year, month) {
    const wrap = document.createElement('div');
    wrap.className = 'mini';

    const hdr = document.createElement('div');
    hdr.className = 'mini__month';
    hdr.textContent = `${MONTHS[month]} ${year}`;
    wrap.appendChild(hdr);

    const list = document.createElement('div');
    list.className = 'mini__list';

    const last = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= 31; d++) {
      const row = document.createElement('div');
      row.className = 'mini__row';
      if (d > last) {
        row.classList.add('mini__row--empty');
        list.appendChild(row);
        continue;
      }

      const ds = dateStr(year, month, d);
      const dow = new Date(year, month, d).getDay();
      const isWE = dow === 0 || dow === 6;
      const hol = HOLIDAYS[ds];
      if (hol) row.classList.add('is-holiday');
      else if (isWE) row.classList.add('is-weekend');

      const dayEl = document.createElement('span');
      dayEl.className = 'mini__day';
      dayEl.innerHTML = `<b>${d}</b><i>${DOW_SHORT[dow]}</i>`;
      row.appendChild(dayEl);

      const slots = lookup(ds) || [0, 0, 0, 0, 0, 0];
      const worst = Math.max(...slots);
      const box = document.createElement('span');
      box.className = `mini__box cat-${worst || 0}`;
      row.appendChild(box);

      list.appendChild(row);
    }
    wrap.appendChild(list);
    return wrap;
  },

  render: function(mC, mD) {
    // Ensure the structure exists
    let miniWrap = document.getElementById('calMini');
    if (miniWrap) {
      if (!document.getElementById('mapBox')) {
        const mapBox = document.createElement('div');
        mapBox.id = 'mapBox';
        mapBox.className = 'mapbox';
        miniWrap.appendChild(mapBox);
      }
      if (!document.getElementById('miniList')) {
        const miniList = document.createElement('div');
        miniList.id = 'miniList';
        miniList.className = 'mini-list-wrap';
        miniWrap.appendChild(miniList);
      }
    }

    const mini = document.getElementById('miniList') || document.getElementById('calMini');
    if (mini) {
      mini.innerHTML = '';
      if (mC) mini.appendChild(this.renderMini(mC.y, mC.m));
      if (mD) mini.appendChild(this.renderMini(mD.y, mD.m));
    }
    this.updateMapRoutes();
  },

  MAP_BOUNDS: [[47.50, 11.50], [48.25, 13.10]],
  MAP_CAT_COLOR: {
    0: '#f4a12a',
    1: '#6db33f',
    2: '#f0c040',
    3: '#e8732a',
    4: '#c0392b',
    5: '#8b1a0e'
  },
  ROUTES_GEO: {
    A93: [
      [47.856, 12.121],
      [47.820, 12.133],
      [47.790, 12.143],
      [47.760, 12.155],
      [47.730, 12.162],
      [47.700, 12.168],
      [47.677, 12.172],
      [47.583, 12.167]
    ],
    A8: [
      [48.137, 11.660],
      [48.070, 11.820],
      [48.010, 11.980],
      [47.975, 12.100],
      [47.900, 12.380],
      [47.860, 12.560],
      [47.820, 12.780],
      [47.800, 13.000]
    ]
  },
  mapState: {
    map: null,
    lines: {},
    arrow: null
  },

  initMap: function() {
    if (this.mapState.map || typeof L === 'undefined') return;
    const el = document.getElementById('mapBox');
    if (!el) return;

    const map = L.map(el, {
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
      attributionControl: false,
      zoomSnap: 0.1
    });
    map.fitBounds(this.MAP_BOUNDS);
    map.setMaxBounds(this.MAP_BOUNDS);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    L.marker([48.155, 11.580], {
      icon: L.divIcon({
        className: 'map-label map-label--city',
        html: '<span>München</span>',
        iconSize: [80, 16],
        iconAnchor: [-4, 8]
      }),
      interactive: false,
      keyboard: false
    }).addTo(map);

    L.marker([47.550, 12.500], {
      icon: L.divIcon({
        className: 'map-label map-label--region',
        html: '<span>Österreich</span>',
        iconSize: [90, 16],
        iconAnchor: [45, 8]
      }),
      interactive: false,
      keyboard: false
    }).addTo(map);

    for (const [name, coords] of Object.entries(this.ROUTES_GEO)) {
      const line = L.polyline(coords, {
        color: '#bbbbbb',
        weight: 3,
        opacity: 0.5,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
      this.mapState.lines[name] = line;
    }

    this.mapState.map = map;
    setTimeout(() => map.invalidateSize(), 50);
  },

  updateMapRoutes: function() {
    this.initMap();
    if (!this.mapState.map) return;
    const active = state.strecke;

    for (const [name, line] of Object.entries(this.mapState.lines)) {
      if (name === active) {
        line.setStyle({ color: this.MAP_CAT_COLOR[0], weight: 6, opacity: 1.0 });
      } else {
        line.setStyle({ color: '#bbbbbb', weight: 3, opacity: 0.5 });
      }
    }
    this.updateMapColor(0, null);
  },

  updateMapColor: function(cat, _ds) {
    if (!this.mapState.map) return;
    const active = state.strecke;
    const line = this.mapState.lines[active];
    if (!line) return;
    const color = this.MAP_CAT_COLOR[cat] || this.MAP_CAT_COLOR[0];
    line.setStyle({ color });

    const coords = this.ROUTES_GEO[active];
    const reverse = (state.richtung === 'Nord' || state.richtung === 'West');
    const endpoint = reverse ? coords[0] : coords[coords.length - 1];
    if (this.mapState.arrow) this.mapState.arrow.remove();
    this.mapState.arrow = L.circleMarker(endpoint, {
      radius: 6,
      fillColor: color,
      color: '#ffffff',
      weight: 2,
      fillOpacity: 1,
      interactive: false
    }).addTo(this.mapState.map);
  }
};
