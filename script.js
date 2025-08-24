// Karte initialisieren
const map = L.map("map", {
  zoomControl: true, // +/- Steuerung (per CSS auf Mobile ausgeblendet)
  worldCopyJump: true
});

// Custom pane for lightweight dots (rendered below markers, above tiles)
map.createPane('dots-pane');
map.getPane('dots-pane').style.zIndex = 450; // overlayPane is 400, markerPane is 600
map.getPane('dots-pane').style.pointerEvents = 'auto';

// Theme: load from storage and toggle
(function initTheme() {
  try {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') {
      if (saved === 'light') document.body.setAttribute('data-theme','light');
      else document.body.removeAttribute('data-theme');
    }
  } catch {}
})();

// OpenStreetMap Tiles mit deutscher Beschriftung und Attribution
const osm = L.tileLayer("https://{s}.tile.openstreetmap.de/tiles/osmde/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    'Karte: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap-Mitwirkende</a> | Kartendarstellung: <a href="https://www.osm.org/">OSM DE</a>'
});
osm.addTo(map);

// Japan-Grenzbereich (grobe Bounding Box) und Start auf Japan
const japanBounds = L.latLngBounds(
  [24.396308, 122.934570], // Südwest
  [45.551483, 153.986672]  // Nordost
);
map.fitBounds(japanBounds, { padding: [20, 20] });
// Erlaube wieder freies Zoomen/Schwenken (keine MaxBounds, kleines minZoom)
map.setMinZoom(2);

// Deep-Linking: Hash lesen (z, lat, lng) und setzen; Hash bei Bewegungen aktualisieren
(function initDeepLinking() {
  try {
    const raw = location.hash ? location.hash.substring(1) : '';
    const params = new URLSearchParams(raw);
    const z = params.get('z');
    const lat = params.get('lat');
    const lng = params.get('lng');
    if (z && lat && lng && !Number.isNaN(+z) && !Number.isNaN(+lat) && !Number.isNaN(+lng)) {
      map.setView([+lat, +lng], +z);
    }
  } catch {}

  const writeHash = () => {
    const c = map.getCenter();
    const z = map.getZoom();
    const params = new URLSearchParams({ z: String(z), lat: c.lat.toFixed(5), lng: c.lng.toFixed(5) });
    const newHash = `#${params.toString()}`;
    if (location.hash !== newHash) history.replaceState(null, '', newHash);
  };
  map.on('moveend', writeHash);
})();

// Header-Buttons: Auf Japan zoomen & Teilen & Theme & Zoom sichtbare Kategorien
window.addEventListener('DOMContentLoaded', () => {
  // Entfernt: btn-reset (Japan) & btn-zoom-visible (Sichtbare)
  const btnShare = document.getElementById('btn-share');
  if (btnShare) {
    btnShare.addEventListener('click', async () => {
      const shareUrl = location.href;
      try {
        if (navigator.share) {
          await navigator.share({ title: document.title, text: 'Japan Emoji-Karte', url: shareUrl });
        } else if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(shareUrl);
          alert('Link kopiert');
        } else {
          const ta = document.createElement('textarea');
          ta.value = shareUrl; document.body.appendChild(ta); ta.select();
          document.execCommand('copy'); document.body.removeChild(ta);
          alert('Link kopiert');
        }
      } catch (e) {
        console.warn('Share fehlgeschlagen', e);
      }
    });
  }

  const btnTheme = document.getElementById('btn-theme');
  if (btnTheme) {
    const apply = (mode) => {
      if (mode === 'light') document.body.setAttribute('data-theme','light');
      else document.body.removeAttribute('data-theme');
    };
    btnTheme.addEventListener('click', () => {
      const light = document.body.getAttribute('data-theme') === 'light';
      const next = light ? 'dark' : 'light';
      apply(next);
      try { localStorage.setItem('theme', next); } catch {}
    });
  }

  // Wire up hamburger button to open the mobile legend/filter drawer
  const btnFilter = document.getElementById('btn-filter');
  if (btnFilter) {
    btnFilter.addEventListener('click', () => {
      if (!isMobile()) return;
      if (!mobileOverlayEl) initMobileUI();
      if (mobileOverlayEl) mobileOverlayEl.open();
    });
  }
});

