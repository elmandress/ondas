# Cuándo — Roadmap Maestro (la biblia)

> **Cómo usar este doc:** es la fuente de verdad. Se ejecuta **en orden**, fase por fase.
> Una tarea no se da por terminada hasta cumplir su **DoD (Definition of Done)**. No se salta
> de fase sin cerrar la anterior (salvo lo marcado "en paralelo"). Cada ejecución arranca por
> la primera tarea pendiente de la fase activa. Última actualización: may 2026.

---

## 0) Norte y estrategia (no tocar sin repensar todo)

- **North Star Metric:** *viajes que terminan bien por semana* = el usuario planificó/consultó y
  llegó a su bondi a tiempo. Proxies: WAU (activos semanales) y **retención semana-4**.
- **Tesis para ganar (no negociable):** no competir por cantidad de features contra maprab, sino
  ser **dramáticamente mejor en el núcleo**: *rutear bien + decir la verdad + al instante*. Marca:
  **"te lleva bien y te dice la verdad, al toque."**
- **Diferenciales defendibles:** honestidad (no inventamos datos), velocidad real, **privacidad por
  defecto** (sin trackers de terceros tipo PostHog), y diseño limpio y entendible.
- **Modelo de negocio (canvas resumido):**
  - *Propuesta de valor:* la app de bondi más confiable y rápida de Uruguay, gratis.
  - *Segmentos:* estudiantes/trabajadores de MVD y área metro; luego interior.
  - *Canales:* PWA instalable (gratis) → Play Store/App Store; IG/TikTok orgánico + ads.
  - *Ingresos:* **ads NO invasivos** (1 slot, respetuoso) + **premium honesto** (ver §6) — el GPS
    en vivo SIEMPRE gratis (diferencial anti-Moovit).
  - *Costos:* hosting (gratis→VPS al escalar), datos (gratis, oficiales), 1 dev.
  - *Ventaja injusta:* obsesión por el núcleo + honestidad + el churn de confianza de las otras apps.

---

## 1) Estado actual (hecho — no rehacer, solo mantener)

UI limpia y a tokens · **tema claro/oscuro + Auto por hora** · **onboarding** de primer uso ·
**performance** (code-split por pantalla, lazy de routes.json 3.9MB, polling adaptado a red +
pausa en background, tiles por tema/red, SW cachea pesados) · principio de **honestidad** (sin
datos inventados) · destinos acortados · tracking en toda parada · mic · WiFi solo en eléctricas
confirmadas · **hora pico** (fuente IM) · **viaje mixto** taxi/Uber zona-aware nocturno (sin precio
falso) · **filtros** accesible/AC · **Mis rutas por dirección/esquina** · **blindaje de API** con
marca · **"Optimizar para"** funcionando · legal (Ley 18.331) · **deploy-ready** (next.config
tracing, assetlinks, build OK). Docs: VISION-MONUMENTAL, PERFORMANCE, PLAYSTORE-LAUNCH.

---

## FASE 1 — El núcleo que nos hace ganar  ⭐ (máxima prioridad)
*Objetivo: que un usuario diga "me dio la ruta bien, al toque, y no me mintió".*

### 1.1 Motor de ruteo de verdad (el golpe #1)
- **Qué:** reemplazar el planner heurístico por un algoritmo correcto multi-criterio
  (**Connection Scan Algorithm** o RAPTOR) sobre el GTFS, con costo de transbordo y caminata
  bien calibrados.
- **Resolver el 181/183 y circulares:** si **una sola variante** de una línea cubre origen→destino
  en orden → es **directo** (cero transbordos), aunque cambie de letrero/ramal. Detectar
  continuaciones (interlining) cuando el dato lo permita.
- **Archivos:** `src/lib/route-planner-gtfs.ts`, `src/lib/gtfs-db.ts`, `data/gtfs-v2.db`.
- **DoD:** tests que reproducen 181/183, "183→183 Pocitos", y un circular de Ciudad Vieja, y
  devuelven **directo** (no 3 transbordos). Nunca sugiere caminar >X cuando hay un transbordo corto.
  p95 de cómputo < 300 ms. 0 regresiones en los 50 tests actuales.

### 1.2 Feedback instantáneo (matar el "2 s en silencio" de maprab)
- **Qué:** respuesta visual inmediata en cada acción: marcador al fijar origen/destino en el mapa,
  skeletons en resultados, estados optimistas, spinners < 100 ms.
