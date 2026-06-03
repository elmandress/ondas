# Crítica brutal: ¿qué falta para el "no puedo creer que esto exista"

Evaluada NO contra apps de transporte, sino contra Google Maps, Uber, Spotify, Linear,
Apple Maps. Estándar: que un usuario nuevo piense *"no puedo creer que funcione tan bien"*.
Con evidencia de la app corriendo. Junio 2026. **50 defectos reales.**

---

## LA VERDAD INCÓMODA
La app es **competente pero olvidable**. Funciona, es honesta, está prolija. Pero NO hay un
solo momento donde el usuario diga "wow". Y la **primera impresión te pide trabajo en vez de
darte valor**. Una referencia mundial no se siente así. Hoy es un 6.5, no un 8.2.

---

## A. PRIMERA IMPRESIÓN / WOW FACTOR (lo más grave)

1. **🔴 La home en primer uso es un ESTADO VACÍO.** Lo más prominente que ve un usuario nuevo:
   "Activá el contador / Guardá una parada favorita o activá el GPS". Le pedís tarea antes de
   dar valor. Uber abre con autos moviéndose; Spotify con tu música; vos con un to-do.
2. **🔴 "Acciones STM" (links externos: Saldo, Reportar) son protagonistas** cuando no hay
   favoritos. Mandás al usuario AFUERA de tu app como primer call-to-action. Absurdo.
3. **🟡 Primer load ~2.4s sin skeleton del hero** — aparece de golpe. Las apps top muestran un
   esqueleto que se llena, dando sensación de velocidad aunque tarde lo mismo.
4. **🔴 No hay NINGÚN momento "wow".** Nada sorprende. La mejor app de transporte del mundo
   debería tener un instante mágico (ver TU bus acercándose en vivo apenas abrís, p.ej.).
5. **🟡 "Ubicando…" en el header, seco.** Uber muestra el mapa girando hacia tu posición
   mientras ubica — el proceso es parte del delight. Acá es un texto gris.

## B. BÚSQUEDA (la puerta de entrada al valor)

6. **🔴 Íconos de lugares = EMOJIS en cajas moradas/azules** (🛍️📍📌). Es EL patrón de IA.
   Inconsistente con la marca ámbar. Google Maps usa íconos vectoriales con color por categoría.
7. **🔴 Ranking pésimo**: "Centro de Campo de Fútbol de los Pocitos" rankea ARRIBA de "Pocitos"
   (el barrio). Ningún humano busca eso. Falta boost por relevancia/popularidad obvia.
8. **🟡 Dos zonas de input** (card "Desde/Hacia" + barra de búsqueda) → ¿dónde escribo?
   Confunde. Google Maps tiene UN campo claro.
9. **🟢 "Cancelar" es solo texto**, sin afordancia de botón.
10. **🟡 Fondos azul/morado de los POI** rompen la paleta ámbar — parecen de otra app.

## C. VELOCIDAD PERCIBIDA (donde Linear/Spotify ganan)

11. **🔴 Los números NO animan.** El "8 min", el "¡Ya!", los ETAs aparecen de golpe. Uber y
    Citymapper hacen count-up — el número subiendo se siente *vivo* e inteligente.
12. **🟡 Transición entre tabs = fade plano** (opacity 0.18s). No hay dirección/movimiento.
    Las apps top usan transiciones espaciales (slide) que dan sensación de lugar.
13. **🟡 Sin pull-to-refresh.** Gesto universal esperado para "actualizá las llegadas".
14. **🔴 Sin shared-element transitions.** Tocás una parada → el sheet aparece de la nada, sin
    continuidad. Apple Maps/Airbnb: el elemento que tocás *crece* hacia el detalle.
15. **🟡 routes.json (3.9MB) se baja al tocar la primera parada** → esa primera interacción
    puede tener un lag invisible que rompe la fluidez.

## D. JERARQUÍA E INFORMACIÓN

16. **🔴 Badges de línea = muro de números grises.** Una parada con 8 líneas (D9 D11 104 180…)
    es un bloque gris ilegible. Sin agrupación, sin peso, sin "tu línea primero".
17. **🟡 "horario" repetido bajo cada llegada** — redundante, ruido visual.
18. **🟡 Densidad inconsistente entre sheets** — algunos apretados, otros con aire.
19. **🟡 Nombre de parada largo se parte en 2 líneas** y empuja los chips de línea hacia abajo.
20. **🟢 El "min" del ETA grande compite con el número** — podría ser más sutil.

## E. PERSONALIDAD / DELIGHT (lo que hace que la AMEN)

