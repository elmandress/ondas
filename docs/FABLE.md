# FABLE.md — Contexto Maestro para Claude Fable 5

> Generado por auditoría completa (Claude Sonnet 4.6, 2026-06-10).
> Para arquitectura técnica → ARQUITECTURA.md · QA/historial → AUDITORIA-MAESTRA.md · Operativo → DESARROLLO.md

---

## 0. Cómo leer este documento

Este documento existe para una sola razón: que Fable 5 pueda tomar el proyecto **Cuándo** y llevarlo al siguiente nivel con el menor desperdicio de tokens posible. Está estructurado así:

1. Qué es Fable 5 y cómo usarlo bien
2. Estado actual real (verificado en código)
3. Arquitectura resumida
4. Bugs confirmados + deuda técnica
5. Quick wins (bajo esfuerzo, alto impacto)
6. Proyectos grandes (alto esfuerzo, impacto transformador)
7. Roadmap con orden de ejecución
8. División óptima Sonnet vs Fable
9. Estimaciones de impacto, dificultad y costo de tokens
10. Qué NO hacer

---

## 1. Qué es Fable 5 y Cómo Usarlo Bien

Fable 5 es el modelo de mayor capacidad de Anthropic (junio 2026). Supera a todos sus predecesores en:
- **Codificación a escala industrial**: Stripe migró 50M líneas de Ruby en 24hs. Fable puede refactorizar monolitos completos manteniendo coherencia interna.
- **Contexto masivo**: millones de tokens sin perder foco. Puede leer y razonar sobre toda la base de código de una vez.
- **Multimodalidad**: entiende capturas de pantalla, puede reconstruir UI desde imágenes, puede generar código que produce mapas 3D o simulaciones.
- **One-shot de alta complejidad**: puede generar componentes completos de 500+ líneas con integración correcta a la primera.

**Precio**: $10/M tokens entrada · $50/M tokens salida. Caro. Usar con cabeza.

### Cuándo justifica el costo

- Refactors de monolitos (requiere razonamiento sobre 1000+ líneas sin perder el hilo)
- Diseño de sistemas nuevos con múltiples componentes interconectados
- Generación de features complejas desde cero (asistente conversacional, visualización 3D)
- Auditorías de seguridad o accesibilidad que requieren razonamiento contextual profundo

### Cuándo NO usar Fable

- Fixes de 1-5 líneas (Sonnet)
- Agregar tests siguiendo patrones existentes (Sonnet)
- Actualizar docs (Sonnet)
- Ajustes de CSS puntuales (Sonnet)
- Cualquier tarea con inputs/outputs bien definidos (Sonnet)

### Estrategia para minimizar tokens

> **Preparar el contexto con Sonnet antes de llamar a Fable.** Que Sonnet lea los archivos relevantes, identifique los puntos de cambio exactos (línea N del archivo X), y pase a Fable solo eso — no el repo entero.

---

## 2. Estado Actual Real (verificado 2026-06-10)

### 2.1 Resumen ejecutivo

**Cuándo** es una PWA mobile-first de transporte público de Uruguay (Montevideo STM + interior). La propuesta de valor es honestidad ("no inventamos datos"), privacidad (sin trackers), SEO de intención, y la pregunta que la app responde directamente: "¿cuándo SALIR para llegar a tiempo?".

| Área | Estado | Detalle |
|------|--------|---------|
| Código | ✅ Sólido | TypeScript strict, 0 errores |
| Tests | ✅ 151/151 | 23 archivos de test, todos verdes (R51: +9 route-area) |
| ESLint | 🟡 57 warnings | `setState in effect` (legacy). 0 errores |
| **Deploy** | 🟡 **Verificar** | Commits "ci: trigger Netlify redeploy" indican sitio Netlify conectado. `cuando.uy` NO resuelve aún (falta dominio/DNS + Search Console). Confirmar URL y estado con el usuario. |
| Seguridad | ✅ Bien | XSS (jsonLdHtml), timeouts, localStorage try/catch |
| PWA | ✅ Lista | SW v4, manifest completo, install prompt iOS/Android |
| SEO | ✅ Base lista | 6600 URLs, JSON-LD, OG, sitemap — bloqueado por deploy |
| Accesibilidad | 🟡 Base | WCAG AA texto-3 dark, focus-visible — sin auditar con lector real |
| Tema light | 🟡 Incompleto | Funciona pero sin pasada de contraste AA |

### 2.2 Stack verificado

```
Next.js 16.2 (App Router, Turbopack)
React 19 · TypeScript strict
Tailwind v4 + design tokens en globals.css (tema claro/oscuro)
Leaflet 1.9.4 (mapa, dynamic ssr:false) sobre tiles CARTO
framer-motion 12.40 (sheets/transiciones)
Supabase @supabase/ssr 0.10 (auth + favoritos + analytics — degradable)
better-sqlite3 solo en build/scripts (NO en runtime serverless)
vitest 4.1.7 (142 tests)
Deploy: Netlify + OpenNext (configurado, no ejecutado)
```

### 2.3 Cobertura funcional

| Feature | Estado | Notas |
|---------|--------|-------|
| Llegadas en tiempo real (STM OAuth2) | ✅ | Combina GPS live + horarios por línea |
| Mapa con buses + paradas en vivo | ✅ | Leaflet, interior Busmatick |
| Ruteo O-D (motor GTFS propio) | ✅ | Resuelve 181/183 (continuaciones de línea) |
| Horarios por línea (233 líneas) | ✅ | 157 con bitset completo, 76 con ventana real |
| Interdepartamentales | ✅ | 420 salidas, 55 destinos desde MVD — falta sentido inverso |
| GPS interior (Busmatick) | ✅ | Maldonado/Paysandú/Rivera/Rocha |
| Seguridad contextual nocturna | ✅ | Zonas, hora, taxi por tramo |
| Favoritos + alias "Casa/Trabajo" | ✅ | Sync Supabase degradable → localStorage |
| Crowdsourcing de ocupación | 🟡 | Código listo, SQL no aplicado |
| SEO (6600 URLs SSG/ISR) | ✅ | Sin deploy |
| PWA instalable (Android/iOS) | ✅ | Sin deploy |
| Búsqueda (paradas/líneas/lugares/voz) | ✅ | |
| Compartir ETA + OG dinámica | ✅ | |
| Tema claro/oscuro + texto grande | ✅ | |
| "A pasos también pasan" (paradas vecinas ≤300m) | ✅ | |
| Seguir bus con alerta de bajada | ✅ | Voz opcional |
| Long-press en mapa → elegir punto O-D | ✅ | |

---

## 3. Arquitectura Resumida

```
src/
  app/
    page.tsx             → AppShell (SPA: tabs Home/Mapa/Rutas/Buscar)
    layout.tsx           → metadata, JSON-LD sitio, theme pre-paint sin parpadeo
    linea/[X]/           → SSG/ISR landing "¿cuándo pasa el X?"
    parada/[id]/         → SSG/ISR landing "¿qué pasa por parada X?"
    a/[destino]/         → SSG/ISR "cómo llegar a X" (12 destinos)
    barrio/[x]/          → SSG/ISR "bondis en barrio X" (22 barrios)
    lineas/ barrios/ destinos/ desvios/  → hubs SEO
    api/
      stm/arrivals       → Live + schedule fallback (lógica compleja, bien comentada)
      stm/vehicles       → Posiciones GPS en vivo
      route/plan         → Motor GTFS O-D (con validación)
      geocode            → POIs + Nominatim + IDE.uy (timeout 6s)
      interdept          → Horarios inter-dept estáticos
      gps/interior       → Busmatick (4 deptos)
      occupancy/report   → Crowdsourcing (sin SQL aplicado)
      walking            → OSRM peatonal
  components/
    AppShell.tsx         → SPA shell
    home/HomeScreen.tsx  → Home (paradas cercanas, favoritos, hero "cuándo salir")
    map/MapScreen.tsx    → Mapa completo (~900 líneas — monolito conocido)
    route/RouteScreen.tsx → Planificador O-D (~1200 líneas — monolito conocido)
    home/LeaveNowHero.tsx → Counter "cuándo salir" (feature estrella)
    home/StopArrivalSheet.tsx  → Bottom-sheet de parada completa
    home/LineDetailSheet.tsx   → Detalle de línea (recorrido, empresa, wifi)
    ui/                  → ArrivalRow, LineBadge, EmptyState, Tip, etc.
  lib/
    gtfs-db.ts           → Lee gtfs-v2.json (server-only)
    bus-direction-gtfs.ts → ¿el bus va hacia la parada? (snapshot GTFS)
    route-planner-gtfs.ts → Motor ruteo O-D
    line-hours.ts        → Ventana operativa bitset
    trip-safety.ts       → Seguridad contextual (zonas, hora, taxi)
    mvd-api.ts           → Cliente OAuth2 STM (server-only, con timeout)
    jsonld.ts            → JSON-LD anti-XSS (jsonLdHtml())
    schedule-db.ts       → SQLite horarios (metro-schedule.db)
    stm.ts               → Tipos + STOPS_DATASET + getArrivalsForStop
  hooks/                 → useArrivals, useVehicles, useLocation, etc.
data/                    → GTFS JSON + SQLite (server, bundleados a Netlify Functions)
public/                  → stops.json, routes.json, sw.js, manifest.json, icons
supabase/schema.sql      → Esquema completo PostgreSQL+PostGIS (preparado, no totalmente aplicado)
```

### Decisiones arquitectónicas clave (NO cambiar sin entender el porqué)

