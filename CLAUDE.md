@AGENTS.md

# CLAUDE.md — Cuándo · Entorno Operativo Definitivo

> ⚠️ Leer también @AGENTS.md antes de tocar Next.js internals.
> Fuente de verdad para Claude Code. Leer completo al inicio de cada sesión.
> El proyecto vive en `D:\comoire\ondas` — NO en `D:\comoire` (otro repo).
> Última actualización: 2026-06-13

---

## 1. IDENTIDAD DEL PRODUCTO

**Cuándo** es una PWA mobile-first que responde una sola pregunta: **"¿cuándo tengo que salir para tomar el bus?"**

El diferencial real no es features — es honestidad. No inventamos datos. No mostramos buses fantasma. No hacemos afirmaciones que no podemos sostener. Eso es lo que nos diferencia de Cómo Ir (2.9⭐), Moovit (ads invasivos) y Cutcsa gOOva (ignora el 75% del sistema).

**Posición de mercado:**
- Cómo Ir: servidores inestables, se cuelga al minimizar, no actualiza en vivo
- Moovit: tiempo real detrás de paywall, publicidad invasiva
- Maprab/STM Matungos: 0 páginas SEO por entidad, menú poco intuitivo
- Cutcsa gOOva: ignora Coetc, Ucot, Comesa + todo el suburbano
- **Nadie** resuelve el trayecto Montevideo↔Canelones/Maldonado en una interfaz

**Nuestros diferenciales concretos:**
- Sin trackers de terceros
- SEO de intención: 6,600 URLs por línea, parada, destino, barrio
- Ruteo honesto: el 181 que sigue como 183 no es un transbordo, es el mismo bus
- Estimados marcados con `~`, nunca afirmaciones falsas
- GPS interior: Maldonado, Paysandú, Rivera, Rocha (Busmatick)

---

## 2. STACK — VERSIONES EXACTAS, SIN AMBIGÜEDAD

```
Next.js 16.2 — App Router, Turbopack
React 19
TypeScript strict (0 errores, siempre)
Tailwind v4 + design tokens en globals.css (tema claro/oscuro)
Leaflet 1.9.4 — mapa, dynamic() con ssr:false, tiles CARTO
framer-motion — sheets y transiciones de estado (no decorativo)
Supabase — auth + favoritos + analytics, DEGRADABLE
vitest — 151 tests, 23 archivos
Deploy: Netlify via OpenNext
```

---

## 3. ⛔ CONSTRAINT CRÍTICA — REGLA DE ORO DEL RUNTIME

`better-sqlite3` es un módulo **C++ nativo que ROMPE en Netlify Functions**.
El binario no carga en el entorno serverless. Esto destruyó las rutas en producción.

**Regla absoluta:**
- `better-sqlite3` = **SOLO en `scripts/` y `data/`** (build time). NUNCA en `src/`
- Todo dato que el runtime necesita = **JSON leído con `fs`** — sin módulos nativos
- `metro-schedule.db` (32MB) SÍ se bundlea a las functions (horarios suburbanos, degrada si no carga)
- `schedule.db` (84MB) NO se sube — demasiado grande; horarios urbanos en `line-hours.json`

**Si necesitás datos de SQLite en runtime:**
Exportalos a JSON con un script en `scripts/` (igual que `scripts/export-gtfs-json.mjs` → `data/gtfs-v2.json`, 3.8MB).

**Check rápido antes de subir:**
```bash
grep -r "better-sqlite3" src/
# Si devuelve algo, hay un problema
```

---

## 4. ESTRUCTURA DE DIRECTORIOS

