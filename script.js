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
  const btnReset = document.getElementById('btn-reset');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      map.fitBounds(japanBounds, { padding: [20, 20] });
    });
  }
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
          // Fallback
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

  const btnZoomVisible = document.getElementById('btn-zoom-visible');
  if (btnZoomVisible) {
    btnZoomVisible.addEventListener('click', () => {
      // Sammle alle aktuell sichtbaren Marker aus dem globalen Cluster
      const visibleMarkers = [];
      Object.keys(emojiLayers).forEach((emoji) => {
        if (emojiVisibility.get(emoji) !== false) {
          const group = emojiLayers[emoji];
          group.eachLayer((m) => {
            // m ist der originale Marker; prüfe, ob in Karte/Cluster vorhanden
            if (globalCluster.hasLayer(m)) visibleMarkers.push(m);
          });
        }
      });
      if (visibleMarkers.length > 0) {
        const bounds = L.latLngBounds(visibleMarkers.map(m => m.getLatLng()));
        map.flyToBounds(bounds, { padding: [30, 30], maxZoom: 11, duration: 0.5 });
      }
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

// Marker-Layer nach Emoji-Kategorie sammeln, aber global clustern (kategorienunabhängig)
const globalCluster = L.markerClusterGroup({
  chunkedLoading: true,
  chunkInterval: 150,
  chunkDelay: 25,
  removeOutsideVisibleBounds: false,
  // Clustern nur bei sehr weitem Herauszoomen
  maxClusterRadius: (z) => {
    if (z <= 4) return 100;
    if (z <= 5) return 80;
    if (z <= 6) return 60;
    if (z <= 7) return 40;
    return 0; // ab 8 praktisch keine Clusterbildung mehr
  },
  disableClusteringAtZoom: 8,      // ab Zoom 8 Marker getrennt
  showCoverageOnHover: false,
  zoomToBoundsOnClick: false,
  spiderfyOnEveryZoom: false,
  spiderfyOnMaxZoom: true,
  spiderfyDistanceMultiplier: 1.25,
  iconCreateFunction: (cluster) => {
    const count = cluster.getChildCount();
    return L.divIcon({
      className: 'emoji-cluster',
      html: `<div class="inner"><span class="cnt">${count}</span></div>`,
      iconSize: null
    });
  }
});
map.addLayer(globalCluster);

// Marker-Container pro Emoji (für Legenden-Checkboxen)
const emojiLayers = {}; // { '🗻': L.layerGroup (nur Container), ... }
const presentEmojis = new Set();
const emojiVisibility = new Map(); // Sichtbarkeitszustand pro Emoji (mobil/desktop synchron)
function ensureEmojiLayer(emoji) {
  if (!emojiLayers[emoji]) {
    // Nur Container pro Kategorie, nicht direkt der Karte hinzufügen
    emojiLayers[emoji] = L.layerGroup();
  }
  return emojiLayers[emoji];
}
function setEmojiVisibility(emoji, show) {
  const group = emojiLayers[emoji];
  if (!group) return;
  const layers = [];
  group.eachLayer((l) => layers.push(l));
  if (show) {
    globalCluster.addLayers(layers);
  } else {
    globalCluster.removeLayers(layers);
  }
  emojiVisibility.set(emoji, !!show);
}

// Emoji-Marker als DivIcon
function emojiIcon(emoji, label) {
  const safeLabel = (label || "").replace(/"/g, "&quot;");
  return L.divIcon({
    className: "", // wir nutzen eigenes HTML
    html: `<div class="emoji-marker" aria-label="${safeLabel}" title="${safeLabel}">${emoji}</div>`,
    iconSize: null,
    iconAnchor: [0, 16]
  });
}

// Emoji-Zuordnung nach Kategorie/Schlüsselwörtern
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
  { k: ['wasserfall','falls','kegon','nachi'], e: '💦' },
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

// Anzeigenamen für Kategorien (für Legende) + Reihenfolge
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
  '💦': 'Wasserfall',
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
  // Zusätzliche Emojis aus den Daten (vermeidet "Sonstiges" in der Legende)
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
const CATEGORY_ORDER = ['🗻','⛩️','🛕','🏯','🗼','🚦','🕊️','🍜','🎮','🌸','🏞️','💦','♨️','🌉','🏝️','🐈','🐠','🏛️','🎢','🎆','🥾','🏘️','📍'];

function getEmojiForAttraction(a) {
  if (a.emoji && String(a.emoji).trim()) return a.emoji;
  const name = (a.name || '').toLowerCase();
  const type = (a.type || '').toLowerCase();
  const hay = `${type} ${name}`;
  for (const { k, e } of EMOJI_KEYWORDS) {
    if (k.some((kw) => hay.includes(kw))) return e;
  }
  return '📍'; // Fallback
}

// ---- Links in Popups: Mapping + Helpers ----
// Optional: Externes Mapping per <script> vor dieser Datei: window.attractionLinks = { 'Name': 'https://…' }
const attractionLinks = (window.attractionLinks || {});

function isValidHttpUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function getAttractionUrl(a) {
  // 1) Direkter Link am Datensatz
  if (a.url && isValidHttpUrl(a.url)) return a.url;
  // 2) Mapping über exakten Namen
  const byName = attractionLinks[a.name];
  if (byName && isValidHttpUrl(byName)) return byName;
  return null;
}
function buildPopupContent(a) {
  const name = escHtml(a.name);
  const type = escHtml(a.type);
  const city = escHtml(a.city);
  const desc = escHtml(a.desc);
  const url = getAttractionUrl(a);
  const nameHtml = url
    ? `<a href="${escHtml(url)}" target="_blank" rel="noopener noreferrer">${name}</a>`
    : name;
  return `
      <h3>${nameHtml}</h3>
      <p>${type} · ${city}</p>
      ${desc ? `<p>${desc}</p>` : ''}
    `;
}

// Marker hinzufügen
function addAttractionMarkers(list) {
  list.forEach((a) => {
    const emj = getEmojiForAttraction(a);
    const marker = L.marker([a.lat, a.lng], {
      icon: emojiIcon(emj, a.name)
    });
    const popupHtml = buildPopupContent(a);
    marker.bindPopup(popupHtml, { closeButton: true });
    // Marker pro Emoji sammeln und dem globalen Cluster hinzufügen
    presentEmojis.add(emj);
    ensureEmojiLayer(emj).addLayer(marker);
    globalCluster.addLayer(marker);
  });
  // Initial alle sicht- und gespeichert setzen
  presentEmojis.forEach(e => emojiVisibility.set(e, true));
}

addAttractionMarkers(attractions);

// Maßstabsleiste (metrisch, deutsch-typisch)
L.control.scale({ metric: true, imperial: false }).addTo(map);

// Entferne die visuelle Maskierung außerhalb Japans
// (vorheriges L.polygon mit world/japanRect wurde entfernt)

// Legende (Desktop) – oben rechts; mobil verwenden wir ein Left-Drawer-Overlay
function buildLegendOnAdd() {
  return function () {
    const div = L.DomUtil.create('div', 'legend-control leaflet-bar');

    // Emoji-Liste dynamisch: bekannte Kategorien in definierter Reihenfolge, dann evtl. zusätzliche Emojis
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

    // Master-Checkbox Zustand berechnen
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
    // Interaktionen innerhalb der Legende sollen die Karte nicht bewegen
    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);

    // Einklappen/aufklappen per Klick oder Tastatur
    const header = div.querySelector('.legend-header');
    const list = div.querySelector('.legend-list');

    // Initialzustand je nach Gerät: mobil zu, Desktop offen (hier Desktop => offen)
    list.style.display = '';
    header.setAttribute('aria-expanded', 'true');

    function toggle() {
      const isHidden = list.style.display === 'none';
      list.style.display = isHidden ? '' : 'none';
      header.setAttribute('aria-expanded', String(isHidden));
    }
    header.addEventListener('click', toggle);
    header.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });

    // Checkbox-Interaktion
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
let mobileFabEl = null;

function renderMobileOverlayContent(container) {
  // Liste und Zustände zusammenstellen
  const ordered = CATEGORY_ORDER.filter((e) => presentEmojis.has(e));
  const extras = Array.from(presentEmojis).filter((e) => !CATEGORY_ORDER.includes(e)).sort();
  const emojiList = [...ordered, ...extras];
  const allOn = emojiList.every(e => emojiVisibility.get(e) !== false);

  const listItemsHtml = emojiList.map((e, idx) => {
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
    // No auto-focus on mobile drawer
  }
  function close() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  }

  // Expose controls
  overlay.open = open;
  overlay.close = close;

  backdrop.addEventListener('click', close);
  btnClose.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) close();
  });

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

  // Suche/Filter der Liste
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
  // FAB erstellen
  mobileFabEl = document.createElement('button');
  mobileFabEl.className = 'mobile-fab';
  mobileFabEl.type = 'button';
  mobileFabEl.title = 'Filter & Kategorien';
  mobileFabEl.setAttribute('aria-label', 'Filter & Kategorien öffnen');
  mobileFabEl.textContent = 'Filter';
  document.body.appendChild(mobileFabEl);

  // Overlay-Container
  const holder = document.createElement('div');
  holder.className = 'mobile-overlay-holder';
  document.body.appendChild(holder);

  mobileOverlayEl = renderMobileOverlayContent(holder);

  mobileFabEl.addEventListener('click', () => {
    if (mobileOverlayEl) mobileOverlayEl.open();
  });
}

