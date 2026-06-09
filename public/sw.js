// Service Worker de Cuándo (PWA installable + modo offline real).
//
// Filosofía: los datos EN VIVO (/api/*) NUNCA se cachean — mostrar un bus viejo sería
// mentir. Pero el "esqueleto" (app shell + datasets que cambian raro: paradas, recorridos)
// SÍ se cachea, así la app ABRE sin señal y podés ver el mapa, las paradas y los recorridos.
// Estrategia por tipo:
//   - app shell (/, _next/static): cache-first (con revalidación en segundo plano).
//   - datasets .json pesados: stale-while-revalidate (sirve cache al toque + actualiza atrás).
//   - /api/*: solo red (nunca cache).
//   - resto: network-first con fallback a cache.

// Versión del cache: subir en cada cambio del SW o estrategia. `activate` borra las
// viejas → garantiza que un deploy no arrastre HTML/assets obsoletos.
const CACHE = "cuando-v4";

// Datasets que vale la pena tener offline (el catálogo del transporte).
const DATASETS = ["/stops.json", "/routes.json", "/line-shapes.json", "/operators.json", "/interior-stops.json"];
const SHELL = ["/", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// stale-while-revalidate: devuelve el cache YA (rápido) y actualiza en segundo plano.
function staleWhileRevalidate(request) {
  return caches.open(CACHE).then((cache) =>
    cache.match(request).then((cached) => {
      const network = fetch(request).then((res) => {
        if (res && res.ok) cache.put(request, res.clone());
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Datos en vivo: nunca cachear (que falle si no hay red — es honesto).
  if (url.pathname.startsWith("/api/")) return;
  // Solo GET de mismo origen.
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  // Datasets del catálogo → stale-while-revalidate (instantáneo + se actualiza solo).
  if (DATASETS.includes(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // Estáticos de Next (con HASH en el nombre) e iconos → cache-first/SWR (seguro: un
  // build nuevo genera nombres nuevos, nunca colisiona). El HTML NO va acá a propósito.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // HTML / navegaciones ("/" incluida) → NETWORK-FIRST. Clave para que un DEPLOY no deje
  // usuarios con la app rota: el HTML viejo cacheado referencia chunks que ya no existen.
  // Siempre traemos el HTML fresco (que apunta a los chunks actuales); si no hay red,
  // recién ahí caemos al cache. Cae al "resto" de abajo (que ya es network-first).

  // Resto → network-first, cae al cache si no hay red; si tampoco, la home cacheada.
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, clone));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        // Para navegaciones (HTML), servir la home cacheada → la app abre offline.
        if (event.request.mode === "navigate") {
          const home = await caches.match("/");
          if (home) return home;
        }
        return new Response("Sin conexión", { status: 503, headers: { "Content-Type": "text/plain" } });
      })
  );
});