- **Archivos:** `MapScreen.tsx`, `RouteScreen.tsx`, `useRouteplanner.ts`.
- **DoD:** al tocar un punto en el mapa aparece el marcador y el campo se llena **al instante**
  (< 100 ms percibido). Ninguna acción queda "muda".

### 1.3 Planner avanzado (paridad bien hecha)
- **Qué:** **hora de salida** (planner schedule-aware para una hora futura) + **paradas intermedias**
  (hasta 3) + "Optimizar para" (✅ ya está).
- **Archivos:** `route-planner-gtfs.ts` (departAt + waypoints), `RouteScreen.tsx`, `/api/route/plan`.
- **DoD:** elegir "Salir 21:30" cambia las ETAs según horario; agregar 1 parada intermedia arma una
  ruta encadenada coherente. Tests de ambos.

### 1.4 Confianza / predicción honesta
- **Qué:** **predicción de atrasos** para líneas que no respetan horario (histórico real,
  etiquetada "estimación", nunca como verdad) + **modo "último bus"** (resaltar última corrida).
- **Archivos:** nuevo `src/lib/delay-prediction.ts`, `schedule-db.ts`, `ArrivalRow.tsx`.
- **DoD:** una línea con atraso histórico muestra "suele venir ~X min tarde (estimado)"; la última
  corrida del día se marca con aviso. Todo etiquetado y testeado.

---

## FASE 2 — Cobertura nacional (table-stakes contra maprab)
*Objetivo: servir fuera de Montevideo, con CALIDAD (no "experimental que te manda a caminar").*

### 2.1 Pipeline GTFS nacional
- **Qué:** sumar GTFS suburbano e interdepartamental del **Catálogo Nacional de Datos Abiertos** al
  pipeline (`scripts/build-gtfs-db.mjs`), con QA por departamento antes de publicar cada uno.
- **DoD:** Canelones metro + 1 interdepartamental (ej. MVD↔Maldonado) con rutas verificadas. Bandera
  por-departamento "verificado / experimental" visible al usuario (honestidad).

### 2.2 Tiempo real multi-empresa/departamento
- **Qué:** integrar tracking regional (SeguíTuBus/Tres Cruces, COPAY, etc.) donde haya fuente.
- **DoD:** ver en vivo al menos buses interdepartamentales de 1 corredor. Estados claros si no hay dato.

### 2.3 Búsqueda "que va a X" en vivo
- **Qué:** lo que la gente ama: escribir "a Pando" y ver en vivo solo los que van ahí.
- **Archivos:** `SearchScreen.tsx`, `/api/stm/vehicles`.
- **DoD:** la búsqueda filtra vehículos por destino en tiempo real.

### 2.4 Horarios simplificados del interior
- **Qué:** convertir los horarios infumables (COPSA en Excel) a vista limpia.
- **DoD:** una empresa del interior con horario legible en la app.

---

## FASE 3 — Plataforma y cuentas (necesita backend)
*Objetivo: persistencia, sync y la integración STM que maprab ya tiene.*

### 3.1 Backend (Supabase)
- **Qué:** Supabase (free tier) para sync de favoritos/rutas entre dispositivos y cuentas
  **opcionales** (la app sigue andando sin login). Mover `schedule.db` a Postgres (resuelve los 84MB).
- **DoD:** favoritos sincronizan con cuenta opcional; sin cuenta, todo sigue en localStorage. RLS y
  privacidad conforme Ley 18.331.

### 3.2 Integración STM (saldo / recarga / movimientos)
- **Qué:** ver saldo, movimientos y recargar la tarjeta STM (lo que maprab tiene).
- **DoD:** consultar saldo real y flujo de recarga funcionando. Manejo seguro de credenciales.

### 3.3 Puntos de recarga STM en el mapa
- **DoD:** capa de puntos de recarga con búsqueda del más cercano.

---

## FASE 4 — Nativo y notificaciones (el caso de uso definitivo)
*Objetivo: "tu bus está llegando" con la app cerrada, y presencia en tiendas.*

### 4.1 Capacitor + Push (FCM)
- **Qué:** envolver con **Capacitor**, push nativo FCM, **notificaciones para bajarse** y "salí ahora".
  Usa la plantilla de email/aviso del brand book como base de copy.