function destroyMobileUI() {
  if (mobileFabEl && mobileFabEl.parentNode) mobileFabEl.parentNode.removeChild(mobileFabEl);
  if (mobileOverlayEl && mobileOverlayEl.parentNode && mobileOverlayEl.parentNode.parentNode) {
    // remove holder
    mobileOverlayEl.parentNode.parentNode.removeChild(mobileOverlayEl.parentNode);
  }
  mobileFabEl = null;
  mobileOverlayEl = null;
}

// Steuerung: je nach Gerät entweder Desktop-Legende oder Mobile-Overlay verwenden
let legendControl = null;
function initDesktopLegend() {
  legendControl = createLegendControl('topright');
  legendControl.addTo(map);
}
function destroyDesktopLegend() {
  if (legendControl) {
    map.removeControl(legendControl);
    legendControl = null;
  }
}

function applyUiMode() {
  if (isMobile()) {
    destroyDesktopLegend();
    if (!mobileOverlayEl) initMobileUI();
  } else {
    destroyMobileUI();
    if (!legendControl) initDesktopLegend();
  }
}

applyUiMode();
let wasMobile = isMobile();
window.addEventListener('resize', () => {
  const nowMobile = isMobile();
  if (nowMobile !== wasMobile) {
    applyUiMode();
    wasMobile = nowMobile;
  }
});

// Cluster-Klick: bei "relativ nah" spiderfy statt weiter stark zu zoomen
globalCluster.on('clusterclick', (e) => {
  const z = map.getZoom();
  const n = e.layer.getChildCount();

  // Wenn schon nah genug oder der Cluster klein ist -> spiderfy
  if (z >= 10 || n <= 8) {
    e.layer.spiderfy();
    return;
  }
  // sonst sanft näher heran, nicht bis Maximum
  map.flyTo(e.latlng, Math.min(z + 1, 12), { duration: 0.25 });
});
