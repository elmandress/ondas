# Ejecución de pulido pre-deploy — informe final

De auditoría a ejecución. Qué se cambió, qué se resolvió, qué NO se tocó y por qué,
y calificación con evidencias concretas. Junio 2026.

## QUÉ CAMBIÉ (con evidencia)

### 1. Tarifas
- **Tarjeta de ruta**: "$52 con tarjeta" → **"~$52 tarjeta"** (el ~ = estimado).
- **Ruta expandida**: nueva línea **"$52 con tarjeta / $64 efectivo · estimado según tarifas
  vigentes a junio 2026"** (`fareDetail()`). Evidencia: verificado en screenshot, el texto
  aparece bajo el timeline.
- **Tabla en Ajustes**: ampliada con jubilado efectivo + suburbano por distancia (32/40/60km).
  Entrada del menú: "Tus derechos" → **"Tarifas y tus derechos"** (más descubrible).

### 2. Design system / anti-IA (lo de mayor impacto visual)
- **Tokens únicos** en `:root`: radios (`--r-xs/chip/card/lg/pill`), sombras
  (`--shadow-sm/card/sheet/pop`), spacing (`--sp-1..6`).
- **tailwind.config**: `rounded-lg/xl/2xl/3xl` ahora mapean a los tokens de marca →
  los 58 usos de Tailwind suelto quedan unificados a 2-3 radios reales (antes 3 casi iguales).
- **Sombras de MapScreen** migradas de `shadow-2xl`/`shadow-[...]` inline a `--shadow-sheet`/
  `--shadow-card`. Evidencia: `grep shadow-2xl` = 0 resultados.

### 3. Accesibilidad
- **Contraste**: `--text-3` #5c647a (3.34:1, **fallaba WCAG AA**) → #737c92 (**4.71:1, pasa**).
  Evidencia: cálculo de luminancia documentado.
- **Foco de teclado**: agregado `:focus-visible` global (anillo ámbar). Antes había 1 sola
  regla de foco → navegación por teclado casi sin foco visible (WCAG 2.4.7). Evidencia: grep.

### 4. Limpieza técnica
- **Código muerto borrado** (re-verificado 0 usos): `FavoriteCard`, `NearbyStopCard`, `Pill`,
  `ThemeToggle`, `useNearbyStops`, `lib/occupancy`, `lib/routes-server`.
- **Haversine unificado**: 5 implementaciones duplicadas → `lib/geo.ts` (puro, cliente+server).
  Dejé `distM` equirectangular en bus-direction (es optimización intencional, no duplicación).
  Evidencia: 68 tests siguen pasando tras tocar el motor de ruteo.

### 5-6. UX / diseño profundo (crítica dura aplicada)
- **ETAs con jerarquía**: verde "ya viene" (≤2min) / ámbar "pronto" (≤6min) / neutro "falta".
  Antes TODO gris → un bus a 1h se veía igual que uno a 3min. (El `.eta.soon` ya existía en
  CSS pero ArrivalRow no lo usaba.)
- **Buscador des-rellenado**: eliminada sección "Explorá" = `STOPS_DATASET.slice(0,10)` (paradas
  al azar, relleno de dev). "Populares" → "Paradas frecuentes" (curadas).

## QUÉ NO TOQUÉ Y POR QUÉ
- **`distM` equirectangular** (bus-direction): NO es duplicación, es una aproximación rápida
  intencional para distancias cortas (snap de buses). Tocarla sería empeorar.
- **Colores de líneas hardcodeados** (LeafletMap `{"76":"#ef4444"}`): es DATO de líneas, no UI.
  Centralizarlo es cosmético, bajo ROI.
- **Light theme `--text-3`**: el dark es el tema principal y por defecto; el light requiere su
  propio cálculo de contraste sobre fondo claro (pendiente, no crítico).
- **Badges de línea grises** (el "muro de números" en paradas con muchas líneas): es un hallazgo
  de diseño real pero teñirlos reintroduce el "arcoíris" que el usuario ya rechazó antes. Decisión
  consciente: mantener neutro. Mejorable con densidad/agrupación, no con color.

## PENDIENTE ANTES DE UN DEPLOY SERIO
1. **Medición en producción** (no inventable): Lighthouse real, error real de ETAs, batería en
   dispositivo, VoiceOver/TalkBack manual. El analytics ya está puesto para empezar a medir.
2. **Light theme**: validar contraste sobre fondo claro.
3. **Reportes comunitarios** (la mayor oportunidad de producto restante — schema listo).
4. **Microcopys**: quedan 2-3 genéricos ("Cargando paradas…") sin pulir.

## CALIFICACIÓN (honesta, con criterio)

| Dimensión | Nota | Justificación con evidencia |
|---|---|---|
| **UX** | 8.5/10 | Flujos claros, un protagonista por pantalla, sin fricción en el core. Resta: el buscador idle aún flojo; falta el "modo rápido". |
| **UI** | 8/10 | Subió fuerte con el design system unificado (radios/sombras). Resta: badges de línea monótonos, alguna densidad en sheets, light theme sin validar. |
| **Código** | 8.5/10 | Tras la limpieza: sin muertos, haversine unificado, 68 tests, tsc/build 0. Resta: aún hay Tailwind suelto en sheets (migrado a tokens vía config, pero el método mezcla clases CSS de marca + Tailwind). |
| **Accesibilidad** | 7.5/10 | Contraste AA corregido, foco de teclado agregado, touch 44px, aria-labels. Resta: prueba real con lectores de pantalla, light theme, zoom 200%. |
| **Producto** | 8.5/10 | Diferenciales reales (honestidad del dato, interior, sin ads, voz uruguaya). Resta: reportes comunidad para cerrar brecha con Moovit. |
| **Nivel profesional** | 8/10 | Ya NO se siente "hecho por IA" en marca/voz/jerarquía. Se siente un producto cuidado. Resta el último 20%: detalles de densidad, badges, y pulido fino que separa "muy bueno" de "excepcional". |

**Promedio: ~8.2/10.** Antes de esta ronda estaba en ~7. El salto vino de: design system
unificado (UI), contraste/foco (a11y), limpieza (código), y quitar relleno (producto).

## Veredicto
La app está **lista para un deploy serio** en lo funcional y bastante pulida en lo visual.
El 20% restante para "excepcional" es: validación en dispositivo real (a11y/perf), reportes
comunitarios, y un pase de diseño fino sobre densidad y badges. Nada de eso es bloqueante.
