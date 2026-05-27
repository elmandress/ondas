# Análisis comparativo vs STM Montevideo (Matungos)

Fecha: 26 mayo 2026
Source: changelog público de la app "STM Montevideo" desde 2023 hasta v3.17.0 (22/5/2026)

---

## TL;DR

**v3.17.0 (hace 4 días) hicieron una de sus actualizaciones más grandes** y en gran parte coincide con lo que estuvimos haciendo: rutas directas más ricas, trasbordos mejorados, recorridos con calles reales, tracking de buses que antes no aparecían, búsqueda sin acentos. Eso es **buena señal** (vamos por el camino correcto, problema real validado) pero también es **competencia activa**.

Donde estamos **MEJOR** que ellos: datos enriquecidos por bus (♿ accesibilidad, ❄ AC, emisiones), filtro upstream GTFS estricto, OSRM para walking (gratis, no dependemos de Google que los rompió en v3.2), POIs curados con aliases, estilo moderno mobile-first.

Donde nos **faltan** features que tienen: interdepartamentales, links a web IM (recarga STM, reportes), favoritos guardados con persistencia, recorridos circulares con colores ida/vuelta.

---

## Feature por feature

| Feature | Matungos | Ondas | Notas |
|---|---|---|---|
| **Llegadas en tiempo real** | ✅ desde 2023 | ✅ | Nosotros con cadena fuentes oficiales + GTFS + schedule |
| **Mapa con buses live** | ✅ | ✅ | Nosotros con colores por línea (v3.17 no especifica) |
| **Búsqueda calles/líneas sin acentos** | ✅ v3.17.0 (22/5) | ✅ | Lo tenemos hace varias sesiones |
| **Calles reales en walking** | ✅ v3.17.0 | ✅ | OSRM público (gratis, sin auth) |
| **Rutas directas + trasbordos** | ✅ v3.17.0 mejorado | ✅ | Nuestro planificador GTFS-based con dedupe semántico |
| **Descartar caminar > bus** | ✅ v3.17.0 | ✅ | Nuestro `WALK_ONLY_MAX_M = 2500` |
| **Tracking ómnibus que antes no aparecían** | ✅ v3.17.0 | ✅ | Tracking lejano hasta 17km + GTFS filtro |
| **Recorridos circulares ida/vuelta colores** | ✅ v3.17.0 (verde/rojo) | ⚠️ Parcial | Tenemos colores por LÍNEA pero no por sentido. Vale agregarlo |
| **Interdepartamentales en mapa** | ✅ desde v2.3 (2023) | ❌ | Out-of-scope v1.0 |
| **Filtrar líneas interdep** | ✅ v3.4.0 | ❌ | Out-of-scope v1.0 |
| **Recargar saldo STM (link web IM)** | ✅ v3.4.0 | ❌ | **Quick win** |
| **Reportar problemas (link web IM)** | ✅ v3.9.0 | ❌ | **Quick win** |
| **Favoritos guardados** | ✅ desde siempre | ⚠️ Parcial | Hay localStorage pero no expuesto en UI todavía |
| **Backup/restore favoritos** | ✅ v2.10 (automático) + v3.13 (manual) | ❌ | Futuro (necesita backend) |
| **Walking/auto a destino con Google** | ❌ removido v3.2 ("Google se fue al joraca") | ✅ | **Ventaja nuestra**: usamos OSRM gratis sin límite |
| **Caminar como opción siempre** | ❌ removido | ✅ | Nosotros lo mantenemos |
| **Recorridos sobre calles reales** | ✅ v3.17 | ⚠️ | Bus = paradas conectadas, walking = OSRM. Mejorable: usar shapes.txt del GTFS para bus polyline real |
| **Accesibilidad ♿ por bus** | ❌ | ✅ | **Único nuestro** (de la API oficial nueva con OAuth) |
| **AC ❄ por bus** | ❌ | ✅ | **Único nuestro** |
| **Emisiones (Euro V/eléctrico)** | ❌ | ⚠️ | Lo tenemos en backend pero no expuesto en UI todavía |
| **Detección acortados real** | ❌ (Guille se quejó de esto) | ✅ | Implementado: compara destinoDesc del bus en vivo vs headsign GTFS |
| **Múltiples alternativas en misma parada** | ⚠️ | ✅ | Sheet muestra todas las líneas (Guille se quejó de esto en Matungos) |
| **Long-press en mapa para Cómo Llegar** | ❌ | ✅ | Implementado esta sesión |
| **PWA installable** | N/A (es app nativa) | ✅ | Web pero installable |
| **Búsqueda POIs locales** ("Nuevo Centro" → Shopping) | ⚠️ Limitado | ✅ | Lista curada de 323 POIs MVD con aliases |

---

## Aprendizajes de su evolución

1. **Matungos vive de updates de datos** (paradas, líneas, recorridos) varias veces por año → confirma que el GTFS hay que refrescar periódicamente. Nuestro script `build_gtfs_db_v2.py` lo cubre.

2. **v3.2 (abr 2025)**: tuvieron que sacar walking porque Google los limitó. Nosotros usamos OSRM público que es libre y mantenido por la comunidad OSM. **Ventaja sostenible.**

3. **Backup local de favoritos** (v3.13.1 ene 2026) sugiere que es feature valioso. Lo nuestro está en localStorage automático del navegador (más simple que Matungos).

4. **Bugs recurrentes en favoritos** (v3.3, v3.6.1: "intentos n°1 y n°2 de corregir errror que borra favoritos") → es área compleja. Nuestro localStorage es más simple y robusto.

5. **Interdepartamentales** es un nicho que les funciona desde 2023. Out-of-scope nuestro para v1.0 pero buena dirección futura.

6. **No mencionan accesibilidad por bus en ninguna versión** → nadie en MVD usa el campo `access` de la API nueva. Es nuestro diferencial más grande.

---

## Quick wins (esta sesión)

1. **Recorridos circulares con colores ida/vuelta** — el GTFS tiene `direction_id`, lo podemos usar.
2. **Favoritos REALES en UI** — el localStorage ya existe (`store.ts`), falta el botón ★ en las paradas y mostrarlos en Inicio.
3. **Links a web IM** — botones simples para recargar STM y reportar.

## Medium-term

4. Refrescar GTFS automáticamente (cron semanal) — Matungos lo hace manual.
5. Interdepartamentales (cuando v1.0 esté estable).
6. Mejorar polyline del bus usando `shapes.txt` real (no paradas conectadas).

## Diferenciación clara para marketing

> "Toda la info del STM + lo que ninguna otra app te muestra: si el bondi es accesible, si tiene AC, si va por su recorrido normal o está acortado."
