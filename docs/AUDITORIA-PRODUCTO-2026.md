# Auditoría de producto + investigación de mercado — Cuándo (ómnibus Uruguay)

Informe de un equipo senior (product researcher, UX/UI de transporte, PM de movilidad,
analista de mercado UY, experto en tránsito). Junio 2026. Análisis duro, comparativo y
accionable. Niveles de evidencia: **Muy fuerte** (en muchas apps top + reseñas) ·
**Fuerte** · **Moderada** · **Débil** (una sola fuente).

---

## 1) RESUMEN EJECUTIVO

**Qué pasa en el mercado.** Las apps top (Transit, Citymapper, Moovit, Google/Apple Maps,
DB Navigator, BVG, TfL Go) convergen en lo mismo: *abrir → ver qué viene cerca → un toque
para el viaje frecuente → aviso de cuándo bajar*. Lo que las diferencia NO son features
exóticas, sino **confiabilidad del dato** y **mínima fricción**. La queja #1 transversal,
de Nueva York a Montevideo, es idéntica: **"los horarios mienten"** — la app dice que viene
un bus y no viene, o dice "no hay buses" y pasa uno al minuto (verificado en reseñas de
Moovit, Transit y, textualmente, en la app oficial **Cómo Ir** de Montevideo).

**Qué se repite en las mejores.** (a) *Nearby al abrir* sin tocar nada. (b) *Get-me-home*
de un toque. (c) *Get-off alert* (aviso de bajada). (d) *Favoritos rápidos* arriba de todo.
(e) *Offline real* (Transit pesa "como un GIF de un gato" para andar sin señal). (f) *Menos
caminata / menos transbordos* como filtro. (g) *Honestidad del tiempo real*.

**Errores que se repiten (a evitar).** Rediseños que **entierran los favoritos** y agregan
taps (BVG: *"se volvió un quest de 250 de IQ"*; DB Navigator: *"quitaron ajustes que servían"*).
**Ads invasivos** que tapan los horarios (Moovit: *"ads cada 3 acciones"*). **UI bloated**.
**Battery drain** del GPS de fondo.

**Oportunidad clara para Uruguay.** El benchmark local (Cómo Ir / STM) es **funcional pero
lento, se cuelga, no muestra todos los buses, no avisa de desvíos por obras y tiene UX pobre**
(reseñas App Store / Play). Hay un hueco real para una app que haga **lo básico mejor**:
rápida, honesta con el dato (no mostrar buses que ya pasaron), clara para gente grande, y con
**cobertura del interior** que las grandes no tienen. Cuándo ya apunta ahí.

---

## 2) TABLA COMPARATIVA DE FEATURES

