// Minimaler Service Worker: macht das Dashboard installierbar ("Zum Homescreen
// hinzufügen") und liefert eine Offline-Notlösung. Bewusst "network-first" für
// ALLE Requests (auch data.js) — ein cache-first-Ansatz würde sonst nach jedem
// Sync veraltete Zahlen ausliefern, bis der Cache irgendwann abläuft. Das Netzwerk
// hat also immer Vorrang; der Cache greift nur, wenn gar keine Verbindung besteht.

// Hochzaehlen bei jedem Deploy, der fuer alle Geraete ankommen MUSS (Bugfixes o.ae.):
// beim Aktivieren der neuen Version werden alle Caches mit abweichendem Namen geloescht
// (siehe "activate" unten) - sonst kann ein Geraet mit wackliger Verbindung (v.a. Handy im
// Mobilfunknetz) nach einem fehlgeschlagenen Netzwerk-Request beliebig lange auf einer
// alten, im Cache haengengebliebenen script.js/index.html sitzen bleiben.
const CACHE_NAME = "dashboard-v3";
const APP_SHELL = [
  "./", "index.html", "styles.css", "script.js", "data.js", "habits-data.json", "sync-data.json", "manifest.webmanifest", "icon.svg",
  "fonts/fraunces-var.woff2", "fonts/publicsans-var.woff2", "fonts/plexmono-500.woff2", "fonts/plexmono-600.woff2"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