1. **GTFS JSON, no SQLite**: `better-sqlite3` falla en Netlify Functions (binario nativo). El GTFS migró a JSON puro. `metro-schedule.db` sigue en SQLite pero degrada si no carga.
2. **Runtime sin módulos nativos**: Todo dato en runtime = JSON via `fs`.
3. **Supabase degradable**: Sin credenciales → localStorage. La app funciona completa offline-first.
4. **API routes como proxy autenticado**: Credenciales STM (OAuth2) nunca salen del servidor.
5. **Arrivals = live + schedule**: siempre hay "próximo" para cada línea aunque no haya GPS en vivo.

---

## 4. Bugs Confirmados + Deuda Técnica

### 4.1 Bugs activos (no todos reproductibles sin deploy)

| ID | Sev | Área | Descripción |
|----|-----|------|-------------|
| MAP-1 | ✅ R51 | Mapa | Layer inactivo de tab solo se ocultaba con `opacity:0` → capas compuestas de Leaflet podían quedar pintadas. Fix: `visibility:hidden` además de opacity en AppShell. |
| MAP-2 | ✅ R51 | Mapa | El bus elegido desaparecía del merge arrivals+vehicles por un ciclo (refrescos desfasados) y la card moría. Fix: se retiene la última posición conocida mientras el seguimiento siga activo (MapScreen). |
| SCH-1 | ALTO | Horarios | "Próximos horarios" puede no aparecer en Netlify si `metro-schedule.db` no carga (módulo nativo) — verificar en prod |
| UI-1 | BAJO | UI | Estilos inconsistentes: colores hardcodeados dark en componentes que no se adaptan al tema light |
| UI-2 | BAJO | UI | Backdrop del sheet no tiene suficiente contraste — se ve el hero detrás |
| INT-1 | MEDIO | Interdept | Falta sentido inverso (interior→MVD) y entre-departamentos |

### 4.2 Deuda técnica en código

| ID | Sev | Descripción | Ubicación |
|----|-----|-------------|-----------|
| DT-1 | ✅ R51 | MapScreen partido: orquestador (~490) + `panels/{StopPanel,RoutePanel,PlacePanel,VehicleCard,PinDropPopup}` | `src/components/map/` |
| DT-2 | ✅ R51 | RouteScreen partido: orquestador (~430) + `RouteInputs,PlaceSearch,GtfsRouteCard,HeuristicRouteCard,RouteStates,ServiceAlertsNote` + `lib/route-area.ts` (testeado) | `src/components/route/` |
| DT-3 | BAJO | 57 warnings ESLint (`setState in effect` legacy) | múltiples |
| DT-4 | MEDIO | Ocupación: SQL no aplicado — crowdsourcing inactivo | `supabase/schema.sql` |
| DT-5 | MEDIO | GTFS actualizado a mano (sin pipeline automático) | `scripts/` |
| DT-6 | BAJO | localStorage sin límite/expiración → puede llenar cuota ~5MB | varios |
| DT-7 | BAJO | `analytics_events`/`occupancy_reports` sin TTL | supabase |
| DT-8 | MEDIO | CSP con `'unsafe-inline'` + `'unsafe-eval'` — requiere nonces | `netlify.toml` |
| DT-9 | ✅ R51 | Haversine deduplicada: 5 copias locales → `lib/geo.ts` (arrivals, walking, useLocation, useInteriorArrivals, useEnrichedRouteLegs, route-area) | |

### 4.3 Gaps de testing (priority order)

1. ✅ R54: degradación cubierta en parte por el smoke E2E de CI (corre SIN credenciales
   STM contra el build real — prueba que la app funciona completa degradada). Falta:
   degradación de Nominatim/Supabase a nivel unit (tests/degradation.test.ts cubre parte).
2. ✅ R54: smoke E2E en CI (`scripts/pipeline/e2e-smoke.mjs`, job `e2e-smoke`): bootea,
   4 tabs, cero pageerrors, gate duro. Falta: flujo completo "planificar ruta" E2E.
3. Tests de API routes con inputs extremos (todos los endpoints, no solo los cubiertos)
4. Tests de accesibilidad (contraste, lector de pantalla)
5. Tests de performance/CWV (requieren deploy)

---

## 5. Quick Wins (Sonnet puede hacer estos)

| ID | Tarea | Impacto | Esfuerzo |
|----|-------|---------|---------|
| QW-1 | Aplicar SQL `occupancy_reports` en Supabase | Alto — activa crowdsourcing | 30min |
| QW-2 | Tema light — pasada contraste WCAG AA | Medio — profesionalismo | 2h |
| QW-3 | Pull-to-refresh en HomeScreen | Medio — UX esperada mobile | 2h |
| QW-4 | Fix unused var `start` en `trip-safety.ts:127` | Bajo — lint | 5min |
| QW-5 | Backdrop del sheet (UI-2) — más opacidad | Bajo — UI | 15min |
| QW-6 | Deduplicar haversine (`distM`) | Bajo — deuda técnica | 30min |
| QW-7 | GTFS data freshness indicator en Settings | Bajo — transparencia | 1h |
| QW-8 | Rate-limit server-side en `/api/occupancy/report` | Medio — confianza | 1h |

---

## 6. Proyectos Grandes (aquí aplica Fable 5)

### PG-0: DEPLOY HTTPS — BLOQUEANTE P0 (NO es tarea de código)
Sin deploy, todo el SEO (6600 URLs), el PWA, el Lighthouse y el TWA valen exactamente 0. El producto no existe para los usuarios. **Fable no puede hacer esto** — es acción manual del usuario en Netlify/GitHub/DNS.

```
Pasos del deploy:
1. Subir repo a GitHub
2. Netlify → Import from GitHub (detecta Next.js solo)
3. Env vars: NEXT_PUBLIC_SITE_URL, STM OAuth2, Supabase keys
4. Dominio cuando.uy → DNS → Netlify
5. Google Search Console → subir sitemap.xml (~6600 URLs)
```

---

### PG-1: Refactor MapScreen (monolito ~900 líneas) [Fable]

MapScreen.tsx mezcla estado global, UI, efectos, lógica de filtro de buses y paneles. Dificulta agregar features.

**Split propuesto:**
```
components/map/
  MapScreen.tsx           → orquestador solo (estado + coordinación)
  panels/StopPanel.tsx    → bottom-sheet de parada
  panels/VehicleCard.tsx  → card del bus seguido + follow alert
  panels/RoutePanel.tsx   → panel de ruta planificada
  panels/PlacePanel.tsx   → panel de lugar buscado
  panels/PinDropPopup.tsx → popup de long-press
  MapCanvas.tsx           → solo LeafletMap + bounds callback
```

**Lo que Fable necesita saber antes de empezar:**
- Hay 5 estados de selección interrelacionados: `selectedStopId`, `selectedVehicleId`, `filterLine`, `selectedRoute` (global), `selectedPlace` (global)
- Los paneles son mutuamente excluyentes — la lógica de `AnimatePresence` es la clave
- `vehiclesForMap` es un merge de 3 fuentes (filteredVehicles + arrivals live + interiorBuses)
- Los hooks `useVehicles` y `useArrivals` son dos llamadas independientes a la API que devuelven sets distintos

**Tests afectados:** No hay tests unitarios de MapScreen (solo tests de la lógica de lib/). El refactor no debe romper los 142 tests existentes.

---

### PG-2: Refactor RouteScreen (monolito ~1200 líneas) [Fable]

RouteScreen.tsx maneja inputs, búsqueda, waypoints, voice input, historial, planificación, resultados y el sheet de parada — todo en un archivo.

**Split propuesto:**
```
components/route/
  RouteScreen.tsx         → orquestador solo
  RouteInputBar.tsx       → inputs desde/hasta/waypoints + swap
  SuggestionList.tsx      → lista de sugerencias con historial
  RouteCandidateCard.tsx  → tarjeta de opción de ruta con ETA en vivo
  WalkingPanel.tsx        → pasos a pie OSRM
  RouteDetailPanel.tsx    → detalle completo de una ruta seleccionada
```

**Lo que Fable necesita saber:**
- `activeInput` puede ser `"from" | "to" | "wp-${number}"` — el search/suggestions es compartido
- Voice input (`useVoiceInput`) popula `query` que dispara sugerencias
- El historial se guarda en localStorage con clave `HISTORY_KEY = "ondas_route_history"`
- `useRoutePlanner` hace la llamada a `/api/route/plan` — no confundir con `planRoutes` (legacy)
- Los waypoints son hasta 3 y se manejan con índices

---

### PG-3: Pipeline GTFS automático [Sonnet/Fable]

Hoy los datos se actualizan a mano. Riesgo operativo: datos viejos sin aviso.

**Propuesta:**
```
.github/workflows/update-gtfs.yml     → cron semanal
scripts/pipeline/
  01-download.mjs      → descarga ZIP GTFS oficial STM + MTOP
  02-validate.mjs      → valida estructura mínima (trips, stops, shapes, calendar)
  03-export-json.mjs   → genera gtfs-v2.json, line-hours.json
  04-diff-report.mjs   → detecta cambios significativos (líneas nuevas/eliminadas)
  05-notify.mjs        → avisa si hay diff > umbral
```

**Lo importante:** Cualquier cambio en `gtfs-v2.json` rompe los tests de ruteo si cambia la estructura de índices. El script de exportación debe mantener compatibilidad con `gtfs-db.ts`.

---

### PG-4: Accesibilidad WCAG AA completa [Fable]

La app tiene la base pero nunca fue auditada con lector de pantalla real.

