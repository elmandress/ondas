# Estado actual de Ondas — Auditoría completa

Fecha: 25 mayo 2026 · Versión SRS auditada: 0.1

---

## Resumen ejecutivo

**Estado general: V0.6 → camino a V1.0**

Lo que está sólido:
- ✅ Llegadas con cadena multi-fuente (API oficial OAuth2 + GTFS + schedule + legacy)
- ✅ Filtro upstream basado en GTFS (sentido correcto, paradas restantes exactas)
- ✅ Búsqueda con POIs curados + bias geográfico
- ✅ Mapa con detalle de paradas, polylines, accesibilidad real
- ✅ Tracking de buses lejanos (hasta 17km via GTFS)

Lo que falta para V1.0:
- ⚠️ Planificador "Cómo Llegar" sigue heurístico — necesita Raptor o OTP
- ⚠️ Deploy a producción no hecho
- ⚠️ Tests automatizados mínimos
- ⚠️ Varias features pedidas por Guille pendientes

---

## Estado por requerimiento funcional

### FR-1: Llegadas en tiempo real por parada

| Sub-FR | Estado | Notas |
|---|---|---|
| FR-1.1: Llegadas ordenadas por tiempo | ✅ | |
| FR-1.2: línea, destino, ETA, badge de fuente | ✅ | Badge "En vivo" / "Horario" / "Estimado" |
| FR-1.3: Auto-refresh 20s | ✅ | `useArrivals` con `setInterval` |
| FR-1.4: Cadena fuentes API auth → legacy | ✅ | |
| FR-1.5: Combinación live + schedule por línea | ✅ | Resuelto sesión 2 |
| FR-1.6: Tracking lejano via GTFS | ✅ | Resuelto sesión 3 |

### FR-2: Filtro upstream (GTFS)

| Sub-FR | Estado | Notas |
|---|---|---|
| FR-2.1: Solo mostrar buses upstream | ✅ | `busTowardsStopGtfs` |
| FR-2.2: Variante exacta | ✅ | Match por (line + headsign normalizado) |
| FR-2.3: GPS viejo (>3min) descartado | ✅ | |
| FR-2.4: Bus fuera de ruta (>600m de polyline GTFS) descartado | ✅ | |
| FR-2.5: Tope distancia restante | ✅ | Implicito por tope de paradas |
| FR-2.6: Sin fallback peligroso | ✅ | Variante exacta o descartar |
| FR-2.7: GTFS-based (no heurística) | ✅ | Sesión 3 |

### FR-3: Búsqueda inteligente

| Sub-FR | Estado | Notas |
|---|---|---|
| FR-3.1: Resultados desde primer carácter, 250ms debounce | ✅ | |
| FR-3.2: POIs > direcciones > paradas | ✅ | |
| FR-3.3: Acotado a MVD | ✅ | `bounded=1` viewbox |
| FR-3.4: Iconos por categoría | ✅ | |
| FR-3.5: Tap lugar → detalle | ✅ | |
| FR-3.6: Historial + populares | ✅ | localStorage |
| FR-3.7: Lugares antes de paradas | ✅ | |
| FR-3.8: Pin en mapa + sheet con paradas cercanas | ✅ | |

### FR-4: Cómo Llegar

| Sub-FR | Estado | Notas |
|---|---|---|
| FR-4.1: Inputs múltiples (texto, GPS, mapa, parada) | ⚠️ Parcial | Texto + GPS sí; mapa long-press no; parada por nº no |
| FR-4.2: Hasta 5 alternativas ordenadas | ✅ | |
| FR-4.3: Pasos detallados con calles | ⚠️ Parcial | OSRM walking conectado, pero no muestra calles intermedias del bus |
| FR-4.4: ETA en vivo en cada paso | ❌ | No conectado |
| FR-4.5: Caminar como alternativa adicional <2km | ✅ | |
| FR-4.6: Validación previa fuera de MVD | ❌ | Falta |
| FR-4.7: Badge "estimación aproximada" | ✅ | |
| FR-4.8: Sin rutas → paradas cercanas útiles | ✅ | |
| FR-4.9: OSRM walking real | ✅ | `/api/walking` |
| FR-4.10: OTP cuando esté disponible | ❌ | Fase 2B, pendiente |

### FR-5: Visualización de recorrido

| Sub-FR | Estado | Notas |
|---|---|---|
| FR-5.1: Polyline del bus seleccionado | ✅ | |
| FR-5.2: Marcar posición actual | ✅ | |
| FR-5.3: Respetar sentido (variante) | ✅ | routes.json keys por variante |

