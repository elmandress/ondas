-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  CUÁNDO (ondas) — Esquema completo para Supabase (PostgreSQL 15 + PostGIS)  ║
-- ║                                                                            ║
-- ║  App de transporte público de Uruguay. Este script crea TODO de cero:      ║
-- ║   1. Extensiones                                                           ║
-- ║   2. Tipos enum                                                            ║
-- ║   3. Catálogo GTFS  (operadores, líneas, variantes, paradas, recorridos)   ║
-- ║   4. Interior / crowdsource (paradas inferidas, aristas, reportes)         ║
-- ║   5. Usuarios (perfiles, paradas favoritas, rutas guardadas, historial)    ║
-- ║   6. Feedback comunitario (reportes de incidencias, ediciones propuestas)  ║
-- ║   7. Índices (incl. espaciales GiST) y triggers (updated_at, perfil auto)  ║
-- ║   8. Buckets de Storage + políticas                                        ║
-- ║   9. RLS en todas las tablas                                               ║
-- ║                                                                            ║
-- ║  Diseño: 3FN (sin redundancia), claves naturales del GTFS donde aplica,    ║
-- ║  todo idempotente (IF NOT EXISTS / CREATE OR REPLACE) para correr 2 veces. ║
-- ║                                                                            ║
-- ║  Pensado para Supabase: usa auth.users, auth.uid(), schema public, RLS.    ║
-- ║  Aún NO conectado — este archivo es la preparación del backend (F3+).      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. EXTENSIONES
-- ═══════════════════════════════════════════════════════════════════════════
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "postgis";     -- geografía/geometría de paradas y recorridos
create extension if not exists "pg_trgm";     -- búsqueda fuzzy de nombres de parada/destino

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. TIPOS ENUM
-- ═══════════════════════════════════════════════════════════════════════════
do $$ begin
  create type stop_source as enum ('gtfs', 'metro', 'interior_crowdsource');
exception when duplicate_object then null; end $$;

do $$ begin
  create type service_kind as enum ('urbano', 'metropolitano', 'interdepartamental', 'interior');
exception when duplicate_object then null; end $$;