**Qué falta específicamente:**
- `role="status"` y `aria-live="polite"` para las llegadas en vivo (cuando llegan datos nuevos)
- Textos 11-12px en algunos badges → mínimo 14px para texto normal WCAG AA
- Animaciones de `framer-motion` ya respetan `prefers-reduced-motion` pero Leaflet no
- LeaveNowHero: el contador numérico grande no tiene aria-label contextual ("te quedan X minutos para salir")
- ArrivalRow: el tiempo de llegada (número grande) necesita texto alternativo ("llega en X minutos")
- El tema light tiene colores no verificados contra AA (varios text-slate-400/500 sobre fondos claros)

**Por qué Fable:** Requiere entender el modelo mental de un usuario con discapacidad visual usando una app de transporte en tiempo real, no solo mecánica de aria. Los live regions para datos que cambian cada 15s son delicados.

---

### PG-5: Interdepartamental robusto [Sonnet]

**Dataset oficial disponible:** catalogodatos.gub.uy → MTOP → "Horarios de ómnibus en líneas interdepartamentales" (CSV abierto, ambos sentidos, empresa/origen/destino/horario/paradas).

**Propuesta:**
```
scripts/pipeline/ingest-mtop-interdept.mjs
  → descarga CSV oficial MTOP
  → parsea: empresa, origen, destino, horario salida, paradas intermedias
  → genera public/interdept.json con estructura:
     { salidas: [...], llegadas: [...], entre_deptos: [...] }
```

**UI que necesita cambios:**
- `src/app/api/interdept/route.ts` — agregar soporte para `tipo=llegada` y `tipo=entre_deptos`
- `src/components/home/HomeScreen.tsx` — sección de interdept mostrar también llegadas

---

### PG-6: PWA → Android TWA [Sonnet (ejecución manual)]

Una vez deployado en HTTPS con dominio:
```bash
npx @bubblewrap/cli init --manifest https://cuando.uy/manifest.json
npx @bubblewrap/cli build
# → APK firmado
# Pegar SHA256 del keystore en public/.well-known/assetlinks.json
# Subir a Google Play (US$25 one-time)
```

**Ya preparado:** manifest con `id`/`scope`/`display_override`, `assetlinks.json` (falta el SHA256), SW versionado.

---

### PG-7: Asistente conversacional de movilidad [Fable — proyecto transformador]

Chat integrado donde el usuario pregunta en lenguaje natural sobre el transporte de Montevideo.

**Arquitectura propuesta:**
```typescript
// Sistema de herramientas para el asistente
const tools = [
  {
    name: "plan_route",
    description: "Planifica una ruta de transporte entre dos puntos de Montevideo",
    input_schema: { from: "string", to: "string", depart_at?: "string" }
  },
  {
    name: "get_arrivals",
    description: "Obtiene las próximas llegadas de buses a una parada",
    input_schema: { stopId: "string" }
  },
  {
    name: "search_stop",
    description: "Busca una parada por nombre o dirección",
    input_schema: { query: "string" }
  },
  {
    name: "get_line_info",
    description: "Obtiene información de una línea de bus",
    input_schema: { lineCode: "string" }
  }
]
```

**Por qué Fable:** El diseño del system prompt debe codificar conocimiento geográfico y de transporte uruguayo específico (nombres de barrios, nombres de paradas, abreviaciones de líneas). La integración con las APIs existentes requiere entender el modelo de datos completo.

**Modelo recomendado para el asistente en producción:** Claude Haiku 4.5 (bajo costo, rápido). Fable 5 para el diseño inicial.

---

### PG-8: Visualización 3D / Avanzada [Fable — "WOW factor"]

Usando `deck.gl` + `MapLibre GL JS` (open source, sin costo por tile):

```typescript
// Lo que Fable puede generar en un prompt bien diseñado:
// - Mapa 3D de Montevideo con líneas de bus como arcos animados
// - Buses en movimiento con interpolación GPS suavizada
// - Heatmap de densidad de paradas por zona
// - Vista "explosión temporal": cómo cambia una línea durante el día
// - Extrusión de edificios con OSM Buildings
```

**Costo de tokens Fable:** Muy alto (500K–1.5M). Solo vale para un demo/marketing específico.

**Alternativa de menor costo:** Mejorar el Leaflet actual con:
- Clustering de paradas en zoom bajo (Leaflet.markercluster)
- Animación de buses entre posiciones GPS (interpolación)
- Modo "calor" (heatmap en Leaflet.heat)

---

## 7. Roadmap con Orden de Ejecución

### Fase 0: DEPLOY (semana 1) — No avanzar sin esto
```
[ ] GitHub repo público
[ ] Netlify connect + build
[ ] Env vars (STM, Supabase)
[ ] Dominio cuando.uy + DNS
[ ] Verificar rutas críticas en prod
[ ] Google Search Console + sitemap
```

### Fase 1: Estabilización post-deploy (semana 1–2)
```
[ ] QW-1: SQL occupancy_reports en Supabase
[ ] Lighthouse en prod (CWV, PWA score)
[ ] Verificar SCH-1 (horarios) + MAP-1/2 (mapa) en prod real
[ ] Fix lo que rompa en prod (siempre pasa algo en el primer deploy real)
[ ] QW-5: Backdrop del sheet
```

### Fase 2: Quick wins + crecimiento (semana 2–4)
```
[ ] QW-2: Tema light contraste AA
[ ] QW-3: Pull-to-refresh
[ ] PG-3: Pipeline GTFS automático (datos frescos sin intervención manual)
[ ] PG-5: Interdept inverso (CSV MTOP)
[ ] QW-8: Rate-limit server-side ocupación
[ ] Más páginas SEO: /recorrido/[X], combinaciones
[ ] Validar rich results en Google Search Console
```

### Fase 3: Calidad + distribución (mes 2)
```
[ ] PG-1: Refactor MapScreen (Fable)
[ ] PG-2: Refactor RouteScreen (Fable)
[ ] PG-4: Accesibilidad WCAG AA (Fable)
[ ] PG-6: TWA Android (ejecución tras deploy)
[ ] Tests E2E de flujos críticos
```

### Fase 4: Diferenciación (mes 2–3)
```
[ ] PG-7: Asistente conversacional (Fable — diseño)
[ ] PG-8: Mejora 3D/animación buses (Fable o Sonnet según scope)
[ ] Heatmap de paradas usadas
[ ] "Modo frío" — alternativas proactivas cuando el espera > 15min
[ ] Compartir countdown en tiempo real
```

---

## 8. División Sonnet vs Fable

### Sonnet maneja:
- Cualquier QW-X (fixes puntuales, bien definidos)
- Tests unitarios siguiendo patrones existentes
- Agregar rutas SEO (`/linea`, `/parada`, etc.) — hay plantilla clara
- Pipeline GTFS + interdept inverso (script Node.js bien definido)
- TWA Bubblewrap (ejecución)
- Fixes de lint/TypeScript
- Cualquier ajuste de CSS/UI dentro del design system existente
- Documentación

### Fable justifica el costo para:
1. **Refactor MapScreen + RouteScreen**: los monolitos tienen ~2100 líneas combinadas con estado interconectado. Un error rompe la interacción entre tabs — requiere razonamiento holístico.
2. **Asistente conversacional**: diseño del system prompt, protocolo de herramientas, manejo de ambigüedades geográficas uruguayas.
3. **Accesibilidad profunda**: requiere entender el contexto de transporte en tiempo real + WCAG, no solo poner aria-labels mecánicos.
4. **Visualización 3D completa**: generar integración deck.gl + MapLibre desde cero.
5. **Cualquier feature que requiera modificar 5+ archivos de forma coherente simultáneamente**.

---

## 9. Estimaciones

| Tarea | Impacto | Dificultad | Tokens Fable | Costo aprox |
|-------|---------|-----------|--------------|-------------|
| Deploy | P0 absoluto | Manual | 0 | $0 |
| QW-1 SQL ocupación | Alto | Bajo | 0 (Sonnet) | $0 |
| QW-2–8 | Medio | Bajo | 0 (Sonnet) | $0 |
| Pipeline GTFS | Alto | Medio | 0–50K | $0–2 |
| Interdept inverso | Alto | Medio | 0 (Sonnet) | $0 |
| Refactor MapScreen | Medio | Alto | 150K–300K | $3–8 |
| Refactor RouteScreen | Medio | Alto | 150K–300K | $3–8 |
| Accesibilidad WCAG | Alto | Medio | 80K–150K | $2–5 |
| TWA Android | Medio | Bajo | 0 (Sonnet) | $0 |
| Anti-troll ocupación | Medio | Bajo | 0 (Sonnet) | $0 |
| Asistente conversacional | Muy Alto | Muy alto | 300K–600K | $15–30 |
| Modo 3D completo | Alto (wow) | Muy alto | 500K–1.5M | $25–75 |

**Sprint completo con Fable (todo lo que vale):** ~$50–120

---

## 10. Qué NO hacer

### No hacer con Fable (desperdicio de tokens):
- Fixes de 1–5 líneas
- Agregar tests siguiendo patrones existentes
- Actualizar documentación
- Ajustes CSS puntuales
- Agregar rutas SEO siguiendo el patrón ya establecido
- Debugging iterativo (logs, prueba y error)

### No hacer con el producto:
- **Login STM nativo**: riesgo de credenciales del usuario, ya descartado
- **Scraping de empresas privadas de interdept**: el CSV MTOP las cubre oficialmente
- **Cachear `/api/*` en el SW**: datos en vivo viejos = usuarios que pierden el bus (mentiroso)
- **Capacitor/nativo**: complejidad innecesaria, TWA a $25 cumple el caso de uso
- **`schedule.db` (84MB) en Netlify Functions**: demasiado grande, degrada bien sin él
- **PII en analytics**: violación de la propuesta de valor ("sin trackers")
- **Credenciales STM en cliente**: el proxy server es correcto, nunca cambiar

