/**
 * Inline-SVG Autobahn-Karte (A93 / A8) im Stil der offiziellen
 * Autobahn-Fahrkalender-Karte: hell, schlicht, ohne externe Tiles.
 *
 * Koordinaten werden aus echten lat/lon-Werten via eines festen
 * Bounding-Box-Projektors in den SVG-Viewport (400×280) gerechnet —
 * damit liegen Routen, Städte und die DE/AT-Grenze geografisch korrekt
 * zueinander.
 *
 * Verwendung:
 *   const map = createMapComponent(document.getElementById('mapBox'));
 *   map.setActiveRoute('A93', 'Sued');     // Default
 *   map.setActiveRoute('A8', 'Ost');
 *   map.setColor('#e8732a');               // z. B. nach Kategorie
 */

(function (global) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';

  // ────────────────────────────────────────────────────────────
  // Bounding-Box → SVG-Projektion
  // ────────────────────────────────────────────────────────────

  const BOUNDS = { latS: 47.50, latN: 48.25, lonW: 11.50, lonE: 13.10 };
  const VIEW_W = 400;
  const VIEW_H = 280;

  function proj(lat, lon) {
    const x = (lon - BOUNDS.lonW) / (BOUNDS.lonE - BOUNDS.lonW) * VIEW_W;
    const y = (BOUNDS.latN - lat) / (BOUNDS.latN - BOUNDS.latS) * VIEW_H;
    return [x, y];
  }

  // ────────────────────────────────────────────────────────────
  // Geo-Daten (lat, lon)
  // ────────────────────────────────────────────────────────────

  // A93 Rosenheim → Kufstein
  const A93_LL = [
    [47.856, 12.121], // Rosenheim Zentrum
    [47.820, 12.133], // Rosenheim Süd
    [47.790, 12.143], // Rohrdorf
    [47.760, 12.155], // Brannenburg
    [47.730, 12.162], // Flintsbach
    [47.700, 12.168], // Oberaudorf
    [47.677, 12.172], // Kiefersfelden
    [47.583, 12.167], // Kufstein (Österreich)
  ];

  // A8 München Ost → Salzburg
  const A8_LL = [
    [48.137, 11.660], // München Ost
    [48.070, 11.820], // Vaterstetten
    [48.010, 11.980], // Hofolding
    [47.975, 12.100], // Rosenheim Kreuz
    [47.900, 12.380], // Bernau am Chiemsee
    [47.860, 12.560], // Traunstein
    [47.820, 12.780], // Bad Reichenhall
    [47.800, 13.000], // Salzburg Grenze
  ];

  // DE/AT-Grenze grob (West → Ost) im Kartenausschnitt,
  // mit dem typischen Südwärts-Knick bei Kufstein.
  const BORDER_LL = [
    [47.55, 11.50],
    [47.55, 11.85],
    [47.58, 12.15], // Kufstein-Knick (südlichster Punkt)
    [47.62, 12.50],
    [47.70, 12.90],
    [47.80, 13.10],
  ];

  // Städte / Labels.
  const CITIES = {
    'München':   { lat: 48.137, lon: 11.575, anchor: 'start',  dx: 12, dy: 4 },
    'Rosenheim': { lat: 47.856, lon: 12.121, anchor: 'end',    dx: -8, dy: 4 },
    'Kufstein':  { lat: 47.583, lon: 12.167, anchor: 'start',  dx: 8,  dy: 4 },
    'Salzburg':  { lat: 47.800, lon: 13.045, anchor: 'end',    dx: -6, dy: -8 },
  };

  const REGIONS = {
    'Deutschland': { lat: 48.05, lon: 12.45 },
    'Österreich':  { lat: 47.52, lon: 12.65 },
  };

  const ROUTES = { A93: A93_LL, A8: A8_LL };

  const COLOR_INACTIVE = '#cfd4da';
  const COLOR_DEFAULT_ACTIVE = '#f0a02a';

  // ────────────────────────────────────────────────────────────
  // Style-Injection (idempotent)
  // ────────────────────────────────────────────────────────────

  const STYLE_ID = 'autobahn-map-style';
  const STYLE = `
.autobahn-map {
  width: 100%;
  height: 200px;
  background: #eef2f6;
  border: 1px solid #d8dde3;
  border-radius: 6px;
  overflow: hidden;
  position: relative;
  display: block;
}
.autobahn-map svg {
  display: block;
  width: 100%;
  height: 100%;
}
.autobahn-map__bg { fill: #f5f7fa; }
.autobahn-map__austria { fill: #e3e8ee; }
.autobahn-map__border {
  fill: none;
  stroke: #b8c0c9;
  stroke-width: 1;
  stroke-dasharray: 3 3;
}
.autobahn-map__route {
  fill: none;
  stroke: #cfd4da;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.55;
  transition: stroke 0.15s ease, stroke-width 0.15s ease, opacity 0.15s ease;
}
.autobahn-map__route.is-active {
  stroke-width: 6;
  opacity: 1;
}
.autobahn-map__endpoint {
  stroke: #ffffff;
  stroke-width: 2;
  transition: fill 0.15s ease;
}
.autobahn-map__city-dot {
  fill: #4a5560;
}
.autobahn-map__label {
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 11px;
  fill: #3a4250;
  font-weight: 600;
  pointer-events: none;
  user-select: none;
}
.autobahn-map__label--region {
  fill: #8a95a3;
  font-style: italic;
  font-weight: 500;
  font-size: 12px;
  letter-spacing: 0.5px;
}
.autobahn-map__label--route {
  font-size: 10px;
  font-weight: 700;
  fill: #ffffff;
  paint-order: stroke;
  stroke: rgba(0,0,0,0.35);
  stroke-width: 0.8px;
}
`;

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  // ────────────────────────────────────────────────────────────
  // SVG-Helpers
  // ────────────────────────────────────────────────────────────

  function el(name, attrs) {
    const e = document.createElementNS(NS, name);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function pathFromLL(pts) {
    return pts.map((p, i) => {
      const [x, y] = proj(p[0], p[1]);
      return (i === 0 ? 'M' : 'L') + ' ' + x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
  }

  function austriaPath() {
    // Border-Linie als obere Kante, dann zu den unteren Ecken.
    const border = BORDER_LL.map((p, i) => {
      const [x, y] = proj(p[0], p[1]);
      return (i === 0 ? 'M' : 'L') + ' ' + x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    return border + ` L ${VIEW_W},${VIEW_H} L 0,${VIEW_H} Z`;
  }

  // ────────────────────────────────────────────────────────────
  // Komponente
  // ────────────────────────────────────────────────────────────

  function createMapComponent(container) {
    injectStyle();
    container.classList.add('autobahn-map');
    container.innerHTML = '';

    const svg = el('svg', {
      viewBox: `0 0 ${VIEW_W} ${VIEW_H}`,
      preserveAspectRatio: 'xMidYMid meet'
    });

    // Hintergrund + Österreich-Fläche.
    svg.appendChild(el('rect', { class: 'autobahn-map__bg', x: 0, y: 0, width: VIEW_W, height: VIEW_H }));
    svg.appendChild(el('path', { class: 'autobahn-map__austria', d: austriaPath() }));

    // Grenzlinie als gestrichelte Linie (auf der oberen Kante der Fläche).
    svg.appendChild(el('path', {
      class: 'autobahn-map__border',
      d: BORDER_LL.map((p, i) => {
        const [x, y] = proj(p[0], p[1]);
        return (i === 0 ? 'M' : 'L') + ' ' + x.toFixed(1) + ',' + y.toFixed(1);
      }).join(' ')
    }));

    // Regions-Labels (Deutschland / Österreich).
    for (const [name, def] of Object.entries(REGIONS)) {
      const [x, y] = proj(def.lat, def.lon);
      const t = el('text', {
        class: 'autobahn-map__label autobahn-map__label--region',
        x: x.toFixed(1), y: y.toFixed(1),
        'text-anchor': 'middle'
      });
      t.textContent = name;
      svg.appendChild(t);
    }

    // Routen.
    const routeEls = {};
    for (const [name, pts] of Object.entries(ROUTES)) {
      const p = el('path', {
        class: 'autobahn-map__route',
        'data-route': name,
        d: pathFromLL(pts)
      });
      svg.appendChild(p);
      routeEls[name] = p;
    }

    // Städte (Punkt + Label).
    for (const [name, def] of Object.entries(CITIES)) {
      const [x, y] = proj(def.lat, def.lon);
      svg.appendChild(el('circle', {
        class: 'autobahn-map__city-dot',
        cx: x.toFixed(1), cy: y.toFixed(1), r: 2.2
      }));
      const t = el('text', {
        class: 'autobahn-map__label',
        x: (x + def.dx).toFixed(1),
        y: (y + def.dy).toFixed(1),
        'text-anchor': def.anchor
      });
      t.textContent = name;
      svg.appendChild(t);
    }

    // Route-Badge (kleines Label auf der aktiven Route).
    const routeBadge = el('text', { class: 'autobahn-map__label--route', 'text-anchor': 'middle' });
    svg.appendChild(routeBadge);

    // Endpunkt-Marker (Kreis am Start oder Ende, je nach Richtung).
    const endpoint = el('circle', { class: 'autobahn-map__endpoint', r: 6, cx: 0, cy: 0 });
    svg.appendChild(endpoint);

    container.appendChild(svg);

    // ────────────────────────────────────────────────────────────
    // API
    // ────────────────────────────────────────────────────────────

    const state = { route: 'A93', richtung: 'Sued', color: COLOR_DEFAULT_ACTIVE };

    function applyActive() {
      for (const [name, p] of Object.entries(routeEls)) {
        if (name === state.route) {
          p.classList.add('is-active');
          p.setAttribute('stroke', state.color);
        } else {
          p.classList.remove('is-active');
          p.setAttribute('stroke', COLOR_INACTIVE);
        }
      }
      const pts = ROUTES[state.route];
      const reverse = state.richtung === 'Nord' || state.richtung === 'West';
      const ep = reverse ? pts[0] : pts[pts.length - 1];
      const [ex, ey] = proj(ep[0], ep[1]);
      endpoint.setAttribute('cx', ex.toFixed(1));
      endpoint.setAttribute('cy', ey.toFixed(1));
      endpoint.setAttribute('fill', state.color);

      // Badge ungefähr in der Mitte der aktiven Route.
      const mid = pts[Math.floor(pts.length / 2)];
      const [mx, my] = proj(mid[0], mid[1]);
      routeBadge.setAttribute('x', (mx + 12).toFixed(1));
      routeBadge.setAttribute('y', (my + 3).toFixed(1));
      routeBadge.textContent = state.route;
    }

    function setActiveRoute(route, richtung) {
      if (route && ROUTES[route]) state.route = route;
      if (richtung) state.richtung = richtung;
      applyActive();
    }

    function setColor(color) {
      state.color = color || COLOR_DEFAULT_ACTIVE;
      applyActive();
    }

    applyActive();

    return { setActiveRoute, setColor, el: container };
  }

  global.createMapComponent = createMapComponent;
})(typeof window !== 'undefined' ? window : this);