do $$ begin
  -- Tipos de reporte que la comunidad puede enviar sobre el servicio.
  create type report_kind as enum (
    'parada_inexistente', 'parada_mal_ubicada', 'recorrido_incorrecto',
    'bus_no_pasa', 'demora', 'accesibilidad', 'seguridad', 'otro'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type report_status as enum ('pendiente', 'en_revision', 'aceptado', 'rechazado');
exception when duplicate_object then null; end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. CATÁLOGO GTFS (datos del transporte — read-only para el público)
--    Fuente: GTFS oficial STM + GTFS metropolitano MTOP + shapefile v_uptu_lsv.
--    Lo escribe el pipeline (service_role); el público solo lee.
-- ═══════════════════════════════════════════════════════════════════════════

-- 3.1 Operadores (empresas). Ej: CUTCSA, COETC, UCOT, COPSA…
create table if not exists public.operators (
  id            bigint generated always as identity primary key,
  name          text not null unique,            -- "CUTCSA"
  website       text,                             -- sitio oficial (validado, no inventado)
  phone         text,
  created_at    timestamptz not null default now()
);
comment on table public.operators is 'Empresas operadoras de transporte (CUTCSA, COETC, …).';

-- 3.2 Líneas comerciales. La key natural es el código corto ("181", "468", "G→468").
create table if not exists public.lines (
  id            bigint generated always as identity primary key,
  short_name    text not null unique,             -- "181"
  long_name     text,                             -- descripción larga si existe
  service_kind  service_kind not null default 'urbano',
  color         text,                             -- hex sin '#', para el badge de la línea
  operator_id   bigint references public.operators(id) on delete set null,
  created_at    timestamptz not null default now()
);
comment on table public.lines is 'Líneas comerciales. short_name es la clave que ve el usuario.';

-- 3.3 Paradas. stop_id natural del GTFS ("546") o interior ("int-maldonado-213").
create table if not exists public.stops (
  stop_id       text primary key,                 -- clave natural GTFS / interior
  stop_code     text,
  name          text not null,
  -- Geografía: punto WGS84. PostGIS permite consultas espaciales reales
  -- (paradas a < X metros) en vez de filtrar por bbox a mano en JS.
  geom          geography(point, 4326) not null,
  source        stop_source not null default 'gtfs',
  zone          text,                             -- "maldonado", "paysandu"… (interior)
  -- Accesibilidad REAL (de la API oficial enriquecida). NULL = desconocido (no inventar).
  wheelchair    boolean,
  has_shelter   boolean,                          -- refugio/garita
  created_at    timestamptz not null default now()
);
comment on table public.stops is 'Paradas (GTFS urbano + metro + interior inferidas). geom es geography(point).';
comment on column public.stops.wheelchair is 'Accesibilidad real de la API oficial; NULL = desconocido, nunca inventado.';

-- 3.4 Relación N:M parada ↔ línea (qué líneas paran en cada parada).
--     Normalizado: nada de un array de líneas dentro de stops.
create table if not exists public.stop_lines (
  stop_id       text not null references public.stops(stop_id) on delete cascade,
  line_id       bigint not null references public.lines(id) on delete cascade,
  primary key (stop_id, line_id)
);
comment on table public.stop_lines is 'N:M parada↔línea (qué líneas sirven cada parada).';

-- 3.5 Variantes (recorridos concretos de una línea: ida/vuelta/ramales).
--     variant_id natural del GTFS ("181-0-1").
create table if not exists public.variants (
  variant_id    text primary key,                 -- "181-0-1"
  line_id       bigint not null references public.lines(id) on delete cascade,
  headsign      text,                             -- cartel ("hacia Pocitos")
  direction_id  smallint,                         -- 0 / 1
  -- cod_variante del shapefile oficial (key de la geometría del recorrido).
  shape_code    text,
  created_at    timestamptz not null default now()
);
comment on table public.variants is 'Variantes (recorridos) de cada línea. shape_code liga a route_shapes.';

-- 3.6 Secuencia de paradas de cada variante (orden del recorrido).
create table if not exists public.variant_stops (
  variant_id        text not null references public.variants(variant_id) on delete cascade,
  stop_sequence     int  not null,                -- orden (1,2,3…)
  stop_id           text not null references public.stops(stop_id) on delete cascade,
  arrival_seconds   int,                          -- segundos desde inicio del recorrido (offset)
  primary key (variant_id, stop_sequence)
);
comment on table public.variant_stops is 'Orden de paradas por variante (la espina del recorrido).';

-- 3.7 Geometría del recorrido (polyline por shape_code). Una fila por shape.
--     Guardamos la línea como geography(linestring) → permite cortar el tramo
--     subida→bajada en SQL (ST_LineLocatePoint / ST_LineSubstring) en el futuro.
create table if not exists public.route_shapes (
  shape_code    text primary key,                 -- cod_variante
  geom          geography(linestring, 4326) not null,
  created_at    timestamptz not null default now()
);
comment on table public.route_shapes is 'Trazo real del recorrido por shape_code (geography linestring).';

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. INTERIOR / CROWDSOURCE
--    Paradas inferidas del GPS Busmatick + aristas de recorrido + acumulador.
--    Lo alimenta el recolector (service_role). Las correcciones de usuarios van
--    por la tabla de feedback (sección 6) para no pisar el dato base.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.interior_stop_observations (
  id            bigint generated always as identity primary key,
  zone          text not null,                    -- "maldonado"
  stop_code     text not null,                    -- código p1c del feed
  name          text,
  geom          geography(point, 4326) not null,
  line          text,                             -- línea observada (si se sabe)
  observed_at   timestamptz not null default now()
);
comment on table public.interior_stop_observations is 'Observaciones crudas del GPS interior (clustering posterior → stops).';

create index if not exists idx_interior_obs_zone_code
  on public.interior_stop_observations (zone, stop_code);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. USUARIOS (datos personales — RLS estricta: cada quien ve SOLO lo suyo)
-- ═══════════════════════════════════════════════════════════════════════════

-- 5.1 Perfil. 1:1 con auth.users. Se crea solo por trigger al registrarse.
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  avatar_url    text,                             -- apunta al bucket 'avatars'
  -- Preferencias (espejo del localStorage actual: tema, tamaño de texto).
  theme         text not null default 'dark',
  text_size     text not null default 'normal',   -- 'normal' | 'grande'
  -- Parada de casa / trabajo (acceso rápido). FK a stops, no texto suelto.
  home_stop_id  text references public.stops(stop_id) on delete set null,
  work_stop_id  text references public.stops(stop_id) on delete set null,
  onboarding_done boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.profiles is '1:1 con auth.users. Preferencias y paradas casa/trabajo.';

-- 5.2 Paradas favoritas del usuario (espejo de ondas_fav_stops).
create table if not exists public.favorite_stops (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  stop_id       text not null references public.stops(stop_id) on delete cascade,
  alias         text,                             -- "Casa", "Trabajo", "Facu"…
  created_at    timestamptz not null default now(),
  unique (user_id, stop_id)                       -- no duplicar la misma parada
);
comment on table public.favorite_stops is 'Paradas marcadas como favoritas por el usuario.';

-- 5.3 Rutas guardadas (espejo de FavoriteRoute: "Casa → Trabajo").
--     Soporta ruta por PARADA (stop_id) o por DIRECCIÓN (lat/lon/dirección).
create table if not exists public.saved_routes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,                  -- "Casa → Trabajo"
  emoji           text,
  -- Origen
  from_stop_id    text references public.stops(stop_id) on delete set null,
  from_name       text not null,
  from_lat        double precision,
  from_lon        double precision,
  from_address    text,
  from_is_current_location boolean not null default false,
  -- Destino
  to_stop_id      text references public.stops(stop_id) on delete set null,
  to_name         text,
  to_lat          double precision,
  to_lon          double precision,
  to_address      text,
  -- Cache de preview (líneas y minutos a pie al momento de guardar; orientativo)
  preview_lines   text[] not null default '{}',
  walk_minutes    int,
  sort_order      int not null default 0,         -- orden manual en la lista
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
comment on table public.saved_routes is 'Rutas guardadas del usuario (por parada o por dirección).';

-- 5.4 Historial (paradas y destinos consultados — para sugerencias rápidas).
--     Una tabla con discriminador en vez de dos casi idénticas.
create table if not exists public.search_history (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  kind          text not null check (kind in ('stop', 'route_dest')),
  stop_id       text references public.stops(stop_id) on delete set null,
  label         text not null,                    -- texto mostrado
  lat           double precision,
  lon           double precision,
  searched_at   timestamptz not null default now()
);
comment on table public.search_history is 'Historial de paradas y destinos buscados (sugerencias).';
create index if not exists idx_search_history_user_time
  on public.search_history (user_id, searched_at desc);

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. FEEDBACK COMUNITARIO
--    Reportes de incidencias + ediciones propuestas. El dato base (catálogo) no
--    se pisa: las correcciones se acumulan acá y el equipo/automatismo las aplica.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.reports (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null, -- anónimo permitido
  kind          report_kind not null,
  status        report_status not null default 'pendiente',
  stop_id       text references public.stops(stop_id) on delete set null,
  line_id       bigint references public.lines(id) on delete set null,
  description   text,
  -- Si el reporte sugiere una ubicación corregida.
  geom          geography(point, 4326),
  photo_url     text,                             -- bucket 'report-photos'
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);
comment on table public.reports is 'Reportes de la comunidad (parada mal ubicada, demora, accesibilidad…).';
create index if not exists idx_reports_status on public.reports (status, created_at desc);
create index if not exists idx_reports_stop   on public.reports (stop_id);

-- Votos sobre reportes (corroboración comunitaria: "a mí también me pasa").
create table if not exists public.report_votes (
  report_id     uuid not null references public.reports(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (report_id, user_id)
);
comment on table public.report_votes is 'Un voto por usuario por reporte (corroboración).';

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. ÍNDICES ESPACIALES + DE BÚSQUEDA  (rendimiento)
-- ═══════════════════════════════════════════════════════════════════════════
-- Espaciales (GiST): "paradas a < 400m de acá" en milisegundos.
create index if not exists idx_stops_geom        on public.stops using gist (geom);
create index if not exists idx_route_shapes_geom on public.route_shapes using gist (geom);
create index if not exists idx_reports_geom       on public.reports using gist (geom);
create index if not exists idx_interior_obs_geom  on public.interior_stop_observations using gist (geom);

-- Búsqueda fuzzy de nombres (trigram): "pocito" → "Pocitos".
create index if not exists idx_stops_name_trgm on public.stops using gin (name gin_trgm_ops);

-- FKs muy consultadas.
create index if not exists idx_stop_lines_line     on public.stop_lines (line_id);
create index if not exists idx_variant_stops_stop  on public.variant_stops (stop_id);
create index if not exists idx_variants_line        on public.variants (line_id);
create index if not exists idx_fav_stops_user       on public.favorite_stops (user_id);
create index if not exists idx_saved_routes_user    on public.saved_routes (user_id, sort_order);

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════
-- 8.1 updated_at automático.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_saved_routes_updated on public.saved_routes;
create trigger trg_saved_routes_updated before update on public.saved_routes
  for each row execute function public.set_updated_at();

-- 8.2 Crear perfil automáticamente al registrarse un usuario.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. STORAGE (buckets + políticas)
--    'avatars'      → público (lectura), cada quien escribe SOLO su carpeta.
--    'report-photos'→ público (lectura), cualquier autenticado sube.
-- ═══════════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars',       'avatars',       true, 2 * 1024 * 1024, array['image/jpeg','image/png','image/webp']),
  ('report-photos', 'report-photos', true, 5 * 1024 * 1024, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- NOTA: usamos (select auth.jwt()->>'sub') = uid del usuario, según la guía oficial
-- de Supabase Storage (el wrapper select se evalúa una sola vez por consulta → más
-- rápido que auth.uid() repetido). El layout de archivos es <bucket>/<uid>/<archivo>.

-- Avatars: lectura pública (bucket público igual bypassa descarga, pero la dejamos explícita).
drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects
  for select using (bucket_id = 'avatars');

-- Avatars: el usuario solo gestiona archivos bajo la carpeta con su uid (avatars/<uid>/…).
drop policy if exists "avatars owner write" on storage.objects;
create policy "avatars owner write" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  );
drop policy if exists "avatars owner update" on storage.objects;
create policy "avatars owner update" on storage.objects
  for update to authenticated using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  );
drop policy if exists "avatars owner delete" on storage.objects;
create policy "avatars owner delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  );

-- Fotos de reportes: lectura pública, cualquier autenticado sube bajo su carpeta; borra el dueño.
drop policy if exists "report photos public read" on storage.objects;
create policy "report photos public read" on storage.objects
  for select using (bucket_id = 'report-photos');
drop policy if exists "report photos auth write" on storage.objects;
create policy "report photos auth write" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'report-photos' and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  );
drop policy if exists "report photos owner delete" on storage.objects;
create policy "report photos owner delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'report-photos' and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. ROW LEVEL SECURITY
--     Catálogo GTFS/interior  → lectura pública (anon), escritura solo service_role.
--     Datos de usuario         → cada quien ve/edita SOLO lo suyo.
--     Reportes                 → lectura pública; inserta cualquiera; edita el dueño.
-- ═══════════════════════════════════════════════════════════════════════════

