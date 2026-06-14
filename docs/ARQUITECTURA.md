# Arquitectura — Cuándo (app de transporte de Uruguay)

> Fuente de verdad **técnica**. Para QA/riesgos/historial ver [AUDITORIA-MAESTRA.md](AUDITORIA-MAESTRA.md).
> Para deploy/comandos/testing ver [DESARROLLO.md](DESARROLLO.md).
> Última actualización: 2026-06-10.

## 1. Qué es y qué resuelve
PWA mobile-first de transporte público de Uruguay (Montevideo STM + interior). Responde la
pregunta natural **"¿cuándo pasa mi bus?"** con llegadas en tiempo real, ruteo origen-destino,
mapa en vivo y seguridad contextual nocturna. Diferencial: honestidad (no inventa datos),
privacidad (sin trackers de terceros) y SEO de intención (páginas por línea/parada/destino/barrio).

## 2. Stack
- **Next.js 16.2** (App Router, Turbopack) · **React 19** · **TypeScript strict**.
- **Tailwind v4** + design tokens en `globals.css` (tema claro/oscuro).
- **Leaflet** (mapa, dynamic `ssr:false`) sobre tiles **CARTO**.
- **framer-motion** (sheets/transiciones) · **Supabase** (auth + favoritos sync + analytics, degradable).
- **better-sqlite3** solo en build/scripts (NO en runtime serverless — ver §5).
- **vitest** (151 tests, 23 archivos).
- Deploy: **Netlify** (OpenNext). Ver DESARROLLO.md.

## 3. Estructura
```
src/
  app/
    page.tsx              → AppShell (SPA: tabs Inicio/Mapa/Rutas/Buscar)
    layout.tsx            → metadata, JSON-LD sitio, SITE_URL, theme pre-paint
    {linea,parada,lineas,a,barrio,barrios,destinos,desvios}/  → landings SEO (SSG/ISR)
    sitemap.ts, robots.ts
    api/                  → route handlers (runtime nodejs)
  components/
    AppShell · home/ · onboarding/ · ui/ · brand/
    map/                 → MapScreen (orquestador) + LeafletMap + panels/
                           {StopPanel, RoutePanel, PlacePanel, VehicleCard, PinDropPopup}
    route/               → RouteScreen (orquestador) + RouteInputs + PlaceSearch +
                           GtfsRouteCard + HeuristicRouteCard + RouteStates + ServiceAlertsNote
  hooks/                 → useArrivals, useVehicles, useLocation, useServiceAlerts…
  lib/                   → lógica pura/datos (ver §6)
data/                    → datasets (algunos bundled a las functions, otros solo build)
public/                  → datasets servidos al cliente + manifest + sw.js + icons
```

## 4. Flujo de datos (de dónde sale cada cosa)
| Dato | Fuente | Endpoint/lib | Notas |
|------|--------|--------------|-------|
| Llegadas en vivo MVD | API oficial STM (`api.montevideo.gub.uy`, OAuth2) | `/api/stm/arrivals` | filtro de dirección GTFS (no recomienda buses que ya pasaron). ⚠️ **Mezcla vivo + programado en UNA respuesta con fate compartido — ver §10 antes de tocarlo** |
| Buses en vivo (posición) | STM | `/api/stm/vehicles` | filtra por línea/parada |
| Recorridos/paradas de línea | GTFS pre-procesado | `gtfs-v2.json` vía `gtfs-db.ts` | índices precomputados |
| Horarios de operación | GTFS `schedule.db`+`metro-schedule.db` | `line-hours.json` vía `line-hours.ts` | 233/230 líneas; ver §7 |
| Geocoding (lugares/direcciones) | POIs curados + Nominatim + IDE.uy | `/api/geocode` | timeout 6s, degrada a POIs |
| Ruteo O-D | motor propio GTFS | `/api/route/plan` + `route-planner-gtfs.ts` | resuelve 181/183 (§7) |
| GPS interior en vivo | Busmatick (`avl.xml`) | `/api/gps/interior` | Maldonado/Paysandú/Rivera/Rocha |
| Interdepartamental | dataset MTOP | `public/interdept.json` + `/api/interdept` | 420 salidas, 55 destinos |
| Avisos/desvíos | feed Cómo Ir (`notificacion/mensajes`) | `/api/stm/alerts` | sin auth |
| Favoritos/analytics/ocupación | Supabase (degradable) | `lib/supabase`, `occupancy.ts` | RLS; sin PII |

## 5. Decisión arquitectónica clave: GTFS SQLite → JSON
`better-sqlite3` es un módulo **nativo C++** que **falla en Netlify Functions** (binario no
carga). Cuando el GTFS de rutas/recorridos vivía en `gtfs-v2.db`, las paradas/POIs (JSON puro)
andaban en prod pero **las rutas no**. Solución: `scripts/export-gtfs-json.mjs` exporta a
`data/gtfs-v2.json` (3.8MB, índices compactos) que se lee con `fs` → cero módulos nativos en runtime.
- `metro-schedule.db` (32MB) **sí** se bundlea a las functions (horarios suburbanos) y degrada si no carga.
- `schedule.db` (84MB) **no** se sube (demasiado grande); los horarios urbanos ya están en `line-hours.json`.
- Regla: **el runtime serverless NO usa módulos nativos**; todo dato en runtime es JSON leído con fs.