21. **🔴 Cero micro-delight.** Guardás un favorito → nada. Llega tu bus → nada visual especial.
    Duolingo/Spotify celebran los momentos. Acá todo es transaccional.
22. **🟡 Haptic solo en follow-bus.** Debería estar en cada acción de peso (guardar, confirmar).
23. **🟡 Onboarding funcional pero olvidable** — informa, no emociona.
24. **🟡 La personalidad vive solo en microcopys.** No hay un gesto, animación o detalle visual
    que sea "tan Cuándo". La voz es buena pero está sola.
25. **🟢 Empty states secos** (ícono + texto). Una ilustración con carácter cambiaría todo.

## F. CONFIANZA (el core del producto)

26. **🟡 "Actualizado 12:38" es chico** — el dato más importante para la confianza, casi oculto.
27. **🔴 El bus NO se ve moverse en la lista.** Uber muestra el auto acercándose. Acá el ETA es
    un número estático que cambia al refrescar. Falta la sensación de "está pasando ahora".
28. **🟡 El "~" del ETA aproximado es honesto pero no explica por qué** — un tap debería decir
    "estimado por distancia, el STM no da el dato exacto ahora".
29. **🟡 "en vivo" vs "horario" no es prominente** — la distinción más importante para confiar.

## G. DESCUBRIBILIDAD (features potentes escondidas)

30. **🔴 Las mejores features están ocultas**: voz, compartir, seguir bus, "a casa". Un usuario
    nuevo no sabe que existen. No hay onboarding contextual ni hints.
31. **🟡 "Menos caminata/transbordos" requiere saber que el chip existe** y qué hace.
32. **🟡 Tabla de tarifas enterrada** en Ajustes→Derechos (lo mejoramos pero sigue a 2 toques).
33. **🟡 Gestos ocultos sin hint** (long-press para editar alias) — nadie lo descubre solo.

## H. COHERENCIA VISUAL (el "hecho por dev")

34. **🔴 Mezcla de 3 métodos de estilado**: clases CSS de marca (.hero-card) + Tailwind suelto
    (rounded-xl) + style inline. Tres formas de hacer lo mismo = se nota.
35. **🔴 Dos sistemas de íconos**: emojis (🏠💼🎫🌱📣) Y vectoriales (Icons.*). Incoherente.
36. **🟡 POI azul/morado vs todo lo demás ámbar** — dos paletas.
37. **🔴 tailwind.config tiene colores LEGACY muertos** (brand azul ultramarino, accent naranja
    distinto, fontFamily "geist" cuando es Jakarta). Residuo del template — confunde y es deuda.

## I. CÓDIGO / FUNDACIONES

