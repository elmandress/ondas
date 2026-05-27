# Ondas — Software Requirements Specification (SRS lite)

Versión 0.1 · Mayo 2026 · Autor: Claudio

---

## 1. Visión y propósito

**Ondas** es una app web mobile-first para consultar el sistema de transporte público de Montevideo (STM) en tiempo real. Su objetivo es resolver, mejor que las apps oficiales actuales (*Cómo Ir*, *STM Montevideo*), tres preguntas concretas que un montevideano se hace todos los días:

1. **"¿Cuándo llega mi bus a esta parada?"** (con datos en vivo y honestos)
2. **"¿Dónde está la parada más cerca de X lugar?"** (búsqueda inteligente tipo Google Maps)
3. **"¿Cómo llego desde A hasta B?"** (planificación multimodal estilo Citymapper)

Principio rector: **honestidad de datos**. Si la API no responde, mostrar estado vacío real — nunca inventar datos.

---

## 2. Alcance

### In-scope (v1.0)

- Departamento de Montevideo (4940 paradas STM)
- Líneas urbanas y suburbanas de las 4 empresas STM (CUTCSA, COETC, COMESA, UCOT)
- Llegadas en tiempo real + horarios programados como fallback
- Búsqueda de paradas, lugares conocidos (POIs), direcciones
- Planificador de rutas con transbordos
- Visualización de recorridos de bus seleccionado
- Modo dark único (sin toggle día/noche)

### Out-of-scope (v1.0)

- Canelones e interdepartamentales (futuro v1.5)
- Compra de pasaje / saldo STM
- Sistema de cuentas / sincronización entre dispositivos
- Notificaciones push de llegadas
- Modo offline completo

### Out-of-scope permanente

- Mocks o datos inventados cuando la API falla
- Inferir características que no podemos verificar (ej: garantizar WiFi en un bus específico)

---

## 3. Stakeholders

| Stakeholder | Necesidad principal |
|---|---|
| Usuario final montevideano | Llegar a su destino sin perderse en horarios o paradas |
| Usuario turista | Entender el sistema sin conocer códigos de línea |
| Desarrollador (yo) | Código mantenible, datos verificables, sin deuda técnica |
| API STM (IMM) | No abusar de sus endpoints, cachear cuando se pueda |

---

## 4. Requerimientos funcionales (FR)

### FR-1: Llegadas en tiempo real por parada

- **FR-1.1**: Al seleccionar una parada, mostrar próximas llegadas en orden ascendente de tiempo.
- **FR-1.2**: Para cada llegada mostrar: número de línea, destino, ETA en minutos, badge de fuente (En vivo / Horario / Estimado).
- **FR-1.3**: Auto-refresh cada 20 segundos mientras la parada esté seleccionada.
- **FR-1.4**: Cadena de fuentes para datos live: API oficial autenticada (`upcomingbuses` + `buses?busstopId`) → legacy nextETA/GPS.
- **FR-1.5 (NUEVO mayo 2026)**: Para CADA línea de la parada, mostrar SIEMPRE el próximo bus disponible — sea live o scheduled. Si una línea no tiene live, completar con el próximo horario programado (hasta 3h adelante).
  - **Justificación**: el usuario reportó que paradas con varios servicios programados aparecían como "sin ómnibus" porque la cadena anterior era excluyente (si había live de una línea, no buscaba schedule de otras).
- **FR-1.6 (NUEVO)**: El "tracking lejano" combina dos fuentes:
  - Filtro oficial backend (`/buses?busstopId=X`): conservador, solo buses cercanos confirmados
  - Filtro propio polyline (`/buses?lines=X` + `isBusGoingToStop`): identifica buses upstream a hasta 6km que el backend aún no incluye en el filtro oficial
  - Resuelve el bug "bus 329 no aparece hasta estar a 2 cuadras".

### FR-2: Filtro de buses hacia una parada (REVISADO 2 mayo 2026 - sesión 3)

**SOLUCIÓN DEFINITIVA: filtro GTFS-based** (`src/lib/bus-direction-gtfs.ts` + `src/lib/gtfs-db.ts`).

Reemplaza la heurística anterior de proyección polyline (`bus-direction.ts`). Usa el GTFS oficial de Montevideo pre-procesado a SQLite (3MB) para:

