# MEGA-PROMPT — Rediseño visual de "Cuándo" desde cero

> Pegá este documento entero como prompt a la IA. Es el brief de diseño + ingeniería
> para **rehacer el sistema visual desde cero**, combinando: las bases de nuestra app,
> el prototipo `Cuándo - Design`, y la claridad de la app oficial del STM / apps de
> transporte de referencia (Transit, Citymapper, Moovit). NO cambia la funcionalidad.

---

## 0) ROL Y MISIÓN

Actuá como **director de producto + diseñador senior + ingeniero front-end de élite**,
especializado en apps de transporte público. Tu misión: **rehacer la capa visual de
"Cuándo" desde cero**, con un resultado *clean, minimalista, serio y hermoso* — del nivel
de la app **Transit** o la app oficial del **STM Montevideo** — manteniendo nuestra
identidad de marca y, sobre todo, **sin tocar la funcionalidad ni la capa de datos**.

Antes de escribir código: leé este brief entero, mirá el prototipo `Cuándo - Design/`
(es la dirección estética correcta) y las capturas de referencia del STM. Pensá el
sistema de diseño completo (tokens → componentes → pantallas) ANTES de implementar.

---

## 1) CONTEXTO DEL PRODUCTO

- **Qué es**: "Cuándo" (código interno: `ondas`) — PWA mobile-first de transporte público
  de Montevideo. Responde 3 preguntas: ¿cuándo llega mi bus?, ¿dónde está la parada de X?,
  ¿cómo llego de A a B? Lema: *"El bondi te espera. Vos no."*
- **Stack**: Next.js 16 (App Router, Turbopack), React 19, TypeScript strict, Tailwind v4,
  Leaflet (mapa real), better-sqlite3 (GTFS local), framer-motion.
- **Directorio**: `d:\comoire\ondas`. Dev server en `localhost:3000`.

### NO TOCAR (capa funcional — está bien y es valiosa)
- `src/lib/*` (datos, GTFS, planner, mvd-api, stm), `src/hooks/*`, `src/app/api/*`.
- La lógica de datos, fetching, GTFS y filtros. **Solo se rehace la presentación.**

### Restricciones técnicas obligatorias
- `runtime="nodejs"` y `dynamic="force-dynamic"` en API routes con sqlite/fetch en vivo.
- `gtfs-db.ts`, `schedule-db.ts`, `routes-server.ts`, `mvd-api.ts` son **server-only**.
- Leaflet **solo** vía `dynamic(() => import(...), { ssr: false })`.
- Pantallas **siempre montadas** con opacidad (no conditional render) para preservar el
  estado del mapa/scroll. **NUNCA** poner `transform` en un ancestro de los sheets `fixed`
  (atrapa el `position:fixed` → bug ya sufrido; centrar con `margin-inline:auto`, no transform).
- `NODE_TLS_REJECT_UNAUTHORIZED=0` en `.env.local` (requerimiento TLS con CA AGESIC) — no tocar.

---

## 2) IDENTIDAD DE MARCA (mantener)

- **Nombre**: Cuándo. **Logo**: anillo casi cerrado (una "C" / cuenta regresiva) con un
  punto líder ámbar que sugiere salida/movimiento. (`src/components/brand/Logo.tsx`.)
- **Tipografía**: **Plus Jakarta Sans** (400–800), vía `next/font`. Mono opcional: JetBrains Mono.
- **Tema**: dark único. **Acento de marca: ámbar `#f0a020`.**
- **Tono**: confiable, montevideano, directo, sin chiste. "Honestidad de datos" (nunca inventar).

---

## 3) FILOSOFÍA DE DISEÑO (la tesis central)

Combiná **tres fuentes**:
1. **Prototipo `Cuándo - Design/`** → la base estética correcta (paleta, tipografía, layout
   responsive: sidebar desktop / bottom-nav mobile, hero "salí ahora", hoja de parada).
2. **App oficial del STM Montevideo** (capturas de referencia) → claridad y minimalismo:
   número de línea grande, destino claro, ETA enorme, 2 acciones por fila (horario + seguir),
   mucho negro, poquísimo color, hoja parcial sobre el mapa.
3. **Transit / Citymapper / Moovit / Google Maps** → principios probados (ver §4).

> **Google Maps (transporte) como complemento clave** — simple, clean, rápido:
> - El **color se restringe casi solo al mapa, iconos y fotos**; la UI (texto, tarjetas,
>   controles) va **neutra** para dirigir la atención a la próxima acción. Confirma la regla
>   de badges neutros: el color es para significado, no decoración.
> - **Departure board**: próximas salidas (hasta 2–3) con badge de línea, destino y ETA en vivo.
> - **Direcciones**: cada opción es una fila escaneable — tiempo total en negrita + secuencia
>   de iconos de modo + badges + flechas + "sale HH:MM". Swipe entre opciones.
> - **Bottom sheet** arrastrable y parcial sobre el mapa; jerarquía que guía al próximo paso.

