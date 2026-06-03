# QA / Auditoría pre-deploy — Cuándo

Auditoría con DATOS REALES (no asunciones): código analizado, 6 resoluciones probadas,
contraste calculado, Supabase verificado. Junio 2026. NO se tocó código — solo se auditó.

Cada hallazgo tiene: **severidad** (🔴 alta / 🟡 media / 🟢 baja-cosmética) y **esfuerzo**.

---

## RESUMEN: estado general
El producto está **sólido**. NO hay bugs visuales que rompan el layout en ninguna de las 6
resoluciones (sin overflow horizontal, sin elementos superpuestos, sheets dentro de pantalla).
Los estados de error están bien cubiertos. El analytics funciona end-to-end (29 eventos ya en
Supabase). Lo que hay para arreglar es **consistencia (anti-IA), contraste y limpieza** — pulido,
no rescate.

**Priorización (qué arreglar antes del deploy):**
1. 🔴 Contraste de `text-3` (falla WCAG AA) — afecta legibilidad real.
2. 🔴 Inconsistencia de radios/sombras (lo que MÁS delata "hecho por IA").
3. 🟡 Tabla de tarifas enterrada + falta vigencia en la tarjeta de ruta.
4. 🟡 Código muerto (4 componentes, 2 libs, 1 hook).
5. 🟢 Microcopys y CSS huérfano menor.

---

## 1. TARIFAS — auditoría de consistencia

| Hallazgo | Sev | Detalle |
|---|---|---|
| ✅ Sin valores viejos hardcodeados | — | No hay `$52`/`$64` sueltos fuera de `fare.ts`. Centralización OK. |
| ✅ Suburbano usa tarifa correcta | — | `fareLabel(numTransfers, usesMetro)` — rutas metro pasan `usesMetro`. Verificado. |
| 🟡 Vigencia NO está en la tarjeta de ruta | Media | La tarjeta muestra "🎫 $52 con tarjeta" sin "(jun 2026)" ni "estimado". El usuario pidió que la vigencia sea clara. Solo está en Ajustes. |
| 🟡 Tabla de tarifas ENTERRADA | Media | Vive en Ajustes→"Tus derechos", PERO aparece DESPUÉS de "Convivencia" y "Trasbordos" — hay que scrollear. Quien busca tarifas no la encuentra rápido. Debería ir PRIMERO en esa vista, o tener su propia entrada. |
| 🟢 Urbano $52 sigue vigente | — | Verificado en cutcsa.com.uy. Correcto. |

---

## 2-3. AUDITORÍA VISUAL (6 resoluciones: iPhone SE/13/15PM, Galaxy A14/A54, Pixel 8)

**Resultado: NO se encontraron layouts rotos.** Probado Home + Rutas en las 6; sin overflow
horizontal, sin texto cortado que rompa, sin botones superpuestos, sin sheets fuera de pantalla.

| Hallazgo | Sev | Detalle |
|---|---|---|
| ✅ iPhone SE (375px) Home/Rutas | — | Limpio, bien espaciado, badges entran. |
| ✅ Galaxy A14 (360px, el más angosto) | — | Tarjetas no se rompen, elipsis correcta ("Shopping Tres Cru…"). |
| ✅ Sheets dentro de pantalla | — | El sheet de parada y Ajustes no se salen del viewport. |
| 🟢 Chips con scroll horizontal cortados | Baja | "Menos caminata", "Más tarde", "+ Parada" se cortan en el borde sin gradiente/indicador → parece "texto cortado" aunque es scroll intencional. Sugerencia: fade en el borde derecho. |
| 🟢 Densidad en "Tus derechos" en 375px | Baja | Mucho texto junto; legible pero apretado. |

> Nota: el logo "N" de Next dev tapa "Inicio" en los screenshots — es solo del overlay de
> desarrollo, NO del producto. No es un bug.

---

## 4. ANTI-IA PROFUNDA (lo más importante de esta auditoría)

**Hallazgo principal 🔴: el design system de marca existe pero los componentes NO lo respetan.**

- **Radios**: tokens de marca (`var(--r-chip)`, `var(--r-card)`) usados **7 veces**; Tailwind
  suelto (`rounded-xl`=12px, `rounded-2xl`=16px, `rounded-lg`, `rounded-md`) usado **58 veces**.
  Hay TRES radios casi iguales (12/14/16px) para la misma función → el ojo lo percibe como
  "improvisado / mezcla de librerías". **Este es el patrón #1 que delata IA**, más que el valor
  del radio en sí.