- **DoD:** notificación real "tu 64 llega en 4 min" con la app cerrada (Android).

### 4.2 Widget (iOS/Android)
- **Qué:** widget "cuándo salir sin abrir la app" — 3 tamaños del brand book (`product.jsx`).
- **DoD:** widget Android mostrando la próxima salida de la parada Casa.

### 4.3 Publicación en tiendas
- **Qué:** TWA→Capacitor a **Play Store** (target API 35, Lighthouse ≥80, assetlinks) y luego App Store.
  Antes: **página pública de Política de Privacidad** + Data Safety form. (Ver PLAYSTORE-LAUNCH §7-8.)
- **DoD:** app publicada y aprobada en Play Store.

---

## FASE 5 — Comunidad y datos propios
*Objetivo: que la comunidad mejore los datos y nos diga qué priorizar.*

### 5.1 Reviews de buses + feedback in-app
- **Qué:** avisar "AC roto / viene lleno" (reviews) y feedback por audio/texto (brand: botón de voz).
- **DoD:** un usuario reporta estado de un bus y otro lo ve, etiquetado "aportado por usuarios".

### 5.2 Correcciones crowdsource de paradas/rutas
- **DoD:** proponer corrección de una parada mal ubicada, con cola de moderación.

### 5.3 Analítica propia (privacy-first)
- **Qué:** métricas propias sin trackers de terceros (diferencial vs PostHog de maprab): qué
  paradas/líneas se consultan, para priorizar. Anónimo y conforme Ley 18.331.
- **DoD:** dashboard interno de uso real, sin identificar personas.

---

## FASE 6 — Crecimiento y negocio (el salto a "millones")
*Objetivo: distribución, retención y monetización sana.*

### 6.1 Marketing y ASO
- **Qué:** generar **IG stories + anuncios 1080×1080** (assets de `social.jsx`), **landing**
  (cuando.uy), ficha de tienda optimizada (ASO), prensa local. Plan de contenido orgánico.
- **DoD:** landing live + 1 tanda de stories/ads publicada con el sistema visual de marca.

### 6.2 Monetización (sin ensuciar)
- **Qué:** **ads NO invasivos** (1 slot definido, respetuoso — jamás "anuncios por doquier") +
  **premium honesto** (ej. widgets extra, alertas avanzadas, sin anuncios) — **el GPS en vivo
  siempre gratis**. Definir precio y qué SÍ/NO se cobra antes de prender.
- **DoD:** 1 formato de ad probado que no baja la retención; propuesta premium escrita.

### 6.3 Loops de crecimiento
- **Qué:** **compartir ruta** (link), **buscador global** (líneas/empresas/que va a X), widget como
  gancho de re-enganche, referidos.
- **DoD:** compartir ruta genera un link que abre la ruta en la app; buscador global funcionando.

### 6.4 Métricas y operación
- **DoD:** tablero con North Star + WAU + retención S4; revisión semanal; presupuesto de
  performance (Home JS < 250 KB brotli) y de datos vigilados.

---

## Transversal (en toda fase, no opcional)
- **Calidad:** `tsc` 0, ESLint 0 errores, **tests** por feature, **smoke** verde, **build prod** OK
  antes de cerrar cualquier tarea. Nada se mergea roto.
- **Performance budget:** Home < 250 KB JS (brotli); no regresar lo ganado.
- **Honestidad de datos:** jamás inventar (ETAs, ocupación, wifi, seguridad). Etiquetar estimaciones.
- **Accesibilidad:** contraste AA en ambos temas, labels ARIA, navegación por teclado.
- **Privacidad/legal:** Ley 18.331 al día; GPS no se guarda; sin trackers de terceros.
- **Documentar** cada cambio grande (como venimos haciendo).

---

## Orden de ejecución inmediato (lo que arranca la próxima)
1. **F1.1 — Motor de ruteo + 181/183** (investigación/diagnóstico con tests → reescritura).
2. **F1.2 — Feedback instantáneo.**
3. **F1.3 — Hora de salida + paradas intermedias.**
4. **F1.4 — Predicción honesta + último bus.**
→ Recién con F1 cerrada, F2. Marketing/assets (F6.1) puede hacerse **en paralelo** cuando convenga.