1. **Identificar la variante exacta** del bus en vivo: `(line + destination headsign)` → trip_id GTFS
2. **Verificar paradas en el recorrido**: si la parada target no está en `variant_stops` para esa variante → descartar (bus va por OTRA ruta)
3. **Calcular posición ordinal del bus**: parada del trip más cercana a su GPS = current_sequence
4. **Comparar ordinals**: `current_sequence >= target_sequence` → ya pasó, descartar
5. **ETA real**: basada en `arrival_seconds` del schedule GTFS o paradas restantes × 70s

#### Bugs reportados y resueltos con este algoritmo

| Bug | Causa | Resolución |
|---|---|---|
| 329 hacia AVIACIÓN CIVIL aparece en parada de Garibaldi | Filtrábamos solo por línea, no por variante | `stop-not-in-route` lo descarta |
| 187 lejano con ETA 10min mal calculada | Haversine ignoraba el recorrido real | ETA basada en paradas del trip, no distancia recta |
| Bus aparece recién a 2 cuadras | API oficial es conservadora con upstream | Combinamos con `/buses?lines=X` filtrado por GTFS → tracking hasta 17km |
| Bus que ya pasó la parada figuraba | Polyline proyectaba mal en variantes circulares | Comparación ordinal exacta |

### FR-2: Filtro de buses hacia una parada (HISTÓRICO - heurística anterior)

Diagnóstico real del algoritmo actual (tests con datos verificados):
- ✅ Buses fuera de polyline (>500m) → correctamente descartados
- ✅ Buses que ya pasaron (downstream) → correctamente descartados
- ❌ Buses upstream pero a >5km de la parada → se siguen mostrando (ETA larga, ruido visual)
- ❌ Buses con variante inexistente (ej 9221 no está en shapefile) → fallback a polyline de otra variante con sentido posiblemente contrario → falsos negativos
- ⚠️ Buses de líneas no presentes en routes.json → pasan sin filtro (no podemos juzgar)

Requerimientos actualizados:

- **FR-2.1**: Al seleccionar una parada, mostrar **únicamente** buses que vayan hacia esa parada en los próximos ≤18 minutos.
- **FR-2.2**: Determinar dirección proyectando GPS sobre polyline de la variante exacta (no fallback por nombre de línea).
- **FR-2.3**: Buses con timestamp GPS >3 min antiguo → descartar.
- **FR-2.4**: Buses con `offrouteM > 500` → descartar (GPS sospechoso / fuera de servicio).
- **FR-2.5 (NUEVO)**: Buses upstream pero con `remainingRouteM > 4500m` (~17 min a 16 km/h) → descartar para reducir ruido visual.
- **FR-2.6 (NUEVO)**: Si la variante exacta no está en `routes.json` (ej variante nueva), NO usar fallback por nombre de línea para el filtro. Si la línea está en `routes.json` con otra variante, descartar el bus (no podemos garantizar el sentido). Solo el dibujo visual del recorrido puede usar fallback.

### FR-3: Búsqueda inteligente (CRÍTICO — en curso)

- **FR-3.1**: Al escribir en el buscador, mostrar resultados a partir del primer carácter, con debounce 250ms.
- **FR-3.2**: Tipos de resultado en orden de prioridad:
  1. POIs conocidos de Montevideo (shoppings, hospitales, universidades, terminales, estadios, plazas, barrios)
  2. Direcciones (calle + altura) de Nominatim
  3. Lugares genéricos (Nominatim/Photon)
  4. Paradas STM (por nombre o número)
- **FR-3.3**: Resultados deben estar **acotados a Montevideo y área metropolitana**, no devolver lugares de otros países.
- **FR-3.4**: Cada resultado debe tener icono distintivo según categoría.
- **FR-3.5**: Al tocar un resultado tipo lugar, abrir vista de detalle (ver FR-3.8).
- **FR-3.6**: Historial de búsquedas recientes (localStorage) y populares.
- **FR-3.7**: En la pantalla de búsqueda, la sección **"Lugares"** se renderiza ANTES que la sección **"Paradas"**. Justificación: cuando el usuario escribe "nuevo centro" o "facultad", busca el lugar, no una parada. Las paradas son el medio para llegar al lugar, no el destino primario.
- **FR-3.8**: Al tocar un resultado tipo lugar, la app debe:
  1. Cerrar la pantalla de búsqueda
  2. Mostrar el mapa con un **pin destacado** sobre el lugar elegido
  3. Hacer fly-to al pin con zoom 16
  4. Abrir un sheet inferior con:
     - Nombre y categoría del lugar
     - Lista de paradas en un radio de 400m, ordenadas por distancia
     - Para cada parada, mostrar las próximas llegadas en vivo (compartir el hook useArrivals)
  5. Al cerrar el sheet, limpiar el pin del mapa

