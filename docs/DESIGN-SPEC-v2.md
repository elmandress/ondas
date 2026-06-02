# Cuándo — Design Spec v2 (minimalista, inspirado en app STM)

Estado: **PROPUESTA — pendiente de aprobación del usuario.** No implementar hasta OK.

## Diagnóstico (por qué la app STM funciona y la nuestra no)
1. Una cosa, grande: la lista de llegadas ES el contenido. Número de línea grande, destino claro, ETA enorme. Se escanea caminando.
2. Disciplina de color: casi monocromo (blanco/crema sobre negro). El único color por fila es el chip de línea.
3. Aire: filas altas, mucho espacio negativo. (Lo nuestro: chiquito y pegado.)
4. Acciones obvias y pocas por fila: horario + seguir/ver en mapa.
5. Hoja parcial sobre el mapa, scrolleable. Mantiene contexto.

## Principios
- **Near-monochrome.** Color = SOLO chip de línea + estados puntuales (llegando/live). Ámbar = marca puntual (seguir activo, foco), no decoración.
- **Aire**: filas altas, espacio negativo, destinos NO pegados.
- **Jerarquía**: destino + ETA protagonistas; metadata (live/AC/accesible/paradas) secundaria y sutil.
- **No perder diferenciales**: AC y accesibilidad legibles (iconos), "llegando" claro, seguir el bus.
- **Menos código**: se eliminan pills de fondo y cajas por fila.

## Tokens (ajustes sobre lo actual)
- `--sheet-bg: #0a0e16` (casi negro, calmo)
- Texto: `--text #f5f6f8` · `--text-2 #8b93a7` · `--text-3 #565e74`
- `--r-card: 14px` (ya) · filas SIN caja (solo divisor `rgba(255,255,255,0.05)`)
- Color por fila: solo el chip de línea (`lineColorFromCode`). Resto neutro.
- `--live #16b886` (solo punto 6px) · ETA verde solo si "llegando".

## Tipografía (más grande, más aire)
- Chip línea: 800 16px
- Destino: 700 17px / line-height 1.3 (no pegado)
- ETA: 800 30px tnum · unidad "min" 500 13px debajo o al lado
- Sublínea meta: 500 13px muted

## Fila de llegada — anatomía
```
  ┌────┐   POCITOS                      3 min   (⊙)
  │ 522│   • en vivo · ♿ ❄
  └────┘
  ───────────────────────────────────────────────  (divisor sutil)
```
- Alto: ~76px · padding 16px vertical · divisor 1px (NO caja, NO fondo por fila).
- Izquierda: chip de línea 44px, color real, número blanco 800. **Único color de la fila.**
- Centro: destino 17px bold. Sublínea 13px muted: punto verde 6px + "en vivo" (o "horario" sin color) · ♿ / ❄ iconos gris 14px solo si aplican · "· N paradas" muted.
- Derecha: ETA 30px neutro (blanco); verde SOLO si ≤2 min ("llegando"). "min" chico.
- Botón **seguir** (⊙ target circular 36px, borde sutil) SOLO si hay bus en vivo → centra y sigue el bus en el mapa; activo = ámbar. (En el sheet de home/búsqueda no hay mapa → el badge lleva a "ver recorrido".)

## Hoja del mapa
- **Mobile**: parcial, alto ~52vh, mapa visible arriba (~40vh). Handle de drag. Scroll interno para ver más líneas (no ocupa toda la pantalla).
- **Header**: nombre parada 18px bold + #código muted + cerrar. Filtro de líneas: chips neutros, activo = color de su línea (scroll horizontal, sin punto de color en inactivos para bajar ruido).
- **Desktop**: panel lateral izquierdo (mismo contenido y filas).

## Estados
- **Llegando** (≤2 min): ETA verde + el punto live pulsa. Sin rojo, sin alarmismo.
- **En vivo**: punto verde 6px + "en vivo" 13px (verde tenue). No bloque/pill.
- **Horario**: "horario" muted, sin color.
- **Acortado**: "acortado" en `--warn`, texto chico (sin pill de fondo).
- **Vacío**: ícono bus + "Sin servicios próximos", calmo.

## Rutas (mismo lenguaje)
- Tarjeta: tiempo total grande arriba (28px), "directo/1 transbordo" muted.
- Secuencia de tramos en una línea: chips de línea (color) + iconos de caminata, con "→" sutiles. SIN cajas anidadas, divisor entre tarjetas, aire.
- Detalle paso a paso expandible (no todo abierto).

## Qué se elimina (ruido + líneas de código)
- Pills con fondo (En vivo/Accesible/AC) → punto + iconos sutiles.
- Caja+borde por fila → divisores.
- Coloreo de ETA por umbral amplio → neutro salvo "llegando".
- Chips de filtro con punto de color en inactivos → neutros.

## Alcance de implementación (cuando se apruebe)
1. `ArrivalRow` v2 (componente único) + tokens/CSS.
2. Hoja del mapa parcial + botón seguir bus + filtro de líneas calmo.
3. StopArrivalSheet (home/búsqueda) hereda el mismo row.
4. Rutas: GtfsRouteCard al mismo lenguaje.
5. Verificación con capturas (mobile/desktop) comparando contra app STM.
