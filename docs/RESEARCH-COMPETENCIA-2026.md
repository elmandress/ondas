# Investigación de competencia y producto — mayo 2026

Trabajo de investigación profundo: apps de Uruguay + referentes internacionales + qué pide
la gente (incl. adultos mayores). Fuente para decidir qué construir y cómo ganar.

## Apps de Uruguay (nota El Observador + stores)

| App | Rating | Fuerte | Débil / quejas |
|-----|--------|--------|----------------|
| **Moovit** | 4.6/4.4 | alertas para bajarse (vibra/sonido), rutas auto, multi-país | **horarios no coinciden**, **ads invasivos que tapan la app**, abruma al nuevo |
| **Cómo Ir** (oficial IM) | 3.94/2.6 | accesibilidad silla, saldo STM, distancia a pie | **pierde búsquedas al minimizar**, UI lenta/fea, mala en iOS |
| **STM Montevideo** | 3.7/4.2 | locales de recarga + horarios, UI limpia, tiempo real | NO traza ruta a pie a la parada |
| **Bondi** | 2.5 iOS | minimalista, modo oscuro | **paradas solo por número sin dirección**, sin recorridos |
| **CUTCSA** | 2.7/1.8 | chat para reportar | muy buggeada, geoloc deficiente |
| **maprab** | — | cobertura nacional, STM saldo, wifi bus, "a destino" en vivo | **motor de ruteo flojo/bug**, lento sin feedback, te trackea (PostHog) |
| **MiBondi** | — | trackea suburbanos+interdepartamentales en vivo (COPSA, CITA, Maldonado, Colonia) | (revisar a fondo: posible fuente de realtime metro que creíamos inexistente) |
| **Voy en Bondi** | — | MVD+Canelones en vivo, elegir línea simple | — |

## Quejas UNIVERSALES = nuestras oportunidades
1. **Horarios mentirosos** → ya hacemos live-vs-horario honesto. Reforzar visualmente la diferencia.
2. **Ads invasivos que tapan** (Moovit) → ads NO invasivos (nunca modal/bloqueante). Diferencial.
3. **Abruma al nuevo / "no entiendo"** → modo simple para adultos mayores (ver abajo). ESTE es el pedido del usuario.
4. **Pierde estado / búsquedas** → persistir historial y última búsqueda.
5. **Parada sin dirección, solo número** → nosotros ya mostramos nombre+esquina. Mantener.
6. **Geoloc deficiente** → feedback instantáneo + fallback claro.

## Referente mundial: Citymapper (50M usuarios, el mejor)
- **Filtros de modo como acción PRIMARIA** (no enterrados en settings): Classic, Walk Less, Bus Only, Step-Free, Turbo, Price. Nosotros: "Más rápido / Menos transbordos / Menos caminata" ✓ — sumar **"Solo bus"** y **accesible**.
- **Navegación por voz + alerta para bajarse** (Moovit y Citymapper). Muy pedida. Candidata fuerte.
- **Step-Free / accesibilidad como modo de primer nivel**, no en settings. Ajusta tiempos de caminata para movilidad reducida.
- **Guardar viaje offline**, live trip tracking.

## Adultos mayores (pedido EXPLÍCITO del usuario: "un señor grande que no entiende")
Guías NN/g, JMIR, Toptal:
- **Texto ≥16px**, alto contraste, **íconos SIEMPRE con etiqueta de texto** (no solo símbolos).
- **Flujos simples**, una tarea por pantalla, limitar funciones secundarias visibles.
- Botones grandes (≥44px touch). Lenguaje claro, sin jerga.
- "Cuando un mayor no puede completar una tarea básica, no es solo frustración: es pérdida de independencia."
- → Acción: auditar que cada ícono-acción tenga texto; el home debe leerse como instrucciones, no como dashboard.

## PLAN DE ACCIÓN priorizado (qué ejecutar)
1. **Home legible para todos** (el pedido #1): jerarquía clara, una acción obvia ("¿A dónde vas?"), texto grande, sin abrumar. Tarjetas con verbo claro.
2. **Verificar MiBondi**: ¿hay realtime de suburbanos/interdepartamentales que podamos sumar? (revisar su fuente).
3. **Modo accesible / texto grande** (toggle): sube tamaños y contraste — gana al segmento que TODAS abandonan.
4. **Alerta "bajate ahora"** (como Moovit, muy amado) — cuando seguís un viaje.
5. **"Solo bus" en filtros** de ruta (Citymapper).
6. Persistir última búsqueda / historial (Cómo Ir lo pierde).
7. Reforzar visual live-vs-horario (nuestra honestidad como ventaja visible).

Relacionado: docs/VISION-MONUMENTAL.md, [[project-competencia-maprab]].
