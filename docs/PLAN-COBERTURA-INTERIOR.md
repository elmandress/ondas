# Plan de cobertura del INTERIOR (documentado, no ejecutado)

Estado: **GPS en vivo ya integrado** para Maldonado/Paysandú/Rivera (sistema Busmatick,
`/api/gps/interior`). Falta escalar a todos los departamentos + sumar las PARADAS del interior
(hoy Maldonado tiene buses en vivo pero NO paradas en el dataset). Documentado para ejecutar de
una sola vez (sin gastar créditos en exploración repetida).

## 1. Más zonas de GPS en vivo (Busmatick `avl.xml`)
El patrón es idéntico en todas: página Leaflet + `btkserver*.js` con `BtkWS="avl.xml"`. Para sumar
una zona: (a) agregar la URL base a `SOURCES` en `src/app/api/gps/interior/route.ts`, (b) agregar
su bounding box a `ZONES` en `src/hooks/useInteriorBuses.ts`.

Fuentes a verificar/agregar (de los sitios que pasó el usuario):
- **Rocha urbano**: `https://sig.rocha.gub.uy/leaflet/busUrbano.php` → buscar su path de avl (Geoportal IM Rocha). bbox Rocha ~ lat [-34.50,-33.50] lon [-54.50,-53.30].
- **Sol Antigua**: `http://solantigua.ddns.net:2780/pub/avl.xml` (verificar zona/empresa).
- **adonde.uy** (Hecho en el Sur): `https://adonde.uy/app/gps/` — usa OpenLayers + LMoveMarker, no Busmatick puro; inspeccionar su backend (líneas bus1..bus14, posible zona sur).
- **gps.maldonadoturismo.com/gps/** y **gpsmicro.maldonadoturismo.com/GPSrivera/** (Maldonado/Rivera alternativos).
- **Colonia, Salto, Tacuarembó, Durazno, etc.**: buscar si su intendencia/empresa tiene Busmatick (patrón `*/pub/avl.xml` o `btkserver`).

Gotchas (ya resueltos en el endpoint actual, replicar): encoding **latin1**, muchos en **http**/puerto
raro → proxear server-side; de noche 0 buses (normal); tratar cada fuente como opcional.

Mejora del endpoint: detectar zona automáticamente por bbox en el server (hoy se pasa `?zona=`),
y un `/api/gps/interior/all` que consulte varias en paralelo para el viewport.

## 2. PARADAS del interior — HECHO (crowdsource pasivo)
`scripts/collect-interior-stops.mjs` acumula del avl: posición de buses lentos cerca de su
próxima parada → clusteriza (mediana + inliers) → `interior-stops.json` (138 paradas confiables
y creciendo: Maldonado/Paysandú/San Carlos). Fusionadas en `stops-dataset.ts` → home/búsqueda/mapa.
Referencia de meta: Maldonado tiene ~1.785 paradas, 41 líneas, 6 operadores (Wikipedia SDT Maldonado).

## 2b. RECORRIDOS del interior para RUTEAR — en progreso (aristas)
HALLAZGO: el avl da `p1c→p2c` por bus = una ARISTA del recorrido (orden de paradas). El recolector
ahora acumula `data/interior-edges.json` ({zona|linea|sentido: {from>to: count}}). Con muchas
corridas se reconstruye la secuencia completa de cada línea (topsort del grafo de aristas) →
permitiría meter las líneas del interior al motor de ruteo. Hoy ~24 líneas-sentido con 6-8 aristas
c/u (incompletas; densificar). NO existe GTFS/shapefile público del interior (CODESA publica
recorridos solo como imágenes; SIT/geoportal no expone WFS simple) → el crowdsource es el único camino.
SIGUIENTE cuando madure: script que haga topsort de las aristas → secuencia de paradas por línea →
construir variant_stops del interior → integrar al pipeline (prefijo por depto).

### (legacy) Fuentes de paradas investigadas:
- El `avl.xml` Busmatick trae `p1c/p1n` y `p2c/p2n` (código+nombre de próximas paradas) → se puede
  **construir un dataset de paradas del interior acumulando** lo que reportan los buses en vivo
  (crowdsource pasivo): cada parada vista, con su código y nombre. Con el tiempo cubre la red real.
- Geoportal de cada intendencia (Rocha ya tiene `sig.rocha.gub.uy`; Maldonado SIG; etc.) suele
  publicar shapefiles de paradas/recorridos (como `v_uptu_lsv` de MVD). Buscar capa WFS/SHP.
- `comomemuevo.uy` (Horarios/Recorridos) y `mibondi.com` como referencia de qué líneas/recorridos existen.

Una vez con paradas+recorridos del interior: meterlas en el pipeline (mismo `build-gtfs-db` /
`merge-metro-gtfs` con prefijo por departamento, ej `MA` Maldonado) → el motor las rutea y el
detalle de línea muestra recorrido completo, igual que MVD/Canelones.

## 3. Mostrar atraso/ocupación del interior en el panel
El `avl.xml` trae `reg` (min de atraso/adelanto) y `psj/poc` (pasajeros/ocupación). Ya los
exponemos en `/api/gps/interior` (delayMin, occupancy). Falta UI: al tocar un bus del interior,
mostrar "viene 3 min adelantado · ~15 pasajeros". Honesto y único (ningún competidor lo muestra bien).

## 4. Interdepartamental en vivo (SeguíTuBus / MiBondi)
- **SeguíTuBus** (Terminal Tres Cruces): realtime de interdepartamentales. Investigar su fuente.
- **mibondi.com**: trackea COPSA, CITA, Zeballos, CODELESTE, COMESA, COPAY. Ver si su backend es
  accesible o si comparten el Busmatick. Combinar con nuestros horarios interdepartamentales (F2.4).

## Prioridad sugerida cuando se ejecute
1. Sumar zonas Busmatick que respondan (Rocha, Sol Antigua, adonde.uy) — barato, alto impacto.
2. Dataset de paradas del interior por crowdsource pasivo del avl.xml (p1/p2) — diferencial único.
3. UI de atraso/ocupación del interior.
4. SeguíTuBus/MiBondi para interdepartamental en vivo.

Ver memoria: [[reference-gps-interior-busmatick]], [[reference-datos-nacionales]].
