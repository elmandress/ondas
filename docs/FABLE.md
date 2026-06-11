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

1. Tests de degradación de proveedores externos (STM caído, Nominatim timeout, Supabase error)
2. Tests E2E de flujos críticos (planificar ruta, abrir parada, instalar PWA)
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
   - **Pendiente**: integrarlo también en `map/panels/StopPanel.tsx` (mismo componente).

2. **PG-3 v1 — detectar, no auto-reemplazar** (`c1e7503`):
   - `scripts/pipeline/validate-gtfs-data.mjs` (npm run validate:data): estructura+umbrales
     de gtfs-v2.json / stops.json / line-hours.json + cruce variantes↔paradas.
   - `scripts/pipeline/check-gtfs-freshness.mjs` (npm run gtfs:freshness): version.txt del
     STM vs `data/gtfs-version.json`; `--save` registra tras regenerar.
   - `.github/workflows/ci.yml`: PRIMER CI del repo (tsc+vitest+eslint+validate en push/PR).
   - `.github/workflows/gtfs-freshness.yml`: cron semanal, abre UN issue si hay GTFS nuevo.
     **Requiere secrets** `MVD_API_CLIENT_ID/SECRET` en GitHub Actions [usuario].

### ⚠ Hallazgo: GTFS desactualizado AHORA

El primer run real del check: STM publicó **20260608**; nuestros datos son del ~2026-06-01.
Regenerar con los pasos del header de `check-gtfs-freshness.mjs` y registrar con `--save`.
`data/gtfs-version.json` queda sin crear a propósito (sin registro = stale = el workflow
lo reclama hasta que se regenere de verdad — honestidad también con nosotros mismos).
