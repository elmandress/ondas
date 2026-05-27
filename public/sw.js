// Service Worker mínimo para que Ondas sea PWA installable.
// Estrategia: network-first con fallback a cache, sin agresividad
// (los datos son tiempo-real, no queremos servir datos viejos por error).

const CACHE_NAME = "ondas-v1";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  // Pre-cache de assets críticos
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Limpiar caches viejos
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // NUNCA cachear API routes (datos en vivo)
  if (url.pathname.startsWith("/api/")) return;

  // Solo manejamos GET de mismo origen
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  // stops.json y routes.json: cache-first (cambian raro)
  if (url.pathname === "/stops.json" || url.pathname === "/routes.json") {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // Resto: network-first con fallback al cache si falla red
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok && (url.pathname === "/" || url.pathname.startsWith("/_next/static/"))) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request) || new Response("Sin conexión", { status: 503 }))
  );
});
