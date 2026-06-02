# Git y deploy — cómo subir seguro

## Estructura (importante)
Hay DOS repos en la máquina:
- `d:/comoire/.git` (raíz) — incluye `Cuándo - Design/` + `ondas/`. **NO usar este para deploy**: subiría la carpeta de diseño y se buguea.
- **`d:/comoire/ondas/.git`** — el repo del PROYECTO. **Este es el que se sube.** Ya tiene remote
  `origin → github.com/elmandress/ondas.git`, rama `main`. La carpeta `Cuándo - Design` está
  FUERA de `ondas/`, así que este repo ni la ve. ✅

→ Para cualquier comando git del proyecto, pararse en `d:/comoire/ondas/` (NO en la raíz).

## Qué se sube y qué NO (gitignore)
**SÍ van (necesarios en runtime/deploy):**
- Todo `src/`, `public/` (incluye stops.json, routes.json, operators.json, interior-stops.json, etc.), `scripts/`, `docs/`, configs.
- `data/gtfs-v2.db` (6.4MB), `data/metro-schedule.db` (32MB), `data/variant_to_line.json`,
  `data/line-hours.json`, `data/mvd-pois.json` → el motor de ruteo y horarios los leen en runtime.

**NO van (ignorados — regenerables, pesados o sensibles):**
- `.env.local` (credenciales OAuth STM) — **CRÍTICO que nunca suba**. ✅ ignorado.
- `data/schedule.db` (88MB, horarios MVD) — la app degrada al GTFS si no está; muy pesado para git.
- `data/gtfs-metro.db`, `data/gtfs.db(.bak)` — intermedios/legacy, se regeneran o ya están fusionados.
- `data/interior-stops-raw.json`, `data/interior-edges.json` — acumuladores del recolector.
- `*.db-shm/-wal/-journal` (locks SQLite), `node_modules/`, `.next/`, `tmp_*/`.

`data/gtfs.db` ya estaba trackeado de antes → se removió del índice con `git rm --cached` (sigue local).

## Pasos para subir (los hace el usuario)
```
cd d:/comoire/ondas
git add -A
git status            # revisar que NO aparezca .env.local, schedule.db, ni 'Cuándo - Design'
git commit -m "..."   # mensaje del cambio
git push origin main
```

## Deploy (Vercel/Netlify)
- Es Next.js 16 con runtime Node (better-sqlite3 + fs) → necesita **Node runtime** (no Edge).
  Vercel Hobby sirve. Cloudflare Pages NO (no corre better-sqlite3).
- Variables de entorno en el panel del hosting (NO en el repo): `MVD_API_TOKEN_URL`,
  `MVD_API_CLIENT_ID`, `MVD_API_CLIENT_SECRET`, `MVD_API_BASE`.
- `next.config.ts` ya incluye los `.db`/`.json` necesarios en `outputFileTracingIncludes`.

## Por qué fallaba antes
El proyecto es JSX/Next y debe subirse como su propia raíz (`ondas/`), no anidado bajo la carpeta
que también contiene `Cuándo - Design`. El repo de `ondas/` ya está bien aislado; solo había que
ajustar el .gitignore (hecho) para no subir intermedios pesados ni credenciales.