### FR-4: Planificador de rutas "Cómo llegar"

Diagnóstico del estado actual (mayo 2026): la heurística en `route-planner.ts` falla cuando origen y destino están a 1–3 km y las paradas cercanas no comparten líneas. Resultado: muestra solo "caminar" para casi todas las consultas. **Es un algoritmo a reemplazar, no a parchar.**

Roadmap: **Fase 2A (heurística mejorada con OSRM walking)** → **Fase 2B (OpenTripPlanner como motor real)**.

Requerimientos finales independientes del motor:

- **FR-4.1**: El usuario indica origen y destino. Ambos inputs deben aceptar:
  - Texto libre (con autocomplete contra `/api/geocode`)
  - "Mi ubicación" (botón rápido si GPS está disponible)
  - Selección desde el mapa (long-press)
  - Una parada STM por número
- **FR-4.2**: La app devuelve hasta 5 alternativas de viaje ordenadas por tiempo total estimado.
- **FR-4.3**: Cada alternativa debe mostrar:
  - Tiempo total estimado en minutos
  - Hora de salida sugerida y hora estimada de llegada
  - Lista de pasos secuenciales con calles reales:
    - "Caminá 240m por Av. Garibaldi" (no solo "caminá 3 min")
    - "Tomá el 76 en parada Av. Italia y Bvar. Artigas, viajá 6 paradas"
    - "Bajate en parada Tres Cruces"
    - "Caminá 80m por Acevedo Díaz"
  - Distancia caminada total
  - Cantidad de transbordos
  - Líneas involucradas con sus colores/badges
- **FR-4.4**: Para cada bus en la ruta, mostrar ETA en vivo del próximo servicio (consulta nextETA).
- **FR-4.5**: Si la distancia origen-destino es <2km, ofrecer "ir caminando" como alternativa adicional, NO como única opción (siempre intentar buses primero).
- **FR-4.6**: Validación previa: no permitir buscar ruta si origen o destino están fuera del área de Montevideo+canelones metro o no están seteados.
- **FR-4.7**: Si el motor está en modo heurístico (Fase 2A), mostrar badge ámbar "Estimación aproximada".
- **FR-4.8**: Si no se encuentra ruta razonable, mostrar mensaje útil: lista de paradas cerca del origen y cerca del destino para que el usuario explore manualmente.
- **FR-4.9 (NUEVO)**: Tramos peatonales deben usar OSRM (calles reales), no haversine. Endpoint público gratis o instancia propia.
- **FR-4.10 (NUEVO — Fase 2B)**: Cuando OTP esté disponible, sustituir el planner heurístico por OTP. Mantener fallback al heurístico si OTP no responde en <3 segundos.

### FR-5: Visualización de recorrido

- **FR-5.1**: Al tocar un bus en el mapa, mostrar su polyline completa.
- **FR-5.2**: Marcar visualmente la posición actual del bus sobre el recorrido.
- **FR-5.3**: La polyline debe respetar el sentido (variante de ida vs vuelta).

### FR-6: Honestidad y estados vacíos

- **FR-6.1**: Si una API falla, mostrar mensaje explícito ("Servicio no disponible") — nunca inventar.
- **FR-6.2**: Distinguir visualmente entre "en vivo" (GPS) vs "estimado" (cálculo desde GPS distante) vs "horario" (programado oficial).
- **FR-6.3**: No mostrar características de bus que no podamos verificar (ej: WiFi, ocupación). Si lo mostramos, indicar "posible" o eliminar el badge.
- **FR-6.4 (NUEVO)**: Prohibido mostrar **ocupación** ("muy lleno", "ocupado") basado en heurística de hora del día. STM no publica ocupación por bus. La heurística actual hacía que casi todos los buses aparezcan en rojo durante horas pico → información engañosa. Eliminar el campo `occupancy` de la UI hasta que tengamos datos reales por bus.

---

## 5. Requerimientos no funcionales (NFR)

### NFR-1: Performance

