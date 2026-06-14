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
- **Problemas:** monolitos RouteScreen (~1200) / MapScreen (~900); 54 warnings set-state-in-effect.
- **Implementado:** ✅ TS strict, 75 tests, geo unificado, sin dead code mayor, lint 0 errores.
- **Pendiente:** ⏳ partir monolitos (P3), limpiar warnings (P3).
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
- **Monolitos** RouteScreen(~1200)/MapScreen(~900) → bugs al modificar, difícil testear. P3.

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
