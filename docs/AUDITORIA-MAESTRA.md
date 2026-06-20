# Auditoría Maestra — Cuándo (app de transporte de Uruguay)

> **Fuente de verdad de QA/seguridad/riesgos/historial.** Parte del sistema de 3 docs:
> [ARQUITECTURA.md](ARQUITECTURA.md) (técnico) · este (QA/estado) · [DESARROLLO.md](DESARROLLO.md) (operativo).
> Modo de trabajo: auditar → documentar → implementar → verificar → reportar. Sin pedir permiso salvo riesgo real a producto/datos/arquitectura.
> Última actualización: **2026-06-13**.

## Leyenda
- Estado: ✅ implementado · 🟡 parcial · ⏳ pendiente · ❌ descartado
- Prioridad: **P0** (bloqueante) · **P1** (alto impacto) · **P2** (medio) · **P3** (bajo/backlog)
- Impacto: confianza / utilidad / retención / viralidad / wow

---

## 🎯 Cola priorizada (ejecutar de arriba hacia abajo: mayor impacto / menor riesgo)

| # | Tarea | Prioridad | Riesgo | Estado |
|---|---|---|---|---|
| 1 | **Cache SW versionado + HTML network-first** (deploy no rompe usuarios) | P0 | bajo | ✅ hecho R36 |
| 3 | **`/a/[destino]` — "cómo llegar a X" (12 destinos, interlinking, deep link /?ir)** | P1 | bajo | ✅ hecho R36 |
| 4 | **Experiencia de parada: incidencias en home + "Otras paradas cerca" cuando atStop** | P1 | bajo | ✅ hecho R37 |
| 6 | **Compartir mi ETA ("el 121 en ~5 min") + OG dinámica /a/destino** | P2 | bajo | ✅ hecho R37 |
| 2 | **`line-hours.json` con metropolitano: 143→233 líneas (90 suburbanas)** | P1 | medio (datos) | ✅ hecho R37 |
| 8b | **SearchAction schema + deep link `/?q=`** (sitelinks searchbox Google) | P1 | bajo | ✅ hecho R40 |
| 11 | **Fix nombre de parada (4 líneas→2) + status "Buscando"→"Actualizando"** | P2 | bajo | ✅ hecho R40 |
| 5 | **Crowdsourcing de ocupación (código+SQL listos)** — falta aplicar migración Supabase | P1 | medio (datos) | 🟡 código hecho R41 |
| 14 | **Aviso "nueva versión · Actualizar" (blindaje deploy)** | P1 | bajo | ✅ hecho R41 |
| 5b | **Crowdsourcing honesto: ≥2 reportes para agregado, copy "te subiste recién", "recién"** | P1 | bajo | ✅ hecho R42 |
| 7 | Ingesta CSV MTOP interdept (ambos sentidos) — catalogodatos.gub.uy | P1 | alto (datos) | ⏳ siguiente (avisar) |
| 13 | **Experiencia parada mágica: "A pasos también pasan" (líneas extra en parada vecina)** | P1 | bajo | ✅ hecho R43 |
| 17 | **Backdrop sheet +contraste · empty hero útil · crowdsourcing no agradece si falla** | P2 | bajo | ✅ hecho R43 |
| 15 | **Anti-troll server-side ocupación: dedup por (IP, línea, parada) + global por IP** | P1 | bajo | ✅ hecho R66 |
| 12 | **Onboarding contextual (componente `Tip`, microayuda 1ª vez en hero)** | P2 | bajo | ✅ hecho R45 |
| 18 | **Precio EFECTIVO primero + placeholder buscador acortado + SW v4** | P2 | bajo | ✅ hecho R44-45 |
| 16 | **Densidad/jerarquía de la home: 3 secciones + bloque "Más" colapsable** | P2 | bajo | ✅ hecho R65 |
| 13 | Experiencia parada: paradas equivalentes + agrupar destinos | P2 | bajo | ⏳ |
| 8 | **Decisión dark-first vs light → DARK-ONLY (señalética nocturna)** | P2 | bajo | ✅ hecho R67 |
| 9 | Estados de error consistentes + "datos de hace X" | P2 | bajo | ⏳ |
| 10 | Partir monolitos RouteScreen/MapScreen | P3 | medio | ✅ hecho R51 (Fable) |

### Hallazgos de la auditoría visual R40 (defectos reales)
- ✅ Nombre de parada se partía en 4 líneas (medio sheet desperdiciado) → line-clamp 2.
- ✅ "Buscando servicios…" salía con llegadas ya visibles (confuso) → "Actualizando…".
- ⏳ Nombre truncado pierde la calle secundaria (aceptable; completo en /parada).
- ✅ Backdrop del sheet deja ver el hero detrás → R65: light 0.45→0.72 (era el real gap), dark 0.82→0.88/blur16.
- ✅ Empty del hero "No viene ninguno" → R65: muestra "vuelve ~HH:MM" (`inactiveLines`) + parada alternativa a pasos ≤150 m.

---

## 1. UX
- **Problemas:** experiencia de parada incompleta (agrupar destinos/equivalentes — P2).
- **Oportunidades:** anticipación (mostrar lo que el usuario quiere sin buscar); "estás acá" llevado al extremo.
- **Implementado:** ✅ preview de mapa en home, auto-detección de parada, big-action "¿A dónde querés ir?", hero "cuándo salir", **pull-to-refresh (R58d)**, **empty states útiles con próximo retorno + alternativas (R58-R65)**, **home a 3 secciones + "Más" (R65)**.
- **Pendiente:** ⏳ experiencia parada mágica: paradas equivalentes + agrupar destinos (P2).
- **Impacto:** utilidad+claridad. **Prioridad media-alta.**

## 2. UI
- **Problemas:** **tema light (default del sistema) vs identidad dark** de marca/landings → dos caras (P2). Truncados puntuales.
- **Implementado:** ✅ design tokens, iconos vectoriales, :active premium, sello seguridad, share toast.
- **Pendiente:** ⏳ decisión dark-first; pasada de truncados/spacing.
- **Impacto:** percepción. **Prioridad media.**

## 3. Producto
- **Problemas:** interdepartamental débil (13 frecuencias); horarios 62%→cubierto R37.
- **Implementado:** ✅ ruteo GTFS (resuelve 181/183), llegadas vivo, mapa, seguridad contextual, favoritos, tarifas, alertas, ficha del bus, **crowdsourcing de ocupación (R41, falta aplicar SQL)**.
- **Pendiente:** ⏳ aplicar migración `occupancy_reports`; interdept robusto (P1).
- **Descartado:** ❌ login STM nativo (riesgo credenciales), personalización de marcadores (vanidad).
- **Impacto:** utilidad+confianza. **Prioridad alta.**

## 4. SEO  *(nuestra mayor ventaja — Maprab no tiene páginas por entidad)*
- **Implementado:** ✅ `/linea/[X]` "¿cuándo pasa el X?", `/parada/[id]` "¿qué bus pasa por X?", **`/lineas` hub**, **`/a/[destino]` "cómo llegar a X" (12)**, **`/barrio/[x]` "bondis en X" (22)**, FAQ schema por entidad, BusStop+Breadcrumb+Organization+WebSite+CollectionPage JSON-LD, sitemap **6.6k**, robots, OG dinámico (línea/parada/destino/barrio), canonical, keywords.
- **Oportunidades:** ⏳ `/recorrido`, combinaciones línea↔línea, índices `/destinos` y `/barrios`; Search Console; validar rich results.
- **Descartado→reconsiderar:** SearchAction/sitelinks (necesita `/?q=`).
- **Impacto:** distribución (la guerra ganable). **Prioridad P1.**

## 5. Accesibilidad
- **Problemas:** contraste tema light sin verificar; nunca probado con lector de pantalla; textos 11-12px puntuales.
- **Implementado:** ✅ touch 44px, focus-visible, prefers-reduced-motion, aria-labels, modo texto grande.
- **Pendiente:** ⏳ auditoría con lector real + contraste AA en light (P2).
- **Impacto:** confianza+alcance (mayores). **Prioridad media.**

## 6. Rendimiento
- **Problemas:** Leaflet en home suma peso; **sin Lighthouse/CWV real** (requiere deploy).
- **Implementado:** ✅ lazy/code-split, SW, intervalos adaptados (adaptInterval), preconnect.
- **Pendiente:** ⏳ medir CWV post-deploy; evaluar peso del mapa en home.
- **Impacto:** percepción+retención. **Prioridad media (bloqueada por deploy).**

## 7. Offline
- **Problemas:** 🔴 cache SW fijo → deploy podía romper (RESUELTO R36); shell cache viejo.
- **Implementado:** ✅ SW (shell+datasets+no-cache /api), useArrivals cache sessionStorage+TTL, banner offline, **re-fetch al volver online** (R33), **HTML network-first + cache versionado** (R36).
- **Pendiente:** ⏳ "datos de hace X" siempre visible.
- **Impacto:** confiabilidad. **Prioridad P0 (gran parte hecha).**

## 8. PWA / Distribución móvil  → ver [DESARROLLO.md](DESARROLLO.md)
- **Decisión (R39):** PWA instalable AHORA ($0) → TWA con Bubblewrap (US$25 one-time) cuando haya dominio/tracción. NO Capacitor/nativo. iOS vía "Add to Home" (gratis, push 16.4+); App Store despriorizado ($99/año).
- **Implementado:** ✅ manifest completo + `id`/`scope`/`display_override` (R39), SW versionado, install prompt **con soporte iOS** (hint "Agregar a inicio", R39), `.well-known/assetlinks.json` (estructura lista), shortcuts ?tab.
- **Pendiente:** ⏳ **deploy HTTPS** (bloqueante TWA+Lighthouse), pegar SHA256 del keystore en assetlinks tras `bubblewrap build`, screenshots en manifest, registrar developer verificado (margen: UY no está en 1ª ola sept-2026).
- **Impacto:** distribución+retención. **Prioridad alta (bloqueada por deploy).**
- **Datos clave 2026:** Play = US$25 único; cuentas personales nuevas requieren 12 testers/14 días + ID; existe tier gratis para distribución limitada; verificación obligatoria global recién 2027.

## 9. Viralidad
- **Implementado:** ✅ URLs limpias, OG dinámico (línea/parada), compartir línea/parada, deep links.
- **Pendiente:** ⏳ compartir ruta, compartir mi ETA/llegada (P2), incentivo a compartir, IG.
- **Descartado→reconsiderar:** compartir bus en vivo (efímero) → "compartir ETA" sí vale.
- **Impacto:** viralidad+distribución. **Prioridad media.**

## 10. Confiabilidad de datos
- **Problemas:** ~~horarios 143/230~~ → **233 líneas (R37, solo faltan 6 diferenciales)**; interdept 13 frecuencias; ETAs dependen de API STM.
- **Implementado:** ✅ filtro horario operativo (fail-open), **horarios suburbanos 700/800 vía metro-schedule.db** (R37), "~" en estimaciones, sin inventar.
- **Pendiente:** ⏳ base interdept (P1); fallbacks visibles; 6 diferenciales sin horario (Ce/Bt/ML/468).
- **Impacto:** **confianza = nuestro diferencial.** **Prioridad P1.**

## 11. Interdepartamentales  *(CORREGIDO R42: no eran 13 frecuencias)*
- **Estado real (medido R42):** **420 salidas, 55 destinos, 35 empresas, 24 destinos** (incl. internacionales) desde Montevideo. GPS vivo 4 deptos (Maldonado/Paysandú/Rivera/Rocha).
- **Implementado:** ✅ horarios de salida MVD→interior (420), GPS Busmatick 4 deptos, 40 ciudades, 171 paradas, detección O-D interdept en Cómo Ir.
- **Problemas:** ⏳ falta sentido inverso (interior→MVD) y entre-deptos; GPS solo 4 deptos; dato no se autoactualiza.
- **Pendiente:** ⏳ ingesta CSV oficial MTOP (catalogodatos.gub.uy, ambos sentidos), más GPS, búsqueda O-D robusta. **TOCA DATOS → avisar.**
- **Impacto:** utilidad (viajero regular). **Prioridad P1.**

## 12. Experiencia de parada
- **Implementado:** ✅ auto-detección "Estás acá" (≤40m), próximos buses, cuánto falta, destinos, incidencias en home (R37), **"A pasos también pasan" (R43: paradas vecinas ≤300m con líneas que acá NO pasan, ordenadas por distancia)**, ocupación crowdsourced (R41-42).
- **Pendiente:** ⏳ agrupar llegadas por destino; navegar a la parada vecina desde el sheet (requiere refactor de animación).
- **Impacto:** wow+utilidad. **Prioridad P1 — gran parte hecha.**

## 13. Cómo ir (ruteo)
- **Implementado:** ✅ motor GTFS (181/183 resuelto), filtro horario, optimize (rápido/transbordos/caminata), seguridad contextual, depart-at, sello "más segura de noche".
- **Problemas:** hueco suburbano en horarios; heurístico fallback sin seguridad.
- **Pendiente:** ⏳ "esperá en la parada de la avenida", alternativas O-D interdept.
- **Impacto:** utilidad core. **Prioridad alta.**