- Carga inicial de la app: < 2.5s en 4G
- `routes.json` (~3.8MB) se carga una sola vez con cache a nivel módulo
- `stops.json` lazy-load con cache
- Refresh de llegadas: < 800ms p95
- Búsqueda de POIs: respuesta visual < 400ms (con cache si repite query)

### NFR-2: Confiabilidad

- Tolerar caídas de APIs STM sin crashear
- Cachear última respuesta exitosa para mostrar mientras reintenta
- Todas las API routes con try/catch + status 200 con `{error}` (nunca 500 al cliente)

### NFR-3: Mantenibilidad

- TypeScript strict, sin `any` excepto en límites de API externas
- Cero mocks. Cero datos hardcodeados que finjan ser reales.
- Tests al menos para: parseo de stm-online, parseo de variantes, cálculo de ETA fallback
- Documentar APIs STM en código (ya hecho en `src/lib/stm.ts`)

### NFR-4: Usabilidad

- Mobile-first, ancho máx 480px
- Dark mode único (no toggle)
- Tap targets ≥ 44×44px
- Loading states con skeletons, no spinners genéricos
- Errores en español, comprensibles ("Bus llegando" no "ETA: 0min")

### NFR-5: Datos y privacidad

- No requerir login
- Geolocalización solo si el usuario lo permite explícitamente
- Si denegó GPS, no asumir ubicación falsa — solo mostrar mapa centrado en MVD sin "tú estás aquí"
- No enviar datos del usuario a servicios de terceros (excepto Nominatim/Photon para geocoding, que es anónimo)

### NFR-6: Disponibilidad

- App debe funcionar como SPA estática hosteada en Vercel/similar
- SQLite de horarios (~84MB) servido desde el servidor Node, no incluido en bundle del cliente

---

## 6. Casos de uso principales

### CU-1: Usuario consulta llegadas en parada cercana

1. Usuario abre la app
2. App pide permiso de geolocalización
3. App muestra paradas cercanas ordenadas por distancia
4. Usuario toca parada
5. App muestra panel con próximas llegadas en tiempo real
6. Buses en el mapa se filtran para mostrar solo los que van a esa parada

**Criterio de aceptación:**
- Tiempo desde apertura hasta ver llegadas: < 4s con GPS concedido
- Si GPS denegado, mostrar mapa de Montevideo con buscador prominente

### CU-2: Usuario busca "Nuevo Centro" para llegar

1. Usuario toca buscador
2. Escribe "Nuevo Centro"
3. Primer resultado debe ser "Nuevo Centro Shopping" (POI conocido)
4. Usuario lo toca
5. App muestra paradas cercanas a ese punto
6. Usuario toca una parada para ver llegadas

**Criterio de aceptación:**
- "Nuevo Centro" devuelve el shopping como primer resultado en < 500ms
- No devuelve lugares de fuera de Montevideo

### CU-3: Usuario planifica viaje "De mi casa a la facultad"

1. Usuario abre "Cómo llegar"
2. Origen: "Mi ubicación" (auto-completado por GPS)
3. Destino: escribe "Facultad de Ingeniería"
4. App devuelve 3-5 alternativas
5. Usuario toca la primera
6. App muestra detalle paso a paso con ETAs en vivo

**Criterio de aceptación:**
- Devuelve al menos 1 alternativa razonable en < 3s
- Si distancia <2km, ofrece caminar como primera opción

### CU-4: Usuario en domingo de noche

1. Usuario consulta parada a las 23:30 un domingo
2. nextETA devuelve vacío
3. GPS no muestra buses cercanos
4. App muestra horarios programados oficiales del próximo servicio, con badge "Horario"

**Criterio de aceptación:**
- Nunca decir "sin buses próximamente" si el horario programado dice que hay servicio en próximos 60 minutos
- Diferenciar visualmente entre dato en vivo vs programado

---

## 7. Arquitectura técnica

### 7.1 Stack actual

- **Frontend**: Next.js 16 App Router + TypeScript + Tailwind + Framer Motion + Leaflet
- **Backend**: Next.js API routes (serverless functions en Vercel)
- **Datos estáticos**: `public/stops.json`, `public/routes.json`, `data/schedule.db` (SQLite), `data/mvd-pois.json`
- **APIs externas**:
  - Pública sin auth: `m.montevideo.gub.uy/transporteRest/*`, `montevideo.gub.uy/buses/rest/stm-online`
  - **OAuth2 (NUEVO mayo 2026)**: `api.montevideo.gub.uy/api/transportepublico/*` con token de `mvdapi-auth.montevideo.gub.uy/token`. Cliente en `src/lib/mvd-api.ts`. Credenciales en `.env.local`.
  - Walking: OSRM público `router.project-osrm.org` vía proxy `/api/walking`
  - Geocoding: Nominatim con bias MVD + POIs curados