### No cambiar sin avisar (toca datos o integración externa):
- `gtfs-v2.json` — cualquier cambio de estructura rompe `gtfs-db.ts` + todos los tests de ruteo
- `public/stops.json` — el cliente lo carga entero en memoria en `useStopsDataset`
- `netlify.toml` → `functions.included_files` — si se quita un archivo, la API route falla silenciosamente en prod
- `supabase/schema.sql` → migraciones — siempre avisar al usuario antes de aplicar
- `public/sw.js` → versión CACHE — subir `cuando-v4` a `cuando-v5` invalida todo el cache de todos los usuarios

---

## 11. Oportunidades Descubiertas en Auditoría

### Ventaja competitiva real de Cuándo

1. **"Cuándo SALIR" (no cuándo llega)**: `LeaveNowHero` calcula el momento de salida considerando caminata + buffer de seguridad. Ningún competidor uruguayo hace esto bien.
2. **Seguridad contextual nocturna**: recomienda rutas más seguras de noche. Diferencial único en Uruguay.
3. **SEO de intención local**: `/linea/76`, `/barrio/pocitos`, `/a/tres-cruces`. Una vez deployado, puede dominar las búsquedas locales (Maprab no tiene páginas indexadas).
4. **Honestidad radical**: nunca inventa datos, marca estimados con "~", no recomienda buses que ya pasaron.

### Features que ningún competidor tiene en Uruguay

| Feature | Impacto |
|---------|---------|
| "Cuándo salir" con buffer de caminata | Diferencial core |
| Seguridad contextual nocturna | Diferencial único |
| SEO por entidad (línea/parada/barrio/destino) | Ventaja de distribución |
| Sin ads ni trackers | Confianza + privacidad |
| GPS interior (Maldonado/Paysandú/Rivera/Rocha) | Cobertura nacional |

### Ideas nuevas detectadas en la auditoría

- **"Modo frío"**: cuando el 1er bus tarda >15min, sugerir alternativas cercanas proactivamente (hoy "A pasos también pasan" es reactivo).
- **Tiempo de última milla**: el planificador calcula la caminata al origen pero no avisa si la caminata al destino es larga de noche.
- **Modo terminal/quiosco**: "en los próximos 5min llegan: 76 (2min), 329 (4min), 187 (5min)" — útil para pantallas de paradero o usuarios recurrentes.
- **Compartir countdown real**: "El 76 está a 3 paradas" → link shareable con countdown que expira en 2min.
- **Resumen semanal PWA notification**: "Esta semana llegaste a tiempo X veces" — retención sin PII.

### Tabla competitiva actualizada

| | Ellos mejor | Nosotros mejor |
|---|---|---|
| Maprab | Deployado, crowdsource con volumen, capas satélite | SEO (0 páginas indexadas ellos), honestidad, 181/183, privacidad |
| Moovit | Cobertura mundial, "bajate ahora", base de usuarios | Sin ads, foco UY, datos oficiales, privacidad |
| Google Maps | Confiabilidad, multimodal, familiar | Especificidad UY (interior, empresas), SEO local español, liviano |

**La guerra se gana con SEO.** Una vez deployado, Cuándo puede dominar las búsquedas "cuándo pasa el [línea]", "bondis en [barrio]", "cómo llegar a [destino]" que ningún competidor local cubre bien.

---

## 12. Resumen Ejecutivo para Fable 5

**El producto está bien construido pero no existe para los usuarios.**

- Código: limpio, TypeScript strict, 142 tests verdes, arquitectura sólida
- Bloqueante #1: **deploy HTTPS** (sin esto, todo vale 0)
- Bloqueante #2 (post-deploy): SQL de `occupancy_reports` en Supabase

**Primeras 3 acciones de mayor impacto:**
1. Deploy en Netlify + dominio + Search Console (manual del usuario)
2. Aplicar SQL de occupancy_reports (Sonnet, 30min)
3. Pipeline GTFS automático en GitHub Actions (Sonnet, 2-4h)

**Proyectos que justifican Fable:**
1. Refactor MapScreen + RouteScreen (desbloquea todas las features futuras en mapa/rutas)
2. Asistente conversacional (diferenciador de categoría)
3. Accesibilidad WCAG AA profunda (alcance: adultos mayores, 30% de la población que más usa el transporte)

**Ventaja competitiva sostenible:** honestidad + SEO local + especificidad uruguaya. Todo lo que se construya debe reforzar eso.

> **Orden de lectura recomendado para Fable:** ARQUITECTURA.md → AUDITORIA-MAESTRA.md → este documento → código.

---

## 13. Sesión Fable R51 (2026-06-10) — refactors + bugs + accesibilidad

### Hecho y verificado (tsc 0 · 151/151 tests · build OK · E2E smoke Playwright OK · 57 warnings, antes 59)

1. **PG-1 MapScreen**: 957 → ~490 líneas de orquestador + 5 paneles en `map/panels/`. El estado interconectado (5 selecciones) y el merge de fuentes quedaron en el orquestador; los paneles son presentacionales con props explícitas.
2. **PG-2 RouteScreen**: 1498 → ~430 líneas + 6 componentes hermanos + `lib/route-area.ts` (clasificación de cobertura extraída como lógica pura, **+9 tests**).
3. **MAP-2 fix real**: la card del bus seguido moría cuando el vehicleId desaparecía un ciclo del merge (arrivals/vehicles refrescan desfasados). Ahora se retiene la última posición conocida mientras siga el seguimiento.
4. **MAP-1 hardening**: layers de tabs inactivos ahora llevan `visibility:hidden` (antes solo `opacity:0` — las capas compuestas de Leaflet podían quedar pintadas).
5. **PG-4 accesibilidad (primera pasada)**: live region `role="status"` con el próximo bus en StopPanel y StopArrivalSheet (una línea, polite — no satura con el refresh de 15s); texto sr-only "llega en X minutos" en ArrivalRow; `aria-label` contextual completo en LeaveNowHero ("te quedan X minutos para salir…"); Leaflet respeta `prefers-reduced-motion` (flyTo→setView). **Pendiente**: pasada de contraste AA en tema light, textos 11-12px, prueba con lector real.
6. **DT-9 + QW-4**: haversine deduplicada (5 copias → `lib/geo.ts`), unused var eliminada.

### Deploy: estado observado (2026-06-10)

Hay commits "ci: trigger Netlify redeploy" → el repo está conectado a Netlify (GitHub `elmandress/ondas`). Pero `cuando.uy` **no resuelve** — falta dominio/DNS y Search Console. **Preguntar al usuario la URL de Netlify y verificar las rutas críticas en prod (SCH-1).** El SEO sigue valiendo 0 hasta que haya dominio indexable.

### Evaluación técnica de las ideas grandes (pedida en el brief)

| Idea | Veredicto | Razón técnica |
|------|-----------|---------------|
| **Sistemas proactivos ("Modo frío")** | ✅ HACER YA | Datos ya disponibles (arrivals + paradas vecinas ≤300m ya calculadas en "A pasos también pasan"). Pasar de reactivo a proactivo cuando espera >15min. Esfuerzo bajo, impacto alto, refuerza el diferencial "cuándo salir". |
| **Detección automática de errores GTFS** | ✅ HACER (con PG-3) | Es el paso 02-validate + 04-diff del pipeline ya diseñado. Sin esto los datos envejecen en silencio. |
| **Recomendaciones personalizadas** | ✅ Viable client-side | Heurísticas sobre favoritos + historial local (sin PII, coherente con privacidad). Ej: "a esta hora solés ir a X". |
| **Asistente conversacional (PG-7)** | 🟡 Post-deploy/tracción | Técnicamente viable (tools sobre APIs existentes, Haiku 4.5 en prod). Pero requiere presupuesto de API recurrente y usuarios reales que lo justifiquen. No antes de tener tráfico. |
| **Predicción de demoras** | 🟡 Requiere historial | Necesita recolectar GPS/llegadas durante semanas en servidor (hoy no se persiste nada). Diseñar la recolección primero (Supabase, agregados sin PII), predecir después. |
| **Predicción de saturación** | ❌ Bloqueada | Cold-start del crowdsourcing (decisión R42: no activar sin volumen). Sin datos no hay modelo. Reevaluar con tracción. |
| **Simulador de viaje** | ❌ Redundante | `departAt` (schedule-aware) ya cubre el 80% del valor. |
| **3D / gemelo digital / exploración temporal** | ❌ Por ahora | Wow de marketing, no utilidad diaria. Costo muy alto (deck.gl+MapLibre = reescribir el mapa). La alternativa barata (clustering, animación de buses, Leaflet.heat) da el 70% de la percepción "premium" por 5% del costo. |
| **Heatmaps** | 🟡 Barato con Leaflet.heat | Solo si hay un caso de uso concreto (densidad de paradas no le sirve al usuario final; demanda sí, pero requiere datos que no hay). |
| **Onboarding inteligente** | 🟡 Incremental | El sistema `Tip` (R45) ya es la base correcta. Agregar tips contextuales puntuales, no rehacer. |

**Próximo orden recomendado**: (1) confirmar deploy + dominio + Search Console [usuario], (2) PG-3 pipeline GTFS con validación/diff [Sonnet], (3) "Modo frío" proactivo [Sonnet/Fable], (4) QW-2 contraste light + resto de PG-4 [Sonnet], (5) PG-7 asistente cuando haya tracción [Fable].

---

## 14. Sesión Fable R52 (2026-06-10) — modo frío + PG-3 v1

### Hecho y verificado (tsc 0 · 162/162 tests · build OK)