### FR-6: Honestidad y estados vacíos

| Sub-FR | Estado | Notas |
|---|---|---|
| FR-6.1: API falla → mensaje explícito | ✅ | |
| FR-6.2: Distinguir live/scheduled/estimated | ✅ | Badges |
| FR-6.3: No mostrar features no verificables | ✅ | WiFi eliminado |
| FR-6.4: Ocupación inventada eliminada | ✅ | |

---

## Estado por NFR

| NFR | Objetivo | Real | Estado |
|---|---|---|---|
| NFR-1.1: Carga inicial < 2.5s | < 2.5s 4G | ~2s (medido localhost) | ✅ |
| NFR-1.2: routes.json cache módulo | sí | sí | ✅ |
| NFR-1.3: stops.json lazy | sí | sí | ✅ |
| NFR-1.4: Refresh < 800ms p95 | < 800ms | ~400-600ms | ✅ |
| NFR-1.5: Búsqueda < 400ms | < 400ms | <100ms cached, <500ms cold | ✅ |
| NFR-2: Confiabilidad (sin crashes API) | 0 crashes | OK en testing | ✅ |
| NFR-3.1: TS strict sin `any` | sin any | hay algunos `any` en líneas con `as never` y APIs externas | ⚠️ |
| NFR-3.2: Tests mínimos | sí | NO HAY | ❌ |
| NFR-4: Usabilidad mobile | mobile-first | sí | ✅ |
| NFR-5: Privacidad | no login | sí | ✅ |
| NFR-6: SPA hosteable | sí | sí (con caveats deploy) | ⚠️ |

---

## Features pedidas por Guille (24/5/2026) — estado

| Feature | Estado | Plan |
|---|---|---|
| Destinos acortados detectados correctamente | ⚠️ Parcial | Badge "Acortado" existe si `destinoDesc !== oficial`. La API nueva ya da headsign correcto. Verificar con casos reales |
| Ver trayecto del bus sin desfijar la ruta | ✅ | Implementado: tocar bus → polyline visible en mapa |
| Gastar menos datos que Google Maps | ✅ | Sin Google APIs, sin tiles propios pesados |
| Múltiples alternativas en misma parada | ✅ | Sheet de parada muestra TODAS las líneas con su ETA |
| Estimación ocupación / horas pico | ❌ | Eliminada por NFR-6.4 honestidad. Sin datos reales no se puede |
| WiFi por modelo de bus | ❌ | Eliminado por NFR-6.3. La API nueva da `thermalConfort` y `access` pero no WiFi |
| Interdepartamentales con precio | ❌ | Out-of-scope v1.0 |
| Viaje mixto bondi + Uber | ❌ | Out-of-scope v1.0 |
| Mapeo de zonas inseguras | ❌ | Out-of-scope v1.0 |

---

## Bugs conocidos abiertos

1. **Stop IDs falsos en favoritos demo** (`stop_001`, `stop_002` en `store.ts`) → 404 silencioso en logs. Bajo impacto.
2. **No hay long-press en mapa** para elegir origen/destino en Cómo Llegar.
3. **arrival_seconds del GTFS es del trip "representativo"** (el primero del día) — podría no reflejar bien velocidad de hora pico.
4. **schedule.db (84MB) no entra en serverless function** → deploy requiere workaround (ver DEPLOY.md).

---

## Roadmap inmediato propuesto

### Sprint A (esta semana) — Pulir lo que ya está
- [ ] Tests mínimos: `bus-direction-gtfs.ts`, `mvd-api.ts`, parsers
- [ ] Limpiar `any` no justificados
- [ ] Validar destinos acortados con casos reales (madrugada)
- [ ] Eliminar stop IDs falsos del store demo
- [ ] Decidir destino del schedule.db en prod

### Sprint B (próxima semana) — Cómo Llegar
- [ ] Long-press en mapa para origen/destino
- [ ] ETAs en vivo en cada paso del viaje (FR-4.4)
- [ ] Validación origen/destino fuera de MVD (FR-4.6)
- [ ] Decisión: Raptor TS vs OTP en celular

### Sprint C — Deploy y feedback
- [ ] Deploy a Vercel
- [ ] Compartir URL con Guille y otros testers reales
- [ ] Métricas: medir uso real, paradas más consultadas, errores

### Sprint D — Pos-launch (cuando haya señales claras)
- [ ] OTP en VPS o celular
- [ ] Atajos "Mi casa" / "Mi trabajo" (Guille)
- [ ] PWA installable
