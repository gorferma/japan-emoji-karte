// Karte initialisieren
const map = L.map("map", {
  zoomControl: true, // +/- Steuerung (per CSS auf Mobile ausgeblendet)
  worldCopyJump: true
});

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
function emojiIcon(emoji, label) {
  const safeLabel = (label || "").replace(/"/g, "&quot;");
  return L.divIcon({
    className: "",
    html: `<div class="emoji-marker" aria-label="${safeLabel}" title="${safeLabel}">${emoji}</div>`,
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
  const t = (a.type || '').toLowerCase();
  const boost = (v) => { s = Math.max(s, v); };
  if (t.includes('unesco')) boost(90);
  else if (t.includes('vulkan') || t.includes('berg')) boost(70);
  else if (t.includes('burg') || t.includes('schloss')) boost(65);
  else if (t.includes('tempel') || t.includes('schrein') || t.includes('pagode')) boost(60);
  else if (t.includes('nationalpark') || t.includes('natur') || t.includes('see') || t.includes('schlucht')) boost(55);
  else if (t.includes('garten') || t.includes('park')) boost(50);
  else if (t.includes('viertel') || t.includes('altstadt')) boost(45);
  else if (t.includes('museum') || t.includes('aquarium')) boost(40);
  else if (t.includes('onsen')) boost(35);
  const n = (a.name || '').toLowerCase();
  if (n.includes('fuji')) s = Math.max(s, 95);
  if (n.includes('skytree') || n.includes('tokyo tower')) s = Math.max(s, 80);
  if (n.includes('miyajima') || n.includes('itsukushima')) s = Math.max(s, 85);
  if (n.includes('himeji')) s = Math.max(s, 80);
  if (n.includes('daibutsu') || n.includes('buddha')) s = Math.max(s, 70);
  const ov = (window.attractionImportance && window.attractionImportance[a.name]);
  if (typeof ov === 'number') s = ov;
  return Math.max(0, Math.min(100, s));
}
function zoomScoreThreshold(z) {
  if (z <= 4) return 90;
  if (z <= 5) return 85;
  if (z <= 6) return 80;
  if (z <= 7) return 70;
  if (z <= 8) return 60;
  if (z <= 9) return 50;
  if (z <= 10) return 35;
  if (z <= 11) return 20;
  return 0;
}
function cellSizeForZoom(z) {
  if (z <= 4) return 140;
  if (z <= 5) return 110;
  if (z <= 6) return 90;
  if (z <= 7) return 70;
  if (z <= 8) return 54;
  if (z <= 9) return 40;
  if (z <= 10) return 30;
  if (z <= 11) return 20;
  return 0;
}

// Zustand für Emoji-Filter
const presentEmojis = new Set();
const emojiVisibility = new Map();
let attractionsAug = [];
let lodLayer = null;

// Initialisiere Attraktions-Metadaten (Emoji + Score sammeln)
function initAttractionsMeta(list) {
  attractionsAug = list.map((a) => {
    const emj = getEmojiForAttraction(a);
    presentEmojis.add(emj);
    return { ...a, emoji: emj, _score: computeImportance({ ...a, emoji: emj }) };
  });
  // Standard: alle sichtbar
  presentEmojis.forEach(e => emojiVisibility.set(e, true));
}

class LODGridLayer {
  constructor(map, data) {
    this.map = map;
    this.data = data;
    this.layer = L.layerGroup();
    this.pool = new Map(); // name -> marker
    this._onUpdate = this.update.bind(this);
    map.on('moveend zoomend resize', this._onUpdate);
  }
  addTo() { this.layer.addTo(this.map); this.update(); return this; }
  remove() { this.map.off('moveend zoomend resize', this._onUpdate); this.layer.remove(); }
  ensureMarker(a) {
    if (this.pool.has(a.name)) return this.pool.get(a.name);
    const m = L.marker([a.lat, a.lng], { icon: emojiIcon(a.emoji, a.name) });
    m.bindPopup(buildPopupContent(a), { closeButton: true });
    this.pool.set(a.name, m);
    return m;
  }
  update() {
    const z = this.map.getZoom();
    const minScore = zoomScoreThreshold(z);
    const cell = cellSizeForZoom(z);
    const size = this.map.getSize();
    const pad = 80;

    // Helfer: Emoji-Filter prüfen
    const emojiOn = (e) => (emojiVisibility.get(e) !== false);

    if (cell === 0) {
      const visible = new Set();
      for (const a of this.data) {
        if (a._score < minScore) continue;
        if (!emojiOn(a.emoji)) continue;
        const p = this.map.latLngToContainerPoint([a.lat, a.lng]);
        if (p.x < -pad || p.y < -pad || p.x > size.x + pad || p.y > size.y + pad) continue;
        const mk = this.ensureMarker(a);
        if (!this.layer.hasLayer(mk)) this.layer.addLayer(mk);
        visible.add(a.name);
      }
      for (const [name, mk] of this.pool) {
        if (!visible.has(name) && this.layer.hasLayer(mk)) this.layer.removeLayer(mk);
      }
      return;
    }

    const bounds = this.map.getPixelBounds();
    const min = bounds.min.subtract([pad, pad]);
    const max = bounds.max.add([pad, pad]);
    const chosen = new Map(); // key -> best attraction

    for (const a of this.data) {
      if (a._score < minScore) continue;
      if (!emojiOn(a.emoji)) continue;
      const pt = this.map.project([a.lat, a.lng], z);
      if (pt.x < min.x || pt.y < min.y || pt.x > max.x || pt.y > max.y) continue;
      const cx = Math.floor(pt.x / cell);
      const cy = Math.floor(pt.y / cell);
      const key = `${cx}:${cy}`;
      const cur = chosen.get(key);
      if (!cur || a._score > cur._score) chosen.set(key, a);
    }

    const keep = new Set();
    for (const [, a] of chosen) {
      const mk = this.ensureMarker(a);
      if (!this.layer.hasLayer(mk)) this.layer.addLayer(mk);
      keep.add(a.name);
    }
    for (const [name, mk] of this.pool) {
      if (!keep.has(name) && this.layer.hasLayer(mk)) this.layer.removeLayer(mk);
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
      syncMaster();
    });

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
let mobileHandleEl = null;
let edgeMoveHandler = null;
let edgeUpHandler = null;

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
  }

  allCb.addEventListener('change', () => {
    const checked = allCb.checked;
    itemCbs.forEach((cb) => {
      cb.checked = checked;
      const emoji = cb.getAttribute('data-emoji');
      setEmojiVisibility(emoji, checked);
    });
    syncMaster();
  });

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

  // Create left edge handle (three vertical lines)
  mobileHandleEl = document.createElement('button');
  mobileHandleEl.className = 'edge-handle';
  mobileHandleEl.type = 'button';
  mobileHandleEl.title = 'Filter & Kategorien';
  mobileHandleEl.setAttribute('aria-label', 'Filter & Kategorien öffnen');
  mobileHandleEl.innerHTML = '<span></span><span></span><span></span>';
  document.body.appendChild(mobileHandleEl);

  // Open on tap/click
  mobileHandleEl.addEventListener('click', () => { if (mobileOverlayEl) mobileOverlayEl.open(); });

  // Simple drag-to-open gesture
  let dragging = false;
  let startX = 0;
  const onDown = (e) => {
    dragging = true;
    startX = (e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX) || 0;
  };
  edgeMoveHandler = (e) => {
    if (!dragging) return;
    const x = (e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX) || 0;
    if (x - startX > 24) { // pulled to the right
      dragging = false;
      if (mobileOverlayEl) mobileOverlayEl.open();
    }
  };
  edgeUpHandler = () => { dragging = false; };

  mobileHandleEl.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointermove', edgeMoveHandler, { passive: true });
  window.addEventListener('pointerup', edgeUpHandler, { passive: true });
  // Touch support
  mobileHandleEl.addEventListener('touchstart', onDown, { passive: true });
  window.addEventListener('touchmove', edgeMoveHandler, { passive: true });
  window.addEventListener('touchend', edgeUpHandler, { passive: true });
}

function destroyMobileUI() {
  if (mobileHandleEl) {
    mobileHandleEl.remove();
    mobileHandleEl = null;
  }
  if (edgeMoveHandler) {
    window.removeEventListener('pointermove', edgeMoveHandler);
    window.removeEventListener('touchmove', edgeMoveHandler);
    edgeMoveHandler = null;
  }
  if (edgeUpHandler) {
    window.removeEventListener('pointerup', edgeUpHandler);
    window.removeEventListener('touchend', edgeUpHandler);
    edgeUpHandler = null;
  }
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
  if (lodLayer) lodLayer.update();
}

// LOD-Layer erstellen und der Karte hinzufügen
lodLayer = new LODGridLayer(map, attractionsAug).addTo();

// Hinweis: bisheriges Marker-Clustering wurde zugunsten des LOD-Renderers entfernt.