### 7.2 API oficial autenticada (hallazgo clave mayo 2026)

`api.montevideo.gub.uy/api/transportepublico/*` (la misma que usa la app oficial *Cómo Ir*) requiere OAuth2 client_credentials. Una vez con token, devuelve datos significativamente más ricos que el endpoint `stm-online` viejo:

```json
{
  "company": "CUTCSA",
  "busId": 502,
  "line": "181",
  "lineVariantId": 7603,
  "location": {"coordinates":[-56.177845,-34.86339]},
  "origin": "POCITOS",
  "destination": "PASO MOLINO",
  "subline": "POCITOS - PASO MOLINO",
  "access": "PISO BAJO",
  "thermalConfort": "Aire Acondicionado",
  "emissions": "Euro V",
  "speed": 34
}
```

**Implicaciones para los FRs**:
- **FR-6.3 revisado**: ahora SÍ tenemos accesibilidad real (`access`) y AC (`thermalConfort`) por bus individual. El badge de "WiFi" sigue eliminado (no hay campo equivalente), pero podemos agregar **"Piso bajo" / "Accesible"** con datos reales.
- **FR-2 mejorado**: `lineVariantId` viene preciso, no como `variante` del endpoint viejo que a veces no coincidía con el shapefile.
- **GTFS estático disponible**: `/buses/gtfs/static/latest/google_transit.zip` (17MB, contiene shapes/stops/stop_times/trips/calendar/routes/agency). Esto desbloquea Raptor y OTP.

### 7.3 Decisión arquitectónica para planificador de rutas

**Adoptaremos OpenTripPlanner (OTP)** como motor de planificación:

- Backend: instancia OTP corriendo en un VPS o tu PC con Docker
- Datos: GTFS de Montevideo (publicado en datos abiertos) + OSM de Uruguay
- Frontend: llama a `/api/route` que proxy-ea a OTP
- Fallback: si OTP no disponible, usar el route-planner actual (más simple)

**Justificación**: OTP es el motor que usan agencias reales (TriMet, BART, etc.). Calidad de planificación muy superior a algoritmos propios. Setup ~1-2 días.

### 7.2 Decisión arquitectónica para planificador de rutas

**Adoptaremos OpenTripPlanner (OTP)** como motor de planificación:

- Backend: instancia OTP corriendo en un VPS o tu PC con Docker
- Datos: GTFS de Montevideo (publicado en datos abiertos) + OSM de Uruguay
- Frontend: llama a `/api/route` que proxy-ea a OTP
- Fallback: si OTP no disponible, usar el route-planner actual (más simple)

**Justificación**: OTP es el motor que usan agencias reales (TriMet, BART, etc.). Calidad de planificación muy superior a algoritmos propios. Setup ~1-2 días.

### 7.3 Decisión arquitectónica para búsqueda

**Adoptaremos Photon** como geocoder principal:

- Photon es OSM indexado con Elasticsearch, optimizado para autocomplete
- Endpoint público: `photon.komoot.io` (gratis, sin auth, alta calidad)
- Bias geográfico: `lat=-34.9&lon=-56.16&zoom=12` para priorizar Montevideo
- Fallback: lista curada local de ~100 POIs muy conocidos (shoppings, hospitales, terminales, universidades) que matcheen *antes* que Photon para garantizar que "Nuevo Centro" → Nuevo Centro Shopping

---

## 8. Roadmap por fases