// Geocoder (nur Japan)
if (L.Control.geocoder) {
  L.Control.geocoder({
    defaultMarkGeocode: false,
    placeholder: "Suche in Japan…",
    geocoder: L.Control.Geocoder.nominatim({
      geocodingQueryParams: {
        countrycodes: "jp",
        // Nominatim viewbox: minLon,minLat,maxLon,maxLat
        viewbox: "122.93457,24.396308,153.986672,45.551483",
        bounded: 1, // harte Begrenzung auf die Viewbox
        addressdetails: 1,
        limit: 8
      }
    })
  })
    .on("markgeocode", (e) => {
      const bbox = e.geocode.bbox;
      if (bbox && bbox.isValid && bbox.isValid()) {
        map.fitBounds(bbox, { padding: [20, 20], maxZoom: 14 });
      } else if (e.geocode && e.geocode.center) {
        map.setView(e.geocode.center, 12);
      }
    })
    .addTo(map);
}

// ---- Emoji- und Kategorie-Logik ----
function emojiIcon(emoji, label, isTop = false) {
  const safeLabel = (label || "").replace(/"/g, "&quot;");
  return L.divIcon({
    className: "",
    html: `<div class="emoji-marker${isTop ? ' emoji-marker--top' : ''}" aria-label="${safeLabel}" title="${safeLabel}">${emoji}</div>`,
    iconSize: null,
    iconAnchor: [0, 16]
  });
}

const EMOJI_KEYWORDS = [
  { k: ['berg','vulkan','fuji','mt '], e: '🗻' },
  { k: ['schrein','jingu','shrine','toshogu','hachimangu','inari'], e: '⛩️' },
  { k: ['tempel','dera','ji '], e: '🛕' },
  { k: ['burg','schloss','jo '], e: '🏯' },
  { k: ['turm','tower','skytree'], e: '🗼' },
  { k: ['kreuzung','crossing'], e: '🚦' },
  { k: ['gedenk','memorial','friedens'], e: '🕊️' },
  { k: ['viertel','district','streetfood','dotonbori','chinatown'], e: '🍜' },
  { k: ['elektronik','akihabara','anime','popkultur'], e: '🎮' },
  { k: ['kirsch','sakura','blüte','blossom','hanami','hirosaki'], e: '🌸' },
  { k: ['nationalpark','shirakami','shiretoko','daisetsuzan'], e: '🏞️' },
  { k: ['schlucht','gorge','oirase','takachiho'], e: '🏞️' },
  { k: ['wasserfall','falls','kegon','nachi'], e: '💧' },
  { k: ['see ',' lake','-see','chuzenji','tazawa'], e: '🏞️' },
  { k: ['bucht','bai','bay','matsushima','kabira'], e: '🌊' },
  { k: ['küste','kueste','strand','beach','insel','island','jima','jima)','jima '], e: '🏝️' },
  { k: ['brücke','bruecke','bridge','kintaikyo'], e: '🌉' },
  { k: ['garten','garden','kenrokuen','korakuen','adachi'], e: '🏛️' },
  { k: ['museum','teamlab','ghibli'], e: '🏛️' },
  { k: ['onsen','thermal','beppu','jigokudani (onsen)'], e: '♨️' },
  { k: ['affen','schneeaffen','monkey'], e: '🐒' },
  { k: ['aquarium','churaumi'], e: '🐠' },
  { k: ['bambus','bamboo','arashiyama'], e: '🎋' },
  { k: ['pilger','koyasan','kumano','88','henro'], e: '🥾' },
  { k: ['festival','matsuri','feuerwerk','nebuta','tanabata','gion'], e: '🎆' },
  { k: ['freizeitpark','disney','usj','fuji-q','legoland','huis ten bosch','ghibli park'], e: '🎢' },
  { k: ['altstadt','old town','bikan','takayama','kawagoe','kakunodate'], e: '🏘️' }
];

const CATEGORY_LABELS = {
  '🗻': 'Berg/Vulkan',
  '⛩️': 'Schrein',
  '🛕': 'Tempel',
  '🏯': 'Burg/Schloss',
  '🗼': 'Turm',
  '🚦': 'Kreuzung/Wahrzeichen',
  '🕊️': 'Gedenkstätte',
  '🍜': 'Food-Viertel/Markt',
  '🎮': 'Elektronik/Popkultur',
  '🌸': 'Kirschen/Blüte',
  '🏞️': 'Nationalpark/Schlucht',
  '💧': 'Wasserfall',
  '♨️': 'Onsen',
  '🌉': 'Brücke',
  '🏝️': 'Insel/Strand',
  '🐈': 'Katzeninsel',
  '🐠': 'Aquarium',
  '🏛️': 'Museum/Garten',
  '🎢': 'Freizeitpark',
  '🎆': 'Festival',
  '🥾': 'Pilgerweg/Wanderung',
  '🏘️': 'Altstadt/Tradition',
  '📍': 'Allgemein',
  '❄️': 'Schneefestival',
  '🚤': 'Kanal/Boot',
  '🌻': 'Blumenfelder',
  '🛶': 'Boot/Kanu',
  '🐧': 'Zoo/Pinguine',
  '🌳': 'Park/Natur',
  '🍣': 'Sushi/Markt',
  '🌆': 'Skyline/Aussicht',
  '🌃': 'Nachtviertel',
  '🦌': 'Park/Hirsche',
  '🌋': 'Vulkan',
  '🏜️': 'Sanddünen',
  '🏖️': 'Strand'
};
const CATEGORY_ORDER = ['🗻','⛩️','🛕','🏯','🗼','🚦','🕊️','🍜','🎮','🌸','🏞️','💧','♨️','🌉','🏝️','🐈','🐠','🏛️','🎢','🎆','🥾','🏘️','📍'];

// Kuratierte Top-10 mit festgelegter Reihenfolge (höchste Priorität)
const CURATED_TOP10 = [
  'Fuji-san (Mount Fuji)',
  'Fushimi Inari-taisha',
  'Itsukushima-Schrein (Miyajima)',
  'Himeji-jo (Burg Himeji)',
  'Kinkaku-ji (Goldener Pavillon)',
  'Kiyomizu-dera',
  'Nara-Park & Todai-ji',
  'Nikko Toshogu',
  'Friedensdenkmal Hiroshima',
  'Shibuya Crossing'
];
// Assign unique scores for Top-10, strictly descending
const CURATED_SCORES = new Map(CURATED_TOP10.map((name, i) => [name, 100 - i * 3]));
const topAttractions = new Set(CURATED_TOP10);

function getEmojiForAttraction(a) {
  if (a.emoji && String(a.emoji).trim()) return a.emoji;
  const name = (a.name || '').toLowerCase();
  const type = (a.type || '').toLowerCase();
  const hay = `${type} ${name}`;
  for (const { k, e } of EMOJI_KEYWORDS) {
    if (k.some((kw) => hay.includes(kw))) return e;
  }
  return '📍';
}

// ---- Links in Popups: Mapping + Helpers ----
const attractionLinks = (window.attractionLinks || {});
function isValidHttpUrl(url) { try { const u = new URL(url); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; } }
function escHtml(str) { return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function getAttractionUrl(a) { if (a.url && isValidHttpUrl(a.url)) return a.url; const byName = attractionLinks[a.name]; if (byName && isValidHttpUrl(byName)) return byName; return null; }
function buildPopupContent(a) {
  const name = escHtml(a.name);
  const type = escHtml(a.type);
  const city = escHtml(a.city);
  const desc = escHtml(a.desc);
  const url = getAttractionUrl(a);
  const nameHtml = url ? `<a href="${escHtml(url)}" target="_blank" rel="noopener noreferrer">${name}</a>` : name;
  return `
      <h3>${nameHtml}</h3>
      <p>${type} · ${city}</p>
      ${desc ? `<p>${desc}</p>` : ''}
    `;
}

// ---- Importance-basierte LOD-Logik (anstelle von Zahlen-Clustering) ----
function computeImportance(a) {
  let s = 10;
  // Curated Top-10 erhalten vordefinierte, absteigende Scores (100, 97, 94, ...)
  const curated = CURATED_SCORES.get(a.name);
  if (typeof curated === 'number') s = curated;
  const t = (a.type || '').toLowerCase();
  const boost = (v) => { s = Math.max(s, v); };
  if (t.includes('unesco')) boost(90);
  else if (t.includes('vulkan') || t.includes('berg')) boost(75);
  else if (t.includes('burg') || t.includes('schloss')) boost(70);
  else if (t.includes('tempel') || t.includes('schrein') || t.includes('pagode')) boost(65);
  else if (t.includes('nationalpark') || t.includes('natur') || t.includes('see') || t.includes('schlucht')) boost(60);
  else if (t.includes('garten') || t.includes('park')) boost(55);
  else if (t.includes('viertel') || t.includes('altstadt')) boost(50);
  else if (t.includes('museum') || t.includes('aquarium')) boost(45);
  else if (t.includes('onsen')) boost(40);
  const n = (a.name || '').toLowerCase();
  if (n.includes('fuji')) s = Math.max(s, 99);
  if (n.includes('skytree') || n.includes('tokyo tower')) s = Math.max(s, 85);
  if (n.includes('miyajima') || n.includes('itsukushima')) s = Math.max(s, 92);
  if (n.includes('himeji')) s = Math.max(s, 89);
  if (n.includes('daibutsu') || n.includes('buddha')) s = Math.max(s, 80);
  const ov = (window.attractionImportance && window.attractionImportance[a.name]);
  if (typeof ov === 'number') s = ov;
  return Math.max(0, Math.min(100, s));
}

function getTopNByScore(list, n) {
  return [...list]
    .sort((a, b) => b._score - a._score)
    .slice(0, n);
}

// ===== Added: LOD helpers and data initialization =====
let attractionsAug = [];
let presentEmojis = new Set();
let emojiVisibility = new Map();
let lodLayer = null;
let showTop10 = true; // NEW: treat Top-10 like a normal filter (visible by default)

function initAttractionsMeta(list) {
  // Build augmented list with guaranteed emoji and importance score
  attractionsAug = list.map((a) => {
    const emoji = getEmojiForAttraction(a);
    const base = { ...a, emoji };
    const _score = computeImportance(base);
    return { ...base, _score };
  });
  // Collect present emojis
  presentEmojis = new Set(attractionsAug.map((a) => a.emoji));
  // Initialize visibility (all visible by default); try restore from storage
  emojiVisibility = new Map();
  try {
    const raw = localStorage.getItem('emojiVisibility');
    if (raw) {
      const obj = JSON.parse(raw);
      for (const e of presentEmojis) {
        if (Object.prototype.hasOwnProperty.call(obj, e)) {
          emojiVisibility.set(e, !!obj[e]);
        }
      }
    }
  } catch {}
  // NEW: restore Top-10 visibility
  try {
    const t10 = localStorage.getItem('showTop10');
    showTop10 = (t10 === null) ? true : (t10 === '1' || t10 === 'true');
  } catch { showTop10 = true; }
}

function persistEmojiVisibility() {
  try {
    const obj = {};
    for (const e of presentEmojis) obj[e] = (emojiVisibility.get(e) !== false);
    localStorage.setItem('emojiVisibility', JSON.stringify(obj));
  } catch {}
}

function cellSizeForZoom(z) {
  // Return 0 when we want full marker mode; otherwise an arbitrary positive value
  if (z >= 10) return 0; // markers appear one zoom earlier (>=10)
  // Coarser cells at low zoom (not used directly for picking here, only to switch modes)
  if (z <= 3) return 256;
  if (z <= 5) return 192;
  if (z <= 7) return 128;
  return 96;
}

function zoomScoreThreshold(z) {
  // Higher threshold at low zoom; decreases as you zoom in
  if (z <= 3) return 88;
  if (z <= 4) return 82;
  if (z <= 5) return 76;
  if (z <= 6) return 70;
  if (z <= 7) return 64;
  if (z <= 8) return 58;
  if (z <= 9) return 50;
  return 0; // full marker mode
}
// ===== End added helpers =====

class LODGridLayer {
  constructor(map, data) {
    this.map = map;
    this.data = data;
    this.layer = L.layerGroup();
    // Lightweight dots for non-selected POIs (Canvas renderer bound to dots pane)
    this.canvas = L.canvas({ padding: 0.5, pane: 'dots-pane' });
    this.dotsLayer = L.layerGroup();
    this.pool = new Map(); // name -> emoji marker
    this.dotsPool = new Map(); // name -> circleMarker (dot)
    this._onUpdate = this.update.bind(this);
    map.on('moveend zoomend resize', this._onUpdate);
  }
  addTo() { this.layer.addTo(this.map); this.dotsLayer.addTo(this.map); this.canvas.addTo(this.map); this.update(); return this; }
  remove() { this.map.off('moveend zoomend resize', this._onUpdate); this.layer.remove(); this.dotsLayer.remove(); if (this.canvas) this.map.removeLayer(this.canvas); }
  ensureMarker(a) {
    const highlight = topAttractions.has(a.name) && showTop10; // highlight only when enabled
    if (this.pool.has(a.name)) {
      const m = this.pool.get(a.name);
      // Always refresh icon to reflect current highlight state
      m.setIcon(emojiIcon(a.emoji, a.name, highlight));
      return m;
    }
    const m = L.marker([a.lat, a.lng], { icon: emojiIcon(a.emoji, a.name, highlight) });
    m.bindPopup(buildPopupContent(a), { closeButton: true });
    // Zoom to marker when clicked
    m.on('click', () => {
      const current = this.map.getZoom();
      const target = Math.max(12, current + 2);
      this.map.flyTo(m.getLatLng(), target, { duration: 0.5 });
    });
    this.pool.set(a.name, m);
    return m;
  }
  ensureDot(a) {
    let mk = this.dotsPool.get(a.name);
    if (!mk) {
      mk = L.circleMarker([a.lat, a.lng], {
        renderer: this.canvas,
        pane: 'dots-pane',
        radius: 6,
        stroke: true,
        weight: 1,
        color: '#1f2937',
        fill: true,
        fillColor: '#0ea5e9',
        fillOpacity: 0.9,
        interactive: true,
        bubblingMouseEvents: true
      });
      // Click to zoom towards this point
      mk.on('click', () => {
        const current = this.map.getZoom();
        const target = Math.max(10, current + 2);
        this.map.flyTo(mk.getLatLng(), target, { duration: 0.5 });
      });
      this.dotsPool.set(a.name, mk);
    } else {
      mk.setLatLng([a.lat, a.lng]);
    }
    if (!this.dotsLayer.hasLayer(mk)) this.dotsLayer.addLayer(mk);
    return mk;
  }
  update() {
    const z = this.map.getZoom();
    const minScore = zoomScoreThreshold(z);
    const cell = cellSizeForZoom(z);
    const size = this.map.getSize();
    const pad = 80;
    const emojiOn = (e) => (emojiVisibility.get(e) !== false);
    const baseMinZoom = (typeof this.map.getMinZoom === 'function') ? (this.map.getMinZoom() ?? 2) : 2;
    const passesFilters = (a) => emojiOn(a.emoji) || (showTop10 && topAttractions.has(a.name)); // Top-10 override when toggle is ON

    // Outer two zoom levels: only Top-1 by score among filtered
    if (z <= baseMinZoom + 1) {
      const top1 = getTopNByScore(this.data.filter(passesFilters), 1)[0];
      const keepMarkers = new Set();
      if (top1) {
        const mk = this.ensureMarker(top1);
        if (!this.layer.hasLayer(mk)) this.layer.addLayer(mk);
        keepMarkers.add(top1.name);
      }
      for (const [name, mk] of this.pool) {
        if (!keepMarkers.has(name) && this.layer.hasLayer(mk)) this.layer.removeLayer(mk);
      }
      for (const [, dot] of this.dotsPool) {
        if (this.dotsLayer.hasLayer(dot)) this.dotsLayer.removeLayer(dot);
      }
      return;
    }

    // Third outermost: only Top-3 by score as markers, rest as dots (all filtered)
    if (z === baseMinZoom + 2) {
      const bounds = this.map.getPixelBounds();
      const min = bounds.min.subtract([pad, pad]);
      const max = bounds.max.add([pad, pad]);
      const filtered = this.data.filter(passesFilters);
      const top3 = getTopNByScore(filtered, 3).map(a => a.name);
      const keepMarkers = new Set();
      const keepDots = new Set();
      for (const a of filtered) {
        const pt = this.map.project([a.lat, a.lng], z);
        if (pt.x < min.x || pt.y < min.y || pt.x > max.x || pt.y > max.y) continue;
        if (top3.includes(a.name)) {
          const mk = this.ensureMarker(a);
          if (!this.layer.hasLayer(mk)) this.layer.addLayer(mk);
          keepMarkers.add(a.name);
        } else {
          const dot = this.ensureDot(a);
          keepDots.add(a.name);
        }
      }
      for (const [name, mk] of this.pool) {
        if (!keepMarkers.has(name) && this.layer.hasLayer(mk)) this.layer.removeLayer(mk);
      }
      for (const [name, dot] of this.dotsPool) {
        if (!keepDots.has(name) && this.dotsLayer.hasLayer(dot)) this.dotsLayer.removeLayer(dot);
      }
      return;
    }

    // High zoom: render all markers directly, clear dots (filtered)
    if (cell === 0) {
      const visible = new Set();
      for (const a of this.data) {
        if (!passesFilters(a)) continue;
        const p = this.map.latLngToContainerPoint([a.lat, a.lng]);
        if (p.x < -pad || p.y < -pad || p.x > size.x + pad || p.y > size.y + pad) continue;
        const mk = this.ensureMarker(a);
        if (!this.layer.hasLayer(mk)) this.layer.addLayer(mk);
        visible.add(a.name);
      }
      for (const [name, mk] of this.pool) {
        if (!visible.has(name) && this.layer.hasLayer(mk)) this.layer.removeLayer(mk);
      }
      for (const [, dot] of this.dotsPool) { if (this.dotsLayer.hasLayer(dot)) this.dotsLayer.removeLayer(dot); }
      return;
    }

    // Low/medium zoom: Top-10 by score always as markers; rest score-based
    const bounds = this.map.getPixelBounds();
    const min = bounds.min.subtract([pad, pad]);
    const max = bounds.max.add([pad, pad]);
    const keepMarkers = new Set();
    const keepDots = new Set();

    const filteredAll = this.data.filter(passesFilters);
    const top10ByScore = getTopNByScore(filteredAll, 10).map(a => a.name);

    for (const a of this.data) {
      if (!passesFilters(a)) continue;
      const pt = this.map.project([a.lat, a.lng], z);
      if (pt.x < min.x || pt.y < min.y || pt.x > max.x || pt.y > max.y) continue;
      if (top10ByScore.includes(a.name)) {
        const mk = this.ensureMarker(a);
        if (!this.layer.hasLayer(mk)) this.layer.addLayer(mk);
        keepMarkers.add(a.name);
        continue;
      }
      if (a._score >= minScore) {
        const mk = this.ensureMarker(a);
        if (!this.layer.hasLayer(mk)) this.layer.addLayer(mk);
        keepMarkers.add(a.name);
      } else {
        const dot = this.ensureDot(a);
        keepDots.add(a.name);
      }
    }
    for (const [name, mk] of this.pool) {
      if (!keepMarkers.has(name) && this.layer.hasLayer(mk)) this.layer.removeLayer(mk);
    }
    for (const [name, dot] of this.dotsPool) {
      if (!keepDots.has(name) && this.dotsLayer.hasLayer(dot)) this.dotsLayer.removeLayer(dot);
    }
  }
}

// Maßstabsleiste (metrisch, deutsch-typisch)
L.control.scale({ metric: true, imperial: false }).addTo(map);

// Legende (Desktop) – oben rechts; mobil verwenden wir ein Left-Drawer-Overlay
function buildLegendOnAdd() {
  return function () {
    const div = L.DomUtil.create('div', 'legend-control leaflet-bar');

    const ordered = CATEGORY_ORDER.filter((e) => presentEmojis.has(e));
    const extras = Array.from(presentEmojis).filter((e) => !CATEGORY_ORDER.includes(e)).sort();
    const emojiList = [...ordered, ...extras];

    const listItemsHtml = emojiList.map((e, idx) => {
      const label = CATEGORY_LABELS[e] || 'Sonstiges';
      const inputId = `legend-emoji-${idx}`;
      const checkedAttr = (emojiVisibility.get(e) !== false) ? 'checked' : '';
      return `
        <li>
          <label for="${inputId}">
            <input id="${inputId}" type="checkbox" data-emoji="${e}" ${checkedAttr}>
            <span class="emoji">${e}</span>${label}
          </label>
        </li>`;
    }).join('');

    const allOn = emojiList.every(e => emojiVisibility.get(e) !== false);

    div.innerHTML = `
      <div class="legend-header" role="button" aria-expanded="true" tabindex="0">Legende</div>
      <div class="legend-all">
        <label for="legend-all">
          <input id="legend-all" type="checkbox" data-legend-all ${allOn ? 'checked' : ''}>
          Alles
        </label>
      </div>
      <div class="legend-top10">
        <label for="legend-top10">
          <input id="legend-top10" type="checkbox" data-top10 ${showTop10 ? 'checked' : ''}>
          Top 10
        </label>
      </div>
      <ul class="legend-list">
        ${listItemsHtml}
      </ul>
    `;
    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);

    const header = div.querySelector('.legend-header');
    const list = div.querySelector('.legend-list');
    list.style.display = '';
    header.setAttribute('aria-expanded', 'true');
    function toggle() {
      const isHidden = list.style.display === 'none';
      list.style.display = isHidden ? '' : 'none';
      header.setAttribute('aria-expanded', String(isHidden));
    }
    header.addEventListener('click', toggle);
    header.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });

    const allCb = div.querySelector('input[data-legend-all]');
    const top10Cb = div.querySelector('input[data-top10]');
    const itemCbs = Array.from(div.querySelectorAll('input[data-emoji]'));

    function syncMaster() {
      const allOn = itemCbs.every((cb) => cb.checked);
      const someOn = itemCbs.some((cb) => cb.checked);
      allCb.checked = allOn;
      allCb.indeterminate = !allOn && someOn;
    }

    allCb.addEventListener('change', () => {
      const checked = allCb.checked;
      itemCbs.forEach((cb) => {
        cb.checked = checked;
        const emoji = cb.getAttribute('data-emoji');
        setEmojiVisibility(emoji, checked);
      });
      // Do not affect Top-10 highlight when toggling "Alles"
      syncMaster();
    });

    if (top10Cb) {
      top10Cb.addEventListener('change', () => {
        setTop10Visible(top10Cb.checked);
      });
    }

    itemCbs.forEach((cb) => {
      cb.addEventListener('change', () => {
        const emoji = cb.getAttribute('data-emoji');
        setEmojiVisibility(emoji, cb.checked);
        syncMaster();
      });
    });

    return div;
  };
}