### Principio rector (de Transit 6.0): *"No skimming, no scanning, no thinking required."*
La info crítica (próximo bus, cuándo salir) se entiende de un vistazo, caminando, sin pensar.

---

## 4) REGLAS DE ORO (no negociables)

1. **Disciplina de color extrema.** Casi monocromo. Pocos colores clave:
   - **Ámbar** = marca / acento puntual (estado activo, foco, CTA principal). Con moderación.
   - **Verde** = "en vivo" / "llegando".
   - **Neutros** (blanco/cremas/grises sobre casi-negro) = TODO lo demás.
   - **Los badges de línea van NEUTROS** (mismo chip oscuro, número blanco). Las líneas de
     MVD **no tienen color oficial** — pintarlas con un hash inventado generaba un arcoíris
     que arruinaba todo ("parecía un chiste"). El número identifica; el color no aporta.
     *(Transit sí colorea líneas, pero usando los colores OFICIALES de la agencia; nosotros
     no los tenemos, así que neutro es lo correcto y honesto.)*
2. **Dark mode bien hecho** (no negro puro). Usar tonos "midnight" desaturados (#070b14 / #0a0e16),
   contraste AA, sin glassmorphism agresivo. (>50% usa dark mode; 75% de noche.)
3. **Jerarquía brutal.** Por fila de llegada: **destino** + **ETA grande** protagonizan;
   línea (badge) y metadata (en vivo/AC/accesible/paradas) son secundarios y sutiles.
   ETA estilo Transit: muy grande en el detalle.
4. **Whitespace > bordes.** Listas con divisores sutiles, NO cajas por fila. Filas altas
   (≥72px), destinos con aire (no pegados). Agrupar metadata, no competir.
5. **Pocas acciones, obvias.** Nada de saturar. Por fila a lo sumo: tocar badge → recorrido,
   y botón **seguir** el bus (cuando hay GPS en vivo).
6. **Consistencia total.** Un único `ArrivalRow`, un único `LineBadge`, tokens en un solo
   lugar. Menos archivos de estilo, no más. (Hoy hay demasiada dispersión percibida.)
7. **Sin alarmismo.** Calmá la urgencia: solo lo inminente (≤2 min) se resalta. El resto, neutro.

---

## 5) QUÉ SALIÓ MAL (lecciones — NO repetir)

El intento anterior se sintió "sobrecargado, poco serio, un chiste". Causas concretas:
- ❌ **Badges de línea con color por línea** (arcoíris). → NEUTROS.
- ❌ **Filas con caja + borde** por cada item. → divisores sutiles, sin caja.
- ❌ **Pills llamativas** (En vivo / Accesible / AC con fondos brillantes sky/cyan/verde). →
  punto + iconitos sutiles muteados.
- ❌ **ETAs coloreados por umbral amplio** (todo <8min ámbar). → neutro salvo "llegando".
- ❌ **Demasiado redondeado** (radios 20px) → ~12–14px.
- ❌ **Todo chiquito y pegado** (tipos chicos, poco espaciado). → más grande, más aire.
- ❌ **Chips de filtro con punto de color** en cada uno. → neutros, activo en ámbar.
- ❌ El **mapa en mobile** quedó sobrecargado (top-bar + chips + cards flotantes gigantes).
- ❌ **"Recientes" en Rutas** quedó todo pegado y feo.

---

## 6) ESPECIFICACIÓN POR PANTALLA

> Estado actual según el dueño del producto: **Inicio = impecable** (úsala de norte),
> **Buscar = bien**, **Mapa = regular en PC / feo y sobrecargado en mobile**,
> **Rutas = bien salvo "Recientes"**.

### 6.1 Inicio (mantener el espíritu, ya está bien)
- Header (logo mobile / título desktop), selector "¿De dónde salís?", **hero "Salí ahora"**
  (contador grande, próximos 3 buses, barra de progreso), paradas cercanas (chips),
  Mis rutas, Acciones STM. Aireado, calmo. **Es la vara de calidad para el resto.**

### 6.2 Buscar (mantener)
- Input con buscador por voz, secciones (Recientes / Populares / Explorá), filas de resultado
  limpias. Badges de línea **neutros** (clave). Mic ver §8.

### 6.3 Mapa (REHACER — es la peor)
- **Mobile**: el mapa Leaflet a pantalla completa. Una **hoja inferior PARCIAL** (~50–55vh)
  que deja ver el mapa arriba, con drag-handle y **scroll para más líneas** (no ocupar todo).
  Top-bar mínima (parada + cerrar). Filtro de líneas: chips neutros, scroll horizontal,
  activo ámbar. **Quitar** cards flotantes gigantes; una sola hoja limpia con `ArrivalRow`s.
- **Desktop**: panel lateral (estilo Moovit/Transit) con la lista + el mapa al lado. Sobrio.
- Cada fila con bus en vivo: botón **seguir** que centra y anima el bus en el mapa.
- Marcadores de parada: simples y discretos (como STM). Parada seleccionada: acento ámbar.

### 6.4 Rutas (arreglar "Recientes" + pulir tarjetas)
- Tarjeta de ruta: **tiempo total grande** arriba + etiqueta (Directa / N transbordos),
  badges de línea **neutros**, secuencia de tramos en una línea (caminar→bus→caminar) con
  iconos sutiles, sin cajas anidadas, divisor entre tarjetas. "Ver en el mapa" sobrio.
- **"Recientes"** (y sugerencias): filas con AIRE — icono, nombre, subtítulo; NO pegadas.
  Mismo lenguaje de fila que el resto.

### 6.5 Hoja de parada (StopArrivalSheet) — el componente más usado
- Mobile: bottom-sheet. Desktop: panel lateral derecho (translateX por CSS, no framer-transform).
- Header: nombre parada + #código + favorito + cerrar. Estado ("actualizado hace…").
- Lista de `ArrivalRow`s (ver §7). Footer: "N servicios · datos STM".

---

## 7) SISTEMA DE COMPONENTES (consolidar)

### Tokens (un solo lugar, `globals.css`)
```
--bg:#070b14  --sheet-bg:#0a0e16  --surface:rgba(255,255,255,.05)
--text:#f5f6f8  --text-2:#8b93a7  --text-3:#565e74
--accent:#f0a020 (ámbar, marca)  --live:#16b886 (verde)  --warn:#f0564b
--r-card:14px  --r-chip:10px   tipografía: Plus Jakarta Sans
```

### `LineBadge` — NEUTRO
Chip oscuro (`rgba(255,255,255,.07)` + borde sutil), número blanco 800. Tamaños xs/sm/md/lg.
(Prop `tinted` opcional por si algún día hay colores oficiales.)

### `ArrivalRow` — anatomía (la pieza central, ÚNICA fuente de verdad)
```
  [ 522 ]   PORTONES                         3 min   ( ⊙ seguir )
            • en vivo · a 2 paradas  ♿ ❄
  ───────────────────────────────────────────────────────────  divisor sutil
```
- Alto ~72–80px, padding 16px, **sin caja**, divisor 1px.
- Izquierda: `LineBadge` neutro (lg). Tocar → recorrido de la línea.
- Centro: **destino** 700/16–17 con aire. Sublínea 13px muteada: `• en vivo` (punto verde)
  o `horario`; `· a N paradas` (diferencial — mostrar SIEMPRE que exista); iconitos `♿`/`❄`
  grises solo si aplican; `acortado` en warn si corresponde. nowrap + ellipsis.
- Derecha: **ETA** grande (28–30px) neutro; **verde solo si ≤2 min ("llegando")**.
- Botón **seguir** (⊙ target circular, activo ámbar) si hay bus en vivo.

### Estados
- Llegando (≤2): ETA verde + punto pulsa. Sin rojo, sin alarma.
- En vivo: punto verde 6px + "en vivo". Horario: "horario" muteado. Vacío: calmo.

---

## 8) MICRÓFONO / BÚSQUEDA POR VOZ (bug actual)

Web Speech API **solo funciona en contexto seguro** (`https://` o `localhost`). En
`http://IP-de-LAN` (probar desde el celular por IP) el navegador la bloquea → "Error de
reconocimiento de voz" y se cierra. Acciones para la IA:
1. Detectar `window.isSecureContext` y, si es falso, mostrar mensaje claro ("Necesita HTTPS").
2. Manejar errores específicos (`not-allowed`, `no-speech`, `network`, `aborted`) con mensajes
   útiles; no cerrar el overlay de golpe (guardar contra el ghost-click del tap de apertura).
3. Recomendación de despliegue: servir por HTTPS para que ande en celular.

---

## 9) PROBLEMA TÉCNICO: BUSES QUE "NO SIGUEN LA RUTA REAL"

**Síntoma**: al trackear los pocos buses disponibles, muchas veces el bus, la parada y el
recorrido dibujado van por caminos distintos; aunque apunten a la misma parada, los caminos
no están coordinados; a veces el bus parece ir "de vuelta".

**Qué ya hicimos** (mantener/mejorar, no romper):
- Filtro de dirección con GTFS oficial: `busTowardsStopGtfs` (`src/lib/bus-direction-gtfs.ts`)
  matchea la **variante** del bus (línea + headsign), verifica que la parada esté en el
  recorrido (`variant_stops`), calcula la posición ordinal (parada más cercana al GPS) y
  descarta si ya pasó. `/api/stm/vehicles?stopId=X` solo devuelve buses que van hacia la parada
  (con `stopId` NO cae a fallbacks sin filtrar — eso ya se arregló).
- GTFS local en SQLite (`gtfs-v2.db`, 1078 variantes) con `variant_stops` y `arrival_seconds`.

**Qué hacen las apps reales (GTFS-Realtime) y deberíamos implementar** — investigar e implementar:
1. **Matchear cada vehículo a su trip/variante** (no solo a la línea). El estándar GTFS-RT usa
   `TripDescriptor` + `direction_id` para saber el sentido y filtrar.
2. **Snap-to-shape**: proyectar el GPS crudo del bus sobre la **polyline/shape** del recorrido
   de su variante, y **mostrar/animar el bus SOBRE la shape**, no en el punto GPS crudo. Esto
   elimina el "va por otra calle" (jitter de GPS) y coordina bus + recorrido + parada.
3. **`currentStopSequence` / "incoming at"**: usar la secuencia de parada actual del vehículo
   para ubicarlo en el recorrido y calcular "a N paradas" de forma consistente.
4. **Interpolación**: animar el bus a lo largo de la shape entre updates de GPS (suave), no
   saltos. Mantener coherencia bus↔polyline↔parada.
5. **Si el match de variante es ambiguo**, preferir NO mostrar el bus antes que mostrarlo en
   sentido contrario (ya es la política; reforzarla).

Investigá en internet: "GTFS realtime vehicle positions trip matching", "snap GPS to polyline /
shape", "map matching transit", y la doc oficial de GTFS-RT (`gtfs.org`).

---

## 10) RESPONSIVE / LAYOUT (del prototipo Cuándo - Design)
- **Mobile FIRST (<768)**: bottom-nav (Inicio · Mapa · Rutas · Buscar), contenido full-width con
  gutter 18px. Sheets = bottom-sheet parcial.
- **Tablet (768–1023)**: sidebar 72px (iconos), contenido centrado.
- **Desktop (≥1024)**: sidebar 220px. Contenido en columna legible (max ~620px) centrado; el
  **mapa ocupa todo el ancho** cuando es su pantalla. Sheets = panel lateral.
- Centrar columnas con `margin-inline:auto` (NUNCA `transform` — atrapa los `fixed`).

---

## 11) ENTREGABLES
1. Sistema de tokens + `globals.css` consolidado (una sola fuente de verdad de estilos).
2. Componentes base: `LineBadge` (neutro), `ArrivalRow` (único), `Pill`/indicadores sutiles,
   `Logo`, `Icons`.
3. Las 5 pantallas reskineadas al spec (Inicio, Buscar, Mapa, Rutas, Hoja de parada).
4. Voz robusta (§8). Snap-to-shape + animación de buses (§9).
5. **Verificación visual obligatoria**: sacar capturas (Playwright, 3 breakpoints) y
   compararlas contra el prototipo `Cuándo - Design` y las capturas del STM antes de dar por
   terminado. tsc 0 / eslint 0 / tests verdes.

## 12) CRITERIO DE ÉXITO
Que un montevideano abra la app, y de un vistazo (caminando, sin pensar) sepa **cuándo sale
su próximo bus y si llega bien** — con una estética **limpia, minimalista y hermosa**, que se
sienta seria y confiable, manteniendo la identidad Cuándo. Si parece recargada o "un chiste",
está mal. Menos color, más aire, más jerarquía.

---

### Fuentes / referencia
- Transit 6.0 (filosofía "no skimming, no scanning, no thinking required"; ETA gigante; dark
  mode midnight; agrupar metadata): https://blog.transitapp.com/six-o/
- UX apps de transporte (simplicidad, no amontonar, tracking en vivo): fuselabcreative, altexsoft.
- Dark UI best practices (no negro puro, desaturar, contraste): designstudiouiux, boundev.
- GTFS-Realtime Vehicle Positions (trip matching, direction_id, currentStopSequence, shapes):
  https://gtfs.org/documentation/realtime/feed-entities/vehicle-positions/