```
D:\comoire\ondas\
  src/
    app/
      page.tsx                  → AppShell (SPA: tabs Inicio/Mapa/Rutas/Buscar)
      layout.tsx                → metadata, JSON-LD sitio, SITE_URL, theme pre-paint
      linea/[x]/page.tsx        → "¿cuándo pasa el X?" (SSG)
      parada/[id]/page.tsx      → "¿qué bus pasa por X?" (SSG)
      a/[destino]/page.tsx      → "cómo llegar a X" (ISR)
      barrio/[x]/page.tsx       → "bondis en X" (SSG)
      lineas/page.tsx           → hub de líneas
      barrios/page.tsx          → hub de barrios
      destinos/page.tsx         → hub de destinos
      desvios/page.tsx          → avisos de desvíos
      sitemap.ts, robots.ts
      api/                      → route handlers (runtime nodejs)
        stm/arrivals/route.ts   → llegadas en vivo
        stm/vehicles/route.ts   → posición de buses
        stm/alerts/route.ts     → desvíos (sin auth)
        geocode/route.ts        → geocoding (Nominatim + POIs)
        route/plan/route.ts     → planificador O-D
        gps/interior/route.ts   → Busmatick (Maldonado/Paysandú/Rivera/Rocha)
        interdept/route.ts      → servicios interdepartamentales
    components/
      AppShell.tsx
      home/                     → hero, preview mapa, big-action, secciones
      onboarding/               → componente Tip, microayuda primera vez
      ui/                       → componentes reutilizables
      brand/                    → identidad visual
      map/
        MapScreen.tsx           → orquestador del mapa
        LeafletMap.tsx          → mapa Leaflet
        panels/
          StopPanel.tsx
          RoutePanel.tsx
          PlacePanel.tsx
          VehicleCard.tsx
          PinDropPopup.tsx
      route/
        RouteScreen.tsx         → orquestador (~469 líneas; partido en sub-componentes R51)
        RouteInputs.tsx
        PlaceSearch.tsx
        GtfsRouteCard.tsx
        HeuristicRouteCard.tsx
        RouteStates.tsx
        ServiceAlertsNote.tsx
    hooks/
      useArrivals.ts
      useVehicles.ts
      useLocation.ts
      useServiceAlerts.ts
    lib/                        → lógica pura / datos (ver §6)
  data/                         → datasets (algunos bundled, otros solo build)
  public/                       → datasets servidos al cliente + manifest + sw.js + icons
  scripts/                      → build-time only — NO importar desde src/
  tests/                        → vitest (151 tests)
  supabase/schema.sql
  netlify.toml
```

---

## 5. FLUJO DE DATOS — DE DÓNDE SALE CADA COSA

| Dato | Fuente | Endpoint / Módulo | Notas críticas |
|------|--------|--------------------|----------------|
| Llegadas en vivo MVD | API STM (OAuth2) | `/api/stm/arrivals` | Filtra dirección GTFS — no recomienda buses que ya pasaron |
| Posición buses | STM | `/api/stm/vehicles` | Filtra por línea/parada |
| Recorridos/paradas de línea | GTFS pre-procesado | `gtfs-v2.json` via `gtfs-db.ts` | JSON puro, índices precomputados — **sin SQLite** |
| Horarios de operación | GTFS schedule | `line-hours.json` via `line-hours.ts` | 233/230 líneas; metro-schedule.db bundleado |
| Geocoding | POIs curados + Nominatim + IDE.uy | `/api/geocode` | Timeout 6s (`AbortSignal.timeout`); degrada a POIs |
| Ruteo O-D | Motor propio GTFS | `/api/route/plan` + `route-planner-gtfs.ts` | Resuelve 181/183 — detecta continuaciones de variante |
| GPS interior | Busmatick (`avl.xml`) | `/api/gps/interior` | Maldonado/Paysandú/Rivera/Rocha |
| Interdepartamental | Dataset MTOP | `public/interdept.json` + `/api/interdept` | 420 salidas, 55 destinos, 35 empresas |
| Avisos/desvíos | Feed Cómo Ir | `/api/stm/alerts` | Sin auth |
| Favoritos/analytics/ocupación | Supabase | `lib/supabase`, `occupancy.ts` | RLS; sin PII; la app funciona sin Supabase |

---

## 6. MÓDULOS `lib/` — CONTRATOS QUE NO SE ROMPEN