-- 10.1 Activar RLS en TODO.
alter table public.operators                  enable row level security;
alter table public.lines                      enable row level security;
alter table public.stops                       enable row level security;
alter table public.stop_lines                  enable row level security;
alter table public.variants                    enable row level security;
alter table public.variant_stops               enable row level security;
alter table public.route_shapes                enable row level security;
alter table public.interior_stop_observations  enable row level security;
alter table public.profiles                     enable row level security;
alter table public.favorite_stops               enable row level security;
alter table public.saved_routes                 enable row level security;
alter table public.search_history               enable row level security;
alter table public.reports                       enable row level security;
alter table public.report_votes                  enable row level security;

-- 10.2 Catálogo: lectura pública (la app lo necesita sin login). Escritura: nadie
--      vía RLS → solo service_role (que bypassa RLS) desde el pipeline.
do $$
declare t text;
begin
  foreach t in array array[
    'operators','lines','stops','stop_lines','variants','variant_stops',
    'route_shapes','interior_stop_observations'
  ] loop
    execute format('drop policy if exists "%s public read" on public.%I;', t, t);
    execute format('create policy "%s public read" on public.%I for select using (true);', t, t);
  end loop;
end $$;

-- 10.3 profiles: cada quien ve y edita su propio perfil.
drop policy if exists "profiles self select" on public.profiles;
create policy "profiles self select" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
-- insert lo hace el trigger (security definer); no exponemos insert directo.