### Fase 1 — Estabilización (URGENTE, esta semana)
- [x] **FIX**: Filtro de buses upstream básico (FR-2) — proyectar GPS sobre polyline
- [x] **FIX**: Búsqueda con bias Montevideo + lista curada de POIs (FR-3)
- [x] **FIX**: Manejo de buses con GPS viejo (>3min)
- [x] **FIX**: Eliminar badge WiFi falso (NFR-6.3)
- [x] **FIX**: Vista de detalle de lugar (FR-3.8) con pin + paradas cercanas
- [x] **FIX**: Pre-rellenar destino en Cómo Llegar desde buscador
- [x] **FIX**: Filtro upstream con tope `remainingRouteM < 4500m` (FR-2.5)
- [x] **FIX**: Filtro upstream sin fallback por nombre de línea (FR-2.6)
- [x] **FIX**: Eliminar badge de ocupación inventado (FR-6.4)
- [x] **FIX**: Conectar `/api/walking` (OSRM) al UI de RouteScreen con pasos por calles
- [x] **NUEVO**: Cliente OAuth2 `mvd-api.ts` para API oficial autenticada
- [x] **MIGRACIÓN GRANDE**: `/api/stm/arrivals` y `/api/stm/vehicles` usan ahora la API oficial autenticada con filtro upstream OFICIAL (param `busstopId`). Resuelve los 3 bugs históricos de filtrado: variantes nuevas no en shapefile, buses "passed" mal detectados, no-variant agresivo.
- [x] **COMBINACIÓN INTELIGENTE (mayo 2026 - sesión 2)**: arrivals ahora COMBINA live + schedule por línea (FR-1.5). Antes era cadena excluyente: si había live de una línea, no buscaba schedule de otras → bug "187 a 23:14 no aparece". Ahora cada línea de la parada SIEMPRE tiene su próximo servicio.
- [x] **TRACKING LEJANO (FR-1.6)**: vehicles combina filtro backend oficial (cercanos) + filtro polyline propio (lejanos hasta 6km). Resuelve "bus aparece recién a 2 cuadras".
- [x] **NUEVO**: badges de accesibilidad real (♿) y AC (❄) en UI, usando `access` y `thermalConfort` de la API oficial. SRS FR-6.3 ahora se cumple con datos reales por bus, no inventados.
- [x] **NUEVO**: `variant_to_line.json` refrescado desde la API oficial (738 → 2166 mappings). El bug "fallback schedule muestra 4879 en lugar de 76" está resuelto.
- [x] **NUEVO**: `stops-server.ts` para leer `stops.json` en API routes (sin depender de fetch del cliente).
- [ ] Tests unitarios mínimos del filtro upstream y parser de stm-online

### Fase 2A — Cómo Llegar heurístico mejorado (próximos días)

**Objetivo**: que "Cómo Llegar" funcione razonable mientras setupeamos OTP. Sin servidor extra.

- [ ] Integrar OSRM público (`router.project-osrm.org`) para tramos peatonales con calles reales
- [ ] Endpoint `/api/walking?from=lat,lon&to=lat,lon` que proxy-ea a OSRM y cachea respuesta
- [ ] Ampliar radio walking del planner a 1500m
- [ ] Permitir hasta 2 transbordos (no 1)
- [ ] Usar `schedule.db` ya existente para ETAs realistas en cada paso (no `BUS_WAIT_MIN` hardcoded)
- [ ] UI de pasos con nombres de calles reales (FR-4.3)

### Fase 2B — Routing real con GTFS (calidad Google Maps)

**Objetivo**: planificación de rutas a nivel agencia. Reemplaza el heurístico actual.

#### Pre-requisitos (✅ COMPLETADOS mayo 2026)
- [x] Cuenta en `api.montevideo.gub.uy` con app suscrita a "Transporte Público" (live)
- [x] Cliente OAuth2 en `src/lib/mvd-api.ts` con cache de token (300s TTL)
- [x] Verificado descarga de GTFS oficial (17MB ZIP, 84MB unzipped: shapes, stops, stop_times, trips, calendar, routes, agency)

#### Decisión de motor (a confirmar antes de implementar)

Opciones evaluadas:

| Motor | Calidad | Setup | Hosting | Costo |
|---|---|---|---|---|
| **A. Raptor TS en Next.js** | ~85% OTP | 2-3 días dev | Vercel (mismo) | $0 |
| **B. OTP en celular Android** | 100% Google Maps | 1-2 días | Termux + Cloudflare Tunnel | $0 (cel siempre prendido) |
| **C. OTP en VPS** | 100% Google Maps | 1-2 días | Hetzner €4/mes o DO $12/mes | €4-12/mes |
| **D. Heurística mejorada + OSRM** | media | hecho | actual | $0 |

**Recomendación pendiente de confirmación**: empezar con A (Raptor TS) por:
- Cero servidor extra
- Funciona en Vercel sin cambios
- Si A no alcanza, migramos a B o C sin tocar la UI (todo abstraído en `/api/route/plan`)
- Tres impls TS maduras: `planarnetwork/raptor`, `Cata-Dev/RAPTOR`, `joshuajaharwood/raptor-ts`