| Módulo | Qué hace | Regla |
|--------|----------|-------|
| `gtfs-db.ts` | Acceso al GTFS JSON (variantes, paradas, secuencias) | **Server-only** — no importar en client components |
| `bus-direction-gtfs.ts` | ¿El bus va hacia la parada o ya pasó? (`busTowardsStopGtfs`, `busLikelyPassedStop`) | Core de la honestidad — no simplificar |
| `bus-direction-interior.ts` | Espejo de honestidad para el INTERIOR (Busmatick, sin GTFS): navega `interior-edges` (BFS p1c→target), 3 capas (approaching/nearby/in-zone) | `AVG_SECONDS_PER_HOP=90` SIN VALIDAR → ETA siempre `~`. `delayMin` no es ETA (sin baseline). v1 Maldonado |
| `route-planner-gtfs.ts` | Motor de ruteo O-D | Detecta continuaciones de línea (181→183 es el mismo bus) |
| `line-hours.ts` | Ventana operativa por línea/tipo-día (bitsets) | 43/233 líneas tienen el bloque operativo principal ≥22h (≈24h) → dato dudoso (24 con 24h literal); medido 2026-06-17 → **no afirmar "24h"** para esas |
| `trip-safety.ts` | Seguridad contextual nocturna | Puro, testeado. Hora granular + avenidas + taxi por tramo |
| `fare.ts` | Tarifas STM | Efectivo primero en la UI |
| `occupancy.ts` | Crowdsourcing de ocupación | Código listo; SQL pendiente de aplicar en Supabase |
| `jsonld.ts` | JSON-LD serialización segura | **SIEMPRE** usar `jsonLdHtml()` — nunca `JSON.stringify` directo (SEC-1) |
| `geo.ts` | Haversine unificado | **ÚNICA copia**. No crear instancias locales (DT-9 ya corregido) |
| `route-area.ts` | Clasificación de cobertura del planificador | Pura, testeada (9 tests en `mvd-area.test.ts`) |
| `mvd-area.ts` | Validación de coordenadas MVD | `isValidMvdCoord`: usar `Number.isFinite` — `typeof === 'number'` deja pasar NaN |

---

## 7. DEFINITION OF DONE — NO NEGOCIABLE

Antes de cualquier commit o declarar una tarea terminada:

```bash
# Desde D:\comoire\ondas
npx tsc --noEmit          # → 0 errores (siempre)
npx eslint src/           # → 0 errores (57 warnings legacy son OK, no agregar nuevos)
npx vitest run            # → todos verdes (actualmente 151/151)
npm run build             # → build de producción exitoso
```

Para cambios en `lib/` o `api/`, verificar en prod local:
```bash
PORT=3100 npm start
# Probar el flujo afectado con curl o navegador
```

Si `vitest run` falla ANTES de tu cambio → documentar el fallo previo en AUDITORIA-MAESTRA.md antes de continuar.

---

## 8. SISTEMA DE DISEÑO FRONTEND

### Principios de identidad visual
- **Identidad oscura**: el tema dark es la cara pública de la marca. El tema light existe pero está pendiente de pasada de contraste AA.
- **Un elemento memorable por pantalla**: la firma de la app es el contador "¿cuándo salir?". Todo lo demás es soporte, no protagonista.
- **Sin genéricos**: no usar la paleta "cream + serif terracotta" (cliché de IA), no usar el esquema "near-black + acid-green" sin justificación específica para este producto. Las elecciones se justifican para Cuándo, no para cualquier app.
- **El material del diseño es la ciudad**: las cuadrículas de Montevideo, los colores del STM, la tipografía de los recorridos de bus — eso define la estética, no las tendencias de Dribbble.
- **Estructura es información**: numeración solo si hay secuencia real. Dividers solo si hay cambio real de contexto.