function createLegendControl(position) {
  const ctrl = L.control({ position });
  ctrl.onAdd = buildLegendOnAdd();
  return ctrl;
}

const isMobile = () => window.matchMedia('(max-width: 600px)').matches;

// --- Mobile Overlay (Left Drawer) ---
let mobileOverlayEl = null;

function renderMobileOverlayContent(container) {
  const ordered = CATEGORY_ORDER.filter((e) => presentEmojis.has(e));
  const extras = Array.from(presentEmojis).filter((e) => !CATEGORY_ORDER.includes(e)).sort();
  const emojiList = [...ordered, ...extras];
  const allOn = emojiList.every(e => emojiVisibility.get(e) !== false);

  const listItemsHtml = emojiList.map((e) => {
    const label = CATEGORY_LABELS[e] || 'Sonstiges';
    const checkedAttr = (emojiVisibility.get(e) !== false) ? 'checked' : '';
    return `
      <li>
        <label>
          <input type="checkbox" data-emoji="${e}" ${checkedAttr}>
          <span class="emoji">${e}</span>${label}
        </label>
      </li>`;
  }).join('');

  container.innerHTML = `
    <div class="mobile-overlay" aria-hidden="true">
      <div class="mobile-overlay__backdrop" data-close></div>
      <section class="mobile-overlay__panel" role="dialog" aria-modal="true" aria-label="Filter">
        <div class="mobile-overlay__header">
          <div class="mobile-overlay__handle" aria-hidden="true"></div>
          <div class="mobile-overlay__title">Filter</div>
          <button type="button" class="mobile-overlay__close" title="Schließen" aria-label="Schließen" data-close>✕</button>
        </div>
        <div class="mobile-overlay__body">
          <div class="legend-all legend-all--mobile">
            <label>
              <input type="checkbox" data-legend-all ${allOn ? 'checked' : ''}>
              Alles
            </label>
          </div>
          <div class="legend-top10 legend-top10--mobile">
            <label>
              <input type="checkbox" data-top10 ${showTop10 ? 'checked' : ''}>
              Top 10
            </label>
          </div>
          <div class="legend-search">
            <input type="search" placeholder="Kategorien suchen…" aria-label="Kategorien suchen" />
          </div>
          <ul class="legend-list legend-list--mobile">
            ${listItemsHtml}
          </ul>
        </div>
      </section>
    </div>
  `;

  const overlay = container.querySelector('.mobile-overlay');
  const backdrop = overlay.querySelector('[data-close]');
  const btnClose = overlay.querySelector('.mobile-overlay__close');
  const list = overlay.querySelector('.legend-list');
  const search = overlay.querySelector('.legend-search input');
  const allCb = overlay.querySelector('input[data-legend-all]');
  const top10Cb = overlay.querySelector('input[data-top10]');
  const itemCbs = Array.from(overlay.querySelectorAll('input[data-emoji]'));

  function open() {
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
  }
  function close() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  }
  overlay.open = open;
  overlay.close = close;

  backdrop.addEventListener('click', close);
  btnClose.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.classList.contains('open')) close(); });

  function syncMaster() {
    const allOn = itemCbs.every((cb) => cb.checked);
    const someOn = itemCbs.some((cb) => cb.checked);
    allCb.checked = allOn;
    allCb.indeterminate = !allOn && someOn;
    persistEmojiVisibility();
  }

  allCb.addEventListener('change', () => {
    const checked = allCb.checked;
    itemCbs.forEach((cb) => {
      cb.checked = checked;
      const emoji = cb.getAttribute('data-emoji');
      setEmojiVisibility(emoji, checked);
    });
    // Do not auto-toggle Top-10 highlight when toggling "Alles"
    syncMaster();
  });

  if (top10Cb) {
    top10Cb.addEventListener('change', () => {
      setTop10Visible(top10Cb.checked);
    });
  }

  itemCbs.forEach((cb) => {
    cb.addEventListener('change', () => {
      const emoji = cb.getAttribute('data-emoji');
      setEmojiVisibility(emoji, cb.checked);
      syncMaster();
    });
  });

  function filterList(q) {
    const term = q.trim().toLowerCase();
    Array.from(list.children).forEach((li) => {
      const text = li.textContent.toLowerCase();
      li.style.display = text.includes(term) ? '' : 'none';
    });
  }
  search.addEventListener('input', () => filterList(search.value));

  return overlay;
}

