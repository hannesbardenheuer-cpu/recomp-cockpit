/* Recomp Cockpit – Service Worker
   Cache-first app shell, runtime-cache for fonts. Bump CACHE to force update. */

const CACHE = "recomp-cockpit-v2";

const CORE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png"
];

// Install: pre-cache the app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
  );
});

// Activate: drop old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first, then network. Runtime-cache successful GETs (incl. fonts).
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // Cache same-origin and font responses (opaque allowed) for offline use
          const url = new URL(req.url);
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
        .catch(() => {
          // Offline fallback: for navigations, serve the cached app shell
          if (req.mode === "navigate") return caches.match("./index.html");
        });
    })
  );
});