1. **"Modo frío" proactivo** (`451ffc4`): cuando el primer bus tarda >15 min (o no hay
   servicio), el StopArrivalSheet consulta llegadas EN VIVO de hasta 3 paradas a ≤300 m
   y muestra alternativas alcanzables: "a 120 m el 405 llega en ~6 min (3 min a pie)".
   - `lib/cold-mode.ts` (lógica pura, +11 tests) · `hooks/useColdAlternatives.ts` (fetch,
     cache 60 s por parada, refresh 60 s) · `components/home/ColdModeSuggestion.tsx`.
   - Reglas: solo líneas que NO pasan acá (la misma línea "antes" en parada vecina suele
     ser sentido contrario), solo alcanzables (ETA ≥ caminata con sinuosidad), ahorro ≥5 min.
   - ✅ R53: integrado también en `map/panels/StopPanel.tsx` (mismo componente y reglas).

2. **PG-3 v1 — detectar, no auto-reemplazar** (`c1e7503`):
   - `scripts/pipeline/validate-gtfs-data.mjs` (npm run validate:data): estructura+umbrales
     de gtfs-v2.json / stops.json / line-hours.json + cruce variantes↔paradas.
   - `scripts/pipeline/check-gtfs-freshness.mjs` (npm run gtfs:freshness): version.txt del
     STM vs `data/gtfs-version.json`; `--save` registra tras regenerar.
   - `.github/workflows/ci.yml`: PRIMER CI del repo (tsc+vitest+eslint+validate en push/PR).
   - `.github/workflows/gtfs-freshness.yml`: cron semanal, abre UN issue si hay GTFS nuevo.
     **Requiere secrets** `MVD_API_CLIENT_ID/SECRET` en GitHub Actions [usuario].

### ⚠ Hallazgo: GTFS desactualizado AHORA → ✅ RESUELTO en R53

El primer run real del check: STM publicó **20260608**; nuestros datos eran del ~2026-06-01.

**R53 (2026-06-11, `98d4f06`)**: regeneración completa ejecutada y verificada. El pipeline
quedó completo para actualizaciones de MVD: `download-gtfs.mjs` (01-download OAuth2+zip),
`preserve-metro.mjs` (snapshot/restore del merge "M" sin necesitar tmp_nac/), cadena
build→restore→export→validate, diff vs baseline (0 líneas perdidas), 162/162 tests con los
datos nuevos, build OK. `data/gtfs-version.json` registra 20260608.
**Proceso documentado en el header de `check-gtfs-freshness.mjs`** — la próxima versión
del STM la reclama el workflow semanal y se regenera con esa misma secuencia.

---

## 15. Sesión R54 (2026-06-11) — robustez + análisis competitivo

### Hecho y verificado

1. **QA post-R53**: el SW sirve `stops.json` con stale-while-revalidate → la actualización
   de datos llega sola a usuarios existentes (primera visita refresca en background). Sin regresión.
2. **Smoke E2E en CI** (`9bee05f`): gate duro contra el build de producción real y SIN
   credenciales STM (= prueba de degradación). Cubre los gaps #1/#2 de testing en parte.
3. Lint 59→57 (`c6a0680`): residuos de sesiones previas en tests.

### Análisis competitivo (pedido del usuario: criterio, no lluvia)

Veredicto: **el roadmap actual sigue siendo correcto; PG-5 (interdepartamental completo,
CSV MTOP) es el próximo gran paso** con la mejor relación impacto/esfuerzo:
- Es el ÚNICO espacio donde nadie compite bien (Google: horarios pobres; Moovit: sin
  interdept; Maprab: solo MVD). "ómnibus a Punta del Este / horarios COT" = volumen real.
- Datos oficiales abiertos (catalogodatos.gub.uy MTOP), riesgo bajo, degradable.
- Habilita landings SEO por corredor (`/interdepartamental/montevideo-maldonado`) que
  multiplican la distribución una vez deployado.

**Idea nueva incorporada al backlog** (analizada vs existentes): *horarios offline de
favoritos* — cachear los horarios programados de las paradas favoritas para que sin señal
la app siga respondiendo "cuándo pasa". Ningún competidor lo hace en UY; refuerza PWA +
honestidad. **Bloqueada por SCH-1**: primero verificar en prod que metro-schedule.db
carga en Netlify Functions; sin eso el endpoint de schedule no es confiable. Prioridad:
después de PG-5 y de confirmar deploy.

Descartado por ahora (impacto/esfuerzo peor): push "salí ahora" (requiere HTTPS+infra
push, post-deploy), CSP nonces (DT-8, riesgo de romper el script de tema pre-paint, sin
beneficio visible al usuario), clustering/heatmap del mapa (estética antes que utilidad).

---

## 16. Sesión R55 (2026-06-11) — auditoría visual + inventario de APIs UY

### Auditoría UX multimodal (capturas reales 390px → análisis visual → fix → re-captura)

6 fixes commiteados en `1fda0a5` (hero chips sin destino truncado, picker "Más tarde"
sin guiones nativos, dedup del geocoder por nombre+distancia con `lib/place-dedup.ts`
+8 tests, "Tres Cruces, Tres Cruces", Cancelar recortado, pill "+N").

**Backlog UX** (orden de valor):
- ✅ R56: **muro de íconos del mapa** resuelto — paradas como punto chico a zoom <17,
  ícono-bus completo al acercarse (`LeafletMap.tsx`, `STOP_FULL_ICON_ZOOM`). Verificado.
- ✅ R56: ETA largo en chips del hero → modo `compact` de `formatEta` ("1h+").
- Paradas duplicadas por sentido sin desambiguar en Buscar ("Basilea – Av Juan M
  Ferrari" ×2, #3301/#3302) — agregar pista de dirección (primera línea-destino GTFS).

### Inventario de APIs/fuentes de datos UY (investigación R55)

**En uso** (10): STM OAuth2 (`api.montevideo.gub.uy/api/transportepublico` — buses,
busstopId, GTFS zip+version), `m.montevideo.gub.uy` legacy (variantes, nextETA,
stm-online GPS), avisos (`api.montevideo.gub.uy/notificacion/mensajes`), IDE.uy
(geocode direcciones + intersecciones), Nominatim, OSRM (routing.openstreetmap.de,
foot), shapefile SIT (`intgis.montevideo.gub.uy` v_uptu_lsv), Busmatick interior
(CODESA/Sol Antigua/COPAY/IM Rocha), CARTO tiles, Overpass (build de POIs).

**Confirmadas disponibles, a integrar**:
- **MTOP interdept** (PG-5): dataset oficial en catalogodatos.gub.uy
  ("horarios-de-omnibus-en-lineas-interdepartamentales") con recursos CSV
  nacionales + `horarios_metropolitanos_dnt.csv` + GTFS metropolitano. ESTA es la
  fuente para ambos sentidos + entre departamentos.
- **Recorridos ómnibus suburbanos** (MTOP, catalogodatos) — shapes suburbanos para
  pintar recorridos metro en el mapa.

**Evaluadas y descartadas/limitadas**:
- **Saldo STM**: investigado a fondo en R56. La consulta pública
  (`montevideo.gub.uy/app/stm/beneficios`) es un form **JSF/PrimeFaces** que pide
  tipo+nº de documento (cédula) + código mifare de la tarjeta y responde HTML parcial
  vía POST con `ViewState` por sesión. Proxearlo es frágil (el ViewState/jsessionid
  cambia, se rompe en cada deploy de ellos) y obliga a manejar PII (cédula) en nuestro
  server. La cuenta personal (`stm.gub.uy/app/mistm`) requiere login. **Decisión
  (R56): NO scrapear; la acción "Saldo STM" de Home queda como deep-link oficial.**
  Si el usuario insiste, la vía sostenible sería un WebView a la página oficial (la IM
  maneja sus credenciales), nunca nuestro server intermediando la cédula.
- **Inumet**: catálogo abierto = observaciones horarias (histórico), no pronóstico
  estructurado; las alertas no tienen API limpia. Un hint de lluvia en "cuándo
  salir" requeriría scrapear el JSON interno de la app → frágil. Reevaluar si
  publican pronóstico abierto.

---

## 17. Sesión R57 (2026-06-11) — auditoría detección de buses + 5 fixes de raíz

Queja del usuario: "los ómnibus se marcan mal (detecta los que vienen por otra parada
/ ya pasaron)" + "recorridos desfasados de las paradas". Auditoría con verificación
en vivo encontró 5 causas raíz; TODAS arregladas y verificadas (tsc 0 · 187/187 tests
· build OK · validate:data OK · flota en vivo 502/502 resuelta contra GTFS):

1. **Case-sensitivity entre fuentes** (`lib/line-name.ts` nuevo): el GPS reporta
   "CE1"/"124 SD", el GTFS tiene "Ce1"/"124 Sd", variant_to_line "CE2"/"BT1". El
   lookup exacto dejaba esas líneas SIN filtro de dirección, sin horarios, sin shape
   y sin "Próximo en X min". Canonicalización (`canonLine`) en gtfs-db, schedule-db,
   routes-cache (getShapesForLine), useNextArrivalForLine y lineColorFromCode.
   Medido: 6 buses CE1 circulaban sin filtro; ahora 502/502 resuelven.
2. **trustUpstream mostraba `stop-not-in-route`**: bus de sentido contrario u otro
   ramal que el STM incluía en busstopId se mostraba igual. Ahora se descarta en
   arrivals Y vehicles (la incertidumbre legítima sigue siendo "no-position").
