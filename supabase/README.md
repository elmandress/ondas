# Supabase — esquema de Cuándo (ondas)

`schema.sql` crea **todo** el backend de cero, idempotente (se puede correr 2 veces sin romper).
Aún **no está conectado**: es la preparación para la fase de backend (F3+). Validado con el
parser real de Postgres (libpg_query) — 114 statements, 0 errores de sintaxis.

## Qué crea
- **Catálogo GTFS** (`operators`, `lines`, `stops`, `stop_lines`, `variants`, `variant_stops`,
  `route_shapes`) — los datos del transporte. Lectura pública, escritura solo `service_role`.
- **Interior/crowdsource** (`interior_stop_observations`) — observaciones del GPS Busmatick.
- **Usuario** (`profiles`, `favorite_stops`, `saved_routes`, `search_history`) — RLS estricta:
  cada quien ve solo lo suyo. El perfil se crea solo por trigger al registrarse.
- **Comunidad** (`reports`, `report_votes`) — incidencias y corroboración.
- **Storage**: buckets `avatars` y `report-photos` (públicos para leer, escritura por carpeta `<uid>`).
- **Índices**: GiST espaciales (`geom`), trigram para búsqueda fuzzy de nombres, FKs calientes.
- **RPC**: `nearby_stops(lat, lon, radius_m, max_rows)` — paradas cercanas usando el índice GiST.

## Cómo aplicar (cuando se decida conectar)
```bash
# opción A: CLI de Supabase
supabase db push           # con schema.sql como migración

# opción B: SQL Editor del dashboard → pegar schema.sql → Run
```

## Diseño
- **3FN, sin redundancia**: nada de arrays de líneas dentro de `stops` (va `stop_lines` N:M).
- **Claves naturales del GTFS** donde aplica (`stop_id`, `variant_id`, `shape_code`) → la carga
  desde los `.json`/`.db` actuales es directa, sin re-mapear ids.
- **PostGIS** (`geography`): consultas espaciales reales en SQL (paradas cercanas, cortar el
  tramo de un recorrido) en vez de filtrar por bounding-box en JS.
- **Honestidad**: `stops.wheelchair`/`has_shelter` son `boolean` nullable — `NULL` = desconocido,
  nunca un valor inventado.

## Carga de datos (pipeline → catálogo)
El catálogo lo escribe el pipeline con `service_role` (que bypassa RLS) a partir de:
- `public/stops.json` → `stops` + `stop_lines`
- `public/operators.json` → `operators` (+ FK desde `lines`)
- `data/gtfs-v2.db` (`variants`, `variant_stops`) → `variants` + `variant_stops`
- `public/routes.json` (por `shape_code`) → `route_shapes`
- `public/interior-stops.json` → `stops` (source = `interior_crowdsource`)
