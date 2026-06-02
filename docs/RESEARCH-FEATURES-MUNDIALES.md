# Investigación: features de las mejores apps de transporte del mundo

Desglose de features de Transit, Citymapper, Moovit, Google Maps, Navitime (Japón),
Naver/Kakao (Corea), Subway Korea y otras — con análisis de **aplicabilidad a Cuándo**.
Investigación de junio 2026 (blogs oficiales, reseñas de usuarios, foros, casos de estudio).

Leyenda de estado: ✅ ya implementado · 🟡 parcial / schema listo · 🔵 aplicable (a futuro) ·
⚪ aplicable pero requiere backend/datos que no tenemos · 🔴 no aplicable a Uruguay.

---

## 1. Navegación y avisos en viaje

| Feature | App referente | Estado en Cuándo |
|---|---|---|
| **Get-off alert** (avisarte cuándo bajar) | Transit GO, Moovit Live Directions | ✅ por ETA y por paradas restantes ("Faltan 3 paradas") + voz |
| **Cuenta regresiva de paradas** ("5…4…3 paradas") | Transit GO | ✅ |
| **Avisos por voz / manos libres** | Transit GO | ✅ (`voice-alerts.ts`, opt-in) |
| **"Salí ahora" / recordatorio de salida** | Transit, Citymapper | ✅ (hero "cuándo salir", buffer 4-6 min) |
| **Navegación paso a paso en vivo (estilo GPS)** | Transit GO, Moovit | 🔵 tenemos el seguimiento; falta el "modo GO" guiado pantalla a pantalla |
| **Notificación en lock-screen / widget** | Citymapper, Transit | ⚪ requiere app nativa (Capacitor) o Web Push |

## 2. Planificación de rutas

| Feature | App referente | Estado |
|---|---|---|
| **Menos caminata / menos transbordos / más rápido** | Transit, Citymapper "Walk less" | ✅ (chips optimize en Rutas) |
| **Costo del viaje por ruta** | Citymapper | ✅ ($52 tarjeta, dato oficial STM) |
| **Impacto: CO₂ ahorrado + calorías** | Citymapper | ✅ (`trip-impact.ts`, datos EPA) |
| **Hora de salida programada + paradas intermedias** | Citymapper | ✅ (departAt + waypoints) |
| **Multimodal (bus + bici + scooter)** | Transit, Citymapper | 🔴 Montevideo no tiene bikeshare/scooter integrado con dato abierto |
| **Viaje mixto bus + taxi/Uber (último tramo de noche)** | — (original nuestro) | ✅ (`rideshare.ts` + seguridad nocturna) |
| **"Rain safe" — rutas con menos exposición a la lluvia** | Citymapper | 🔵 idea linda; requiere data de cuáles tramos son cubiertos (no la tenemos, pero "menos caminata" ya cubre el espíritu) |

## 3. Tiempo real y confiabilidad

| Feature | App referente | Estado |
|---|---|---|
| **ETA en vivo + bus en el mapa** | todas | ✅ (GPS oficial STM + interior Busmatick) |
| **Filtrar buses que YA pasaron** (no mostrar los que ya se fueron) | — (queja universal de ETAs falsos) | ✅ (`busLikelyPassedStop`) — **diferencial de honestidad** |
| **Último bus del día** | — | ✅ (`detectLastBus`, badge "última corrida") |
| **Predicción de atraso honesta** (sin inventar histórico) | Transit "better predictions" | ✅ (`observedDelay` etiquetado "en vivo") |
| **Crowdedness / ocupación** (asientos libres / lleno) | Moovit, Transit Rate-My-Ride | 🟡 tenemos ocupación del interior (Busmatick `psj`); STM urbano NO la expone |

## 4. Accesos rápidos y personalización

| Feature | App referente | Estado |
|---|---|---|
| **Get me home / Get me work** (un toque) | Citymapper | ✅ ("A casa / A trabajo") |
| **Paradas favoritas** | todas | ✅ (con alias Casa/Trabajo/Facu, sync nube opcional) |
| **Rutas guardadas por dirección** | Citymapper | ✅ (FavoriteRoute con coords) |
| **Nearby mode** (ver todo cerca al abrir, sin tocar) | Transit | ✅ (paradas cercanas en Inicio + Mapa) |
| **Modo texto grande / accesibilidad visual** | Moovit (VoiceOver) | ✅ (text-size + avisos por voz) |

## 5. Comunidad y datos colaborativos