- **Sombras**: ~10 valores distintos (`shadow-xl`, `shadow-2xl`, `box-shadow 0 2px 6px` con
  opacidades 0.4/0.45/0.5...). Misma función, valores distintos = inconsistencia.

| Hallazgo | Sev | Esfuerzo |
|---|---|---|
| 🔴 Mezcla radios marca vs Tailwind (58 vs 7) | Alta | Medio — unificar a 2-3 tokens (`--r-card`, `--r-chip`, `--r-pill`) |
| 🔴 ~10 sombras distintas | Alta | Bajo-medio — definir 2-3 tokens de sombra (`--shadow-card`, `--shadow-sheet`) |
| ✅ Identidad de marca | — | Logo propio, ámbar (no morado IA), Plus Jakarta, voz uruguaya. FUERTE. |
| ✅ Jerarquía visual | — | Un protagonista por pantalla. No es "dashboard de cards iguales". |
| 🟢 Colores de líneas hardcodeados (LeafletMap) | Baja | Mapa de colores `{"76":"#ef4444"...}` + hash HSL — es dato de líneas, no UI. OK pero podría centralizarse. |

**Veredicto anti-IA**: la app tiene identidad (no se siente IA en marca/voz/jerarquía). Lo que
la hace ver "menos profesional" es la **inconsistencia de radios y sombras** — deuda de método
(Tailwind suelto en vez de tokens). Arreglarlo es lo de mayor impacto visual/esfuerzo.

---

## 5. ANALYTICS — análisis técnico

| Check | Resultado |
|---|---|
| ¿Tabla existe en producción? | ✅ Sí, `analytics_events` con 29 filas (el usuario ya corrió el SQL). |
| ¿Funciona end-to-end? | ✅ Sí, ya registró eventos reales. |
| ¿Qué pasa si Supabase falla? | ✅ `void ...then(()=>{}, ()=>{})` — fire-and-forget, traga error, no rompe. |
| ¿Qué pasa si la tabla no existe? | ✅ El insert falla en silencio, no crashea. |
| ¿Impacto en performance/red? | ✅ Mínimo: 1 insert async por evento (open_app, view_tab). No bloquea render. |
| ¿Offline? | ✅ El fetch falla y se traga; sin reintentos que acumulen. |
| 🟢 Mejora menor | Los eventos offline se PIERDEN (no se encolan). Aceptable para analytics; no crítico. |

**Veredicto**: el analytics está bien diseñado y es resiliente. Sin problemas.

---

## 6. ACCESIBILIDAD — pruebas reales (contraste calculado)

| Elemento | Contraste sobre bg #070b14 | WCAG AA (4.5 normal / 3.0 grande) |
|---|---|---|
| `text` #eef0f5 | 17.26 | ✅ pasa holgado |
| `text-2` #9aa3b5 | 7.76 | ✅ pasa |
| `accent` #f0a020 | 9.14 | ✅ pasa |
| **`text-3` #5c647a** | **3.34** | 🔴 **NO pasa AA normal** (solo grande) |

| Hallazgo | Sev | Detalle |
|---|---|---|
| 🔴 `text-3` falla contraste AA | Alta | Se usa en metadatos pequeños ("61m · 2 líneas", subtítulos). 3.34 < 4.5. Gente con visión reducida no lo lee bien. **Fix simple**: aclarar `--text-3` de #5c647a a ~#6b7488 (sube a ~4.5). |
| ✅ Texto grande implementado | — | `text-size` funciona. |
| ✅ Touch targets 44px | — | En coarse pointers (implementado). |
| ✅ aria-labels en botones de ícono | — | Presentes. `role="status"` en avisos. |
| 🟡 Pendiente prueba real | Media | VoiceOver/TalkBack + orden de foco por teclado + zoom 200% → requiere dispositivo/manual, no auditable por código. |

---

## 7. ESTADOS DE ERROR Y RESILIENCIA

| Caso | Qué ve el usuario | ¿Recuperable? | Veredicto |
|---|---|---|---|
| API STM caída | "Los servidores del STM están durmiendo 💤" + reintentar | ✅ botón retry | ✅ Bueno |
| Sin buses ahora | "No viene ninguno por ahora" | — | ✅ Honesto |
| GPS denegado | Cae a centro MVD, "ubicación aproximada" | ✅ retry en useLocation | 🟡 OK pero falta CTA claro "activá el GPS" |
| Sin rutas | NoRoutesState con paradas cercanas a origen/destino | ✅ sugiere alternativas | ✅ Bueno |
| Offline | Banner "Sin conexión — mostramos lo último" + app usable | ✅ | ✅ Bueno |
| Error 500/timeout | Cae a schedule/cache, o EmptyState con retry | ✅ | ✅ Bueno |