## 14. Búsqueda
- **Implementado:** ✅ ranking real (código>prefijo>palabra), **proximidad**, **instantánea** (useMemo), voz, lugares (geocode), paradas, líneas, intersecciones.
- **Pendiente:** ⏳ por nº de coche (requiere API vehículos, P3); "qué bus va a X" en vivo (existe parcial).
- **Impacto:** utilidad. **Prioridad media.**

## 15. Onboarding
- **Implementado:** ✅ OnboardingFlow primer uso, HowToSheet (botón ?), empty states que enseñan (Rutas, R35), **microayuda contextual `Tip` (R45): aparece 1 vez donde tiene sentido, descartable — primer tip explica el diferencial "te decimos cuándo SALIR"**.
- **Pendiente:** ⏳ más tips contextuales donde aporten (mapa long-press, ocupación); medir si ayudan.
- **Impacto:** claridad+retención. **Prioridad media — base hecha.**

## 16. Microinteracciones
- **Implementado:** ✅ count-up, fav-pulse+haptic, :active premium, share toast, arr-in stagger, skeletons hero/búsqueda, whileTap.
- **Pendiente:** ⏳ transición entre tabs con significado (sin romper position:fixed), feedback en guardados/errores (P2).
- **Impacto:** percepción premium. **Prioridad media.**

## 17. Diseño
- **Implementado:** ✅ tokens (radios/sombras/spacing), WCAG AA texto-3, jakarta font, paleta dark.
- **Pendiente:** ⏳ resolver tema light, sistema de elevación coherente.
- **Impacto:** percepción. **Prioridad media.**

## 18. Código
- **Problemas:** ~~monolitos RouteScreen/MapScreen~~ **partidos (R51)**: RouteScreen ~469, MapScreen ~490, con sub-componentes presentacionales separados. Quedan 57 warnings legacy set-state-in-effect.
- **Implementado:** ✅ TS strict, 218 tests, geo unificado, sin dead code mayor, lint 0 errores.
- **Pendiente:** ⏳ limpiar warnings legacy (P3).
- **Impacto:** mantenibilidad. **Prioridad baja-media.**

## 19. Arquitectura
- **Implementado:** ✅ GTFS SQLite→JSON (deploy fix), datos como JSON (sin módulos nativos en runtime), Supabase degradable, API routes proxy.
- **Pendiente:** ⏳ versionar datos/cache, estrategia de regeneración GTFS automatizada.
- **Impacto:** confiabilidad+deploy. **Prioridad media.**

## 20. Analítica
- **Implementado:** ✅ analytics privacy-first (sin trackers, sin PII, opt-out), eventos útiles (view_tab, deep_link, share, safety_*, open_shortcut).
- **Pendiente:** ⏳ embudo de activación (¿llega a ver una llegada?), medir SEO landings → app.
- **Impacto:** decisiones de producto. **Prioridad media.**

## 21. Distribución
- **Problemas:** 🔴 **NO DEPLOYADO** — bloqueante #1 absoluto. Sin IG/comunidad.
- **Implementado:** ✅ base SEO lista, OG, sitemap.
- **Pendiente:** ⏳ **DEPLOY** (P0), Search Console, `/a/destino`+`/barrio`, IG, loop de invitación.
- **Impacto:** **todo el SEO vale 0 sin esto.** **Prioridad P0.**

---

## 🔬 INVESTIGACIÓN — Honestidad de llegadas: buses fantasma / dirección (2026-06-14)
> Research-first (sin fix todavía). El "killer reason #1 de abandono": recomendar un bus
> que no va a llegar. Síntomas reportados: (1) buses que ya pasaron (media cuadra) siguen
> como "llega en X"; (2) buses de sentido opuesto / calle paralela aparecen como llegando.

### Cómo funciona hoy — `lib/bus-direction-gtfs.ts` (filtro principal de arrivals)
Algoritmo (auditado línea por línea): variantes de la línea → filtra por **HEADSIGN TEXT**
(`destinoDesc` vs headsign GTFS) → proyecta el GPS sobre la **polilínea de paradas** de la
variante (proyección de segmento, no "parada más cercana") → "ya pasó" si la proyección
quedó **>75 m** después del target por el recorrido → elige la variante con **mejor snap**.
Es bastante bueno (no es proximidad euclídea genérica). **PERO no usa**: el `lineVariantId`
exacto que da la API; el `directionId` del GTFS; el bearing (no existe — la API no lo da,
está hardcodeado a 0).

### Causa raíz (no síntoma)
1. **Matchea por texto de destino, no por la variante exacta.** La API del STM da
   `lineVariantId` (cod_variante numérico = el recorrido exacto, con su sentido). El filtro
   GTFS lo **IGNORA** y matchea por headsign-text (fuzzy). Cuando el texto no matchea
   (destinos acortados de noche, o ambiguos) **cae a "probar TODAS las variantes de la
   línea"** → la discriminación de dirección colapsa a geometría pura (mejor snap), que **no
   distingue ida de vuelta**. ⟵ raíz del "sentido opuesto".
2. **Tolerancia de snap de 900 m** (`MAX_GPS_SNAP_M`). Una calle paralela (~80–100 m) entra
   holgada → un bus en la paralela proyecta sobre la polilínea del target. ⟵ "calle paralela".
3. **Sin bearing/rumbo.** La API no lo da (bearing=0). Sin variante exacta ni rumbo, el único
   discriminador que queda es la geometría — ambigua justo en avenidas/paralelas.
4. **Márgenes de "ya pasó" generosos** (75 m snapped / 120 m en el backstop
   `busLikelyPassedStop`). Un bus a **media cuadra pasado (≤75–120 m)** se muestra como
   "llegando" — por diseño (no ocultar uno que está EN la parada), pero el usuario lo lee
   como fantasma. ⟵ "ya pasó pero aparece".
5. **`trustUpstream` sin verificación dura.** En `arrivals/route.ts`, los buses del filtro
   oficial del STM (`busstopId`) que el GTFS **no puede snapear** (reason `no-position`) se
   **muestran igual** (ETA aproximada, `etaApprox`) confiando en el STM — pero ese filtro
   `busstopId` no es perfectamente direccional.

### ✅ El descubrimiento clave (el check exacto que NO se hace)
La API del STM **`/variantes/{stopId}`** (`getStopVariants`) devuelve EXACTAMENTE qué
`cod_variante`s sirven una parada (con su sentido). El bus reporta su `lineVariantId` (mismo
numerado: "480","448"…). **Hoy NO se compara `bus.lineVariantId` contra los `variantCode`s que
sirven la parada.** Si se hiciera: un bus cuyo cod_variante NO está en la lista de la parada =
no sirve esa parada en ese sentido → descartar. Check **exacto, por ID, sin geometría**.
*(`lib/bus-direction.ts` —el heurístico viejo— SÍ usa `routes[variantCode]`; el filtro GTFS de
arrivals no.)*

### Espacios de ID (por qué no es trivial mapear)
- API STM: `lineVariantId` = **cod_variante numérico** ("480").
- `public/routes.json`: keyado por **cod_variante** ("2","8","17") → shape del recorrido.
- `data/gtfs-v2.json`: variantId **sintético** `{línea}-{dir}-{n}` (ej. `505-0-2`) — **encoda
  el directionId** pero NO es el cod_variante. **No hay puente directo cod_variante ↔ GTFS
  variantId.** Para usar la variante exacta en el filtro GTFS hace falta: (a) el check contra
  `getStopVariants` (arriba, no necesita puente), y/o (b) construir el puente cod_variante→GTFS.

### Reproducción (prod `cuando-bondi`, datos reales)
Parada **2201** (Colonia y Barrios Amorín): 15 buses en vivo, incl. **línea 505 en AMBOS
sentidos** (→ADUANA *y* →CIUDADELA) en la misma parada (bandera roja de wrong-direction — a
confirmar si Colonia es two-way para 505), y buses hasta **70 min / 27 km** (ETA correcta pero
ruido). En el snapshot no apareció ningún `etaApprox` ni "cerca-pero-N-paradas" flagrante → el
bug es **intermitente / por geometría puntual** (paralelas, destinos acortados), no constante.

### El ruteo NO propaga el bug ✅
`route-planner-gtfs.ts` usa `getDownstreamStops(variantId, sequence)` → el destino debe estar
**downstream** del origen en la secuencia de la variante (dirección correcta por sequence).
Haversine sólo para encontrar paradas candidatas cercanas, no para juzgar dirección del bus.

### Estándar de industria (GTFS-realtime) vs lo nuestro
GTFS-RT: matchear vehículo→trip (`trip_id`) + `current_stop_sequence`, filtrar por
`direction_id`. La API del STM **no es GTFS-RT** (no da trip_id/direction_id/bearing), pero
`lineVariantId` **es el equivalente** (identifica el recorrido exacto). Lo tenemos; no lo
usamos en el filtro de arrivals — ese es el gap respecto al estándar.

### Hallazgo secundario (ruido, P2)
arrivals devuelve hasta 25 buses sin tope de ETA/distancia → muestra buses a 70 min/27 km.
Erosiona confianza ("¿por qué me muestra uno a una hora?"). Falta cap.

### Alcance del fix propuesto (a decidir juntos — NO ejecutado) — ⚠️ SUPERADO, ver verificación abajo
- ~~**Core (alto impacto, bajo riesgo):** en `arrivals/route.ts`, descartar todo bus cuyo
  `lineVariantId` NO esté entre los `variantCode`s que `getStopVariants` dice que sirven la
  parada. Check exacto por ID — corta sentido-opuesto/paralelas sin tocar geometría.~~ **← premisa
  FALSA (probada en vivo). Ver "Verificación empírica".**
- Bajar `MAX_GPS_SNAP_M` (900→~250 m) para cortar paralelas en el path GTFS.
- Tope de ETA/distancia (ej. ≤45 min o ≤N paradas) contra el ruido.
- Revisar los márgenes de "ya pasó" (75/120 m) — quizá endurecer a ~40 m.
- Verificar si la API trae un campo `sentido`/dirección que hoy descartamos en el mapeo `MvdBus`.

