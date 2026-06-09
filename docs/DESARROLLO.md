# Desarrollo, Deploy y Testing — Cuándo

> Fuente de verdad **operativa**. Arquitectura → [ARQUITECTURA.md](ARQUITECTURA.md). QA/riesgos → [AUDITORIA-MAESTRA.md](AUDITORIA-MAESTRA.md).
> Última actualización: 2026-06-04.

## Comandos
```bash
npm run dev      # desarrollo (Turbopack) en :3000
npm run build    # build de producción (genera SSG: ~240 /linea, /barrio, etc.)
npm start        # servir el build (prod local)
npx tsc --noEmit # typecheck
npx eslint src/  # lint
npx vitest run   # tests (89)
```
> ⚠️ El proyecto vive en `D:\comoire\ondas` (NO en `D:\comoire`, que tiene otro repo). Todo se corre parado ahí.

## Definition of Done (cada cambio)
`tsc 0` · `lint 0 errores` · `vitest` verde · `npm run build` OK · verificación en prod local (curl/Playwright) cuando aplique · auditoría/memoria actualizada.

## Deploy (Netlify + Supabase) — gratis, web/PWA
La estrategia es **PWA + SEO + web** (Play Store documentada como objetivo futuro, ver §Android).
1. Subir el repo a **GitHub**.
2. **Netlify** → Import from GitHub. Detecta Next.js solo (usa `netlify.toml`; OpenNext arma las functions). No tocar el build command.
3. Cargar **variables de entorno** (Site settings → Environment variables). Las que falten **degradan, no rompen**:
   - `NEXT_PUBLIC_SITE_URL` → la URL final (canonical/OG/sitemap correctos). **Importante.**
   - `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` → favoritos sync + analytics + ocupación. Públicas (RLS protege).
   - `MVD_API_TOKEN_URL/CLIENT_ID/CLIENT_SECRET/BASE` → **llegadas en vivo** del STM (OAuth2). Secretas → scope "Functions". Sin esto, degrada a horarios.
   - `SUPABASE_SERVICE_ROLE_KEY` → solo para scripts de carga server-side. Secreta. NUNCA con prefijo `NEXT_PUBLIC_`.
   - `OSRM_URL` → opcional (router peatonal; default público en el código).
4. Deploy → queda en `*.netlify.app` o el dominio propio.
5. **Google Search Console**: agregar el sitio → subir `/sitemap.xml` (~6.6k URLs) para indexar.
- `netlify.toml` ya define: `NODE_VERSION=22`, `functions.included_files` (datasets que el runtime lee), `external_node_modules=["better-sqlite3"]`, y los **headers de seguridad** (CSP, HSTS, X-Frame DENY, etc.).
- Datos: `gtfs-v2.json`, `metro-schedule.db`, `line-hours.json`, etc. van bundleados a las functions. `schedule.db` (84MB) NO se sube.

## Supabase
- Esquema en `supabase/schema.sql` (RLS estricta para datos de usuario; insert anónimo + lectura pública para `analytics_events`/`occupancy_reports`). Ver `supabase/README.md`.
- Para activar **crowdsourcing de ocupación**: aplicar la tabla `occupancy_reports` del schema en el SQL editor de Supabase (el código degrada sin ella).
- La app corre **sin Supabase** (favoritos solo en localStorage; sin sync ni analytics).

## Testing (89 tests)
- **Unit/lógica** (`tests/*.test.ts`, vitest): ruteo, horarios, seguridad-zonas, trip-safety, fares, intersection.
- **Seguridad**: `jsonld.test.ts` (anti-XSS del JSON-LD).
- **Validación adversarial**: `mvd-area.test.ts` (NaN/Infinity/null/fuera de área/invertidos).
- **Degradación**: `degradation.test.ts` (líneas/paradas inexistentes y entradas vacías → vacío/null, sin throw).
- **Verificación en prod local** (Playwright ad-hoc): `PORT=3100 npm start`, scripts en `scripts/` para screenshots/asserts (deep links, OG images, flujos). Limpiar el script y apagar el server al terminar.
- Saltear onboarding en tests: `localStorage.setItem("ondas_prefs", JSON.stringify({onboardingDone:true}))` vía `addInitScript`.
- **Gaps conocidos** (ver AUDITORIA-MAESTRA): E2E de flujos críticos, degradación de **proveedores externos** caídos (API STM/Nominatim/Supabase), accesibilidad (lector/contraste), performance/CWV.

## Convenciones
- Respuestas y UI en **español rioplatense**. Honestidad: nunca inventar datos (ETAs, precios, wifi); marcar estimados con "~".
- Datos en runtime = JSON leído con `fs` (sin módulos nativos). SQLite solo en build/scripts.
- JSON-LD siempre vía `jsonLdHtml()` (anti-XSS). `localStorage.setItem` siempre en try/catch (quota/Safari privado).
- El usuario hace los commits/push.

## Android / iOS (objetivo futuro)
**Decisión vigente**: PWA instalable ahora ($0) → **TWA con Bubblewrap** (US$25 one-time) cuando haya dominio/tracción. NO Capacitor/nativo. iOS vía "Agregar a inicio" (gratis, push 16.4+); App Store despriorizado.
- Ya listo: manifest completo (`id`/`scope`/`display_override`), SW versionado, install prompt con soporte iOS, `public/.well-known/assetlinks.json` (falta pegar el SHA256 del keystore tras `bubblewrap build`).
- Datos 2026: Play = US$25 único; cuentas personales nuevas requieren 12 testers/14 días + ID; verificación obligatoria de developers recién global 2027 (UY no está en la 1ª ola).
- Bloqueante para TWA/Lighthouse: **deploy HTTPS** con dominio.