3. **"Ya pasó" por PROYECCIÓN sobre el recorrido** (bus-direction-gtfs reescrito):
   antes snapeaba a la "parada más cercana" (un bus recién pasado seguía "llegando"
   hasta media cuadra de la siguiente; margen ±1 parada del respaldo dejaba mostrar
   buses 2 paradas más allá). Ahora: proyección punto-a-segmento sobre la polilínea
   de paradas, "pasó" = >75m más allá de la target POR EL RECORRIDO (respaldo
   no-snapeado: >120m), distancia restante real por el recorrido, ETA interpolado.
   Caches por variante. +6 tests de regresión con datos GTFS reales.
4. **Shapes desactualizados y SIN generador**: routes.json/line-shapes.json eran del
   01/06 vs GTFS 20260608, y line-shapes.json no tenía script generador. Ahora
   process-routes.js genera AMBOS del mismo feed SIT (`npm run routes:update`), con
   validación de alineamiento (`npm run validate:shapes`, umbral estructural: ~237
   variantes que cruzan a Canelones donde el shapefile IM clipea — eso lo cubre el
   guard del cliente). Regenerado: 834 variantes, 148 líneas completas; TODAS las
   líneas urbanas con shape (las 90 sin shape son metro "M-", esperado).
5. **El mapa dibujaba la shape de OTRA variante**: fallback "primera shape de la
   línea" + `routes[lineName]` (colisionaba nombres numéricos con cod_variantes).
   Ahora LeafletMap fusiona trazo+paradas en un efecto: candidatos = variantCode
   exacto + shapes de la línea, gana la de MENOR maxGap contra las paradas reales,
   acepta solo ≤120m (mismo criterio que useEnrichedRouteLegs) y si no, dibuja la
   polilínea por las paradas (honesto). bus-direction.ts (filtro cliente) ahora
   recibe line-shapes para "¿la línea tiene shape?" sin colisión de keys.

**Estructural conocido (no es bug)**: el shapefile SIT cubre solo Montevideo; las
variantes que siguen a Las Piedras/Canelones (175, L32, L39, G8…) tienen gap >120m
en la cola → el guard las baja a polilínea-por-paradas. Fix futuro: shapes del
dataset MTOP "Recorridos ómnibus suburbanos" (catalogodatos).

---

## 18. Sesión R58 (2026-06-12) — facelift por auditoría visual

Método R55 a fondo: capturas reales 390px del build (dark+light, 10 pantallas,
`scripts/facelift-shots.mjs`) → análisis multimodal → fix → re-captura. Verificado:
tsc 0 · 191/191 tests (4 nuevos de `titleCaseDestination`) · lint 0 errores · build OK
· 0 pageerrors en todas las capturas.

Implementado (todo verificado con re-captura antes/después):
1. **Header del sheet de parada**: las 4 acciones le robaban media pantalla al nombre
   ("Av Gral Garibal…"). Ahora eyebrow+acciones comparten fila y el nombre va debajo a
   todo el ancho (`.head-row`; markup viejo sigue compatible).
2. **`titleCaseDestination()` en `lib/utils.ts`**: destinos del STM en MAYÚSCULAS →
   Title Case rioplatense (conectores en minúscula, siglas UTU/BPS/ANTEL… respetadas,
   texto ya-mixto intacto). Aplicado en ArrivalRow, VehicleCard y LineDetailSheet.
3. **Ocupación colapsada por defecto** (OccupancySection): 4 líneas × 3 botones ocupaban
   media pantalla siempre; ahora es una fila discreta que expande, y se abre sola si hay
   reportes recientes que mostrar.
4. **Cards de ruta**: fuera el "Tocá para ver el paso a paso" repetido (el chevron ya lo
   dice; queda solo "N alternativas cercanas"); `.route-card` con borde más presente y
   12px de aire (antes parecían una lista continua).
5. **Pills de optimización**: "Más rápido"→"Rápida" — las 3 entran en 390px (antes
   "Menos camina…" quedaba cortada y parecía bug).
6. **UI-2 resuelto**: backdrop del sheet 0.74→0.82 + blur 14 (dark) y velo propio más
   liviano en light.
7. **Chip del mapa**: "100 paradas a la vista" 13px bold + hint legible (antes 10px gris).
8. **Buscador**: anillo de foco único (outline global + ring propio = doble anillo).

**Backlog de diseño detectado en R58** → ✅ TODO ejecutado en R58b (mismo día, ver §19).

---

## 19. Sesión R58b (2026-06-12) — basics: jerarquía, AA, desambiguación, interlinking

Ejecutado el backlog completo de R58 + basics nuevos. Verificado: tsc 0 · 191/191 ·
lint 0 errores · build OK (279 páginas) · re-captura dark+light con 0 pageerrors.

1. **Jerarquía de la Home**: orden nuevo = avisos → "¿A dónde querés ir?" → hero
   "cuándo salir" (la estrella, ARRIBA del pliegue) → preview del mapa (contexto,
   compactado 188→150px) → resto. Antes el mapa ocupaba el lugar de honor.
2. **Botón "mi ubicación" del mapa**: EXISTÍA pero estaba en bottom 24px — la misma
   esquina que el zoom de Leaflet, que lo tapaba. Ahora a 152px, visible (+haptic).