### Reglas técnicas
- **Design tokens** en `globals.css` — no hardcodear colores ni espaciado
- **Tailwind v4** — no usar clases arbitrarias sin justificación documentada
- **Touch targets**: mínimo 44×44px en todo elemento interactivo
- **focus-visible**: siempre definido (accesibilidad de teclado)
- **prefers-reduced-motion**: respetar en TODAS las animaciones
- **framer-motion**: solo donde la animación aporta contexto (sheets que aparecen, estados que transicionan). No decorar sin razón — "menos animación" es mejor que "más animación por el solo hecho de verse moderno"
- **Leaflet**: `dynamic()` con `ssr:false`. Fix mapa negro: `preferCanvas:false`, `noClip:true`, modo SVG, `invalidateSize()` al montar
- **localStorage.setItem**: SIEMPRE en try/catch (quota llena + Safari privado → throw sin catch = acción silenciosa que no se guarda)
- **JSON-LD**: SIEMPRE via `jsonLdHtml()` de `lib/jsonld.ts` — nunca `JSON.stringify` en `<script type="ld+json">` (XSS: un valor con `</script>` rompe el bloque)

### Escritura en la UI (español rioplatense)
- Voz activa: "Buscar ruta" nunca "Búsqueda iniciada"
- El botón dice exactamente qué pasa al tocarlo
- La acción y el resultado tienen el mismo nombre: el botón dice "Guardar" → el toast dice "Guardado"
- Errores: explican qué pasó y cómo resolverlo. Nunca vagos. Nunca apologéticos. Nunca emojis en errores.
- Empty states: invitaciones a actuar. "No viene ninguno" es un empty state seco — mejorarlo
- Estimados marcados con `~` (ETA, tiempos, precios aproximados)
- **Nunca inventar datos**: si no sabemos, no mostrar o marcar "sin datos"

---

## 9. IDIOMA Y TONO

- **Español rioplatense** en toda la UI: vos, bondis, cuadras, plata
- **Voz activa, oraciones cortas, sin fluff**
- **Prohibido en código y UI:**
  - "cabe destacar que", "en el marco de", "a nivel de"
  - "Lamentamos el inconveniente" / "Disculpá las molestias"
  - Puntos y coma innecesarios
  - Gerundios apilados ("habiendo sido implementado")
  - Mayúsculas para énfasis (usar negritas si hace falta)
  - "Muy", "realmente", "verdaderamente" como intensificadores vacíos
- **Comentarios de código**: inglés (convención técnica estándar)
- **Mensajes de UI**: español rioplatense, tono directo y útil

---

## 10. REGLAS DE EJECUCIÓN PARA CLAUDE CODE

### Git / deploy — REGLA ABSOLUTA (no negociable)
- **NUNCA `git push` sin que el usuario lo pida EXPLÍCITAMENTE** (que escriba literalmente "pusheá" / "dale push"). Cada push a `main` dispara un deploy en Netlify y **gasta créditos**.
- **Commits locales: sí**, todo lo que haga falta — son gratis. Commiteá al terminar cada pasada.
- Al terminar una pasada, dejá el commit local y avisá: **"listo, commiteado local en `<hash>`, no pusheado"**. El usuario decide cuándo gastar el deploy.
- Esta regla aplica desde 2026-06-14 (pedido explícito del usuario). Ante la duda: NO pushear.

### Código — reglas absolutas
- **NUNCA** escribir "el resto del código sigue igual", "...", "// continúa como antes", "// same as before"
- **SIEMPRE** generar archivos completos, incluso si tienen 800+ líneas
- Si un archivo es muy largo para una respuesta: "Parte 1/3 — esperá que complete las partes 2 y 3 antes de aplicar"
- **Antes de tocar `lib/` o `api/`**: buscar todos los imports de ese módulo (`grep -r "from.*lib/gtfs-db"` etc.) — entender el contrato antes de cambiarlo
- **Antes de refactorizar**: verificar que los tests pasan ANTES de empezar. Si fallan antes de tu cambio, documentalo
- **Imports**: named exports preferidos. No crear barrel files que mezclen módulos server y client

### Seguridad — checks automáticos
- `jsonLdHtml()` para TODO JSON-LD
- `AbortSignal.timeout(6000)` en todos los fetches externos (Nominatim, Busmatick, STM)
- `Number.isFinite(value)` para validar coordenadas (no `typeof === 'number'`)
- Rate limiting en endpoints con crowdsourcing (`/api/stm/vehicles` sin límite de `lineIds` — VEH-1)

