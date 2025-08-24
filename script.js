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

// Marker hinzufügen
function addAttractionMarkers(list) {
  list.forEach((a) => {
    const marker = L.marker([a.lat, a.lng], {
      icon: emojiIcon(a.emoji, a.name)
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