| Feature | Quién la hace bien | Por qué funciona | Prioridad UY | Riesgo de molestar | Recomendación | Evidencia |
|---|---|---|---|---|---|---|
| **Nearby al abrir** (ver paradas/buses sin tocar) | Transit | Cero fricción, resuelve el 80% de los usos | **Alta** | Bajo | Mantener y reforzar | Muy fuerte |
| **"Qué bus tomo y a qué hora"** (núcleo) | Cómo Ir, todas | Es EL trabajo a resolver | **Alta** | Bajo | Es el corazón — proteger de ruido | Muy fuerte |
| **Get-off alert** (aviso de bajada por paradas) | Transit GO, Moovit | Permite distraerse sin perder la parada | **Alta** | Bajo (es opt-in al seguir un bus) | Mantener | Muy fuerte |
| **Get-me-home / trabajo** | Citymapper | El commuter repite el mismo viaje | **Alta** | Bajo | Mantener | Muy fuerte |
| **Favoritos arriba, accesibles** | DB, BVG (y su error al enterrarlos) | Acceso en 1 toque al viaje frecuente | **Alta** | **Alto si se entierran** | Mantener visibles, NO esconder | Muy fuerte |
| **Honestidad del tiempo real** (no mostrar buses ya pasados) | — (nadie lo hace bien) | Es la queja #1; genera confianza | **Alta** | Bajo | **Diferenciador clave** | Muy fuerte |
| **Offline / baja conectividad** | Transit | UY tiene conectividad irregular | **Alta** | Bajo | Mantener (ya hecho) | Fuerte |
| **Menos caminata / transbordos** | Transit, Citymapper "Walk less" | Útil para mayores, lluvia, valijas | **Media-alta** | Bajo | Mantener (ya hecho) | Fuerte |
| **Costo del boleto por ruta** | Citymapper | Dato útil y concreto | **Media** | Bajo | Mantener simple ($52) | Fuerte |
| **Último bus del día** | — | Evita quedar a pie de noche | **Media-alta** (UY nocturno flojo) | Bajo | Mantener | Moderada |
| **Texto grande / voz** | Moovit (VoiceOver) | Gente grande es gran parte del público de bondi | **Alta** | Bajo | Reforzar | Fuerte |
| **Alertas de servicio / desvíos** | Citymapper, Moovit, DB | Cómo Ir NO avisa de obras (queja real) | **Media-alta** | Medio (si spamea) | **Oportunidad**: resumir desvíos IM | Fuerte |
| **Crowdedness / ocupación** | Moovit | Saber si viene lleno | **Media** | Bajo | Solo donde hay dato real (interior) | Fuerte |
| **Reportes comunidad** | Moovit, Transit | Corrige datos, engagement | **Media** | Bajo si es simple | **Oportunidad** (schema listo) | Fuerte |
| **Compartir viaje / ETA** | Citymapper, Google | Seguridad, coordinación | **Media** | Bajo | Versión simple ya hecha | Fuerte |
| **CO₂ / calorías** | Citymapper | Engagement de nicho joven | **Baja** | **Alto** (moralista/relleno) | **Opt-in y oculto** ✅ ya movido | Moderada |
| **Gamificación / leaderboard** | Transit Royale | 20% lo usa, pero es de nicho | **Baja** | Medio (puede sentirse infantil) | No prioridad para UY | Moderada |
| **Qué vagón/puerta tomar** | Subway Korea, Citymapper | Solo para metro con andenes | **Nula** | — | **No aplica** (UY es 100% bus) | Fuerte |
| **Multimodal bici/scooter** | Transit | UY no tiene bikeshare con dato abierto | **Baja** | — | No aplica hoy | Fuerte |
| **Pago / ticketing in-app** | DB, EMT Madrid | UY usa tarjeta STM física | **Baja** (link a saldo) | Medio (complejidad) | Solo link a saldo, no pago propio | Fuerte |
| **Widget pantalla de inicio** | Google/Apple Maps | "Salidas cercanas" de un vistazo | **Media** | Bajo | Requiere app nativa (F4) | Fuerte |

---

## 3) PROBLEMAS REALES DE USUARIOS (quejas verificadas)

Recopilado de reseñas App Store / Play (Cómo Ir, STM Montevideo, Moovit, Transit, DB, BVG),
foros y blogs de producto.

**Pérdida de confianza (la más grave):**
- *"Dice que no hay buses y pasa uno al minuto"* — App Cómo Ir (Montevideo), textual.
- *"El ETA es mentira; esperé y no vino nunca"* — Transit/Moovit/Quora, transversal.
- **→ Cuándo ya ataca esto**: filtra buses ya pasados, no inventa atrasos. Es el activo más valioso.

**Datos desactualizados:**
- *"No actualizaron la línea 115 que cambió de recorrido"* — Cómo Ir.
- *"No avisa de cortes por obras"* — Cómo Ir.
- **→ Oportunidad**: reportes comunidad + resumir desvíos de la IM.