## 6. Módulos `lib/` importantes
- `gtfs-db.ts` — acceso al GTFS JSON (variantes, paradas, secuencias). Server-only.
- `bus-direction-gtfs.ts` — ¿el bus va hacia la parada o ya pasó? (filtro de dirección real).
- `route-planner-gtfs.ts` — motor de ruteo O-D (resuelve continuaciones de línea, §7).
- `line-hours.ts` — ventana operativa por línea/tipo-día (bitsets); `getServiceWindow`.
- `trip-safety.ts` — seguridad contextual nocturna (hora granular, avenidas, taxi por tramo). Puro, testeado.
- `fare.ts` — tarifas (efectivo primero); `occupancy.ts` — crowdsourcing ocupación.
- `jsonld.ts` — serialización segura de JSON-LD (anti-XSS, §AUDITORIA).
- `geo.ts` — haversine unificado (única copia; R51 eliminó las 5 locales restantes).
- `route-area.ts` — clasificación de cobertura/interdept del planificador (pura, testeada).

## 7. Problemas técnicos resueltos (con datos, no suposiciones)
- **181/183 y continuaciones de línea**: una línea que sigue con otro nº/destino se trataba como
  transbordo (3 saltos para 1 bus directo). El motor GTFS detecta la continuación de variante y la
  marca como "seguís en el 183". Diagnóstico original con `scripts/diag-181-183.cjs`.
- **Buses que ya pasaron la parada**: `busTowardsStopGtfs` + `busLikelyPassedStop` proyectan el GPS
  sobre la variante y descartan los que quedaron atrás (no recomienda lo que no va a llegar).
- **Mapa negro**: Leaflet `preferCanvas` clipeaba polylines; fix con `noClip:true` + SVG + `invalidateSize`.
- **Honestidad de horarios**: 157/233 líneas tienen el bitset saturado a 00:00–24:00 (dato dudoso) →
  NO afirmamos "24h"; sólo mostramos ventana en las 73 parciales reales (nocturnas/suburbanas).

## 8. Performance (aplicado)
- Code-splitting por pestaña (Home estático; Mapa/Rutas/Buscar lazy con `dynamic`).
- Service Worker (`public/sw.js`, cache `cuando-v4`): shell+datasets cacheados, `/api/*` nunca
  cacheado, HTML network-first (deploy no rompe), re-fetch al volver online, aviso de nueva versión.
- Polling adaptado a la red (`adaptInterval`): menos frecuente en celular/Data Saver; pausa en background.
- Búsqueda de paradas instantánea (en memoria, `useMemo`); geocoding con debounce.
- Pendiente: medir Lighthouse/CWV reales (requiere deploy HTTPS).

## 9. SEO (ventaja de distribución — Maprab no tiene páginas por entidad)
`/linea/[X]` "¿cuándo pasa el X?" · `/parada/[id]` "¿qué bus pasa por X?" · `/lineas` · `/a/[destino]`
· `/barrio/[x]` · `/destinos` · `/barrios` · `/desvios`. Sitemap ~6.6k URLs, FAQ+Breadcrumb+
BusStop+CollectionPage JSON-LD, OG dinámico por entidad, deep links (`/?linea`, `/?parada`, `/?q`,
`/?ir`, `/?tab`). Detalle de estrategia en AUDITORIA-MAESTRA §SEO.

## 10. Anti-patrón: `/api/stm/arrivals` mezcla vivo + programado con *fate compartido*
**Leé esto antes de tocar `/api/stm/arrivals`.** El endpoint devuelve, en UNA sola respuesta,
las llegadas EN VIVO (API STM, externa, puede caer/tardar) **y** los horarios PROGRAMADOS
(line-hours/GTFS, datos NUESTROS, no dependen del STM). El problema: las dos partes comparten
el **mismo fate** — si la parte viva falla de la forma equivocada, se lleva puesto al
programado, aunque el programado no necesitaba al STM para nada.

Esto ya causó **dos incidentes en prod**:
- **R67 (cache, FASE 0):** otras routes por-query (`geocode`, `walking`, …) con `Cache-Control:
  public` colapsaban en la CDN Durable de Netlify porque `Netlify-Vary` no variaba por la query
  → se servía una respuesta congelada para toda query. Fix: `no-store` por-route. *(arrivals ya
  estaba `no-store`, pero 3 returns vacíos/error no lo tenían → se les agregó.)*
- **R67 (timeout):** `getStopVariants` es un fetch LIVE al STM que corre **primero y serial**
  antes de los `getBuses` + token. En cold start con STM lento, la cadena (4s+3s+4.5s acotados;
  antes 6s+4s+6s) pasaba el límite de función de Netlify (~10s) → 504 → el `catch` que sirve el
  fallback de programados **nunca corría** → "Los servidores del STM están durmiendo" para vivo
  **y** programado a la vez.

**Reglas para no repetirlo:**
1. **Ningún `NextResponse.json` sin `Cache-Control: no-store`** en este endpoint (ni en los empty/error).
2. **La parte viva nunca debe poder colgar la función** por encima del budget de Netlify: timeouts
   STM acotados (ver `lib/stm.ts` getStopVariants, `lib/mvd-api.ts` token+get) y, si se agregan
   llamadas live, mantener la suma serial **bien por debajo de ~10s**.
3. **El fallback a programados tiene que ser alcanzable aunque el live falle/tarde** — vive en el
   `catch`; cualquier refactor debe preservar eso. Cubierto por `tests/arrivals-degradation.test.ts`
   (simula timeout de getStopVariants → exige 200 con `source: schedule-only`).
4. Si en el futuro conviene, **aislar de verdad**: servir programados desde un cómputo local que no
   dependa de ninguna llamada live (idealmente sin pasar por el mismo fetch que el tiempo real).