function initMobileUI() {
  // Create overlay holder and overlay content
  const holder = document.createElement('div');
  holder.className = 'mobile-overlay-holder';
  document.body.appendChild(holder);

  mobileOverlayEl = renderMobileOverlayContent(holder);
}

function destroyMobileUI() {
  if (mobileOverlayEl && mobileOverlayEl.parentNode && mobileOverlayEl.parentNode.parentNode) {
    mobileOverlayEl.parentNode.parentNode.removeChild(mobileOverlayEl.parentNode);
  }
  mobileOverlayEl = null;
}

let legendControl = null;
function initDesktopLegend() { legendControl = createLegendControl('topright'); legendControl.addTo(map); }
function destroyDesktopLegend() { if (legendControl) { map.removeControl(legendControl); legendControl = null; } }

function applyUiMode() {
  if (isMobile()) {
    destroyDesktopLegend();
    if (!mobileOverlayEl) initMobileUI();
  } else {
    destroyMobileUI();
    if (!legendControl) initDesktopLegend();
  }
}

// --- Start: Daten initialisieren und LOD-Layer aktivieren ---
initAttractionsMeta(attractions);

applyUiMode();
let wasMobile = isMobile();
window.addEventListener('resize', () => {
  const nowMobile = isMobile();
  if (nowMobile !== wasMobile) { applyUiMode(); wasMobile = nowMobile; }
});

// Sichtbarkeit einer Emoji-Kategorie setzen -> LOD neu rendern
function setEmojiVisibility(emoji, show) {
  emojiVisibility.set(emoji, !!show);
  try { persistEmojiVisibility(); } catch {}
  if (lodLayer) lodLayer.update();
}

function setTop10Visible(val) { // controls highlight only
  showTop10 = !!val;
  try { localStorage.setItem('showTop10', showTop10 ? '1' : '0'); } catch {}
  if (lodLayer) lodLayer.update();
}

// LOD-Layer erstellen und der Karte hinzufügen
lodLayer = new LODGridLayer(map, attractionsAug).addTo();

// Hinweis: bisheriges Marker-Clustering wurde zugunsten des LOD-Renderers entfernt.