-- 10.4 favorite_stops: dueño total sobre las suyas.
drop policy if exists "fav stops owner all" on public.favorite_stops;
create policy "fav stops owner all" on public.favorite_stops
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 10.5 saved_routes: dueño total.
drop policy if exists "saved routes owner all" on public.saved_routes;
create policy "saved routes owner all" on public.saved_routes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 10.6 search_history: dueño total.
drop policy if exists "history owner all" on public.search_history;
create policy "history owner all" on public.search_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 10.7 reports: lectura pública (mapa de incidencias), inserta cualquier
--      autenticado, edita/borra solo el autor.
drop policy if exists "reports public read" on public.reports;
create policy "reports public read" on public.reports for select using (true);
drop policy if exists "reports auth insert" on public.reports;
create policy "reports auth insert" on public.reports
  for insert with check (auth.uid() = user_id or user_id is null);
drop policy if exists "reports owner update" on public.reports;
create policy "reports owner update" on public.reports
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "reports owner delete" on public.reports;
create policy "reports owner delete" on public.reports
  for delete using (auth.uid() = user_id);

-- 10.8 report_votes: lectura pública (contar votos), cada quien gestiona su voto.
drop policy if exists "votes public read" on public.report_votes;
create policy "votes public read" on public.report_votes for select using (true);
drop policy if exists "votes owner write" on public.report_votes;
create policy "votes owner write" on public.report_votes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 11. FUNCIONES ÚTILES (RPC para el cliente)
-- ═══════════════════════════════════════════════════════════════════════════
-- Paradas cercanas a un punto (reemplaza el filtro por bbox en JS). Usa el índice
-- GiST → rapidísimo. Devuelve la distancia real en metros, ordenada.
create or replace function public.nearby_stops(
  in_lat double precision, in_lon double precision,
  radius_m double precision default 600, max_rows int default 8
)
returns table (stop_id text, name text, distance_m double precision)
language sql stable as $$
  select s.stop_id, s.name,
         st_distance(s.geom, st_makepoint(in_lon, in_lat)::geography) as distance_m
  from public.stops s
  where st_dwithin(s.geom, st_makepoint(in_lon, in_lat)::geography, radius_m)
  order by distance_m
  limit max_rows;