3. **QW-2 RESUELTO — pasada AA del tema light, medida** (script de ratios WCAG, no a
   ojo): text-3 3.28→4.60 (#646c7d), accent 2.99→4.58 (#9b5e00), live 3.02→4.66
   (#087a56), warn 4.23→4.70 (#c73127). Nuevo token **`--accent-bg`** (relleno de
   botones con texto oscuro encima) separado de `--accent` (texto sobre fondo): en
   dark coinciden, en light divergen — un solo valor no podía cumplir ambos roles.
   13 usos CSS + 9 inline migrados a `--accent-bg`. Dark ya pasaba todo (verificado).
4. **Deep links tolerantes**: `?tab=` acepta aliases español/inglés (rutas/routes/
   ruta/mapa/buscar/inicio) — antes ?tab=routes fallaba EN SILENCIO.
5. **Interlinking /linea ↔ /barrio**: nueva sección "Barrios por donde pasa" con
   chips-link derivados de las PARADAS REALES de la línea contra los centroides de
   BARRIOS (en build, costo 0 runtime). Ej: /linea/183 → Pocitos · La Blanqueada ·
   Buceo · El Prado · Parque Batlle · Tres Cruces.
6. **Desambiguación de paradas duplicadas en Buscar** (pendiente R55, RESUELTO):
   `scripts/build-stop-dirs.mjs` genera `public/stop-dirs.json` (42KB) con el headsign
   dominante por parada, SOLO para nombres duplicados donde la pista difiere (1.856 de
   6.257 duplicadas). El buscador muestra "#3301 hacia Plaza Independencia" /
   "#3302 hacia Rambla Costanera". Dataset en SW + headers Netlify; paso agregado a la
   secuencia de regeneración GTFS (check-gtfs-freshness.mjs). `npm run data:stop-dirs`.

Notas: sw.js sumó stop-dirs.json a DATASETS sin bump de CACHE (un dataset nuevo se
cachea on-demand; invalidar todo el cache de todos los usuarios no se justifica).

---

## 20. Sesión R58c (2026-06-12) — walkthrough "usuario normal": 2 bugs graves arreglados

Auditoría USANDO la app (flujos interactivos Playwright táctiles, no capturas pasivas).
Verificado: tsc 0 · 195/195 tests (8 nuevos) · lint 0 errores · build OK · back-test y
esquinas verificados en vivo.

### Bug 1 (GRAVE): la búsqueda de esquinas estaba muerta en silencio
Tipeando como usuario: "18 de julio y ejido" (LA esquina de Montevideo) → única
sugerencia: "18 De Julio, **Rocha**" (balneario a 200 km). Causa doble:
- **Overpass (kumi) caído/timeout** → toda resolución de esquinas fallaba silenciosa.
- **matchInteriorCity corría ANTES que la esquina y con prefijo**: la query empieza
  con "18 de Julio" (ciudad de Rocha) → secuestro.
Fix triple en `intersection-search.ts` + `api/geocode`:
1. **`findIntersectionLocal()`**: las 10k paradas SON esquinas reales con coords
   ("Av 18 De Julio Y Ejido") → resolución local instantánea, sin red. Para una app
   de transporte, las esquinas que importan son las que tienen parada.
2. Overpass con **mirrors en orden** (overpass-api.de → kumi) como respaldo.
3. En geocode, **si la query parsea como esquina, la ciudad del interior no aplica**.
4. `STREET_ALIASES`: "propios" → "José Batlle y Ordóñez" (nombres populares).
Verificado en vivo: 18 de Julio y Ejido / Garibaldi y Rivadavia / Av Italia y Propios /
Rivera y Soca → esquina exacta, [intersection], instantáneo. +4 tests de regresión.

### Bug 2 (GRAVE en Android): el botón ATRÁS cerraba la app entera
Ningún sheet/panel pusheaba estado al history → abrías una parada, tocabas atrás
(gesto universal) y te ibas de la app. Nuevo **`hooks/useBackClose.ts`** (pushState
con id propio + popstate que cierra solo el tope de la pila — sheets apilados
cierran de a uno). Cableado en: StopArrivalSheet, LineDetailSheet, SettingsSheet,
SaldoSheet, HowToSheet, RoutesManager y paneles del mapa (MapScreen, un back limpia
la selección). Test en vivo: sheet abierto + back → sheet cerrado, app viva.

### Hallazgos REPORTADOS sin fix → ✅ TODOS resueltos en R58d (ver §21), salvo:
- Cambiar de pestaña no pushea history (back en una pestaña = salir; estándar PWA,
  decisión consciente, reevaluar con feedback real).

---

## 21. Sesión R58d (2026-06-12) — basics de gestos + re-auditoría de generación de datos

Verificado: tsc 0 · 195/195 · lint 0 errores · build OK (279 págs) · drag-to-close
testeado en vivo (swipe-down cierra) · 0 pageerrors.

### Fixes de UX (lo reportado en R58c)
1. **Drag-to-close real**: StopArrivalSheet (touch handlers en zona handle+header,
   >90px suelta y cierra, menos vuelve con la transición) y LineDetailSheet
   (framer `drag="y"`, offset>100 o velocity>600). El handle dejó de ser decorativo.
2. **Pull-to-refresh en Home (QW-3 RESUELTO)**: tirar >55px con el scroll arriba
   refresca las llegadas del hero, con indicador ("Soltá para actualizar" →
   "Actualizando…"). Sin preventDefault — no pelea con el scroll nativo.
3. **Filas de llegadas estables**: las keys eran por ÍNDICE (sheet) y con ETA adentro
   (StopPanel del mapa) → cada refresh de 15-20s REMONTABA filas y la animación de
   entrada parpadeaba. Keys estables por vehicleId; los reordenamientos reales (un bus
   pasa a otro) siguen reflejándose, sin flash.

### Re-auditoría de generación de datos (rutas/horarios/secuencias)
- `build-gtfs-db.mjs` ✓ SÓLIDO: 1 variante por patrón único de paradas (el fix
  histórico anti buses-fantasma), secuencias renumeradas 1..N, arrival_seconds
  absolutos del primer trip del patrón (las DIFERENCIAS que usa el ETA son válidas;
  cruces de medianoche ok). `export-gtfs-json.mjs` ✓ fiel al .db.
- `build-stops-json.mjs` ✓ directo de stops.txt.
- **BUG (familia mayúsculas, arreglado)**: `line-hours.json` hereda keys de
  variant_to_line ("CE2"/"BT1") y los consumidores buscan con grafía GTFS ("Ce2") →
  ventana horaria / "cierra pronto" / filtro horario NUNCA aplicaban a esas líneas.
  `line-hours.ts` ahora canonicaliza keys y lookups (3 puntos).
- Cobertura medida: 139/140 líneas urbanas con horarios (solo falta la 468,
  diferencial sin horario CONOCIDO, fail-open documentado). variant_to_line ídem.

### R58e — re-chequeo "sin inventar" (mismo día)
Confirmado y arreglado: **"A pasos también pasan" comparaba líneas en vivo ("CE1")
contra stops.json ("Ce1")** → la misma línea aparecía como "extra en la parada
vecina" cuando sí pasa acá (lo que el feature promete evitar). Canon en
NearbyAlternatives + pickColdAlternatives (este último solo desalineaba en modo
degradado). Verificados y NO rotos (auditados con evidencia, sin tocar):
detectLastBus (cruce de medianoche bien manejado), route-planner heurístico y
searchStops (comparaciones misma-fuente), layout del sheet post drag-wrapper
(captura), PTR sin pelear con scroll nativo. Quinto y último miembro conocido de
la familia de mayúsculas — barrida completa con
`grep '\.lines\.(filter|includes|some)'` sin pendientes.

### R59 (mismo día) — clean pass #1: color = significado
Principio del spec v2 aplicado donde se violaba: **buses del mapa NEUTROS** (pill
oscura, número blanco; ámbar SOLO el seleccionado — antes cada línea un hue hash
aleatorio = carnaval), **ocupación con dots CSS** (fuera 🟢🟡🔴), fuera el 🎫 de la
tarifa. tsc 0 · build OK.

**R59b (aplicación completa del plan clean):**
- **Emojis funcionales → vectores**: PlaceSearch de Rutas ya no renderiza los emojis
  del geocoder (🏥🛍️ → Icons.Bus/Pin, como Buscar desde R55); nuevo `Icons.Moon`
  reemplaza el 🌙 del sello nocturno. Quedan a propósito: 🏠💼 (atajos personales,
  calidez) y los del texto de ocupación reciente (sin volumen aún).
- **LineBadge 100% neutro**: LeaveNowHero era el ÚNICO lugar que le pasaba el color
  hash por línea — eliminado; la decisión v2 del propio componente rige en toda la UI.
- **Piso tipográfico 11px** (PG-4 "textos 11-12px puntuales" RESUELTO): barrido
  text-[9px]/text-[10px]/text-[10.5px] → text-[11px] en 10 componentes + inline
  font-size de tooltips del mapa. Excepción consciente: el número de línea DENTRO de
  la pill del bus en el mapa (glifo de marcador, no texto de lectura).
- Verificado: tsc 0 · 195/195 · build OK (279 págs).
**R59c (cierre del plan clean — con baseline→cambio→re-captura):**
- **Tamaños "a medias" eliminados** en globals.css: 10.5/11.5/12.5/13.5/14.5px →
  escala entera {11..17} (9 ocurrencias; chips/pills/subtítulos ahora comparten paso).
  Queda 15.5px solo en modo texto-grande (escala de accesibilidad, intencional).
- **Dieta de bordes — doble codificación fuera**: los banners/notas con fondo TINTADO
  ya no llevan borde además (urgent-banner, home-alerts, safe-badge, cont-note,
  metro-note, occ-section, nearby-alt). Regla: el fondo separa; el borde queda para
  interactivos e identidad (cards de ruta, line-badge, inputs). globals 51→47 bordes.
- Verificado con re-captura (parada/home/rutas): más sereno, nada roto. tsc 0 ·
  195/195 · lint 0 errores · build OK.
- ~~Observado 1 vez: ?ir= con "Desde" sin llenar~~ → R59d: 4/4 corridas frescas OK,
  flake del headless confirmado, no es bug.

### R59d — re-chequeo con server: BUG REAL en sheets apilados + back (RESUELTO)
Cacería sistemática pedida por el usuario ("seguro pasa varias veces"). Encontrado
con probes de DOM: **parada → detalle de línea → back cerraba LOS DOS sheets** (y
desmontaba la página entera, instantáneo — no animación). Diagnóstico por
instrumentación del history: los deep links hacían `replaceState(null, …)` para
limpiar la URL → **el null borraba los internals del App Router** (__NA,
__PRIVATE_NEXTJS_INTERNALS_TREE) del entry base → al hacer back a un entry sin
árbol, Next "restauraba" remontando toda la página (perdía sheets, tab, todo).
Fixes:
1. `replaceState(window.history.state, …)` en los 3 deep-link cleanups (AppShell ×2,
   HomeScreen) — preservar SIEMPRE los internals de Next al limpiar la URL.
2. `useBackClose` v3: pila propia de closers (no depende de history.state, que Next
   muta) + listener global en captura + pushState que preserva el state del router.
Verificado E2E: back1 cierra SOLO el detalle (parada sigue), back2 cierra la parada,
back3 sería salir (correcto); cerrar con ✕ no deja back fantasma; 195/195 · tsc 0 ·
lint 0 errores · build OK.
**Regla nueva del proyecto**: NUNCA `replaceState(null, …)` — siempre preservar
`window.history.state` (los internals del router viven ahí).

---

## 21. Sesión R60–R61 (2026-06-12) — horarios vivos en prod, trackeo, diferencial

### R60 — los "próximos horarios" estaban MUERTOS en producción (causa raíz)
schedule.db (84MB, no se subía) + metro-schedule.db (better-sqlite3, módulo nativo
que no carga en Netlify Functions) → pager, schedule-completion, "último del día" y
horarios metro daban vacío EN PROD (andaban en local, por eso no se veía).
- `scripts/pipeline/export-schedules-json.mjs`: 3.0M horarios → `data/sched/shard-*.json`
  (32 shards, 14.3MB vs 116MB SQLite, 0 perdidos). Línea CANÓNICA, urbano+metro juntos.
- `schedule-db.ts` reescrito 100% JSON, lazy por shard (hash de stopId). Cero nativo.
- netlify.toml: `data/sched/*.json` bundleado, fuera `external_node_modules`.
- **Regla cerrada**: TODO dato en runtime = JSON. Era la última excepción (SQLite).

### R60 — el bus seguido moría al pasar tu parada
El filtro upstream descartaba el vehículo seguido como "passed" → la card del
seguimiento quedaba congelada justo cuando importa (cuándo bajarte). Param `keep=`
en /api/stm/vehicles exime al vehicleId seguido del descarte; cableado en MapScreen.

### R61 — el diferencial, donde más importa
- **Siguiente horario inline**: filas programadas muestran "· luego 23:36" (patrón
  Transit: tras ver un horario, la pregunta es "¿y el de después?").
- **"Salí en X" en el paso a paso**: la app se llama Cuándo y promete "te decimos
  cuándo SALIR", pero el trip detail no lo decía. Banner prominente arriba del viaje
  ("Salí en 6 min / Salí ahora", color de urgencia). Comparte cache con el timeline
  → cero red extra. Solo modo "salí ahora".

### Análisis competitivo (qué hace cada uno mejor, qué falta)
- **Transit**: horario = ciudadano de 1ª (offline, instantáneo) + "GO" (navegación
  paso a paso en vivo durante el viaje, avisa cuándo bajar). Cuándo ya tiene "seguir
  bus" + alerta de bajada; falta el modo "GO" como pantalla dedicada de viaje activo.
- **Citymapper**: "rain safe", múltiples modos (bici/scooter), diferenciación clara de
  opciones. Cuándo gana en foco UY pero no tiene multimodal (no aplica acá aún).
- **Moovit/Google**: confiabilidad y escala. Cuándo gana en SEO local + honestidad +
  interior, pierde en volumen de crowdsourcing.

### Próximas ideas priorizadas (impacto/esfuerzo)
1. **Caminata al destino de noche** [alto/bajo]: el planner avisa de la caminata al
   ORIGEN pero no de la del destino si es larga y de noche (seguridad = diferencial).
   `trip-safety` ya tiene la lógica; falta cablearla al último walk leg.
2. **Modo "GO" / viaje activo** [alto/medio]: pantalla dedicada durante el viaje con
   el countdown de bajada — robar lo mejor de Transit. Ya existe seguir-bus, faltaría
   elevarlo a una vista de viaje.
3. **"Salí en X" también en el resumen colapsado** [medio/bajo]: hoy solo expandido;
   en colapsado costaría 1 fetch por card (cacheado 25s). Evaluar si vale.
4. **Pull-to-refresh en parada/rutas** [medio/bajo]: ya está en Home (R58d), faltan las
   otras pantallas con datos en vivo.

---

## 22. Sesión R62 (2026-06-12) — BUG GRAVE de horarios + seguridad nocturna visible + scrape

### El bug más grande de toda la serie: schedule.db urbano era HHMM, no minutos
Auditoría profunda (el usuario: "siempre hay algo mal"). El campo `hora` de schedule.db
(2.25M filas urbanas) guarda **HHMM** (607=6:07, 1320=13:20) — prueba estadística: CERO
filas con `(hora%100)>59` (si fueran minutos, ~40% las tendrían). metro-schedule.db SÍ son
minutos (317k filas con %100>59). El motor leía todo como minutos →
- Un viaje de 14:07 (HHMM 1407) se mostraba como "23:27" en el pager/próximos.
- `build-line-hours.js` (mismo bug): **67% de líneas (157/233) parecían operar "24h"** —
  era el scramble HHMM, no servicio real. Por eso el ruteo podía sugerir una nocturna a
  las 14h. (Esto era el "157 saturadas, dato dudoso" que FABLE notaba sin saber la causa.)

**Fix en la fuente única** (no parches): `export-schedules-json` convierte HHMM→min
(urbano) y normaliza metro; `build-line-hours.js` idem; runtime con wrap de medianoche
(a las 23:55 aparece el viaje de 00:15). Regenerados shards (13.4MB) + line-hours.
Resultado medido: saturación falsa **67% → 14%** (198 líneas con ventana real ahora, eran
73). Verificado en vivo: pager del 187 muestra 00:01 + hueco nocturno real hasta 05:37.

**Lección**: cada fuente de datos UY tiene su propia convención silenciosa. Antes de
confiar en un campo numérico de tiempo, verificar el encoding con `(v%100)>59`.

### R62 — seguridad nocturna VISIBLE al elegir (diferencial único en UY)
`assessTripSafety` ya evaluaba la caminata al destino, pero el aviso vivía enterrado en
el taxi-por-tramo del detalle expandido. Nuevo chip en el RESUMEN de cada ruta ("caminás
N m de noche · zona poco transitada") → comparás seguridad antes de elegir, no abriendo
cada una. Solo de noche (de día assess da level "none"). +2 tests congelan el contrato.

### Scrape MTOP interdepartamental (PG-5) — pipeline listo para correr
`scripts/pipeline/ingest-mtop-interdept.mjs`: CKAN package_show → descarga CSVs →
descubre el esquema real (columnas + muestra). NO lo corre el agente: los .gub.uy usan CA
de AGESIC que Node no trae → requiere `NODE_TLS_REJECT_UNAUTHORIZED=0` (solo build) con OK
del usuario. 1ª corrida = descubrimiento; con las columnas reales se finaliza el transform
a public/interdept.json (salidas + llegadas + entre_deptos). Es el único espacio sin
competencia buena (Google/Moovit flojos en interdept).

---

## 23. Sesión R62b (2026-06-13) — capitalizar el fix de horarios + limpieza

Con `line-hours.json` ya correcto (R62), se desbloqueó valor real:
- **getMainServiceWindow()**: bloque contiguo de servicio (no el span primer-último).
  La 187 pasó de oculta ("00:00-24:00" dudoso) a "~05:15-24:00 (+ algún trasnoche)".
  ~100 líneas ganan horario honesto en su landing /linea. +2 tests.
- **SEO**: la meta description de /linea incluye el horario real ("Días hábiles ~05:15
  a 24:00") → responde "a qué hora pasa el primer 187" en el snippet de Google (CTR).
- **Limpieza de íconos** (un solo sistema): fuera 🎫 del detalle de tarifa; pin de lugar
  del mapa = punto blanco limpio; PlacePanel = vector de marca (no emoji del geocoder).

### Próximo paso de MAYOR valor (no hecho — requiere tocar /api/stm/arrivals con cuidado)
**"No corre ahora · vuelve ~05:15"** en el sheet de parada: hoy una línea fuera de
servicio simplemente no aparece → el usuario no sabe si la app falló o si el bus no
pasa. Con line-hours ya correcto, se puede mostrar la línea muteada con su hora de
retorno. Es el diferencial "honestidad" llevado al caso nocturno. Dejarlo para una
sesión dedicada (el endpoint de arrivals es central; no apurarlo).

### Estado de datos tras R60-R62 (todo verificado)
- Horarios: 3M en JSON shards, encoding HHMM/min resuelto, wrap de medianoche. ✓
- line-hours: saturación falsa 67%→14%, 198 líneas con ventana real. ✓
- Detección de buses: canon de líneas, proyección "ya pasó", filtro horario correcto. ✓
- El bus seguido no muere al pasar la parada. ✓

---

## 24. Sesión R63 (2026-06-13) — investigación competitiva, auditoría, simplificación

### Investigación de competidores y fuentes de datos (web, a fondo)
- **No existe GTFS-realtime público para Montevideo.** El API oficial
  (api.montevideo.gub.uy/apidocs) expone SOLO 2 servicios: transporte público (buses +
  busstopId + upcomingbuses + GTFS estático — lo que Cuándo YA usa entero) y playas.
  No hay feed estándar de vehicle-positions/trip-updates/alerts que tomar.
- **catalogodatos.gub.uy** (interdept CSV, PG-5) tiene cert auto-firmado (AGESIC) que
  rompe TODO fetch automático, incluso WebFetch server-side. El dato es público pero la
  automatización requiere el CA de AGESIC o bajada manual. No bloqueante.
- **Maprab** (principal competidor UY): paridad de features de ruteo con Cuándo
  (origen/destino, 3 paradas, optimizar rápido/transbordos/caminata, salir ya). Los
  diferenciales de Cuándo se sostienen: "cuándo SALIR", seguridad nocturna, honestidad,
  SEO por entidad, GPS interior. Conclusión: Cuándo ya está sobre la mejor data disponible.

### Auditoría del motor de horarios (post-fix HHMM) — SIN bugs
Verificado en vivo a las 10:38 sábado contra los shards: 4D eta 3, 2A eta 16 coinciden
exacto. El fix HHMM es correcto en todos los tipos de día (un falso positivo inicial fue
mi probe usando tipo 1 en sábado). Nota menor aceptada: un programado que salió hace
≤2 min se muestra "ahora" (tolerancia de reconciliación con vivo).

### Diseño — simplificación
El selector de fuente del hero ("Estás acá") solo aparece con 2+ paradas. Con una sola,
"Estás acá" se repetía 3 veces (label + pill + dentro del hero) → ahora una sola vez.

---

## 25. Sesión R64 (2026-06-13) — rediseño visual + "no corre ahora" (mayor próximo paso)

### Rediseño a nivel design-tokens (cascada a toda la app)
- **Fondo neutro near-black** (#0a0b0f) en vez del azul (#070b14) → el ámbar (marca)
  resalta más; se siente premium, no "utilitario genérico".
- **Radios más generosos** (card 14→18, lg 18→24, chip 10→12) → look de app moderna.
- **Sombras más suaves y amplias**; **ámbar un punto más vivo** (#f5a623) + token
  `--accent-grad` para superficies firma. Glow del hero más presente.
- **Bottom nav**: estado activo = pastilla ámbar suave detrás del ícono + micro-scale
  (patrón contemporáneo) en vez de la barrita.
- **Home**: el selector de fuente del hero solo con 2+ paradas (antes "Estás acá" ×3).

### "No corre ahora · vuelve ~05:15" — el mayor próximo paso (HECHO)
Honestidad llevada al caso nocturno: una línea de la parada sin llegada ya no se OMITE
(¿falló la app o no pasa el bus?) — se muestra muteada con su retorno.
- `arrivals` route: campo aditivo `inactiveLines` (línea + resumesHHMM + resumesInMin).
- **Guard de honestidad CLAVE** (bug del 1er intento, corregido): solo se marca inactiva
  si la línea GENUINAMENTE no opera ahora según `getLineHoursLookup().operatesNowOrSoon`
  (bitset agregado, más completo que el horario sparse por-parada). Sin el guard, una
  línea que SÍ corre pero sin bus cerca + dato puntual faltante mostraba "vuelve 20:00"
  = mentira. Verificado: 187/102/148 (corren todo el día) YA NO aparecen; solo 106/133
  (tardías reales) y 495 (nocturna) → su hora de retorno real.
- Threaded aditivo por useArrivals (sin tocar el array `arrivals`) → StopArrivalSheet
  renderiza sección muteada "No están pasando ahora".

tsc 0 · 199/199 · build OK · verificado en vivo (parada 4769: 106→00:51, 133→01:11).

### Investigación web (R63) — conclusión
No hay GTFS-realtime público para MVD; Cuándo ya usa la única fuente oficial. Maprab a
paridad de ruteo. La ventaja se gana con SEO + diferenciales (cuándo salir, seguridad
nocturna, honestidad), no con más datos.