🟡 Único hallazgo: **GPS denegado no tiene un CTA visible** para reactivarlo (el usuario queda
en "ubicación aproximada" sin saber que puede arreglarlo). Menor.

---

## 8. CONSISTENCIA FUNCIONAL (lo que dice vs lo que hace)

| Check | Resultado |
|---|---|
| Tarifas | ✅ Coherente (urbano $52, suburbano correcto vía `usesMetro`). |
| ETAs | ✅ Coherente tras el fix — los aproximados muestran "~". |
| Buses ya pasados | ✅ Se filtran (no se muestran). |
| Offline | ✅ El banner aparece de verdad sin red (probado). |
| Desvíos | ✅ Honesto — dice "fuente oficial" porque NO hay feed (no promete lo que no hay). |
| Alertas de bajada | ✅ Funciona por paradas + min. |
| 🟢 Notificaciones | La app NO tiene push (correcto — requiere nativo); no promete tenerlas. Coherente. |

Sin inconsistencias funcionales. Los refactors no rompieron la coherencia.

---

## 9. LIMPIEZA TÉCNICA (código muerto)

| Tipo | Muertos encontrados | Esfuerzo |
|---|---|---|
| Componentes | `FavoriteCard`, `NearbyStopCard`, `Pill`, `ThemeToggle` | Bajo — borrar |
| Libs | `lib/occupancy`, `lib/routes-server` (solo en comentario) | Bajo — verificar y borrar |
| Hooks | `useNearbyStops` | Bajo — borrar |
| Utilidades duplicadas | **6 implementaciones de haversine/distancia** (distM, haversineM, haversine, haversineKm, haversineMeters, distanceTo) en 6 archivos | Medio — unificar en `utils.ts` |
| CSS | Posibles reglas huérfanas de `.shortcut-card .mid` (el componente se borró, la clase la usa otro) | Bajo — revisar |

> ⚠️ `lib/sync-favorites` y `lib/routes-server` aparecen "muertos" por grep pero `sync-favorites`
> está VIVO (import dinámico en auth.ts). `routes-server` sí es candidato real. Verificar antes de borrar.

---

## 10. RONDA DE PRODUCTO (usar como usuario nuevo)

| Flujo | Fricción encontrada |
|---|---|
| Buscar un bondi | ✅ Fluido: Home → parada cercana → llegadas. |
| Planificar ruta | ✅ Claro: Hacia → resultados con opciones. |
| Seguir recorrido | ✅ Funciona (tras los fixes de trazado). |
| Sin internet | ✅ Banner + paradas cacheadas. |
| Primera vez | ✅ Onboarding con datos reales. |
| Volver tras 1 semana | 🟢 Los favoritos persisten; el GPS se re-pide. OK. |
| 🟡 Ver tarifas | Fricción: hay que ir a Ajustes→Derechos→scrollear. Poco descubrible. |

---

## PLAN PRIORIZADO (recomendación de qué arreglar antes del deploy)

**Tanda 1 — alto impacto, bajo riesgo (hacer):**
1. 🔴 Subir contraste de `--text-3` (#5c647a → ~#6b7488) — 1 línea, arregla WCAG AA.
2. 🔴 Unificar sombras a 2-3 tokens (`--shadow-card`, `--shadow-sheet`) — anti-IA.
3. 🟡 Agregar vigencia/“estimado” a la tarifa en la tarjeta de ruta.
4. 🟡 Borrar código muerto (4 componentes + 1 hook + libs verificadas).

**Tanda 2 — más esfuerzo, alto valor visual:**
5. 🔴 Unificar radios: migrar `rounded-xl/2xl/lg/md` a `--r-card`/`--r-chip` (58 usos).
6. 🟡 Mover la tabla de tarifas al principio de "Derechos" o darle entrada propia.
7. Unificar las 6 funciones de haversine en una.

**Tanda 3 — requieren producción/manual (post-deploy):**
8. Lighthouse real, VoiceOver/TalkBack, batería en dispositivo, medir error real de ETAs.

---

## Conclusión
No hay nada **roto** que impida deployar. Lo prioritario es **contraste (a11y real)** y
**consistencia de radios/sombras (anti-IA)** — eso es lo que más sube la percepción de
"profesional / no improvisado". El resto es limpieza incremental.