**Fricción / rediseños malos:**
- *"Ahora son 80% más taps; los favoritos cuestan encontrarlos"* — BVG.
- *"UI más lenta que antes"* — Cómo Ir.
- **→ Lección**: NO enterrar lo esencial. Proteger el camino "abrir → qué bus → cuándo".

**Invasividad:**
- *"Ads cada 3 acciones, tapan los horarios"* — Moovit.
- **→ Cuándo no tiene ads invasivos (diferencial). Si entran, que sean no-intrusivos.**

**Técnicos:**
- *"Se cuelga si no la usás unos días"* — Cómo Ir. *Battery drain del GPS* — transversal.
- **→ Vigilar el watchPosition (ya estabilizado a 25m) y el polling.**

---

## 4) PROPUESTA PARA URUGUAY

### MUST-HAVE (el núcleo intocable — proteger del ruido)
- Abrir → ver paradas/buses cerca (ya).
- "Qué bus y a qué hora" claro, sin pasos de más (ya).
- Tiempo real **honesto** (no mostrar pasados) — *el* diferencial (ya).
- Favoritos + Get-me-home en 1 toque, **siempre visibles** (ya).
- Get-off alert por paradas + voz (ya).
- Offline real (ya).
- Texto grande / accesibilidad para gente grande (ya, reforzable).

### NICE-TO-HAVE (suman, sin estorbar)
- Costo del boleto (ya), último bus (ya), menos-caminata (ya).
- Reportes comunidad simples ("esta parada se movió", "no pasó") — **siguiente de mayor ROI**.
- Resumen de desvíos/avisos de la IM en lenguaje claro.
- Departure board de una parada con muchas líneas.

### DIFERENCIADORAS (lo que las grandes NO tienen en UY)
- **Honestidad del dato** (anti "los horarios mienten").
- **Cobertura del interior + GPS Busmatick** (Maldonado/Paysandú/Rocha) — único.
- **Viaje mixto bus + taxi de noche con criterio de seguridad** (original, sin juzgar barrios).
- **Sin ads invasivos, sin trackers** — privacidad como valor.

### NO RECOMENDARÍA (para UY, hoy)
- Qué vagón/puerta (no hay metro). Multimodal bici/scooter (sin dato). Pago in-app propio
  (la tarjeta STM ya existe; solo linkear saldo). Gamificación/leaderboard (riesgo infantil,
  nicho). CO₂/calorías *prominente* (moralista) → ya movido a opt-in oculto.

---

## 5) AUDITORÍA BRUTAL DEL PRODUCTO ACTUAL (feature por feature)

Sin sesgo a conservar. Veredictos: **PROTEGER** · **MANTENER** · **SIMPLIFICAR** · **ELIMINAR/OCULTAR**.

| Feature actual | Aporta valor real | Veredicto | Justificación |
|---|---|---|---|
| Hero "cuándo salir" | Sí, alto | **PROTEGER** | Es el corazón. Cuidado con que no tiemble (ya arreglado). |
| Nearby / paradas cercanas | Sí, alto | **PROTEGER** | Resuelve el uso #1. |
| Get-me-home / trabajo | Sí | **MANTENER** | 1 toque al viaje frecuente. |
| Tiempo real honesto (filtro pasados) | Sí, máximo | **PROTEGER** | El diferencial. |
| Recorrido del bus / rutas | Sí | **MANTENER** | Ya arreglados los bugs de trazado. |
| Costo del boleto | Sí | **MANTENER** | Dato concreto, no estorba. |
| Último bus del día | Sí | **MANTENER** | Valor real de noche. |
| Voz / get-off alert | Sí (opt-in) | **MANTENER** | Accesibilidad + manos libres. |
| Texto grande | Sí | **MANTENER/REFORZAR** | Público mayor. Podría ser más visible en onboarding. |
| Viaje mixto taxi de noche | Sí, contextual | **MANTENER** | Solo aparece de noche/zona — bien acotado. |
| Horas pico (PeakHint) | Medio | **SIMPLIFICAR** | Solo aparece en pico real (bien), pero es informativo, no accionable. Mantener compacto; vigilar que no se sienta "relleno". |
| Zonas de seguridad nocturna | Medio-alto, sensible | **MANTENER con cuidado** | Bien hecho (no nombra barrios). Riesgo reputacional si se malinterpreta — mantener el tono actual. |
| CO₂ / calorías | Bajo | **OCULTAR (hecho)** | Movido a opt-in. Correcto. |
| Compartir viaje | Medio | **MANTENER** | Simple, no estorba. |
| Avisos por voz config | Sí | **MANTENER** | Opt-in en Ajustes. |
| Sync favoritos nube (cuentas) | Medio | **MANTENER, no empujar** | Útil pero opcional; que NUNCA sea obligatorio loguearse. |
| Derechos del pasajero / convivencia (en Ajustes) | Bajo-medio | **MANTENER (enterrado)** | Está bien que viva en Ajustes, no en el camino principal. No subir a Home. |

