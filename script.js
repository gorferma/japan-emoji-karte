// Karte initialisieren
const map = L.map("map", {
  zoomControl: true, // +/- Steuerung
  worldCopyJump: true
});

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

// Marker-Layer (statt Clustering, um alle Emojis direkt zu sehen)
const markersLayer = L.layerGroup();
markersLayer.addTo(map);

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

// Marker hinzufügen
function addAttractionMarkers(list) {
  list.forEach((a) => {
    const marker = L.marker([a.lat, a.lng], {
      icon: emojiIcon(getEmojiForAttraction(a), a.name)
    });
    const popupHtml = `
      <h3>${a.name}</h3>
      <p>${a.type} · ${a.city}</p>
      <p>${a.desc}</p>
    `;
    marker.bindPopup(popupHtml, { closeButton: true });
    markersLayer.addLayer(marker);
  });
}

addAttractionMarkers(attractions);

// Maßstabsleiste (metrisch, deutsch-typisch)
L.control.scale({ metric: true, imperial: false }).addTo(map);

// Entferne die visuelle Maskierung außerhalb Japans
// (vorheriges L.polygon mit world/japanRect wurde entfernt)

// Legende (kleine Box mit Emoji-Erklärungen) – oben rechts; mobil standardmäßig geschlossen
function buildLegendOnAdd() {
  return function () {
    const div = L.DomUtil.create('div', 'legend-control leaflet-bar');
    div.innerHTML = `
      <div class="legend-header" role="button" aria-expanded="true" tabindex="0">Legende</div>
      <ul class="legend-list">
        <li><span class="emoji">🗻</span>Berg/Vulkan</li>
        <li><span class="emoji">⛩️</span>Schrein</li>
        <li><span class="emoji">🛕</span>Tempel</li>
        <li><span class="emoji">🏯</span>Burg/Schloss</li>
        <li><span class="emoji">🗼</span>Turm</li>
        <li><span class="emoji">🚦</span>Kreuzung/Wahrzeichen</li>
        <li><span class="emoji">🕊️</span>Gedenkstätte</li>
        <li><span class="emoji">🍜</span>Food-Viertel/Markt</li>
        <li><span class="emoji">🎮</span>Elektronik/Popkultur</li>
        <li><span class="emoji">🌸</span>Kirschen/Blüte</li>
        <li><span class="emoji">🏞️</span>Nationalpark/Schlucht</li>
        <li><span class="emoji">💦</span>Wasserfall</li>
        <li><span class="emoji">♨️</span>Onsen</li>
        <li><span class="emoji">🌉</span>Brücke</li>
        <li><span class="emoji">🏝️</span>Insel/Strand</li>
        <li><span class="emoji">🐠</span>Aquarium</li>
        <li><span class="emoji">🏛️</span>Museum/Garten</li>
        <li><span class="emoji">🎢</span>Freizeitpark</li>
        <li><span class="emoji">🎆</span>Festival</li>
        <li><span class="emoji">🥾</span>Pilgerweg/Wanderung</li>
        <li><span class="emoji">🏘️</span>Altstadt/Tradition</li>
      </ul>
    `;
    // Interaktionen innerhalb der Legende sollen die Karte nicht bewegen
    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);

    // Einklappen/aufklappen per Klick oder Tastatur
    const header = div.querySelector('.legend-header');
    const list = div.querySelector('.legend-list');

    // Initialzustand je nach Gerät: mobil zu, Desktop offen
    const startCollapsed = isMobile();
    if (startCollapsed) {
      list.style.display = 'none';
      header.setAttribute('aria-expanded', 'false');
    } else {
      list.style.display = '';
      header.setAttribute('aria-expanded', 'true');
    }

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

    return div;
  };
}

function createLegendControl(position) {
  const ctrl = L.control({ position });
  ctrl.onAdd = buildLegendOnAdd();
  return ctrl;
}

const isMobile = () => window.matchMedia('(max-width: 600px)').matches;

// Legende immer oben rechts hinzufügen; Mobil initial geschlossen (in onAdd umgesetzt)
let legendControl = createLegendControl('topright');
legendControl.addTo(map);
let wasMobile = isMobile();

// Bei Größenänderung: Wenn zwischen Mobil/Desktop gewechselt wird, Legende neu aufbauen,
// um den gewünschten Startzustand (geschlossen/offen) zu übernehmen
window.addEventListener('resize', () => {
  const nowMobile = isMobile();
  if (nowMobile !== wasMobile) {
    map.removeControl(legendControl);
    legendControl = createLegendControl('topright');
    legendControl.addTo(map);
    wasMobile = nowMobile;
  }
});