| Feature | App referente | Estado |
|---|---|---|
| **Reportar parada mal ubicada / línea cambiada** | Moovit community, Transit | 🟡 schema Supabase listo (`reports`/`report_votes` + bucket fotos), falta UI |
| **Crowdsourced real-time** (tu GPS mejora el de todos) | Transit GO crowdsourcing | ⚪ requiere broadcast de ubicación (backend) — interesante para F5 |
| **Rate-My-Ride** (puntuar limpieza/puntualidad/accesibilidad) | Transit | 🔵 muy aplicable; el schema de reports lo soporta casi tal cual |
| **Gamificación / leaderboard de "ayuda"** | Transit Royale | 🔵 curioso; 20% de usuarios de Transit usan GO por esto. Aplicable a futuro con cuentas |

## 6. Seguridad

| Feature | App referente | Estado |
|---|---|---|
| **Caminata segura de noche** | Citymapper "night safe", GeoSure | ✅ (`safety-zones.ts` — sugiere taxi en tramos de periferia de noche, sin juzgar barrios) |
| **Compartir viaje / ubicación en vivo con un contacto** | Citymapper, Google Maps | 🟡 compartir el plan ✅ (`share-trip.ts`); la ubicación EN VIVO necesita backend |
| **Zonas seguras para mujeres** | apps de Taiwán | 🔵 idea valiosa pero sensible; requiere data local validada |

## 7. Datos curiosos / "wow" (algunos aplicables, otros no)

| Feature | App referente | Veredicto para Cuándo |
|---|---|---|
| **"Qué vagón/puerta tomar"** para salir más rápido | Citymapper, Subway Korea | 🔴 es para METRO con andenes; Montevideo es 100% bus, no aplica |
| **Traducir alertas confusas del operador a lenguaje claro** | Citymapper (MTA) | 🔵 aplicable: la IM publica desvíos/avisos en texto denso → podríamos resumirlos |
| **CO₂ ahorrado tras cada viaje (push motivador)** | Pave Commute, Citymapper | ✅ ya mostramos el ahorro (sin push, que necesita nativo) |
| **Calorías quemadas caminando** | Citymapper | ✅ |
| **Disruption alerts** (suscribirte a una línea y que te avise de cortes) | Citymapper, Moovit | ⚪ requiere fuente de alertas en tiempo real + push; la IM tiene "Desvíos" como texto |
| **Departure board** (tablero de salidas tipo aeropuerto) | Citymapper | 🔵 lindo para una parada con muchas líneas; tenemos los datos |
| **Dark mode "para viajes nocturnos"** | Transit | ✅ (tema auto/claro/oscuro) |
| **Historial de viajes** (no solo búsquedas) | varias | 🟡 guardamos búsquedas; los viajes hechos requerirían registrar el "GO" |

---

## Lo que ya nos hace competitivos (resumen)

Cuándo **ya tiene** la mayoría de las features estrella de las top-5 mundiales: get-off alert por
paradas, get-me-home, costo, CO₂/calorías, menos-caminata, último bus, voz, offline, accesibilidad,
viaje mixto con seguridad nocturna. Y tiene **dos diferenciales propios**:
1. **Honestidad de datos**: filtramos buses ya pasados y no inventamos ETAs/atrasos — la queja #1
   de TODAS las apps ("the ETAs are lies").
2. **Cobertura nacional + GPS del interior** (Busmatick) que ni Moovit tiene en Uruguay.

## Próximas features de mayor ROI (priorizadas)

1. **UI de reportes comunitarios** (schema ya listo) — "esta parada se movió / esta línea no pasa".
   Bajo esfuerzo, alto valor, alimenta el círculo virtuoso de datos.
2. **Departure board** de una parada (tablero de próximas salidas de todas las líneas).
3. **Resumir desvíos/avisos de la IM** a lenguaje claro (estilo Citymapper-MTA).
4. **Rate-My-Ride** (puntuar el viaje) — alimenta crowdedness/puntualidad reales con el tiempo.
5. **Web Push** (cuando haya backend) para disruption alerts y "tu bus llega".
6. **Modo GO guiado** pantalla-a-pantalla (hoy seguimos el bus; faltaría el flujo guiado completo).

## Fuentes
Transit blog (GO, crowdsourcing, Rate-My-Ride, better-predictions), Citymapper (ridewithvia,
androidpolice tips), Moovit (crowdedness, accessibility, live location), reseñas App Store / Play /
Quora sobre ETAs poco confiables y battery drain, Our World in Data / EPA (CO₂), Healthline (calorías),
Subway Korea / Navitime (Asia), GeoSure (seguridad).