### "Features que ELIMINARÍA"
- Ninguna por completo hoy — el producto está sorprendentemente disciplinado. Pero **vigilar**:
  - Si la **home** supera ~6 bloques visibles a la vez → recortar. Hoy roza el límite.
  - Cualquier intento futuro de meter CO₂/horas-pico/derechos en el camino principal: **no**.

### "Features que SIMPLIFICARÍA"
- **PeakHint (horas pico)**: dejarlo en una línea mínima o solo como ícono; hoy puede leerse
  como dato de relleno. Verificar que aporte algo accionable o degradarlo.
- **Onboarding**: que el camino a "ver mi parada" sea aún más corto para gente grande.
- **Mixed trip / taxi**: asegurar que el bloque sea colapsable y no empuje las acciones
  principales ("ver en mapa", "compartir") hacia abajo.

---

## 6) OPORTUNIDADES NO OBVIAS (microUX de alto ROI)

1. **Aviso "este bus ya pasó"** explícito cuando corresponda, en vez de simplemente ocultarlo
   → convierte el diferencial de honestidad en algo *visible* y memorable.
2. **"Salidas cercanas" como primer pixel** (Transit nearby) — que al abrir, sin tocar, ya
   veas los próximos 2-3 buses de tu parada habitual.
3. **Repetir último viaje** de un toque (DB favorites) — el commuter hace A→B todos los días.
4. **Resumir el desvío de la IM** ("el 121 no pasa por X por obras, tomalo en Y") — nadie lo
   hace bien y Cómo Ir directamente no avisa.
5. **Haptic sutil** al confirmar "seguir bus" / "salí ahora" — hace que se sienta premium sin
   ruido visual (Apple Maps lo usa). Bajo esfuerzo.
6. **Estado de carga honesto** ("buscando buses en vivo…" vs "sin datos del STM ahora") en vez
   de spinners mudos — la gente tolera la espera si entiende qué pasa.

---

## 7) PRINCIPIO RECTOR (para cada decisión futura)

Antes de agregar algo, pasa estos 3 filtros. Si falla uno, no va al camino principal:
1. ¿Acelera encontrar qué ómnibus tomar? 
2. ¿Aumenta la confianza en el dato?
3. ¿Lo entiende alguien grande, apurado, sin paciencia, con conexión regular?

Cuándo ya gana en lo que importa (honestidad + cobertura + simplicidad). El riesgo no es que
le falten features — es que se **infle** y pierda la claridad que hoy es su ventaja.

## Fuentes
Reseñas App Store / Google Play (Cómo Ir, STM Montevideo, Moovit, Transit, DB Navigator, BVG),
Trustpilot, blogs de producto de Transit y Citymapper, Smart Cities Dive / Fast Company (offline
de Transit), NN/g y Toptal (UX para mayores), Our World in Data / EPA (CO₂), Quora/Reddit
(quejas de ETAs), documentación oficial de DB/BVG/TfL.