#### Setup (1-2 días)
- [ ] Crear `docker/otp/docker-compose.yml` con imagen oficial `opentripplanner/opentripplanner:latest`
- [ ] Script de bootstrap: build graph (~5 min en PC mid-range, ~10 min en VPS chico)
- [ ] Verificar OTP en `http://localhost:8080/otp/` con query de prueba MVD
- [ ] Documentar todo en `docs/OTP-SETUP.md`

#### Integración con app
- [ ] Crear `/api/route/plan` que proxy-ea a OTP (`/otp/routers/default/plan`)
- [ ] Adaptador: traducir respuesta OTP a la interfaz `RouteCandidate` actual
- [ ] Mantener fallback a `route-planner.ts` heurístico si OTP timeout (>3s) o cae
- [ ] UI sin cambios — el adaptador hace que sea transparente
- [ ] Variable env `OTP_URL` para alternar entre dev local y prod

#### Deploy
- [ ] Para dev: OTP corre en localhost de tu PC
- [ ] Para prod: VPS DigitalOcean/Hetzner ~$5/mes con Docker
- [ ] Refresh del GTFS: cron semanal que re-descarga y re-builda el graph

### Fase 3 — Pulido y features secundarias (próximo mes)
- [ ] Badge de "trayecto acortado" con detección desde `destinoDesc`
- [ ] Modo "salir ahora" en home (LeaveNowCard)
- [ ] Persistencia de favoritos (origen, destino, rutas guardadas)
- [ ] Atajos: "Mi casa" / "Mi trabajo" pre-configurables
- [ ] PWA installable

### Fase 3 — Pulido y features secundarias (próximo mes)
- [ ] Badge de "trayecto acortado" con detección desde `destinoDesc`
- [ ] Modo "salir ahora" en home (LeaveNowCard)
- [ ] Persistencia de favoritos
- [ ] PWA installable

### Fase 4 — Expansión (futuro)
- [ ] Canelones e interdepartamentales
- [ ] OTP en Android via Termux (tu Redmi 9 / S20F)
- [ ] Modo offline básico

---

## 9. Definición de "Hecho" (DoD)

Una feature está hecha cuando:

1. Cumple los criterios de aceptación de su FR
2. Funciona sin mocks ni datos hardcodeados
3. Maneja errores de API con UI clara
4. Compila sin warnings TypeScript ni ESLint
5. Probada manualmente en el navegador móvil (no solo desktop)
6. Documentada en este SRS si cambia los requerimientos

---

## 10. Bugs conocidos y deuda técnica

### Bugs críticos (P0)
- [x] **BUG-1 RESUELTO COMPLETO** (mayo 2026): Buses ya pasados o lejanos
  - ✅ Filtro upstream OFICIAL via `/buses?busstopId=X&lines=Y` de la API autenticada
  - ✅ Sin depender del shapefile viejo (que omite variantes nuevas)
  - ✅ Nuestro filtro propio queda como red de seguridad solo si falla la API
- [x] **BUG-2 RESUELTO**: Búsqueda devuelve resultados fuera de MVD
- [ ] **BUG-3 EN PROGRESO**: "Cómo llegar" — heurística mejorada (Fase 2A hecho), OTP/Raptor pendiente
- [x] **BUG-4 RESUELTO**: Ocupación inventada — badge eliminado
- [x] **BUG-5 RESUELTO**: Fallback schedule mostraba "4879" en vez de "76"
  - Causa: `variant_to_line.json` se generaba del shapefile viejo (738 variantes)
  - Fix: refrescado desde API oficial → 2166 variantes con `variantCode → línea comercial`

### Deuda técnica
- [x] WiFi badge eliminado
- [ ] Ocupación: eliminar de la UI hasta tener datos reales
- [ ] `route-planner.ts` heurístico → reemplazar por OTP en Fase 2B

---

## 11. Métricas de éxito

| Métrica | Objetivo v1.0 |
|---|---|
| Tiempo de respuesta de llegadas | < 800ms p95 |
| Precisión de filtro de buses | 0% falsos positivos (buses pasados) |
| Búsqueda devuelve resultado correcto en top 3 | > 90% para POIs conocidos |
| Planificador devuelve ruta válida | > 95% para origen-destino dentro de MVD |
| Crashes del cliente | 0 |