38. **🟡 tailwind.config con colores y fuente que no son la marca** (ver #37).
39. **🟢 localStorage keys mezclan `ondas_` y `cuando_`** — inconsistencia histórica (no se
    pueden renombrar sin migrar datos de usuarios, pero es deuda visible).
40. **🟡 Aún Tailwind suelto en sheets** pese a los tokens — migración a medias.
41. **🟢 routes.json 3.9MB + stops.json 1.5MB** al cliente — pesado para móvil con datos.

## J. ACCESIBILIDAD (más allá de lo corregido)

42. **🟡 Light theme sin validar contraste** sobre fondo claro.
43. **🔴 El mapa (Leaflet) no es navegable por teclado** ni por lector de pantalla — toda la
    función de mapa es invisible para quien usa accesibilidad.
44. **🟡 Emojis como íconos sin aria-label descriptivo** — un lector lee "casa emoji" o nada.
45. **🟡 Sin prueba real de VoiceOver/TalkBack** (requiere dispositivo).

## K. PRODUCTO (lo que la haría imprescindible)

46. **🔴 No hay "modo rápido"** para el usuario diario — el frecuente repite los mismos pasos
    cada vez. Una referencia mundial aprende tu patrón y te lo anticipa.
47. **🟡 Sin reportes comunitarios** — brecha con Moovit; lo que alimenta datos buenos.
48. **🟡 Sin notificaciones push** ("tu bus llega en 5") — requiere nativo pero es EL hook de
    retención de las apps de transporte.
49. **🟡 Search idle no ayuda** — "paradas frecuentes" son curadas a mano, no tus paradas.
50. **🔴 Saltos de contexto**: de "ver parada" a "seguir bus" a "ruta" no hay continuidad — son
    pantallas separadas, no un flujo fluido. Uber es UN flujo continuo.

---

## RE-SCORING BRUTAL (estándar: Google Maps / Uber / Spotify)

| Categoría | Antes (auto-indulgente) | Real (clase mundial) | Por qué |
|---|---|---|---|
| UX | 8.5 | **6.0** | Pide trabajo antes de dar valor; fricciones; saltos de contexto; no es la forma más fácil imaginable. |
| UI | 8.0 | **6.0** | Emojis + 3 métodos de estilo + badges monótonos + sin delight. Se nota "hecha por dev". |
| Accesibilidad | 7.5 | **6.0** | Lo básico OK, pero mapa inaccesible, light sin validar, sin prueba real. |
| Código | 8.5 | **7.0** | Limpio tras la purga, pero config muerto + mezcla de métodos + keys inconsistentes. |
| Producto | 8.5 | **7.0** | Diferenciales reales (honestidad, interior), pero le faltan modo rápido / push / reportes para ser imprescindible. |
| Percepción profesional | 8.0 | **6.5** | Prolija, no excepcional. Cero momentos "wow". |

**Promedio honesto: ~6.4/10.** No es malo — es competente. Pero está lejísimos de "referencia mundial".

---

## PLAN A 10/10 (por categoría: qué impide, impacto, esfuerzo, cómo)

### UX → 10
- **#1 Primera impresión con valor (no tarea).** Impacto: ENORME. Esfuerzo: medio. Cómo: si hay
  GPS, mostrar de una "tu próximo bus en la parada más cercana" SIN pedir nada. Si no, un destino
  de un toque. Nunca un empty state como bienvenida.
- **#50 Flujo continuo.** Impacto: alto. Esfuerzo: alto. Cómo: que "ver parada → seguir bus →
  cómo llegar" sea un solo hilo con transiciones, no saltos de tab.
- **#46 Modo rápido / anticipación.** Impacto: alto. Esfuerzo: medio. Cómo: aprender el patrón
  (a las 8am vas al trabajo) y mostrarlo arriba sin pedirlo.

### UI → 10
- **#6/#35 Un solo sistema de íconos** (vectoriales, fuera emojis de UI). Impacto: alto.
  Esfuerzo: medio. Cómo: reemplazar emojis por Icons.* con color de marca.
- **#11/#14 Movimiento con significado**: count-up de números + shared-element transitions +
  el bus moviéndose. Impacto: ENORME (es el "wow"). Esfuerzo: medio-alto. Cómo: framer-motion
  layoutId + un tween de números + animar la posición del bus en la lista.
- **#16 Badges con jerarquía** (tu línea primero, agrupar, peso). Impacto: medio. Esfuerzo: bajo.
- **#34/#37 Un solo método de estilo** + limpiar config muerto. Impacto: medio. Esfuerzo: medio.

### Accesibilidad → 10
- **#43 Mapa con alternativa accesible** (lista navegable de lo que hay en el mapa). Impacto:
  alto. Esfuerzo: medio.
- **#42/#45 Validar light + lectores reales.** Impacto: medio. Esfuerzo: bajo (en dispositivo).

### Código → 10
- **#37 Limpiar tailwind.config** (colores/fuente de marca reales). Impacto: bajo-medio.
  Esfuerzo: bajo.
- **#34/#40 Terminar la migración a tokens** (sin Tailwind suelto). Impacto: medio. Esfuerzo: medio.

### Producto → 10
- **#48 Push "tu bus llega"** (el hook de retención). Impacto: ENORME. Esfuerzo: alto (nativo/Web Push).
- **#47 Reportes comunitarios.** Impacto: alto. Esfuerzo: medio (schema listo).
- **#46 Anticipación inteligente.** Impacto: alto. Esfuerzo: medio.

### Percepción profesional → 10
- **#21 Delight en los momentos clave** (guardar, llegar, confirmar) con micro-animación + haptic.
  Impacto: alto. Esfuerzo: bajo-medio.
- **#25 Empty states con ilustración de carácter** (no ícono + texto). Impacto: medio. Esfuerzo: medio.

---

## LOS 5 CAMBIOS DE MAYOR ROI (si solo se hicieran 5)
1. **Primera impresión con valor inmediato** (#1) — cambia todo desde el primer segundo.
2. **Count-up de números + bus que se mueve** (#11/#27) — el "wow" de velocidad/inteligencia.
3. **Un solo sistema de íconos, fuera emojis de UI** (#6/#35) — sube la calidad percibida al toque.
4. **Shared-element transitions** (#14) — la app se siente "una", no pantallas sueltas.
5. **Delight en momentos clave** (#21) — lo que hace que la recuerden y la amen.

Ninguno de estos es "agregar features". Son **elevar la experiencia de lo que ya existe**.
Ese es el camino de 6.4 a 9+.
