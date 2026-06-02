# Cuándo — Optimización de velocidad y datos

Objetivo: arrancar rápido y gastar **los menos datos posibles en celular**, sin resignar
fluidez en WiFi. Todo medido, no a ojo.

## Lo aplicado

### 1. Menos JS en el arranque (code-splitting)
- `AppShell` importa **solo Home** estático. Mapa, Rutas y Buscar se cargan con `next/dynamic`
  **al visitarse por primera vez** (keep-alive después, para no recargar). El JS de esas
  pantallas no entra en la carga inicial.
- `optimizePackageImports: ["framer-motion"]` en `next.config.ts` → tree-shaking más fino.
- **Medido (producción):** Home inicial ≈ **716 KB** de JS (≈ ~220 KB con brotli). Abrir el Mapa
  suma **~196 KB** (Leaflet + MapScreen) recién ahí. Antes todo eso estaba en el arranque.

### 2. Assets pesados, diferidos y cacheados
- `routes.json` (**3.9 MB**, polylines de recorridos) ya está a 5 decimales (~1 m) y **solo se
  baja al tocar una parada en el mapa** (no al abrir el mapa). Mirar el mapa ≈ 0 datos extra.
- El **service worker** cachea `stops.json` y `routes.json` (cache-first) → en visitas repetidas
  esos archivos se sirven del cache: **0 datos**.

### 3. Polling consciente de red y visibilidad (el mayor ahorro real)
`useArrivals` y `useVehicles` (buses en vivo, el más pesado):
- **Se pausan cuando la app no está visible** (segundo plano) y refrescan al volver.
- **Se adaptan a la red** (`src/lib/network.ts`, Network Information API): en datos móviles ×1.6,
  en 2G/3G ×3, con **Ahorro de datos** ×2.5. En WiFi/4G, intervalo normal.

### 4. Tiles del mapa según red
- En **celular / Data Saver**: una sola capa `dark_all` (mitad de tiles) y **tiles 1x** (sin `@2x`
  retina, que pesan ~4×).
- En **WiFi**: base sin labels + capa de labels (look más limpio) y retina.

### 5. Red más rápida
- `preconnect` / `dns-prefetch` en `<head>` a STM, CARTO, OSRM y Nominatim → la 1ª llamada a cada
  uno no paga el handshake TLS/DNS.

## Ideas futuras (si hiciera falta más)
- `@next/bundle-analyzer` para vigilar el bundle en cada cambio.
- `LazyMotion` + `m` de framer-motion (baja a ~4.6 KB) si se quiere exprimir más el JS.
- Servir `stops.json` filtrado por cercanía desde una API en vez de mandar 757 KB al cliente
  (trade-off: pierde la búsqueda instantánea offline).
- Vector tiles en vez de raster (menos datos, más nítido) — cambio mayor.
