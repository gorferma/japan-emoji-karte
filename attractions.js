// Eine Auswahl wichtiger Sehenswürdigkeiten in Japan mit passenden Emojis
// Koordinaten: [lat, lng]
const attractions = [
  { name: "Fuji-san (Mount Fuji)", city: "Shizuoka/Yamanashi", type: "Berg", emoji: "🗻", lat: 35.3606, lng: 138.7274, desc: "Ikonischer Vulkan und UNESCO-Welterbe." },
  { name: "Fushimi Inari-taisha", city: "Kyoto", type: "Schrein", emoji: "⛩️", lat: 34.9671, lng: 135.7727, desc: "Tausende rote Torii-Tore am Berghang." },
  { name: "Kiyomizu-dera", city: "Kyoto", type: "Tempel", emoji: "🛕", lat: 34.9949, lng: 135.7850, desc: "Berühmter Holztempel mit Aussichtsbühne." },
  { name: "Kinkaku-ji (Goldener Pavillon)", city: "Kyoto", type: "Tempel", emoji: "✨", lat: 35.0394, lng: 135.7292, desc: "Goldglänzender Pavillon am Teich." },
  { name: "Arashiyama Bambuswald", city: "Kyoto", type: "Natur", emoji: "🎋", lat: 35.0094, lng: 135.6668, desc: "Atmosphärischer Bambuswald." },
  { name: "Nara-Park", city: "Nara", type: "Park", emoji: "🦌", lat: 34.6851, lng: 135.8431, desc: "Freilaufende Hirsche und Tempel." },
  { name: "Himeji-jo (Burg Himeji)", city: "Himeji", type: "Burg", emoji: "🏯", lat: 34.8394, lng: 134.6939, desc: "Prächtige weiße Burg, UNESCO-Welterbe." },
  { name: "Itsukushima-Schrein", city: "Miyajima", type: "Schrein", emoji: "⛩️", lat: 34.2956, lng: 132.3199, desc: "Schwimmendes Torii im Meer." },
  { name: "Friedensdenkmal Hiroshima", city: "Hiroshima", type: "Memorial", emoji: "🕊️", lat: 34.3955, lng: 132.4536, desc: "Gedenkstätte und Museum." },
  { name: "Dotonbori", city: "Osaka", type: "Viertel", emoji: "🍜", lat: 34.6687, lng: 135.5011, desc: "Neon, Streetfood und Nachtleben." },
  { name: "Shibuya Crossing", city: "Tokyo", type: "Kreuzung", emoji: "🚦", lat: 35.6595, lng: 139.7005, desc: "Eine der belebtesten Kreuzungen der Welt." },
  { name: "Senso-ji (Asakusa)", city: "Tokyo", type: "Tempel", emoji: "🛕", lat: 35.7148, lng: 139.7967, desc: "Tokyos ältester Tempel mit Kaminari-mon." },
  { name: "Tokyo Tower", city: "Tokyo", type: "Turm", emoji: "🗼", lat: 35.6586, lng: 139.7454, desc: "Aussichtsturm im Herzen Tokyos." },
  { name: "Akihabara", city: "Tokyo", type: "Viertel", emoji: "🎮", lat: 35.6984, lng: 139.7730, desc: "Elektronik, Games und Anime." },
  { name: "Nikko Toshogu", city: "Nikko", type: "Schrein", emoji: "⛩️", lat: 36.7570, lng: 139.5993, desc: "Prächtiger Schrein in den Bergen." }
];