Fuentes: [STM API docs](https://api.montevideo.gub.uy/apidocs/publictransport) ·
[GTFS-RT vehicle positions](https://gtfs.org/documentation/realtime/feed-entities/vehicle-positions/)

### ⚠️ Verificación empírica (2026-06-14) — la premisa del fix #1 era FALSA, y el mecanismo corregido
> Antes de escribir una línea de producción se reprodujo la 2201 en vivo cruzando las dos APIs
> (`d:\tmp\probe-2201.mjs` y `probe-2201b.mjs`). Resultado: el check literal #1 era **imposible**,
> pero hay un mecanismo corregido **validado con datos reales**.

**HALLAZGO 1 — `bus.lineVariantId` y `variantCode` de la parada son ESPACIOS DE ID DISTINTOS.**
La parada 2201 vía `transporteRest/variantes` declara variantCodes **chicos**: `10→494, 11→495,
15→505, 21→582, 56→140, 59→142, 61→143, 83→175, 446→151`. Los buses vía `api.montevideo/buses`
reportan `lineVariantId` de **4 dígitos**: `505→{4005,4006,4649}, 151→9007, 494→{4414,4458}…`.
**Cruce en vivo: 0 de 62 buses matchean.** Un check `lineVariantId ∈ variantCodes` naïve
**ocultaría el 100 % de los buses** (catástrofe de falsos negativos). Prueba de que son espacios
distintos: el código `11` = línea **495** en la parada, pero = línea **402** en `variant_to_line.json`
(misma key, líneas distintas). El `variantCode` de `getStopVariants` **NO sirve** como puente.

**HALLAZGO 2 — el puente real es `public/routes.json`, keyado por el `lineVariantId` del bus.**
`routes.json[4005]`, `[4649]`, `[9007]`… **existen todos** y devuelven el **shape exacto**
(polilínea `[lat,lon]`) de la variante del bus. `variant_to_line.json` confirma el mapeo
(`4005→505, 4006→505, 4649→505`). O sea: el shape del recorrido EXACTO del bus se obtiene por su
propio `lineVariantId`, sin texto de headsign ni el `variantCode` de la parada. `data/gtfs-v2.json`
**no** trae el cod_variante (sólo IDs sintéticos `505-0-2` + `directionId`), así que no hay puente
cod_variante→GTFS; **`routes.json` es el único puente exacto disponible**.

**HALLAZGO 3 — el fix #1 corregido (proyección sobre el shape exacto) FUNCIONA (validado 2201).**
Mecanismo: para cada bus, `shape = routes.json[lineVariantId]` → proyectar la PARADA y el BUS
sobre el shape → "sirve" si el shape pasa a ≤~70 m de la parada; "va hacia" si el `along` del bus
≤ `along` de la parada + margen. Resultado en vivo (18 buses upstream): **9 mostrar / 9 ocultar**,
y la **505 se separa por sentido**: `4005`→ADUANA `faltan −1107 m` (ya pasó → OCULTAR), `4649`→
CIUDADELA `faltan +6164/+9911 m` (viene → MOSTRAR). Los fantasmas de **27 km** (494 `−24377 m`,
582 `−14402 m`) caen como "ya pasó". Sentido resuelto por ID exacto + geometría del shape propio,
**sin matchear texto**. (Diferencia de scope vs lo aprobado: NO es un set-membership de una línea;
es proyección geométrica sobre `routes.json` — toca geometría, justo lo que #2/#4 difería.)

**HALLAZGO 4 (#5) — la API NO trae campo `sentido`/`direction`/`bearing`.** Claves crudas de un bus:
`eType, company, timestamp, busId, line, lineVariantId, location, origin, destination, subline,
special, speed, access, thermalConfort, emissions`. Sin rumbo ni sentido explícito. PERO
`lineVariantId` ES la clave de sentido de facto (4005≠4006 = sentidos opuestos), y `origin`+`subline`
("ANDALUZ - ADUANA" vs "ADUANA - ANDALUZ") lo dan textualmente. No hace falta un campo nuevo.

**HALLAZGO 5 — #3 sigue necesario.** Aun con #1 corregido, quedan buses "yendo hacia" a **16–17 km**
(175 `+17797 m`, 142 `+16139 m`). El cap de distancia/ETA es independiente y sigue haciendo falta.

### Fix corregido — propuesto (a confirmar antes de producción)
- **#1 corregido — gate exacto por `routes.json[lineVariantId]`:** descartar el bus si su shape no
  pasa cerca de la parada (otra ruta) o si su `along` ya superó el de la parada (ya pasó). Reemplaza
  el "fall-back a todas las variantes por texto" que es la raíz del sentido-opuesto. Módulo nuevo
  acotado (lee `routes.json` server-side); `bus-direction-gtfs.ts` queda como está (ETA por GTFS).
- **#3 — cap de ETA/distancia** (≤~45 min o ≤N paradas): independiente, bajo riesgo, listo.
- **#2/#4 diferidos** (snap 900→250, márgenes 75/120→40): medir #1+#3 primero.

### ✅ IMPLEMENTADO (R69) — gate por variante exacta + cap, con reproducción antes/después
- **Refinamiento clave del diagnóstico:** la fuente autoritativa (gtfs-db por `stopId`) muestra que
  2201 está servida por **505 solo en dirección 1** (`505-1-1`→Aduana, `505-1-2`→Ciudadela — ambas
  dir 1, mismo sentido físico). O sea Aduana+Ciudadela **NO eran sentidos opuestos**: el wrong-direction
  real es **505→Andaluz (dir 0)**. Snap del shape a la parada: dir-1 servidas **~4 m**, dir-0 opuesta
  **~101 m** → un umbral de 75 m los separa limpio.
- **Código:** `lib/routes-server.ts` (loader fs de `public/routes.json`, server-only) +
  `busVariantTowardsStop()` en `lib/bus-direction.ts` (pura: `no-shape|not-on-route|passed|serves-going`,
  reusa `projectOnPolyline`) + gate duro en `arrivals/route.ts` (veta `passed`/`not-on-route` por el
  `lineVariantId` del bus, antes de toda lógica de texto) + cap #3 (`withinHonestRange`: realtime a
  >45 min o >12 km → fuera; programados intactos). `bus-direction-gtfs.ts` **sin tocar**.
- **Reproducción en vivo (2201):** ANTES 34 buses → DESPUÉS **9**. La 505 **→Andaluz (dir 0): 2 buses
  ocultados por `not-on-route`** (sentido opuesto, por ID). Los →Ciudadela (dir 1, servido) que vienen
  dentro de rango se muestran; uno a 15 km lo corta #3; uno ya pasado → `passed`. **Sin falsos-negativos
  direccionales** (el único dir-1 ocultado fue por distancia, no por el gate).
- **Tests:** `tests/bus-direction-shape.test.ts` — puros (sintéticos, siempre corren) + data-backed con
  `routes.json` real que **pinea** 4006→not-on-route, 4005 antes→serves-going / después→passed. 230/230.
- **#2/#4 siguen diferidos:** con #1+#3 el grueso del ruido cae sin tocar las tolerancias del path GTFS.
- **Hallazgo de borde para vigilar:** los buses sin shape en `routes.json` (`no-shape`) NO se vetan
  (caen a la lógica GTFS) — correcto (degradación honesta), pero si una variante viva común no tuviera
  shape, el gate no la protege. No observado en 2201; revisar si aparece en otras paradas.

### ✅ SEGUNDA PARADA — patrón "calle paralela" confirmado (2026-06-14)
> La 2201 validó sentido-opuesto de la MISMA línea. Faltaba confirmar el síntoma original de
> "calles paralelas": variantes corriendo a ~80–240 m sobre la calle de al lado. Se midió en
> la grilla de sentido único del Centro (Av Uruguay ‖ Mercedes, ~90 m).
- **Caso canónico — 4615 (Av Uruguay y Julio Herrera y Obes, 18 líneas):** la **L124→SANTA CATALINA**
  (variante que corre por la paralela) snapea a **113 m → `not-on-route` → excluida**, mientras la
  MISMA L124→Ciudad Vieja (la que corre por Av Uruguay) es reconocida on-route. El gate distingue las
  dos variantes de una línea por su shape exacto, no por la línea.
- **Banda clave:** los buses excluidos por paralela snapean a **108–239 m**. El snap viejo del path
  GTFS (`MAX_GPS_SNAP_M = 900`) los **incluía**; el gate de 75 m los **excluye**. Ese es, literal, el
  fix de "calle paralela".
- **Corte de ruido (6 paradas céntricas, en vivo):** 4040 66→11 · 4909 54→9 · 4615 46→6 · 573 50→5 ·
  4549 31→1 · 5109 47→0. (El 0 de 5109 fue honesto: en ese instante no había bus en una variante
  servidora cerca; los próximos estaban en paralelas/cruces o ya pasados.)
- **Auditoría de falso-negativo (la preocupación explícita):** para 5109/4615/4549, **TODAS** las
  líneas de la parada (17/17, 18/18, 15/15) tienen al menos una variante con snap **≤75 m** → el gate
  reconoce el sentido servido de cada línea. **No sobre-excluye**: cuando llega un bus por la variante
  correcta, lo muestra. Lo que oculta es la variante paralela/opuesta de esa misma línea.

### Decisión #2/#4 (a confirmar) — el gate los vuelve innecesarios
- **#2 (bajar `MAX_GPS_SNAP_M` 900→250):** ya no hace falta. El gate impone un requisito de **75 m
  sobre el shape EXACTO** (más estricto que 250 m sobre cualquier variante), y corre ANTES. El 900 m
  del path GTFS sólo se usa para enriquecer ETA DESPUÉS de que el gate ya vetó dirección/pasado →
  bajarlo no agrega honestidad y arriesga ETAs peores. **Propongo no tocarlo.**
- **#4 (endurecer márgenes "ya pasó" 75/120→40):** ya no hace falta. El gate decide "pasó" por el
  along del shape exacto (margen 80 m); los márgenes de `bus-direction-gtfs.ts` quedan como segunda
  capa. Endurecerlos arriesga ocultar el bus que está EN la parada (la razón por la que son generosos).
  **Propongo no tocarlos.**
- **Conclusión:** con #1 (gate por variante exacta) + #3 (cap) el grueso del ruido cae —
  sentido-opuesto, calle-paralela, ya-pasado y 27 km— sin tocar las tolerancias geométricas. #2/#4
  quedan **cerrados como innecesarios** salvo que aparezca un caso que el gate no cubra.

### Orden de llegadas — hipótesis a confirmar (2026-06-14)
El "desorden" reportado (12, 3, 25, 8 min) **NO reprodujo** con datos válidos: el endpoint
ordena (`combined.sort`) y todos los paths cliente preservan/ordenan — verificado en vivo en 18
paradas, todas ascendentes, incl. mezcla vivo+programado. Se endureció igual con
`sortArrivalsByEta` (punto de verdad único + guard de finitud para NaN/Infinity, la única forma
en que el comparador rompía). **Hipótesis:** lo que se veía "desordenado" eran probablemente los
**buses fantasma/ruido** que el fix de esta sesión elimina (un bus a 70 min mezclado con uno a 3
min se lee como desorden aunque el array esté sorteado). **A confirmar:** si el desorden NO vuelve
tras este fix combinado (gate + cap + sort endurecido), eran la misma causa. Si vuelve, reproducir
en la superficie exacta (interior / pager / cache stale) antes de tocar.

## 🔬 INVESTIGACIÓN — Paradas del interior sin "cuánto falta" (2026-06-15)
> Los buses del interior se ven moverse en el mapa, pero NINGUNA parada del interior calcula
> "te falta X / llega en N". Research-first: ¿por qué, y qué tan grande es el problema?

> ✅ **IMPLEMENTADO v1 — Maldonado (2026-06-17).** `src/lib/bus-direction-interior.ts` (motor puro,
> espejo de `bus-direction-gtfs.ts`): navega `interior-edges` (BFS p1c→target), clasifica en 3 capas
> honestas — **approaching** (grafo encierra la cadena → "a N paradas · ~M min"), **nearby** (línea
> sirve + cerca, grafo no conecta → "~M min" sin conteo), **in-zone** (no confirma dirección → sección
> "Circulando en la zona", sin ETA). Dos hallazgos del dato que reordenaron el diseño: (1) el peso de
> cada arista es **conteo de observaciones, no segundos** → el ETA usa `AVG_SECONDS_PER_HOP=90` (constante
> SIN VALIDAR, se afina con `samples`; todo minuto va con `~`); (2) **`delayMin` no tiene baseline** (no hay
> horario del interior) → descartado como fuente de ETA. Endpoint expone `sen`+`p2c`; `useInteriorArrivals`
> consume el motor; grafo servido en `public/interior-edges.json`. Tests: `bus-direction-interior.test.ts`
> (grafo puro) + `busmatick-snapshot.test.ts` (fixture vivo capturado con `capture-busmatick-snapshot.mjs`,
> espejo de paradas 2201/4615). Pendiente: calibrar `AVG_SECONDS_PER_HOP` con muestras; extender a Paysandú/
> San Carlos (re-inferir edges) cuando Maldonado valide en uso real.

### El dato de Busmatick es RICO (y parte se ignora — patrón buses-fantasma)
`/api/gps/interior` (avl.xml/geojson de CODESA/COPAY/Rocha) ya parsea por bus: `lat/lon, line (lin),
lineName (lnm), speed (vel), heading (rum)`, **`nextStop (p1n)` + `nextStopCode (p1c)`** (la PRÓXIMA
parada, nombre+código), **`delayMin (reg)`** (atraso vs horario, +tarde/-adelantado) y `occupancy (psj)`.
→ El bus reporta su próxima parada Y su atraso. **`useInteriorArrivals` usa SOLO `nextStopCode === code`
(la parada inmediata) + ETA por distancia/velocidad. Ignora la secuencia de paradas y el `delayMin`.**

### La data del recorrido del interior EXISTE (no hay que construirla de cero)
- **`public/interior-stops.json`**: ~171 paradas GEOLOCALIZADAS — `{zona, code, name, lat, lon, samples,
  lines}` — **inferidas de las observaciones de Busmatick** (`collect-interior-stops.mjs`: agrupa dónde los
  buses reportan cada `p1c`). Ya se mergean al dataset (`stops-dataset.ts` → `int-{zona}-{code}`) → se abren.
- **`data/interior-edges.json`**: **el GRAFO DE SECUENCIA de paradas** (`"961>962":5` por `zona|línea|dir`,
  de `p1c→p2c`). Es "el recorrido" que parecía faltar — **existe**. PERO `useInteriorArrivals` NO lo usa.
- **NO hay GTFS formal del interior** (sin timetable oficial); la data es OBSERVADA, no de un GTFS. Así que
  los ETAs deben ser por posición/secuencia, no por horario (el `delayMin` no tiene baseline sin schedule).

### La causa raíz (el gap, no el síntoma)
La data (paradas geolocalizadas + grafo de secuencia) existe, pero el motor del interior es DELGADO:
`useInteriorArrivals` solo marca "viene" si la parada es el **next-stop INMEDIATO** del bus. Un bus a 2-3
paradas (que SÍ viene) cae al complemento "buses de la línea ≤4 km" mostrado como estimado "en la zona" —
no como "te falta 3 paradas, llega en 5 min". Por eso la parada "no funciona". **Falta un SEGUNDO MOTOR DE
HONESTIDAD para el interior** que use `interior-edges` (secuencia) igual que `bus-direction-gtfs.ts` usa
`routes.json`: ubicar el bus en la secuencia → ¿está upstream de la parada? → paradas restantes → ETA.

### Tamaño real del problema (cobertura desigual por ciudad)
| Ciudad | Paradas inferidas | Edges (línea·dir) | Estado |
|--------|-------------------|-------------------|--------|
| **Maldonado** (CODESA) | **89** | **16** | data completa → solo falta el motor. **Empezar acá** (+ tráfico Punta del Este) |
| **Paysandú** (COPAY) | 66 | 8 | data ok → motor |
| San Carlos | 16 | **0** | paradas sí, edges no → re-correr inferencia de edges |
| **Rocha** | **0** | **0** | GPS sí, paradas NO (el GeoJSON quizá no trae `p1c`) → inferencia incierta |

Afecta a las 4, pero la data sólo cubre 3 bien. **Interdept overlap: ninguno** (interdept.json = salidas
empresa/hora, sin paradas). Reutilizable: `interior-stops` + `interior-edges` (ya construidos).

### Esfuerzo y alcance (a decidir juntos — NADA ejecutado)
- **NO es "construir data de cero"** para Maldonado/Paysandú (existe). El trabajo es **el MOTOR**: un
  `bus-direction-interior` que use `interior-edges` → dirección/upstream + paradas restantes + ETA. Espeja
  `bus-direction-gtfs` pero con un grafo más simple → **MEDIO** (más chico que el de MVD).
- Mejoras opcionales: usar `delayMin` (regularidad), re-inferir edges de San Carlos, intentar Rocha.
- **Es una pieza de arquitectura real (2º motor de honestidad), pero ACOTADA** porque la data ya existe.
  Recomendación: prototipar el motor en **Maldonado** (mejor data + tráfico) y validar antes de extender.

## 🔁 RONDA R71 (2026-06-15) — honestidad del hero + parada↔mapa + barrido de gaps

### Cierre R71 (lo hecho, 5 commits locales sin pushear)
- **Cuándo salir — 3 escenarios resueltos** (`891a264` + `b0c6da5`): Esc 2 (estado honesto "no llegás
  a estos a pie" en vez de "¡Ya!" imposible), Esc 1 (bus inalcanzable dimmed, no borrado), Esc 3
  (alternativa "sin apuro" explícita — medido frecuente: 35% de las decisiones / 41% de los "corré").
  Lógica pura en `selectHeroBus` + 11 tests.
- **Parada ↔ mapa conviven** (`2f86cc8`, Opción A): tocar parada en Home → tab Mapa + StopPanel + mapa
  con todos los buses; store `selected-map-stop` + breadcrumb "← Inicio" + back semántico (round-trip a
  Inicio si viniste del Home; normal si exploraste el mapa). Reusa MapScreen existente, sin 2º Leaflet.
  StopArrivalSheet intacto (lo usa el favorito-ruta).
- **Focus-management probado en prod** (cierra pendiente de R70): el restore parecía roto en dev →
  instrumenté → era el **doble-invoke de React StrictMode (solo dev)** corrompiendo la captura de
  `restoreTo`. Con StrictMode off (= prod): **RESTORE OK**. Trap (0 fugas) + restore funcionan en prod.
- **Validación integrada (5 puntos):** Home→parada→mapa→Inicio ✓ · mapa-directo (back se queda en Mapa,
  no salta a Inicio) ✓ · hero sin regresión ✓ · focus trap+restore ✓ · 320px sin overflow ✓ · 0 errores.

### 🔬 Barrido de gaps silenciosos (patrón buses-fantasma: dato disponible pero no usado)
- **🐞 fare.ts — TARIFA SUBURBANA SUBREPORTADA (gap confirmado, mismo patrón):** `SUBURBAN_FARES` tiene
  tramos por distancia ($86 dentro MVD / $107 ≤32km / $127 ≤40km / $153 ≤60km), pero
  `estimateFare(suburban)` devuelve **SIEMPRE `dentro_mvd` ($86)** — nunca usa la distancia. Y la
  distancia ESTÁ disponible: `GtfsRouteCard.tsx:240` ya calcula `busM` (metros en bus) para el impacto,
  pero `fareLabel`/`fareDetail` (líneas 102/255) no la reciben. Un viaje a Canelones de 50 km (real
  $153) se muestra **"$86"** — subreporte de hasta ~$67 (la disculpa "varía por distancia" está, pero
  el número siempre es el mínimo). **Matiz de producto del fix:** distinguir "dentro de MVD" ($86) de
  "sale de MVD" (tramos por km) — `busM` solo no lo dice (un viaje de 25 km puede ser intra-MVD o cruzar
  a Canelones). El dato preciso existe: coords del destino + `mvd-area.ts` (`isValidMvdCoord`) → si el
  destino está fuera de MVD, usar tramo por `busM`. Decisión de approach pendiente (ver abajo).
- **trip-safety.ts — sin gap:** `isOnAvenue` matchea por TEXTO (regex + lista de avenidas) pero es
  **proxy honesto documentado** — no existe clasificación de calles en el dato. (Menor: el walk usa
  nombres de parada, no las calles reales del polyline de OSRM → mejora posible, no dato-ya-disponible.)
- **occupancy.ts — sin gap de dato:** agrega bien; el riesgo "mostrar con 1 reporte" es regla de UI
  (devuelve `count`, la UI debe distinguir "1 persona dijo…" de un hecho). Verificar en OccupancySection.
- **interdept — sin gap de campo:** `interdept.json` tiene campos escasos (empresa/salida/llegada/días),
  sin precio/km. Lo pendiente es INGERIR más data (CSV MTOP), no un campo ignorado.

### 🧹 Pasada C (deprecar StopArrivalSheet) — audit de tamaño
StopArrivalSheet (340 líneas) tiene 4 features que StopPanel (183) no: **favorito** (`toggleFavoriteStop`),
**compartir** (`shareStop`), **OccupancySection**, **inactiveLines** ("vuelve a las HH:MM"). Ambos ya
comparten ColdMode + paradas-a-pasos. Migración = wirear esas 4 (hooks/componentes reusables YA existen)
→ **MEDIA** (~60-100 líneas en StopPanel) + rerutear el favorito-ruta + borrar StopArrivalSheet.
**Recomendación: HOLD — pero como PREFERENCIA DE SECUENCIA, no bloqueo técnico (razón afilada R71).**
¿Qué se rompe si migro ahora vs con A en prod? **Nada concreto** — el código de la migración es correcto
independiente del estado de deploy de A. Lo único que "A en prod + usado" aporta es CONFIRMAR que su UX
(tab-switch al mapa al abrir una parada) es la dirección correcta. El único downside concreto de migrar
ahora: si A se rechaza tras uso real, el revert es más grande (hay que **restaurar StopArrivalSheet** además
de revertir A) y el Home quedaría sin vista de parada en el ínterin. O sea: no hay riesgo técnico de migrar
ya; el HOLD es "no deprecar el fallback hasta confirmar la dirección de A". Que la próxima sesión NO asuma
que hay algo peligroso acá — es secuencia, no peligro.

### 🔭 Competencia — features baratas que faltan (2-3, criterio: barato bien + alto impacto)
- **Animación suave de los buses en el mapa** (interpolar entre updates de GPS): Maprab/VoyEnBondi
  "se sienten vivos"; los nuestros `setLatLng` instantáneo cada 8-20s (saltan). **Approach (research R71):**
  interpolar old→new con rAF (lerp lat/lon, llamando setLatLng por frame) — **NO CSS-transition** (chocaría
  con el `translate3d` que Leaflet recomputa en pan/zoom). **Riesgo: toca el loop de markers de LeafletMap**
  (que ya tuvo bugs: mapa negro, markers), con edge-cases (cleanup de la animación al remover el vehículo,
  updates rápidos, interacción durante la animación). **Cosmético + delicado → hacerlo como pasada
  enfocada con su testing, NO al apuro.** Pendiente, no ejecutado.
- **"Avisame cuándo salir" — notificación** (gap real vs Moovit). **Research (R71): NO hay infra de
  notificaciones hoy** — sin push/VAPID/web-push/showNotification; el SW no maneja `push`/`notificationclick`;
  manifest sin notificación. La versión con valor (avisar con la app CERRADA) = **Web Push completo desde
  cero**: VAPID + suscripción (pushManager) + guardar subs (Supabase) + backend que mande el push a la hora
  de salida (Netlify scheduled fn) + handlers SW. **Esfuerzo MEDIO-ALTO, NO barato.** La versión barata
  (Notification + setTimeout con app abierta) es de bajo valor (ya ves el hero). Notification Triggers
  (local sin server) → soporte nulo en iOS. **Veredicto: alta utilidad pero es una feature deliberada con
  su propio scope, no un quick-win.** No ejecutar sin decidir el alcance del backend.
- **Favorito de LÍNEA (no solo parada):** "¿cuándo pasa el 121?" en un toque, apalanca las páginas
  `/linea/[x]` que ya existen. Barato, leverage de lo construido.
> Research-first, sin fixes. Ahora que hay deploy (`cuando-bondi.netlify.app`) y la app es
> dark-only, varias cosas "pendientes, requieren HTTPS" son medibles. Herramientas: Lighthouse
> mobile (npx), axe-core 4.10 vía Playwright 375px, curl/Invoke-WebRequest con timing, análisis
> del grafo de imports. **Prod corre el commit DESPLEGADO (anterior a R69)** — para CWV/latencia es
> el baseline real que ve el usuario; para a11y de contraste/aria/focus es válido (paleta y
> sheet-manager son de R67, sin cambios en R69).

### 1. Core Web Vitals (Lighthouse mobile, prod)
| Pantalla | Perf | FCP | LCP | TBT | CLS | Speed Index | TTFB | Bytes |
|----------|------|-----|-----|-----|-----|-------------|------|-------|
| **Home `/`** | **59** | 1.3s | **6.1s** | 170ms | **0.189** | 8.1s | 2.11s | 858 KiB |
| **`/linea/183` (SSG)** | **96** | 1.2s | 1.9s | 40ms | 0 | 5.1s | 2.61s | 399 KiB |

- **Las landings SEO vuelan (96)** — SSG puro, sin mapa. El problema de performance es **el Home**.
- **LCP 6.1s (Home) = el headline.** El elemento LCP es `<span class="ct-text">` (el contador/hero
  "¿cuándo salir?") → pinta tarde, bloqueado por la fuente Archivo (88 KB woff2) + hidratación del SPA.
- **CLS 0.189 (Home, pobre, >0.1)** — layout shift durante la carga (swap de fuente + montaje del
  hero/contador + preview de mapa que se inserta). axe no lo detalló pero el patrón es claro.
- **TTFB ~2.1–2.6s en TODAS las rutas** (incluida la SSG estática) → no es cold-start puntual: el
  `proxy.ts`/middleware (auth Supabase) corre en cada request + spin de función Netlify. Afecta todo.
- **Recursos pesados en Home:** `stops.json` **209 KB** (gzip; 1.5 MB raw) cargado en el Home para
  paradas-cerca/mapa · fuente Archivo **88 KB** (variable wght+wdth) · **tiles CARTO + Leaflet
  cargan en el Home** (preview de mapa) — Leaflet está bien code-split (no es SSR) pero igual se
  baja en el Home. Unused JS estimado 112 KB.

### 2. Latencia `/api/stm/arrivals` (prod, warm)
| Parada | Cold | Warm | Fuente |
|--------|------|------|--------|
| 2201 | 3.7s | 1.3s | upstream+schedule |
| 3790 | 1.0s | 0.8s | far-tracking |
| 4040 (27 líneas) | 2.9s | **2.6s** | upstream+far+schedule |
| 880 | 1.8s | 1.1s | schedule |

- **Warm 0.8–2.6s; el peor caso son las paradas con muchas líneas** (4040, 27 líneas → `getBuses({lines})`
  trae decenas de buses + el gate GTFS los procesa todos). El fix de timeouts de R67 aguanta (sin 504).
- **Token OAuth: SÍ se cachea** (`mvd-api.ts`: `cached` en memoria del proceso, se reusa si vence en
  >30s; token dura 300s). Bien. PERO en serverless cada instancia FRÍA re-autentica (cache no cruza
  instancias). Y la cadena es serial: `getStopVariants` (4s) → `getBuses` (que adentro pide token 3s + buses 4.5s).
- **`getStopVariants` es cuasi-ESTÁTICO** (qué líneas/variantes sirven una parada cambia sólo cuando
  el STM reorganiza recorridos, cadencia GTFS) pero hoy se cachea sólo **60s** (`revalidate: 60`).
  **Oportunidad:** TTL largo (horas/días) o precomputar a JSON como el GTFS → saca el fetch de variantes
  del camino crítico en casi todos los requests.
- **Paralelización:** el token NO depende de las variantes → se puede prewarmear `getAccessToken()` en
  paralelo con `getStopVariants` (hoy el token se pide recién dentro de `getBuses`, después de variantes).
  En cold ahorra ~1–3s del camino crítico. (Diagnóstico — no ejecutado.)

### 3. Accesibilidad (axe-core 4.10 wcag2a+aa, Playwright 375px, prod)
- **axe: 0 violaciones** en Home, Ajustes, Ruteo, Mapa. **El contraste señalética dark PASA AA** (tokens
  medidos AA en globals.css — confirmado, no a ojo) y **0 botones icon-only sin aria-label/title** (FAB,
  cerrar, ajustes, etc. todos rotulados). Cierra positivamente la pregunta "¿AA en dark-only?".
- **🐞 Focus management de los sheets — ROTO (axe no lo detecta, es de comportamiento):**
  - Al **ABRIR** un bottom-sheet el foco **NO entra** al sheet (queda en `<body>`).
  - **Sin focus-trap**: tras 20 Tab, **15 se escapan** detrás del backdrop a contenido oculto.
  - Al **CERRAR**, el foco **NO vuelve** al disparador (se pierde en `<body>`).
  - Es el patrón modal/diálogo incompleto (WCAG 2.4.3 Focus Order + WAI-ARIA dialog). Afecta a teclado y
    lectores de pantalla en TODOS los sheets (parada, ajustes, ficha de bus, ruteo). Bug verificado.

### 4. Bundle / code-splitting
- **Bien code-split ✓:** `LeafletMap` es `dynamic(ssr:false)` (HomeMapPreview + MapScreen) → Leaflet NO
  entra en las SSG (confirmado: `/linea` perf 96, 399 KB). `MapScreen`/`RouteScreen`/`SearchScreen` son
  `dynamic(ssr:false)` por tab en AppShell → se cargan al cambiar de pestaña, no en el Home inicial.
- **🐞 `SettingsSheet` import ESTÁTICO en HomeScreen** → arrastra `useAuth` → `@supabase/ssr` +
  `@supabase/supabase-js` (~120 KB) **al bundle inicial del Home**, aunque el usuario nunca abra Ajustes
  ni se loguee. **Oportunidad clara:** `dynamic(ssr:false)` para SettingsSheet (ya se renderiza condicional
  `{showSettings && …}`) → difiere Supabase hasta que se abre Ajustes.
- **framer-motion entra estático en el shell** (AppShell `AnimatePresence` + HomeScreen + LeaveNowHero +
  StopArrivalSheet) → en el bundle inicial del Home. Difícil de splitear (es transversal a las animaciones
  del shell); se nota como costo fijo. Documentado, no trivial.
- **Archivo 88 KB** (variable wght+wdth) → reducible a ~35 KB soltando el eje `wdth` (instancia condensada
  fija). Ya estaba como optimización diferida (R67) — sigue válida, pesa en el LCP del Home.

### 5. ESLint `set-state-in-effect` (39 de 56 warnings; 0 errores)
- Muestra del camino caliente (`useArrivals:89` seed de cache, `HomeScreen:127/142` mount+deep-link,
  `MapScreen:89/138`, `AppShell:51`): **son patrones de mount/seed one-shot** — gate de `mounted`, seed
  desde cache/localStorage, handler de deep-link, clock de 30s. Corren **una vez por mount/dep**, no en
  loop ni por frame. Generan **1 render extra en mount**, no cascadas medibles. No están en el camino de
  los problemas de CWV (LCP=fuente+hidratación, CLS=layout). **Veredicto: ruido cosmético, queda como
  deuda legacy** (se silencian moviendo los seeds a inicializadores lazy de `useState` si algún día molesta).
  (Los otros 17: 7 exhaustive-deps, 6 refs-en-render en LeafletMap, 3 `Date.now()` en render, 1 unused — todos cosméticos.)

### 🎯 Prioridades (a decidir el punto de entrada juntos — NADA ejecutado)
| Prio | Hallazgo | Tipo | Entrada sugerida |
|------|----------|------|------------------|
| **P1** | **LCP 6.1s Home** (hero `ct-text` bloqueado por fuente+hidratación) | bug perf | preload/optimizar Archivo + priorizar el render del contador; medir LCP element |
| ~~P1~~ ✅🔶 | **Focus management de sheets** (no entra / no atrapa / no restaura) | bug a11y | **RESUELTO R70** — `useFocusTrap` en los 10 sheets. TRAP verificado; restore env-limitado. Ver abajo |
| ~~P2~~ 🔶 | **CLS 0.189 Home** | bug perf | **PARCIAL R70** — hero skeleton 168→264 (igualar hero poblado) bajó CLS **0.20→~0.10**. Residual: map section + "Más" async. Ver abajo |
| ~~P2~~ **P0✅** | **TTFB ~2.1–2.6s todas las rutas** (middleware en cada request) | bug perf | **RESUELTO R70** — ver abajo |
| ~~P2~~ ✅ | **Supabase ~120 KB en bundle inicial Home** (SettingsSheet estático) | oportunidad | **RESUELTO R70** — `dynamic(ssr:false)` SettingsSheet (único consumidor de useAuth → Supabase se baja al abrir Ajustes) |
| **P2** | **stops.json 209 KB en Home** | oportunidad | ¿cargar diferido tras el hero? ¿subset para paradas-cerca? |
| **P3** | getStopVariants 60s→TTL largo/precompute + prewarm token paralelo | oportunidad | cachear variantes (cuasi-estático) + paralelizar token |
| **P3** | Archivo 88→35 KB (soltar wdth) | oportunidad | instancia condensada fija |
| ~~P3~~ ⚠️ | framer-motion en bundle inicial | NO conviene splitear | está en `LeaveNowHero` (elemento LCP) + AnimatePresence del shell → splitearlo difiere el hero (empeora LCP) o exige reescribir el hero a CSS (refactor riesgoso). NO es win gratis; queda como costo fijo salvo refactor dedicado del hero. |
| ✅ | **Contraste AA dark-only OK · aria-labels OK · Leaflet/tabs bien split · /linea perf 96** | verificado positivo | — |
| legacy | 56 warnings ESLint (39 setState mount/seed) — cosméticos | deuda | dejar |

**Lectura:** no hay P0 (nada roto en prod). Los dos P1 son el LCP del Home (perf) y el focus-management
de sheets (a11y) — entradas independientes. Varias P2/P3 son baratas y autocontenidas (lazy SettingsSheet,
TTL de variantes). El contraste AA y los aria-labels salieron limpios — buena noticia del dark-only.

### ✅ RESUELTO R70 — TTFB del middleware (era el P0 real, no un P2)
**Causa raíz confirmada:** `src/middleware.ts` corría `supabase.auth.getUser()` (round-trip de red a
Supabase Auth) en CADA request — el matcher era un negative-lookahead que cubría TODO menos assets:
las ~6,600 páginas SEO (`/linea/*`, `/parada/*`, `/barrio/*`, `/a/*`, `/lineas`…), todos los `/api/*` y
los sitemaps. Por eso `/linea/183` (SSG, debería servirse del edge en ms) medía **TTFB 2.61s**.
**Y no servía para nada:** `getSupabaseServer()` está definido pero **NUNCA se llama** — ningún server
component ni API route lee la sesión server-side; todo el auth/favoritos es CLIENTE (`getSupabaseBrowser`
en `useAuth` + `sync-favorites`, con auto-refresh del token). El refresh server-side era peso muerto
(y el try/catch de R67 lo confirma: tiraba 500 en `/api/stm/*`).
**Fix paso 1 (`matcher: ["/"]`, commit 10c941f):** sacó el middleware de las 6,600 SEO + `/api/*`,
dejándolo sólo en `/`. **Verificado local** (dev logs): `/` mostraba `proxy.ts`; `/linea/183`,
`/parada/2201`, `/api/stm/arrivals` ya **NO**.

**Fix paso 2 — ELIMINADO del todo (`git rm src/middleware.ts`):** research del patrón oficial
`@supabase/ssr` (doc oficial, vía Supabase MCP) confirmó que es **vestigial** en esta app:
- La doc dice textual: *"Since Next.js Server Components **can't write cookies**, you need a Proxy to
  refresh expired Auth tokens and store them."* → el middleware existe **sólo** para que lecturas de
  sesión **server-side** (Server Components / Route Handlers) tengan cookie fresca. Esta app **no tiene
  ninguna** (`getSupabaseServer()` definido, **nunca llamado**).
- El refresh lo cubre **100% el browser client** (`createBrowserClient`, `autoRefreshToken` +
  `onAuthStateChange`): mientras la PWA está abierta y al reabrir (refresca desde el refresh-token en
  init). El middleware **sólo corre en requests** → no protege una PWA cerrada. En "reabrir con
  refresh-token cerca de expirar" el resultado es idéntico con o sin middleware (refresh-token válido →
  login; expirado → logout). **No agrega protección.**
- La propia doc, sobre "invalid refresh token errors", recomienda *"defer rendering to the browser where
  the client library can access an **up-to-date refresh token**"* — confirma que el cliente es la fuente
  de verdad y que el token server-side puede estar stale (problema conocido del patrón; sacarlo incluso
  evita la posible race de doble-refresh).
- **Por qué es SEGURO sacarlo (para que no se reintroduzca por error):** esta app es auth 100% cliente
  (favoritos sync opcional). **Reintroducir el middleware `@supabase/ssr` SÓLO si algún día se agrega
  lectura de sesión server-side** (un Server Component o Route Handler que llame `getSupabaseServer()` /
  `auth.getUser()` en el server). Mientras el auth siga client-only, el archivo no debe volver.

**Impacto total:** el `getUser()` (round-trip a Supabase Auth, ~2s TTFB en el edge) sale de **todas** las
rutas, incluido `/` → baja el TTFB del Home también (el lever que el paso 1 había dejado afuera por
conservador). Saca peso de las 6,600 SEO (ventaja competitiva #1), de `/api/*` (latencia de arrivals +
elimina el modo de falla 500 de R67) y del Home. Mejora de TTFB en prod se confirma post-deploy.
Era el de mayor palanca de la ronda.
**Verificado antes del `git rm` (no asumido):** `git show HEAD:src/middleware.ts` confirma que el archivo
era **100% auth** — sin headers, redirects, rewrites, geo ni locale (solo `NextResponse.next` + cookies de
sesión). Los headers de seguridad (**CSP, X-Frame-Options, HSTS, X-Content-Type-Options, Referrer-Policy,
Permissions-Policy**) viven todos en `netlify.toml` (`[[headers]]`), **independientes del middleware** →
eliminarlo no perdió ningún header.

### 📌 Follow-up CLS residual (~0.08) — P3, NO en esta tanda
El fix del hero bajó CLS 0.20→~0.10. El residual (`home-map-preview`+section-head ~0.04, `home-more`
~0.03) son **secciones condicionales que aparecen async** (map gated en `location`, "Más" en `mounted`,
paradas en `nearbyStops.length`). Reservar su espacio NO es como el fix de hoy ("el contenido final mide
X"): hay que pensar los **N estados** de cada sección (con/sin favoritos, con/sin rutas, mapa cargado o no,
GPS granted/denied) — reservar mal cambia un shift por otro (p.ej. reservar el map y colapsarlo en denied).
Hecho apurado introduce su propio CLS. **Queda como P3 con este contexto; tratarlo como pasada con cuidado,
no quick-win.**

### ✅🔶 RESUELTO R70 — Focus-management de sheets (`useFocusTrap`)
**Arquitectura (verificada, no asumida):** NO existe un "SheetHost" único — cada sheet renderiza su
propio contenedor. La unidad compartida es un HOOK: `src/hooks/useFocusTrap.ts`, una sola implementación,
aplicada en la raíz de **los 10 sheets** (SettingsSheet, StopArrivalSheet, LineDetailSheet, SaldoSheet,
HowToSheet, RoutesManager, StopPanel, VehicleCard, RoutePanel, PlacePanel) + `role="dialog"`/`aria-modal`/
`aria-label` en cada uno (nombre accesible → sin regresión de axe).
**Diseño:** pila global de traps (espeja `useBackClose`) → sólo el del tope atrapa, así los sheets
APILADOS (drill-down) atrapan en el hijo, no en el padre. Captura `activeElement` al montar y restaura al
desmontar → la semántica de stack (drill-down: back vuelve al padre; sólo el último vuelve al disparador
original) **sale gratis** del patrón captura/restaura. Respeta el autofocus de inputs (buscadores) → no
abre el teclado virtual de más.
**TRAP verificado** (`scripts/focuscheck.mjs`, Playwright Tab/Shift+Tab reales, 375px): el foco ENTRA al
abrir, queda ATRAPADO (0 fugas en 18 Tab → ya no se escapa detrás del backdrop, que era el bug del audit),
Shift+Tab hace wrap, y en drill-down el foco entra al hijo y queda atrapado ahí. 6/6 checks de trap PASS.
**RESTORE — implementado, verificación env-limitada (honesto):** el hook restaura el foco al disparador;
si el nodo capturado se desconectó (el header del Home RE-RENDERIZA el botón al cerrar), re-busca por
`aria-label` y enfoca el nuevo. PERO en el dev local **el Home se vacía intermitentemente al cerrar un
sheet** (mismo artefacto de página-en-blanco que en la medición de CLS; el SSR sirve bien pero Playwright
lo renderiza vacío) → el disparador desaparece y el restore no es auto-verificable acá (el test lo marca
**SKIP**, no FAIL). En prod (browser real) el disparador persiste/recrea → el restore aplica. **A confirmar
en prod post-deploy.**
**Teclado virtual 375px:** el trap respeta el autofocus (no roba el foco de un input auto-focuseado) → el
teclado aparece donde corresponde y no de más; los sheets sin input enfocan el contenedor (sin teclado).
**DoD:** tsc 0 · eslint 0 errores (3 warnings legacy) · vitest 235/235 · build OK.

### 🔶 CLS + decisión de fuente R70 (medido con PerformanceObserver, Playwright 375px)
**Fuente — DEJARLA (decisión cerrada):** Archivo ya está en `font-display: swap` → NO es
render-blocking; el hero pinta con la fallback al instante y swapea. Soltar el eje `wdth`
(88→35 KB) ahorra ancho de banda pero **casi no mueve el LCP** (el texto ya aparece). No vale
arriesgar la identidad señalética. El contexto post-middleware confirmó que la fuente no era el lever.
**CLS — fix parcial:** causa raíz medida = el **hero skeleton tenía `minHeight: 168` pero el hero
poblado mide ~221–277** (varía por estado) → saltaba +50 a +109 px al cargar y cascadeaba sobre
paradas+mapa+"Más". Fix: skeleton 168→**264** + el CTA sin-GPS también a 264 (que el swap no shiftee
en ninguno de los dos paths). **Resultado: CLS 0.20 → ~0.08–0.14** (varía porque el hero mismo varía;
un skeleton fijo no matchea un hero variable). **Honestidad:** en una iteración reporté "CLS 0" que era
FALSO — eran páginas en blanco (el dev server por `Start-Job` moría entre llamadas de PowerShell; con
`next start`/OpenNext la home tampoco se sirve medible). Corregido midiendo con dev persistente que SÍ
renderiza. **Residual (~0.08):** `home-map-preview`+section-head (0.04, el map section gated en
`location` aparece async) y `home-more` (0.03, gated en `mounted`). Bajarlo a <0.1 garantizado pide
reservar esas secciones async — pero reservar contenido condicional cambia un shift por otro según el
resultado (granted vs denied), así que es **más-touch, no "sin riesgo"** → follow-up.

## 🔎 QA AUDIT R68 (2026-06-14) — recorrido mobile-first (375px) post-rediseño
> Ronda de auditoría + tester end-to-end a 375px, foco en lo que cambió esta sesión
> (mapa/home/SW). Separación bug-verificado vs oportunidad. **0 errores de consola** en
> Home/Mapa/sheets tras los rediseños (los cambios visuales no metieron runtime errors).

### 🐞 Bugs verificados
| # | Hallazgo | Prio | Evidencia | Estado |
|---|----------|------|-----------|--------|
| A1 | **Toast "Nueva versión" tapaba el header del Home** (logo + GPS/ayuda/ajustes). A 375px el toast (y:10–57) solapaba el header (y:8–60). | P2 | boundingBox overlap + screenshot | ✅ **FIXEADO** — movido arriba de la bottom-nav (no obstruye, al alcance del pulgar) |
| A2 | **Map StopPanel + LineDetailSheet NO migrados a "señalética"**: colores hardcodeados (`#0a0f1c`, `text-amber-400`) y eyebrow ("PARADA #X" / "RECORRIDO COMPLETO") en `font-black` Jakarta, no en Señal. | P2 | screenshots + código | ✅ **FIXEADO (R68)** — utilidad `.eyebrow`/`.eyebrow.accent` (Señal), `Parada #X` en sodio, bg→asfalto, chapa del recorrido en Señal, "Aquí" a tokens sodio. Stacking **sin tocar** (sólo visual). text-slate/white se dejan (≈ niebla/tiza). |
| A3 | **"Más" cerrado por defecto aunque haya favoritos/rutas** → el gancho de retención queda enterrado detrás de un tap cada sesión. | P2 | screenshot `qa-home-full` (open=false con 2 favs+2 rutas) | ✅ **FIXEADO** — open-if-content (abre si hay favoritos/rutas; respeta el toggle del usuario después) |

### 💡 Oportunidades / UX (no son regresiones)
- **A4 (P3) — Hero "¡SALÍ AHORA! · ¡Ya!" cuando estás EN la parada (`atStop`).** ✅ **FIXEADO (R68)**: en atStop el hero habla de la LLEGADA del bus ("TU BUS · ¡Ahí viene!" / "tu bus en · N min"), no de salir. Helper puro nuevo `atStopUrgency` (urgencia por ETA del bus) + test explícito atStop=true; el cálculo de salida de Bug B (`walkToLeaveTime`) **NO se tocó** (su test sigue verde). Verificado en prod-local.
- **A5 (P3/backlog) — Compartir ubicación EN VIVO.** VoyEnBondi/Mi Bondi dejan compartir tu posición en tiempo real ("vení a buscarme, estoy acá"). Cuándo comparte links de parada/ETA (`shareStop`), no la ubicación viva del usuario. **Gap real, no regresión.** Barato-medio de copiar bien (Web Share + un link efímero con coords).

### ✅ Verificado OK (no se degradó con el rediseño)
- **Sheet-manager bajo estrés:** parada → drill-down "ver recorrido" **apila bien** (LineDetailSheet arriba de la hoja), sin sheet fantasma; peer-replace (bus → ficha) confirmado en la pasada del mapa. La política diseñada se sostiene.
- **"Más" en los 3 estados** (sin / 1 / varios favoritos): empty state **limpio** (CTA de rutas + Acciones STM en filas), no "vacío feo".
- **Cobertura suburbana/interior:** `useInteriorArrivals`/`isInteriorStop`/buses Busmatick **sin tocar** por el rediseño → intacta. (Competencia: Moovit/VoyEnBondi fuertes en suburbano; Cuándo mantiene GPS interior Maldonado/Paysandú/Rivera/Rocha.)
- **Carga:** next/font (self-host, swap) + Leaflet lazy (`dynamic ssr:false`) + datasets SWR. CWV sigue **sin medir** (pendiente histórico) — medir antes de prometer "carga veloz" vs VoyEnBondi.

### ▶️ Decisión de cola tras la auditoría
No hay P0/P1 nuevos → **se puede avanzar a Búsqueda/Ruteo**. Recomendado meter **A2 (migrar map StopPanel/LineDetailSheet a señalética)** en la MISMA pasada (tocan los mismos componentes de sheets) y resolver **A4** de paso. A5 al backlog de features.

## 🛡️ QA R67 (2026-06-13/14) — P0 deploy (cache + STM) + bugs de confianza + FASE 2
- **P0 — "Los servidores del STM están durmiendo" PERMANENTE para llegadas vivas Y programadas (`0fe5ff1`).** ⚠️ El diagnóstico inicial ("blip transitorio del STM") era **equivocado** — lo descartó el usuario con una observación correcta: los horarios PROGRAMADOS salen de `line-hours.json`+GTFS (nuestros), no del STM, así que no deberían caer con el tiempo real. **Causa raíz real:** vivo y programado viajan en UNA sola respuesta de `/api/stm/arrivals`, y `getStopVariants` es un fetch LIVE al STM (6s) que corre PRIMERO y SERIAL antes de los `getBuses` (6s) + token (4s). En cold start con STM lento la cadena pasaba el límite de función de Netlify (~10s) → **504** → el `catch` que sirve los programados **nunca corría** → el cliente ve `!res.ok` → "durmiendo" para todo. **Verificado:** cache de arrivals/vehicles ya era `no-store`/`bypass` (NO era el bug de cache de FASE 0). **Fix:** timeouts acotados (variantes 6→4s, token 4→3s, buses 6→4.5s) para que el fallback sea alcanzable; `no-store` en los 3 returns vacíos/error que no lo tenían; `try/catch` en `supabase.auth.getUser()` del middleware (sin él, un fallo de Supabase en el edge tiraba TODA la request → 500). **Verificado en prod con Playwright** (todas las respuestas 200 + arrivals poblado; ficha-de-bus y hoja confirmadas con datos reales). **Test de regresión:** `tests/arrivals-degradation.test.ts` (getStopVariants timeout → 200 schedule-only). Ver anti-patrón en ARQUITECTURA §11.
- **P0 — buscador y voz "no andaban" en prod (FASE 0).** Causa raíz: varias API routes que dependen de query params (`geocode`, `walking`, `stm/geocode`, `stm/stop-info`) marcan `Cache-Control: public`, y la CDN Durable de Netlify las cacheaba **sin variar por la query** (Netlify-Vary por defecto solo varía en `__nextDataReq|_rsc`). Resultado: **toda** request a `/api/geocode?q=X` colapsaba en UNA entrada → se servía el mismo resultado ("Río Grande 857") para cualquier búsqueda; la voz busca lo transcripto → tampoco andaba. **Verificado con curl a `cuando-bondi.netlify.app`** (3 queries distintas → objeto idéntico, `Cache-Status: Netlify Durable; hit`). Local (`next start`) no tiene la CDN Durable → andaba siempre (por eso parecía "anda local, no en prod"). **NO era env var** — geocode es keyless. Fix: `Netlify-Vary = "query"` en `/api/*` (netlify.toml). Requiere deploy para verificar.
- **Bug A — ruta peatonal "rara" a Tres Cruces.** *Causa primaria (resuelta por el fix de arriba):* `/api/walking` también colapsaba → servía la MISMA ruta para coordenadas distintas (verificado: Pocitos→Centro y TresCruces→Cordón devolvían 3834m idénticos). *Causa secundaria (PENDIENTE, decisión de datos):* el destino "Tres Cruces" usa una coordenada genérica (`destinos.ts` -34.8945,-56.1647), no la **entrada real** de la terminal; el planner elige la parada de bajada por proximidad geométrica al punto destino y el tramo a pie rutea a ese punto aunque quede del otro lado del predio. Falta un dataset de **entradas reales por terminal/POI grande** (Tres Cruces, Shopping, hospitales) + preferir la parada de bajada que deje en la entrada. Documentado para próxima sesión.
- **Bug B — "cuándo salir" llegaba tarde (resuelto).** `LeaveNowHero` anclaba en `arrivals[0]` (el bus más próximo) aunque ya no diera tiempo de caminar → "¡Ya!" para un bus imposible. Ahora ancla en el primer bus con `eta ≥ caminata − 1 min` (si `atStop`, vale el más próximo). El cálculo de caminata (sinuosidad 1.3, 75 m/min, buffer 4–6) ya era correcto — el bug era la **elección del bus**, no la matemática.
- **FASE 2 — pasada de tokens "Señalética" (`27244c3`).** Paleta nombrada (asfalto/vereda/sodio/vivo/tiza/niebla/alerta = Montevideo de noche), tipografía "Señal" (Archivo condensada via next/font, eje wdth) en chapas/contador/eyebrows, y **decisión DARK-ONLY** (cola #8 resuelta): `resolveTheme` siempre dark, selector de Apariencia quitado de Ajustes.
- **FASE 2 — pasada estructural del Mapa.** Tira de señalética (el conteo "X paradas" pasó de card protagonista a **pill discreto** — es metadata, no acción; la acción real = FAB de centrar, prominente), **ficha-de-bus** como bottom-sheet del sistema (chapa + tabular + tokens; par=bottom-sheet, drill-down=apilada sobre la hoja de parada), controles tokenizados. **Manager de sheets:** escala de z-index única documentada en `globals.css` + política (paneles par se excluyen vía estado de MapScreen; solo la ficha-sobre-parada apila). Sin manager global nuevo (los sheets del Home adoptan el sistema en una pasada futura).
- **Optimización futura (no ejecutar preventivamente):** la fuente "Señal" (Archivo variable wght+wdth, ~85 KB woff2) se puede bajar a **~35 KB** soltando el eje `wdth` (instancia condensada fija) si CWV lo pide cuando se mida. Decisión del usuario: mantener el wdth completo por ahora (el condensado real lo vale).
- **Pendiente menor (commit aparte):** el CSS `[data-theme="light"]` quedó como código muerto (dark-only) → limpieza en su propio commit.
- **Estado QA**: tsc 0 · 207/207 tests · build OK · ESLint 57 warnings, 0 errores. Fixes R67 en commits `f37eaf8` (cache), `23a8244` (hero), `27244c3` (tokens).

## 🛡️ QA R66 (2026-06-13) — anti-troll server-side en ocupación
- **Estado QA actual**: tsc 0 errores · **207/207 tests verdes (27 archivos)** · build OK · ESLint 57 warnings (legacy), 0 errores.
- **Contexto**: el endpoint `/api/occupancy/report` ya tenía rate-limit global por IP (5/15 min, 429) — la premisa "solo cliente con localStorage" estaba desactualizada. El hueco real era otro: el global **no protege el agregado**, porque no impide que una IP mande 5 veces "lleno" de la MISMA línea+parada e infle el promedio.
- **Fix (R66)**: segunda capa **dedup por (IP, línea, parada)**: 1 reporte por combinación / 15 min → un troll aislado aporta a lo sumo un reporte por línea. 429 rioplatense según motivo (duplicado vs flood) + header `Retry-After`. El budget se consume **tras el insert exitoso** (commit después del insert): un guardado fallido o 503 no bloquea el reintento legítimo. `rateLimitCheck`/`rateLimitCommit` puros con reloj inyectado → +8 tests. Sin dependencias nuevas, todo en el route handler.
- **⚠️ Límite conocido y aceptado**: el estado vive **in-memory por instancia serverless** → no se comparte entre instancias ni sobrevive a un cold start. Es una traba real contra el troll casual (DevTools, repetir el POST) y el script ingenuo; un atacante que **rote IPs/instancias** necesitaría un **store compartido** (Redis/Supabase). Eso implicaría **persistir la IP = PII que el proyecto evita**, así que quedó **fuera de alcance** a propósito. Documentado también en el header de [route.ts](../src/app/api/occupancy/report/route.ts). Si en el futuro se requiere defensa cross-instancia, evaluar un hash con sal rotativa de la IP (no la IP cruda) con TTL corto.

## 🛡️ QA R65 (2026-06-13) — empty state útil + home a 3 secciones + backdrop
- **Estado QA actual**: tsc 0 errores · **199/199 tests verdes (27 archivos)** · build OK · ESLint 57 warnings (legacy `set-state-in-effect`), 0 errores. *(El 151/151 de QA R51 y el 142/142 de QA R50 son snapshots de su ronda — el conteo vigente es 199.)*
- **Empty state del hero**: antes "No viene ninguno en 30 min" a secas. Ahora "El próximo vuelve ~HH:MM · en N min" (vía `inactiveLines`, computado server con `line-hours.ts`) + badges de líneas que retornan + **parada alternativa a pasos ≤150 m** tocable. StopPanel/RouteScreen ya tenían el patrón (R58-R64); StopPanel: copy del cartel apunta a los horarios de retorno + paradas a pasos de abajo.
- **Home density (3 secciones)**: planner+hero "¿cuándo salir?" · paradas cerca (secundario) · **mapa promovido** (encabezado propio, 150→210 px, sombra/borde fuerte). Lo secundario (favoritos, rutas, Acciones STM) en bloque **"Más" colapsable** (`<details>`, cerrado, resumen con counts). **Saldo STM no orfanado** — sólo se abre desde ahí.
- **Sheet backdrop**: el dark ya estaba en 0.82 (>70%, R58); el real gap era **light a 0.45 → 0.72**. Dark reforzado 0.82→0.88 / blur 16.
- **Pull-to-refresh**: confirmado ya existente desde R58d (gesto >55 px + indicador + spin) — no se reimplementó.
- **Sin tests nuevos**: cambios sólo en componentes/CSS de home (no se tocó `lib/` ni `api/`).

## 🛡️ QA R51 (2026-06-10) — Fable 5: monolitos partidos + MAP-1/MAP-2 + accesibilidad
- **PG-1 + PG-2 ejecutados**: MapScreen (957→~490) y RouteScreen (1498→~430) partidos en orquestador + componentes presentacionales. Comportamiento verificado idéntico (E2E smoke Playwright: mapa monta, búsqueda 3 sugerencias, 4 rutas a Tres Cruces, 0 errores JS).
- **MAP-2 RESUELTO** (causa raíz confirmada): arrivals y vehicles refrescan desfasados → el bus seguido desaparecía del merge un ciclo y la card moría. Fix: retener última posición conocida mientras siga el seguimiento.
- **MAP-1 RESUELTO** (hardening): layers de tabs inactivos con `visibility:hidden` además de `opacity:0` (capas compuestas de Leaflet podían quedar pintadas sobre el mapa real).
- **PG-4 primera pasada**: live regions `role="status"` (StopPanel + StopArrivalSheet), sr-only "llega en X minutos" (ArrivalRow), aria-label contextual (LeaveNowHero), Leaflet respeta `prefers-reduced-motion`. Falta: contraste AA light, textos 11-12px, lector real.
- **DT-9 + QW-4**: haversine 5 copias → `lib/geo.ts`; unused var fuera. `classifyArea` extraída a `lib/route-area.ts` (pura) con **9 tests nuevos**.
- **Estado QA**: tsc 0 · **151/151 tests** · build OK · ESLint 57 warnings (antes 59), 0 errores.
- **Deploy observado**: Netlify conectado (commits de redeploy) pero `cuando.uy` no resuelve — falta dominio/DNS/Search Console. Confirmar URL con el usuario y verificar SCH-1 en prod.

## 🛡️ QA R50 (2026-06-10) — auditoría total + FABLE.md
- **Auditoría total** realizada por Claude Sonnet 4.6 — ver [FABLE.md](FABLE.md) para el documento maestro completo.
- **Estado QA verificado**: TypeScript 0 errores · ESLint 59 warnings 0 errores · 142/142 tests verdes.
- **Nuevos hallazgos**: DT-9 (haversine duplicada en arrivals/route.ts + lib/utils.ts) — riesgo bajo, refactor candidato.
- **Ideas nuevas documentadas en FABLE.md §11**: "Modo frío", modo terminal/quiosco, compartir countdown real.

## 🛡️ QA R49 (2026-06-04) — testabilidad + cobertura (degradación + adversarial)
- **Mejora**: extraída la validación de coords de `route/plan` (estaba duplicada e inconsistente: `inMvd` sin finitud + bounds inline que dejaban pasar NaN) a `src/lib/mvd-area.ts` → `isValidMvdCoord` (pura, `Number.isFinite` + bounds, usada también en waypoints). Menos código, una sola fuente, testeable.
- **Tests +11 (78→89)**: `mvd-area.test.ts` (4 — NaN/Infinity/null/string/objeto/fuera-de-área/invertidos = regresión VAL-2) + `degradation.test.ts` (7 — líneas/paradas inexistentes y viajes/tarifas vacíos no crashean). Verificado E2E: `route/plan` rechaza `{lat:null}` y Buenos Aires con 400.
- **Gap restante de testing** (prioridad declarada): degradación de **proveedores externos** caídos (STM/Nominatim/Supabase), E2E, accesibilidad, performance.

## 🛡️ Auditoría QA R47 (2026-06-04) — resiliencia cliente + validación (nuevos vectores)
| ID | Sev | Área | Defecto (verificado) | Evidencia | Estado |
|----|-----|------|----------------------|-----------|--------|
| RES-2 | **MEDIO** | Resiliencia | `savePrefs`, `setMode`, `setVoiceEnabled` hacían `localStorage.setItem` **sin try/catch** → throw con cuota llena o Safari modo privado → **crashea la acción** (guardar favorito, cambiar tema, completar onboarding) | grep: 3 setItem sin try | ✅ FIX R47: try/catch en los 3 (favorite-stops ya estaba protegido) |
| VAL-2 | BAJO | Validación | `route/plan` validaba `typeof lat==="number"` pero **NaN pasa** (typeof NaN==="number" y bounds con NaN son false → se cuela) | PoC node confirmado | ✅ FIX R47: `Number.isFinite` (no explotable por red —NaN→null por JSON— pero hardening correcto) |
| VEH-1 | BAJO | Validación | `/api/stm/vehicles` splitea `lineIds` sin límite de cantidad | route.ts:51 | ⏳ riesgo bajo (la API STM acota); monitorear |
- **Diferenciación honesta**: RES-2 = **defecto confirmado** (crashea en condición real). VAL-2 = **hardening** (no explotable por red hoy, pero correcto). VEH-1 = **riesgo probable** (no demostrado explotable).

## 🛡️ Auditoría QA formal 2026-06-04 (R46) — mentalidad "desconfiar hasta comprobar"

### Defectos hallados (verificados en código, no teóricos)
| ID | Sev | Área | Defecto | Evidencia | Estado |
|----|-----|------|---------|-----------|--------|
| SEC-1 | **ALTO** | Seguridad/XSS | 9 bloques `<script ld+json>` con `JSON.stringify` sin escapar `<` → un dato con `</script>` rompe el bloque e inyecta | PoC: `JSON.stringify({n:"</script>…"})` deja `</script>` literal | ✅ FIX R46: `jsonLdHtml()` escapa `<>&` + U+2028/9; 3 tests regresión |
| RES-1 | **ALTO** | Resiliencia | `/api/geocode` (search+reverse) sin timeout → cuelga si Nominatim lento | `fetch:2 timeout:0` | ✅ FIX R46: `AbortSignal.timeout(6000)` |
| SEC-2 | MEDIO | Seguridad | CSP con `script-src 'unsafe-inline' 'unsafe-eval'` → debilita defensa XSS | netlify.toml:50 | ⏳ requiere nonces (Next); mitigado por SEC-1 |
| VAL-1 | BAJO | Validación | `arrivals` valida `!stopId` pero no formato (gigante/no-numérico) | route.ts:170 | ⏳ riesgo bajo (query a API externa, no path) |

### Cobertura de pruebas — qué se verifica y qué NO (gaps)
- ✅ Hay: 78 tests unitarios (ruteo, horarios, seguridad-zonas, trip-safety, fares, intersection, jsonLd-XSS).
- ❌ **Faltan**: tests de API routes con inputs inválidos/vacíos/extremos; tests de degradación (API STM/Nominatim caídas); tests E2E de flujos críticos (planificar ruta, abrir parada); tests de concurrencia del crowdsourcing; tests de accesibilidad (lector de pantalla, contraste AA); tests de carga/performance.

### Riesgos FUTUROS (aparecen al crecer)
- **Crowdsourcing sin anti-troll server-side** → spam cuando haya volumen (hoy solo rate-limit cliente, evitable). P2.
- **localStorage sin límite/expiración** (favoritos, history, tips, caché) → puede llenar la cuota (~5MB) y tirar `QuotaExceededError`. P3.
- **`analytics_events`/`occupancy_reports` crecen sin retención** → tablas gigantes, queries lentas. P2: agregar TTL/limpieza.
- **GTFS/datos se actualizan a mano** (no hay pipeline) → quedan viejos sin aviso. P1 arquitectura.
- ~~**Monolitos** RouteScreen/MapScreen~~ → **partidos (R51)**: RouteScreen ~469, MapScreen ~490 + sub-componentes. ✅

## 🔬 Auditoría crítica 2026-06-03 (R42) — no asumir que "compila = bien"

### A. Crowdsourcing de ocupación — defectos reales encontrados (en lo recién hecho)
- **🔴 Cold-start fatal** [P1]: con 0 usuarios no hay datos NUNCA. La sección pide sin dar → ruido para los primeros miles. Maprab/Moovit/Google lo resuelven con VOLUMEN que no tenemos. **Evidencia**: lógica `getRecentOccupancy` devuelve {} sin reportes. **Decisión**: mantener el código pero **NO activar el SQL hasta tener volumen** (degrada = invisible); cuando se active, sutil. → tarea: estrategia de volumen / seed.
- **🔴 1 reporte = mentira agregada** [P1] → **ARREGLADO R42**: antes mostraba "🔴 venía lleno" con count=1 como verdad. Ahora con 1 reporte dice "1 persona: venía lleno" (no como hecho); agregado firme solo con ≥2 ("2 dicen").
- **🟡 "hace 0 min"** roto → **ARREGLADO R42**: "recién".
- **🟡 Disonancia temporal** → **ARREGLADO R42**: el copy apuntaba al que espera (no sabe la ocupación); ahora "¿Te subiste recién? contá cómo venía" apunta al que SÍ sabe.
- **⏳ Anti-troll server-side** [P2]: hoy solo rate-limit cliente (localStorage, evitable). Falta límite por IP/sesión server. La agregación mitiga pero no blinda.

### B. Interdepartamentales — CORRECCIÓN de auditoría previa (medición errada)
- **Evidencia medida 2026-06-03**: `interdept.json` = **55 destinos, 420 salidas, 35 empresas, 24 destinos** (incl. internacionales: Buenos Aires, Asunción, Porto Alegre, Florianópolis). **El "13 frecuencias" reportado en rondas previas era un bug de conteo** (leí solo el 1er destino). La cobertura de SALIDAS desde Montevideo es sustancial.
- **Lo que SÍ falta** [P1]: (1) sentido inverso (interior→MVD) y entre-departamentos (Maldonado→Rocha); (2) GPS en vivo solo 4 deptos; (3) búsqueda O-D interdept robusta; (4) el dato no se actualiza solo.
- **FUENTE OFICIAL hallada** [P1]: **catalogodatos.gub.uy → MTOP → "Horarios de ómnibus en líneas interdepartamentales"** (CSV/datos abiertos: empresa, origen, destino, recorrido, salida, paradas intermedias — ambos sentidos). + "Recorridos ómnibus suburbanos" + GTFS metropolitano (jun-2024). Legal, mantenido por DNT/MTOP. → tarea: pipeline de ingesta del CSV MTOP → reemplazar/ampliar interdept.json (TOCA DATOS → avisar antes de aplicar).
- Empresas privadas (COPSA/CITA/Agencia Central/Núñez/Turil/EGA/CUT…): sitios propios, scraping frágil; el dataset MTOP los agrega oficialmente → preferir MTOP.

### C. Auditoría competitiva (Maprab / Moovit / Google Maps)
| | **Hacen mejor que nosotros** | **Hacemos mejor** |
|---|---|---|
| **Maprab** | Ya está deployado + en la calle; ocupación crowdsourced con volumen; personalización de marcadores; capa satélite | SEO (ellos 0 páginas), honestidad sin trackers, seguridad contextual, ruteo 181/183, claridad para mayores |
| **Moovit** | Cobertura mundial, alertas "bajate ahora", base de usuarios enorme | Sin ads invasivos, foco local UY, datos oficiales sin inventar, privacidad |
| **Google Maps** | Confiabilidad, multimodal, ocupación histórica, familiaridad, escala | Especificidad UY (interior, empresas, wifi del bus), SEO en español local, liviano |
- **Qué haría ABANDONAR nuestra app y volver a ellas** [P0/P1]: (1) que recomendemos un bus que no opera → mitigado R37; (2) que el interdept mande a caminar o falte el de vuelta → P1; (3) que esté lenta/rota tras deploy → mitigado R36+R41; (4) que el crowdsourcing muestre datos basura → mitigado R42; (5) **que no exista (no deployada)** → P0.

### D. UX por perfil (simulación) — puntos de confusión + tareas
- **Persona 60 años, 1ª vez**: el mapa-preview ayuda (entiende un mapa). Confusión: "¿Cuándo te tenés que ir?" como label sin contexto; el contador "¡Ya!/min" puede no entenderse sin explicación. → tarea: microayuda 1ª vez sobre el hero (onboarding contextual P2).
- **Viene de Maprab**: espera ver TODOS los buses en el mapa al instante y personalizar. Nuestra home es más guiada (menos densa). No es malo, pero el power-user puede sentirla "simple". → tarea: que el acceso al mapa completo sea más prominente (ya está la preview).
- **Nunca usó apps de transporte**: la big-action "¿A dónde querés ir?" es clara. Riesgo: demasiadas secciones en la home (preview, hero, cercanas, rutas, acciones) → scroll largo. → tarea: revisar densidad/jerarquía de la home (P2).

---

## Preguntas de retención (convertir respuestas en tareas)
- **¿Qué hace volver a Maprab?** cobertura nacional madura, ocupación crowdsourced, ficha del bus. → tareas #5, #7.
- **¿Qué hace volver a Google Maps?** confiabilidad, multimodal, familiaridad. → confiabilidad horarios #2.
- **¿Qué hace volver a Moovit?** alertas "bajate ahora", cobertura. → experiencia parada #4.
- **¿Qué hace abandonar?** recomendar un bus que no opera (confiabilidad #2), app rota tras deploy (#1 ✅), interdept que manda a caminar (#7).

---

## 🔭 FRENTE 1 — Staleness del GTFS (research 2026-06-17, no ejecutado)

> "Los datos se quedan viejos y no hay mecanismo que lo detecte." **Premisa parcialmente FALSA** — ya existe infraestructura. Lo verificamos con números reales.

### Estado HOY: al día
- `data/gtfs-version.json` = `{version: "20260608", recordedAt: "2026-06-11"}`.
- Freshness check EN VIVO contra el STM (`version.txt`, OAuth2): **upstream 20260608 = local 20260608 → AL DÍA.** Los datos MVD no están viejos hoy.

### Lo que YA existe (no hay que construirlo)
- **`.github/workflows/gtfs-freshness.yml`**: cron semanal (lunes 09:00 UTC) → valida datos + compara versión STM vs local → **abre un issue de GitHub** (sin duplicar) con los pasos de regeneración. "No envejecen en silencio".
- **`scripts/pipeline/download-gtfs.mjs`**: descarga el ZIP oficial (endpoint `buses/gtfs/static/latest/google_transit.zip` + `version.txt`, OAuth2).
- **`scripts/pipeline/check-gtfs-freshness.mjs`**: compara y `--save` registra la versión. Degrada sin credenciales (no rompe forks).
- **`validate-gtfs-data.mjs`**, **`check-shape-alignment.mjs`**: validación de datos + shapes.
- Los 9 pasos de regeneración son TODOS scripts existentes (`build-gtfs-db`, `export-gtfs-json`, `build-stops-json`, `merge-metro-gtfs`, `build-stop-dirs`, `routes:update`, `validate`, `--save`).

### Los gaps REALES (esto es lo que falta)
1. **Alerta sí, regeneración automática NO.** El workflow abre un issue; un humano corre 9 pasos a mano. No existe el "(b) regenerar + abrir PR" automático. Como todos los pasos ya son scripts, esto es **ensamblar** (un workflow que corre los 9 + crea PR), no construir.
2. **Cobertura solo MVD.** El metro/suburbano (`metro-schedule.db`, 33MB, último 2026-06-01) y el interdept (`interdept.json`, 2026-06-01) **no tienen freshness check**. El GTFS metropolitano (MTOP) y el dataset interdept envejecen sin vigilancia.
3. **Sin provenance en el dato servido.** `gtfs-v2.json` no tiene campo de versión embebido; el único registro es `gtfs-version.json` (archivo aparte). Si alguien regenera sin `--save`, el baseline driftea silenciosamente.
4. **No verificable acá si el workflow corre de verdad** (depende de secrets en GitHub + `gh` no está instalado local). A confirmar: que tenga los secrets y que haya disparado al menos una vez.

### Breakage si el GTFS cambia y no actualizamos (números reales)
- **6.340 páginas SEO de parada** (`/parada/[id]` con ≥2 líneas) + **230 de línea** (`/linea/[x]`, 1.481 variantes) muestran datos viejos: paradas que ya no existen, recorridos cambiados.
- **Motor de honestidad degrada**: `bus-direction-gtfs.ts` proyecta sobre la SECUENCIA DE PARADAS de `gtfs-v2.json` (`getStopsForVariant`, no un shapes aparte). Si una variante cambia su secuencia y no actualizamos, la proyección "ya pasó / viene" se corrompe → vuelven los buses-fantasma que R57 arregló.
- **Ruteo** puede mandar a una parada eliminada (`route-planner-gtfs.ts` usa las mismas paradas).

### Diseño del pipeline auto (lo que falta, no implementar aún)
Un workflow `gtfs-regenerate.yml` (disparado por el issue de freshness o manual): descarga ZIP → corre los 9 scripts → valida → si pasa, **abre PR** con los datasets regenerados + `--save` de la versión (no push directo a main: el PR deja revisar el diff de paradas/líneas antes de desplegar). Extender el freshness check a metro/interdept (sus fuentes: MTOP). Embeber `version` en `gtfs-v2.json` para provenance auto-verificable.

---

## 🎯 FRENTE 2 — Calibración de tiempos y trayectos (research 2026-06-17, no ejecutado)

### 2a. ETA de MVD (bus-direction-gtfs) — método, requiere ventana dedicada
La precisión real del "~N min" de MVD necesita ground-truth en el tiempo: pollear una parada cada 30s y anotar cuándo el bus desaparece de llegadas (= llegó), comparar contra el ETA mostrado, repetido en 5-10 paradas × varias horas. **Es la única sub-medición que necesita una ventana dedicada de horas** (no se hace honestamente en una corrida). Harness: script Playwright/curl que pollea `/api/stm/arrivals?stopId=X`, registra `(t, vehicleId, eta)` por bus, y al desaparecer un bus calcula error = `eta_en_T − (t_desaparición − T)`. Pendiente de correr con ventana real. Lo honesto: **no lo medimos todavía, no lo afirmamos**.

### 2b. Interior `AVG_SECONDS_PER_HOP=90` (constante puesta a ojo) — MEDIDO: 90s SOBREESTIMA
Captura Busmatick Maldonado (`scripts/measure-interior-hops.mjs`), midiendo el delta de tiempo cuando un coche cambia de `p1c` (cruzó a la parada siguiente). 6 snapshots × 60s, 12 buses/snapshot, **33 cambios de p1c observados**.

**Resultado: los 33 hops ocurrieron dentro de UN solo intervalo de 60s → el hop real es ≤60s, no 90s.** Los buses "limpios" de incremento unitario (ej. L12 coche 325: 707→708→709→710, exactamente 1 parada por muestra de 60s; L24 coche 150: 130→131→132) avanzan ~1 parada cada 60s pero nunca 2 → el hop está en **~45-60s**. **El 90s sobreestima → las ETAs del interior salen MÁS LARGAS de lo real** (le decimos a la gente que el bus está más lejos en tiempo de lo que está).

**Captura fina (15s × 16, midiendo el tiempo entre cambios de `p1c` consecutivos del mismo coche): 31 hops, mediana 45s, promedio 47s** (distribución 15-120s: muchos de 15-30s entre paradas cercanas, cola hasta 120s). **El real es ~45s, la mitad del 90s asumido.** → **Recomendación: bajar `AVG_SECONDS_PER_HOP` a ~50s** (45 medido + margen chico para hora pico — la captura fue ~22:00, tráfico liviano; conviene no calibrar solo con datos nocturnos antes de bajar de 50). Igual hay que mantener el `~` (sigue siendo estimado). Reproducible con `scripts/measure-interior-hops.mjs`.

### 2c. Ruteo O-D (route-planner-gtfs) — sanity OK, optimalidad pendiente
3 pares probados contra `/api/route/plan`: Ciudad Vieja→Tres Cruces da directo 180/188 (0 transb), Centro→Punta Carretas da 117/121 directo, Tres Cruces→Pocitos da 64→427 (1 transb). Opciones plausibles, directos donde existen. **Sanity OK**; una auditoría de optimalidad rigurosa necesita ground-truth por par (comparar vs Cómo Ir/Moovit) — no hecho acá.

### 2d. Horarios "24h" (line-hours) — CORRECCIÓN del doc: 43, no 157
CLAUDE.md §6 afirma "157/233 líneas con bitset saturado 00:00-24:00". **El número real con la lógica actual (bloque contiguo principal, tolera huecos ≤2 cuartos) es 43/233** (~18%). Literal-24h (todos los cuartos, todos los días): solo **24**. La lógica de bloque-principal (line-hours.ts:102) ya descarta los falsos 24h por outliers de madrugada que inflaban el número viejo. **Acción: corregir el 157 en CLAUDE.md §6 + anti-patrones.** Ground-truth de "¿la línea X corre a las 2am?": spot-check del feed STM a esa hora (no corrible ahora). Candidatas a revisar (24.0h exactas): 2, 17, 76, 103, 105, 109, 125, 137, 145, 148, 149, 151.

---

## 🧩 FRENTE 3 — Features: estimaciones de esfuerzo (research 2026-06-17, no ejecutado)

> Hallazgo transversal: **la mayoría ya está parcial o casi construida**. Reuso, no rebuild.

| # | Feature | Qué YA existe | Qué falta | Esfuerzo |
|---|---------|---------------|-----------|----------|
| **A** | "Avisame cuando falten N paradas" | `followAlert` (now/soon a ≤2 paradas) + `speak()` + `haptic()` + countdown YA disparan al seguir un bus (MapScreen:377-393) | Notificación OS vía `registration.showNotification()` (para pantalla apagada/app en background) + pedir permiso `Notification` (hoy NO se pide; sí tenemos SW + permiso de vibración) | **Chico-medio** — agregar OS notif a una lógica que ya existe + 1 permiso |
| **B** | Compartir ETA como link | `navigator.share` + fallback clipboard YA en `share.ts`; `StopArrivalSheet` ya pasa el próximo ETA al compartir | Verificar el formato del texto; agregar botón compartir al StopPanel del mapa (no lo tiene) | **Chico** — mayormente hecho |
| **C** | Badge de desvío en favorito de línea | `useServiceAlerts`/`service-alerts.ts` (feed) + `favorite-lines.ts` existen, pero **no cruzados** | Cruzar favoritos × alerts activas → badge en el favorito + nota al abrir el sheet | **Medio-chico** — wiring nuevo, datos ya están |
| **D** | Historial de paradas recientes | YA existe: `ondas_stop_history` en SearchScreen (localStorage, lista + "Borrar") | Surfacearlo en el **Home** (hoy solo en Buscar) | **Chico** — el dato ya existe, falta UI en Home |
| **E** | Modo "estoy en el bus" | YA existe el grueso: follow + `followAlert` (voz+haptic "Faltan N paradas") + countdown + `voice-alerts.ts` (toggle en Ajustes) | Elegir parada DESTINO (hoy alerta hacia la parada seleccionada) + OS notif (solapa con A) | **Medio** — el núcleo existe; el incremento es destino + notif |

**Orden sugerido por impacto/esfuerzo:** D (chico, retención) → B (chico, viral) → A (chico-medio, retención alta; desbloquea E) → C (medio-chico, recurrentes) → E (medio, sobre A). Decisión de cuál entra primero: del usuario.