### Testing
- Si el cambio afecta `lib/`, agregar/actualizar tests
- Patrón de degradación: inputs inexistentes/vacíos devuelven `null`/`[]`, nunca `throw`
- Patrón adversarial: `NaN`, `Infinity`, `null`, coordenadas fuera de Uruguay

### SEO — páginas de entidad
- Estructura: `app/{linea,parada,barrio,a}/[x]/page.tsx` con SSG/ISR
- JSON-LD por entidad: BusStop, CollectionPage, FAQ, BusRoute según corresponda
- OG dinámico: title y description específicos por entidad (no genérico)
- Deep links: `/?linea=X`, `/?parada=X`, `/?q=X`, `/?ir=X`, `/?tab=X`
- Sitemap: regenerar si se agregan entidades

---

## 11. ANTI-PATRONES — LO QUE NO HACEMOS

| Anti-patrón | Por qué mata | Alternativa correcta |
|-------------|--------------|---------------------|
| `import Database from 'better-sqlite3'` en `src/` | Rompe Netlify Functions en producción | Exportar a JSON en `scripts/`, leer con `fs` en runtime |
| `JSON.stringify(data)` en `<script ld+json>` | XSS — valor con `</script>` inyecta código (SEC-1) | `jsonLdHtml(data)` de `lib/jsonld.ts` |
| `localStorage.setItem(...)` sin try/catch | Crash silencioso en Safari privado y cuota llena (RES-2) | Siempre try/catch alrededor de localStorage |
| Copiar la función haversine en otro archivo | Deuda técnica DT-9 ya corregida | Importar `lib/geo.ts` |
| `typeof value === 'number'` para coordenadas | NaN pasa el check (VAL-2) | `Number.isFinite(value)` |
| Mostrar dato de crowdsourcing con 1 reporte | Mentira estadística | Mínimo 2 reportes para mostrar como hecho; con 1 decir "1 persona: venía lleno" |
| Afirmar "funciona 24h" sin verificar el bitset | 43/233 líneas tienen dato dudoso (medido 2026-06-17, no 157) | Mostrar ventana solo para las ~190 con datos reales |
| Afirmar ETA sin el `~` | Inventamos precisión que no tenemos | Siempre `~N min` para estimados |
| "el resto del código sigue igual" | No sirve para copiar/pegar — Claude Code rompe el archivo | Archivo completo siempre |
| Usar `dynamic()` sin `ssr:false` en Leaflet | Server-side rendering de Leaflet falla | `dynamic(() => import('./LeafletMap'), { ssr: false })` |

---

## 12. ESTADO ACTUAL Y DEUDA TÉCNICA (2026-06-13)

### ✅ Sólido (no tocar sin necesidad)
- TypeScript strict: 0 errores
- 199/199 tests verdes (27 archivos vitest)
- Seguridad: XSS (`jsonLdHtml`), timeouts (`AbortSignal`), localStorage try/catch
- PWA: SW v4 (`cache cuando-v4`), manifest completo, install prompt iOS/Android
- SEO base: 6,600 URLs, JSON-LD, OG dinámico, sitemap
- Ruteo GTFS: resuelve 181/183 (continuaciones de línea)
- Crowdsourcing: código listo — falta aplicar migración SQL `occupancy_reports` en Supabase

### ⏳ P1 — Alta prioridad
- **Deploy + DNS**: `cuando.uy` no resuelve — falta dominio/DNS/Search Console
- **Interdepartamental completo**: ingestar CSV MTOP (sentido interior→MVD + entre-departamentos) — [TOCA DATOS: avisar antes de aplicar]
- **Anti-troll server-side**: límite por IP/sesión en crowdsourcing (hoy solo rate-limit cliente, evitable)

### ✅ Resuelto en R65 (2026-06-13)
- **Home density**: 3 secciones (planner+hero, paradas cerca, mapa promovido) + bloque "Más" colapsable (favoritos/rutas/Acciones STM). Saldo STM no orfanado.
- **Empty state "No viene ninguno"**: hero muestra "vuelve ~HH:MM" (`inactiveLines`) + parada alternativa a pasos ≤150 m. StopPanel/RouteScreen ya tenían el patrón (R58-R64).
- **Backdrop del sheet**: light 0.45→0.72 (era el real gap; el dark ya estaba en 0.82), dark 0.82→0.88/blur16.
- **Pull-to-refresh**: ya existía desde R58d (gesto + indicador + spin).