$$;
comment on function public.nearby_stops is 'Paradas dentro de radius_m de un punto, por distancia (índice GiST).';

-- ═══════════════════════════════════════════════════════════════════════════
-- 12. ANALYTICS ANÓNIMO (privacy-first, sin trackers externos)
--     Eventos AGREGADOS sin PII: nombre de evento + props no identificables +
--     timestamp. NO guarda IP, user_id, ni cookies. Coherente con el valor de
--     "privacidad sin trackers". Sirve para saber qué pantallas/acciones se usan
--     sin espiar a nadie. Insert anónimo permitido; lectura solo service_role.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.analytics_events (
  id          bigint generated always as identity primary key,
  event       text not null,                 -- "open_app", "plan_route", "follow_bus"…
  props       jsonb not null default '{}',   -- datos NO identificables (ej. {"tab":"map"})
  session     text,                          -- id de sesión efímero del cliente (no es el usuario)
  created_at  timestamptz not null default now()
);
comment on table public.analytics_events is 'Eventos anónimos agregados (sin PII/IP/cookies). Privacy-first.';
create index if not exists idx_analytics_event_time on public.analytics_events (event, created_at desc);

alter table public.analytics_events enable row level security;
-- Cualquiera puede INSERTAR un evento anónimo; NADIE puede leerlos vía RLS
-- (solo service_role, que bypassa RLS, para los reportes agregados).
drop policy if exists "analytics anon insert" on public.analytics_events;
create policy "analytics anon insert" on public.analytics_events
  for insert with check (true);

commit;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  FIN. Para aplicar:  supabase db push   (o pegar en el SQL Editor).        ║
-- ║  El catálogo (operators/lines/stops/…) lo carga el pipeline con            ║
-- ║  service_role a partir de los .json/.db de data/ y public/.                ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
