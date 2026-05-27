# Deploy de Ondas — Guía

Versión 0.1 · Mayo 2026

---

## Resumen del problema

Ondas usa:
- **Next.js 16** con API routes (serverless functions)
- **better-sqlite3** (módulo nativo) para `data/gtfs.db` (3MB) y `data/schedule.db` (84MB)
- **`.env.local`** con credenciales OAuth2 de api.montevideo.gub.uy

El deploy clásico de "subir HTML estático" NO funciona porque Next.js genera funciones serverless y páginas dinámicas.

Tres opciones de hosting, ordenadas por simplicidad:

---

## Opción A — Vercel (RECOMENDADA, gratis)

Es de la misma empresa que Next.js. Zero config, detecta todo solo.

### Setup paso a paso

1. **Subir el código a GitHub**:
   ```bash
   cd d:/comoire/ondas
   git init
   git add .
   git commit -m "Ondas v0.1"
   # Crear repo en github.com y conectarlo
   git remote add origin https://github.com/TU_USUARIO/ondas.git
   git push -u origin main
   ```

2. **Ir a https://vercel.com → New Project → Import Git Repository**.

3. **Variables de entorno** (Settings → Environment Variables):
   - `MVD_API_CLIENT_ID`: tu client_id
   - `MVD_API_CLIENT_SECRET`: tu secret (regenerá uno nuevo después de exponerlo en chat)
   - `MVD_API_TOKEN_URL`: `https://mvdapi-auth.montevideo.gub.uy/token`
   - `MVD_API_BASE`: `https://api.montevideo.gub.uy/api/transportepublico`
   - `OSRM_URL`: `https://router.project-osrm.org` (o tu instancia propia)

4. **Deploy** → automático en cada push.

### ⚠️ Caveats Vercel

- **Límite de función**: 50MB unzipped por serverless function. El `data/schedule.db` (84MB) **no entra** en bundle.
- **Node version**: fijar Node 22 en `package.json`:
  ```json
  "engines": { "node": "22.x" }
  ```
- Si Node 24 da "Module did not self-register" con better-sqlite3, downgrade a 22.

### Soluciones para el problema del schedule.db (84MB)

**Solución 1 (fácil)**: deshabilitar el fallback de horarios programados en prod.
- En `/api/stm/arrivals`, condicionar el bloque "schedule-fallback" a `process.env.NODE_ENV !== 'production'`.
- En prod la app sigue funcionando con live de API oficial — solo no muestra schedule cuando no hay buses.

**Solución 2 (recomendada)**: migrar al GTFS unificado.
- El GTFS oficial ya tiene `variant_stops.arrival_seconds` — son los horarios programados.
- Reemplazar `schedule-db.ts` por queries a `gtfs-db.ts` (3MB, sí entra).
- Trade-off: el GTFS tiene UN trip representativo por variante, no todos. Si querés todos los horarios del día necesitás otro approach.

**Solución 3**: hostear el `schedule.db` aparte (ej en Supabase Postgres free) y consultar via fetch.

---

## Opción B — Netlify

Necesita workarounds porque better-sqlite3 da problemas en Netlify Functions (no tiene gcc para compilar nativo).

### Setup

1. **Subir a GitHub** (igual que Vercel).

2. **Conectar Netlify al repo**:
   - https://app.netlify.com → New Site → Import from Git
   - Build command: `npm run build`
   - Publish directory: `.next` (Netlify lo detecta auto)
   - Plugin: `@netlify/plugin-nextjs` se instala solo

3. **Variables de entorno**: lo mismo que en Vercel.

### Workarounds para better-sqlite3 en Netlify

**Opción B.1**: cambiar a `sql.js` (sqlite en WebAssembly, funciona en serverless).
```bash
npm uninstall better-sqlite3
npm install sql.js
```
Refactor `gtfs-db.ts` y `schedule-db.ts` para usar la API async de sql.js. ~2 horas de trabajo.

**Opción B.2**: pre-procesar `gtfs.db` a JSON en buildtime y cargar a memoria.
- Tamaño en JSON: ~5-8MB, manejable.
- Funciona en cualquier serverless sin nativos.

---

## Opción C — Self-hosted (Railway / Render / Fly.io / VPS)

Para tener TODO lo nuestro sin restricciones (incluido OpenTripPlanner cuando lleguemos a Fase 2B).

### Railway (gratis hasta cierto uso)

1. Conectar repo GitHub
2. Setea variables de entorno
3. Deploy → URL pública

### Fly.io / Render

Similar. Soportan Docker → mejor control.

### Tu PC (con Cloudflare Tunnel para acceso público)

Como dijiste tener celulares — también podés usar tu PC:
```bash
npm run build && npm run start  # corre Next.js en localhost:3000
# Cloudflare Tunnel:
cloudflared tunnel --url http://localhost:3000
```
Te da una URL pública gratis (`https://xxx.trycloudflare.com`).

---

## Decisión recomendada

Para v0.1 lanzable: **Vercel + deshabilitar schedule.db fallback en prod**.

Migración futura: cuando lleguemos a Fase 2B con OpenTripPlanner, mover todo a VPS (Hetzner ~€4/mes) que tendrá OTP + Postgres + Next.js todo junto.

---

## Checklist pre-deploy

- [ ] Subir código a GitHub (no incluir `.env.local`, está en `.gitignore`)
- [ ] **Regenerar el secret** de api.montevideo.gub.uy (el que se expuso en chat)
- [ ] Configurar variables en plataforma elegida
- [ ] Decidir qué hacer con schedule.db (deshabilitar o migrar)
- [ ] `npm run build` localmente debe pasar limpio (ya pasa)
- [ ] Probar la URL prod con casos reales (parada 3790, búsqueda "nuevo centro", etc.)