### ⏳ P2 — Media prioridad
- **Experiencia parada**: paradas equivalentes a pasos + agrupar destinos
- (Resuelto) ~~Dark-first definitivo~~ → **dark-only** (R67). ~~Monolito RouteScreen/MapScreen~~ → **partidos R51** (RouteScreen ~469, MapScreen ~490). Limpieza de CSS `[data-theme=light]` muerto: pendiente (commit aparte).

### 📊 Métricas actuales de código
- ESLint: 57 warnings (legacy `setState in effect`), 0 errores
- Tests: 199 verdes, 0 rojos (27 archivos)
- TypeScript: 0 errores

---

## 13. COMANDOS DE DIAGNÓSTICO RÁPIDO

```bash
# Baseline antes de cualquier cambio (correr desde D:\comoire\ondas)
npx tsc --noEmit && npx vitest run && npm run build

# Detectar better-sqlite3 en src/ (debe ser 0 resultados)
grep -r "better-sqlite3" src/

# Detectar haversines duplicadas (DT-9)
grep -rn "haversine\|6371" src/ --include="*.ts"

# JSON.stringify en JSON-LD (debe ser 0 resultados)
grep -rn "type=\"application/ld+json\"" src/ -A2 | grep "stringify"

# localStorage sin try/catch (revisar manualmente si devuelve algo)
grep -rn "localStorage.setItem" src/ --include="*.ts" --include="*.tsx"

# Buscar fetch sin timeout (debe ser 0 en api/)
grep -rn "fetch(" src/app/api/ --include="*.ts" | grep -v "AbortSignal\|timeout"

# Estado de tests detallado
npx vitest run --reporter=verbose
```

---

## 14. VARIABLES DE ENTORNO (deploy)

```bash
NEXT_PUBLIC_SITE_URL           # URL final — canonical/OG/sitemap. IMPORTANTE
NEXT_PUBLIC_SUPABASE_URL       # Supabase URL (degradable — pública)
NEXT_PUBLIC_SUPABASE_ANON_KEY  # Supabase anon key (pública, RLS protege)
MVD_API_TOKEN_URL              # STM OAuth2 — llegadas en vivo (SECRETAS)
MVD_API_CLIENT_ID              # STM OAuth2 (SECRETA, scope: Functions)
MVD_API_CLIENT_SECRET          # STM OAuth2 (SECRETA, scope: Functions)
MVD_API_BASE                   # STM base URL (SECRETA)
SUPABASE_SERVICE_ROLE_KEY      # Solo scripts server-side. NUNCA con prefijo NEXT_PUBLIC_
OSRM_URL                       # Router peatonal (opcional, hay default público)
```

---

## 15. SEO — ESTRUCTURA DE PÁGINAS DE ENTIDAD

Estas páginas son la ventaja competitiva vs Maprab (0 páginas de entidad):

| Ruta | Intención de búsqueda | JSON-LD |
|------|----------------------|---------|
| `/linea/[x]` | "¿cuándo pasa el 121?" | BusRoute + FAQ |
| `/parada/[id]` | "¿qué bus para en Av. 18 de Julio esq. Yi?" | BusStop + CollectionPage |
| `/a/[destino]` | "cómo llegar al Hospital de Clínicas" | FAQ + BreadcrumbList |
| `/barrio/[x]` | "bondis en Pocitos" | CollectionPage + BreadcrumbList |
| `/lineas` | hub general de líneas | CollectionPage |
| `/destinos` | hub de destinos | CollectionPage |
| `/barrios` | hub de barrios | CollectionPage |
| `/desvios` | avisos de desvíos activos | — |

Sitemap: `sitemap.ts` genera ~6,600 URLs. Regenerar si se agregan entidades o barrios.
