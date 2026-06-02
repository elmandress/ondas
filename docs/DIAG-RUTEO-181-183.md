# F1.1 — Diagnóstico del ruteo y el problema 181/183

## Hallazgo (con datos reales del GTFS, no suposiciones)
Corrí `scripts/diag-181-183.cjs` sobre `data/gtfs-v2.db`. Resultado:

1. **Nuestro algoritmo de directas es correcto.** `findDirectVariants` busca, para cada variante
   que pasa por el origen, si alguna parada *posterior en su secuencia* es el destino. Si una sola
   variante cubre origen→destino en orden, la ofrece directa (cero transbordos).

2. **La causa raíz es la DATA: las variantes vienen TRUNCADAS.** El `headsign` promete un destino
   que la secuencia de paradas NO alcanza. Ejemplos reales:
   - `181-1-1` headsign **"Pocitos"**, pero su última parada es **L.A. de Herrera y Joanico** (no
     llega a Pocitos).
   - Todas las variantes "Pocitos" del **183** cortan en **Bv Gral Artigas** — ninguna contiene una
     parada de Pocitos.
   → Como **ninguna** variante cubre el through-route, el planner (correctamente, dado el dato) cae
   a transbordo. **Esto le pasa a TODAS las apps** (Google/Moovit/Cómo Ir/maprab): la fuente oficial
   está cortada. Por eso es el dolor universal del hilo de Twitter.

3. **Bonus:** `CA1` y `14` tienen **0 variantes** en `gtfs-v2.db` (el circuito eléctrico las renombró
   a CE1/E14). Nuestra lista `ELECTRIC_WIFI_LINES` referencia nombres que el GTFS no tiene → revisar.

## Por qué NO hay fix de código "a secas"
La tentación es **unir todas las variantes de una línea** y declarar directo cualquier camino por esa
unión. **Es deshonesto y rompe nuestro principio #1:** unir `183(origen→X)` + `183(X→destino)` puede
implicar **bajarse y tomar OTRO 183** (es un transbordo real, no el mismo bus). Sin datos de
*continuación de servicio* (block/interlining, que el GTFS a nivel variante no da), no podemos saber
si es el mismo coche físico. Marcarlo "directo" sería mentir. Y los stops truncados (Pocitos) **ni
siquiera existen** en el dato, así que unir tampoco los alcanza.

→ **Ganar el 181/183 requiere una estrategia de DATOS, no solo algoritmo.**

## Opciones de fix (fork de decisión)
- **A — Inferir la cola truncada desde el shape (`routes.json`) + paradas reales.** El trazo físico
  suele ir más allá del último stop del GTFS; podríamos mapear las paradas que caen sobre ese trazo y
  extender la variante. Potente, 100% nuestro, pero es trabajo fino y hay que validar mucho.
- **B — Correcciones de la comunidad (F5) + dataset corregido propio.** Dejar que usuarios marquen
  "este 183 sigue hasta X" y construir un overlay de correcciones sobre el GTFS oficial. Escala con
  la gente, encaja con el roadmap (F5), pero tarda en madurar.
- **C — Usar el destino REAL del bus en vivo (API STM) para el ruteo.** El live ya reporta el destino
  real (que a veces es más largo que el GTFS). Sirve para *arrivals* pero es flojo para *planificar*
  (no hay secuencia de paradas del tramo extendido).
- **D — Motor RAPTOR/CSA "bien hecho" igual** (mejora multi-criterio, velocidad, transbordos
  correctos) y dejar el 181/183 honesto: cuando es transbordo entre variantes de la MISMA línea,
  decirlo claro ("seguís en otro 183") en vez de pretender magia. Mejora todo lo demás sin mentir.

## Recomendación
**D + A en etapas:** primero el motor correcto (D) — mejora real, sin mentir, y arregla los casos
legítimamente directos que hoy se pierden por variantes mal cortadas dentro de la misma dirección.
Después, atacar la truncación con inferencia por shape (A), validando. La comunidad (B) como refuerzo
a largo plazo. Nunca declarar "directo" un tramo que en realidad obliga a cambiar de coche.

## Estado de implementación

### ✅ D — IMPLEMENTADO (continuación misma-línea honesta)
`route-planner-gtfs.ts` — paso dedicado y ACOTADO tras el loop de transbordo:
- Se activa **solo si no hay ninguna directa con bus** para ese O→D (es un último recurso,
  no compite con directas ni transbordos a otra línea, que siempre son mejores si existen).
- Busca: v1 (línea L) cubre origen→X, y v2 (OTRA variante de la MISMA línea L) sigue desde X
  hasta cerca del destino, con **X = misma parada física** (transbordo en sitio, sin caminata).
- Marca `sameLineContinuation: true`. Acotado: `fromStops.slice(0,4)` + `break` a los 3 hallazgos
  → no explota la búsqueda (medido: pocitos-lejos→Pocitos ~700ms, 51 tests verdes).
- **UI** (`RouteScreen.tsx`): header "Seguís en el 183" + nota honesta *"El 183 cambia de
  recorrido en el camino… puede ser el mismo coche o el próximo de la línea. Sin inventar."*

### ❌ A — DESCARTADA tras validar con datos (2026-05-31). NO implementar.
La premisa era: "el trazo físico va más allá del último stop GTFS → recuperar la cola hasta Pocitos".
**Es FALSA.** Validación geométrica (shape de `routes.json` vs paradas de la variante GTFS):

- `183-1-1` ("Pocitos", corta en Bv Artigas): los shapes que cubren sus 29 paradas (`8401`, `8888`,
  `9105`) tienen la última parada GTFS **al final del shape** (idx ~165/167, cola de 1-3 pts = metros).
  NO hay trazo hacia Pocitos. El shape `8389` que dice "POCITOS-PASO MOLINO" es el sentido INVERSO.
- `181-1-1` ("Pocitos", corta en L.A.Herrera y Joanico): ídem — shapes `7602/8880/9104` terminan
  en/junto a la última parada (cola 4-37 pts = giro de terminal, no un tramo a Pocitos).

**Conclusión:** el recorrido físico oficial COINCIDE con las paradas GTFS. El `headsign="Pocitos"`
es el **nombre del ramal/cabecera de la línea**, NO una promesa de que ese servicio individual
llegue a Pocitos. Extender la variante sería **inventar un recorrido inexistente** → viola el
principio de honestidad #1. La realidad: ese 183 efectivamente termina en Bv Artigas.

→ La estrategia honesta correcta YA está cubierta por **D** (continuación misma-línea). No hay
"magia" que recupere un tramo que no existe en ningún dato oficial. Caso cerrado con evidencia.

## Reproducción
`node scripts/diag-181-183.cjs` — imprime las variantes y demuestra la truncación.
`npx vitest run tests/cont-181-183.test.ts --reporter=verbose` — muestra el ruteo + perf del paso D.
