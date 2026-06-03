# Plan de medición + auditoría anti-IA profunda — Cuándo

Lo que NO se puede afirmar sin datos en producción (se mide, no se inventa) + auditoría
de identidad visual más allá de los bordes redondeados. Junio 2026.

---

## PARTE A — MÉTRICAS QUE REQUIEREN PRODUCCIÓN (plan honesto)

No puedo afirmar "el ETA tiene ±2 min de error" sin recolectar datos reales en el tiempo.
Acá está QUÉ medir y CÓMO, ahora que hay analytics anónimo (`lib/analytics.ts`).

### 1. Precisión de ETAs (lo más crítico)
**Qué medir**: error = (hora real de llegada del bus) − (ETA que mostramos). El problema:
no sabemos la hora real sin que el usuario confirme o sin un GPS que cruce parada.
**Cómo medir (factible)**: cuando el usuario "sigue" un bus y el GPS de ese bus pasa por
su parada (lat/lon ≈ parada), registrar `track("eta_hit", {predicted, actual_delta})`. Con
~semanas de datos sale el error medio por franja horaria.
**Hallazgo estructural ya conocido**: el ETA oficial preciso (`upcomingbuses`) devuelve 400
desde mayo 2026. Hoy el ETA sale de (a) recorrido GTFS [bueno] o (b) distancia+velocidad
asumida [aproximado, marcado con "~"]. **Acción ya hecha**: marcar los aproximados. **Acción
futura**: si el error medido del modo (b) es alto, mostrar rango ("4-7 min") en vez de número.

### 2. Batería y datos
**Qué vigilar**: el polling de arrivals (cada 20s, ya adaptado a red) y el `watchPosition`
(ya estabilizado a 25m). El mapa abierto mucho tiempo redibuja.
**Cómo medir**: no hay API web de batería confiable (deprecada). Proxy: medir cuántos fetch/min
hace la app por pantalla (analytics) y bajar frecuencia donde no aporta. **Acciones ya hechas**:
intervalo adaptado a red, pausa de polling con `visibilitychange`, GPS con umbral.
**Pendiente**: verificar en dispositivo real que el mapa pausa el redibujo en background.

### 3. PWA / Lighthouse
**Qué medir**: instalabilidad, peso inicial, score PWA, offline.
**Cómo**: correr Lighthouse contra el deploy de Netlify (no contra localhost). Requiere estar
deployado. **Estado conocido**: manifest ✅, service worker ✅ (offline real), íconos ✅,
viewport-fit ✅, HTTPS (Netlify) ✅. Probable score PWA alto; confirmar tras deploy.
**Acción**: correr `lighthouse https://<sitio>.netlify.app` y anotar LCP/INP/CLS reales.

### 4. Accesibilidad real
**Auditable ya (sin producción)**:
- Contraste: paleta diseñada para WCAG AA (text-2 aclarado, accent brillado — comentado en CSS).
- Texto grande: implementado (`text-size`).
- Touch targets: 44px en coarse pointers (implementado).
- Lectores de pantalla: hay `aria-label` en botones de ícono, `role="status"` en avisos.
  **Pendiente**: pasada con VoiceOver/TalkBack real + revisar orden de foco por teclado.
- Una sola mano: el bottom-nav y las acciones principales están en la zona del pulgar. OK.

---

## PARTE B — AUDITORÍA ANTI-IA PROFUNDA (más allá de los bordes)

El usuario tiene razón: lo que delata una app de IA NO es el `rounded-3xl`, es que **todas
las pantallas se sienten iguales y sin criterio de producto**. Auditoría honesta:

### Jerarquía visual — ¿hay una sola cosa clara por pantalla?
- **Home**: ✅ tras la limpieza. UNA acción grande ("¿A dónde vas?") + el contador. Bien.
- **Mapa**: ✅ el mapa manda, los paneles son secundarios.
- **Rutas**: ✅ las tarjetas con el tiempo grande dominan.
- **Buscar**: ✅ input arriba, resultados abajo.
- **Veredicto**: la jerarquía es buena. NO se siente "dashboard de cards iguales" (el pecado
  típico de IA). Hay un protagonista por pantalla.

### Identidad de marca — ¿tiene personalidad propia o es plantilla?
- ✅ Logo propio (anillo-C + dot ámbar), no un ícono genérico.
- ✅ Paleta ámbar `#f0a020` — NO el morado/gradiente de IA.
- ✅ Tipografía Plus Jakarta (elegida, no la default).
- ✅ Tono de marca: "El bondi te espera. Vos no." — tiene actitud.
- **Veredicto**: identidad fuerte. Esto es lo que MÁS la aleja del look de IA.

### Microcopys — ¿suenan a humano uruguayo o a IA?
- ✅ "¡Salí ahora!", "Faltá 3 paradas — prepárate", "Los servidores del STM están durmiendo",
  "el resto lo hace el bondi". Esto es ORO — ninguna IA escribe así por defecto.
- ⚠️ Algunos quedan genéricos: "Cargando…", "Sin servicios próximos". **Mejorables** a tono.
- **Veredicto**: los microcopys son un diferencial real. Empujar más en los estados genéricos.

### Vacíos de contenido (empty states) — ¿pensados o genéricos?
- ✅ Buenos: "Sin buses próximamente · No hay servicios en los próximos minutos", "Los
  servidores del STM están durmiendo 💤" (con personalidad).
- ⚠️ El hero vacío ("Activá el contador") es funcional pero seco.
- **Veredicto**: mejor que el promedio. Los empty states con voz propia son anti-IA.

### Consistencia entre pantallas — ¿criterio o copy-paste?
- ✅ Componentes reutilizados con criterio: `ArrivalRow` única (no 3 markup distintos),
  `LineBadge`, bottom-sheets coherentes.
- ⚠️ Mezcla de estilos: algunos componentes usan clases CSS de marca (`.hero-card`,
  `.arrival-row`) y otros Tailwind suelto (`rounded-2xl`, `bg-[#0a0f1c]/97`). Inconsistencia
  de método (no visual grave, pero es deuda). **Pendiente**: migrar el Tailwind suelto de los
  sheets a clases de marca para coherencia total.

### Patrones de interacción — ¿previsibles o con identidad?
- ✅ Long-press para editar alias, follow-bus con haptic, voz opt-in, bottom-sheets con drag
  handle. Son patrones móviles reales, no "todo es un modal centrado" (pecado de IA/SaaS).

### Veredicto general anti-IA
**Cuándo NO se siente hecho por IA** en lo que más importa: tiene una voz (microcopys
uruguayos), una identidad (ámbar, no morado), jerarquía con protagonista por pantalla, y
empty states con personalidad. **Deuda menor**: unificar el método de estilado (clases de
marca vs Tailwind suelto) y pulir 4-5 microcopys genéricos ("Cargando…") al tono de la casa.
Eso NO es el look de IA — es prolijidad.

### Acciones concretas pendientes (bajo costo, alto criterio)
1. Microcopys genéricos → tono Cuándo: "Cargando…" → "Buscando bondis…"; "Sin servicios
   próximos" → "No viene ninguno por ahora".
2. Migrar Tailwind suelto de los 3 sheets a una clase `.sheet` de marca (consistencia).
3. Empty state del hero vacío con un toque de voz.

## Fuentes
Maven/Medium (AI slop = shadcn look), NN/g (empty states con voz), reseñas que elogian el
tono de apps con personalidad, análisis propio del código de Cuándo.
