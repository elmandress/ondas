# Cuándo — Reforma monumental: cómo le ganamos a maprab

> Contexto: maprab (proyecto de "ShyGrill") es hoy la referencia. Tiene cobertura
> nacional, integración STM, y estética. Esto NO es para copiarlo: es para **ganarle**
> siendo dramáticamente mejor en lo que importa y nadie clava, y después igualar
> cobertura con calidad. (Las quejas de la gente son de TODAS las apps, no solo maprab.)

## 1. Qué tiene maprab (estado real, ene-2026)
Ya shippeado: paradas por proximidad, **interdepartamentales** (Rivera, Paysandú, Colonia…),
**integración STM (recarga, saldo, movimientos)**, notificaciones para bajarse (Android, sin
publicar), puntos de transbordo + buscador rápido de líneas, compartir ruta y "vistas", paradas
combinadas, **puntos de recarga STM**, long-press para ruta rápida, feedback por audio/texto,
tema claro/oscuro, capa satelital, WiFi del bus (red+clave), llamar a la empresa.
Planeado: quick-connect WiFi, reviews de buses (AC roto), **predicciones para buses que no
respetan horario**, correcciones crowdsource de paradas/rutas, tutorial.

## 2. Sus GRIETAS reales (confesadas en Reddit — acá entramos)
1. **El ruteo es flojo/bugueado.** Textual: *"minimizar caminata me propone caminar 2 km en
   lugar de hacer 2 transbordos de 10 metros"*; el propio dev: *"no andaban las optimizaciones…
   me recomendó transbordo en vez de esperar unos minutos por uno directo"*. **El motor es su
   talón de Aquiles.**
2. **Lentitud y falta de feedback.** *"seleccionar un punto en el mapa demora un par de segundos
   y no hay respuesta… me irritó la falta de feedback"*. Sin marcador al fijar origen/destino.
3. **Te trackean** (PostHog; uBlock lo bloquea y la gente lo nota).
4. **Cobertura nueva = experimental** y a veces mal: *"te puede mandar a caminar"* (lo admite).
5. Sprawl de features de un proyecto de una persona → calidad despareja.

## 3. Qué confirma el hilo de Reddit (señal real de valor)
- **El tiempo real multi-departamento es oro**: *"correteé un bondi a Maldonado, sin eso llegaba
  2 h tarde"*. Y la búsqueda **"A pando" + "que contenga"** (ver en vivo solo los que van a X).
- **Simplificar horarios de empresas con info pésima** (COPSA en planillas Excel, Cita sin
  horarios) = *"gracias eternas, no te imaginás lo que simplificás"*. Enorme en el interior.
- **Confianza en el último bus** de la noche (Las Piedras→MVD): *"deposité toda mi confianza y
  apareció"*. La confiabilidad vende.
- "Moovit quién?" pero también *"vivo en Paso de la Arena y Moovit me hace ir hasta 18 para tomar
  otro que puedo tomar en el Paso"* → **ruteo con conocimiento local gana**.

## 4. La TESIS para ganar
No competir por **cantidad** de features (carrera perdida contra su ventaja). Ganar por ser
**dramáticamente mejor en el núcleo** que todos hacen mal, y volverlo nuestra marca:

> **"Cuándo te lleva BIEN y te dice la VERDAD — al instante."**
> El ruteo más inteligente del Uruguay + honestidad + velocidad. Después, cobertura con calidad.

### Pilar A — Moat técnico: motor de ruteo de verdad
- Reemplazar el planner heurístico por **RAPTOR o Connection Scan Algorithm (CSA)** sobre el GTFS:
  multi-criterio REAL (tiempo / transbordos / caminata) **sin los bugs** que maprab admite.
- **Resolver el 181/183 y los circulares** (el dolor #1 universal): detectar cuando una **misma
  línea continúa bajo otra variante/número** (interlining / through-routing) y ofrecer el viaje
  directo en vez de 3 transbordos. Empezar por: para cada línea, si UNA variante cubre
  origen→destino en orden, es directo (ya casi lo hacemos) → extender a variantes encadenadas.
- **Nunca** mandar a caminar 2 km cuando hay un transbordo de 10 m (penalización de caminata bien
  calibrada — su error textual).

### Pilar B — Confianza / predicción (honesta)
- En vivo vs horario explícito (ya lo tenemos), aviso de hora pico (ya), y **predicción para
  líneas que no respetan horario** basada en historial real de atrasos — **etiquetada como
  estimación**, no como verdad. (maprab lo planea; nosotros lo hacemos honesto.)
- **Modo "último bus"**: resaltar la última corrida y avisar "te queda 1 sola".

### Pilar C — UX instantánea con feedback (matar su grieta #2)
- Marcador inmediato al fijar origen/destino, estados optimistas, skeletons, cero "2 s en
  silencio". (Ya optimizamos arranque/datos; sumar feedback inmediato en cada acción.)

### Pilar D — Cobertura con CALIDAD
- Sumar **suburbano + interdepartamental** (GTFS del Catálogo Nacional de Datos Abiertos), pero
  con QA: no shippear "experimental que te caga". Búsqueda **"que va a X"** en vivo (lo que la
  gente ama). Simplificar los horarios infumables de COPSA/Cita = valor enorme en el interior.

### Pilar E — Paridad selectiva (lo que sí vale)
STM **saldo/recarga/movimientos**, **notificaciones para bajarse**, **puntos de recarga STM** en
el mapa, **temas claro/oscuro**, **paradas intermedias + hora de salida + optimizar-por** en el
planner, **long-press = ruta rápida**, compartir, capa satelital, llamar empresa.

### Pilar F — Identidad + monetización SANA
Rápido, honesto, **privacidad por defecto** (sin trackers tipo PostHog → diferencial real).
Los ads (que sí van) deben ser **no invasivos** (1 lugar, respetuoso) para no caer en el
"anuncios por doquier" que le critican a maprab. La privacidad y la prolijidad son la marca.

### Pilar G — Comunidad (con cuidado)
Feedback audio/texto, **reviews de buses** (AC roto, lleno), correcciones crowdsource de
paradas/rutas — todo con moderación y etiquetado "aportado por usuarios".

## 5. Roadmap por fases
- **F1 (semanas) — Wedge + polish:** motor RAPTOR/CSA + fix 181/183 (direct por variante) ·
  feedback instantáneo al fijar puntos · temas claro/oscuro · planner (paradas intermedias, hora,
  optimizar-por) · prompt propio de instalar.
- **F2 — Confianza + comunidad:** predicción honesta de atrasos · modo último bus · reviews de
  buses · feedback in-app.
- **F3 — Cobertura:** suburbano/interdepartamental con QA + búsqueda "que va a X" + horarios
  simplificados del interior.
- **F4 — Integración STM:** saldo/recarga/movimientos + puntos de recarga (necesita backend/cuentas).
- **F5 — Notificaciones para bajarse** (Capacitor + FCM) + publicación nativa.

## 6. Métrica de victoria
Que un usuario que probó maprab diga: *"Cuándo me dio la ruta bien, al toque, y no me mintió"*.
Ese es el día que ganamos.
