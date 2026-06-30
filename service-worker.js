/* Recomp Cockpit – Service Worker
   App shell: NETWORK-FIRST (neue index.html erscheint automatisch beim nächsten Start).
   Statische Assets (Icons, Fonts): cache-first + Runtime-Cache.
   Cache-Version nur hochzählen, wenn du den Cache komplett leeren willst. */

const CACHE = "recomp-cockpit-v6";

const CORE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png"
];

// Install: App-Shell vorab cachen, sofort übernehmen
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
  );
});

// Activate: alte Caches löschen, Kontrolle übernehmen
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // App-Shell (Navigationen + index.html): NETWORK-FIRST.
  // So wird eine neu hochgeladene index.html sofort geladen; offline -> Cache.
  const isShell =
    req.mode === "navigate" ||
    (url.origin === self.location.origin &&
      (url.pathname.endsWith("/") || url.pathname.endsWith("/index.html")));

  if (isShell) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put("./index.html", copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match("./index.html"))
        )
    );
    return;
  }

  // Alles andere: cache-first, dann Netz; erfolgreiche GETs runtime-cachen (inkl. Fonts).
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          const cacheable =
            url.origin === self.location.origin ||
            url.host.includes("fonts.googleapis.com") ||
            url.host.includes("fonts.gstatic.com");
          if (cacheable && (res.ok || res.type === "opaque")) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
