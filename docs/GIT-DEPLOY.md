# Deploy de Cuándo (ondas) — GitHub + Netlify + Supabase

Guía paso a paso, end-to-end. Todo se hace **parado en `D:\comoire\ondas`** (nunca en `D:\comoire`).

---

## 0. Estructura de repos (LEER PRIMERO — esto confunde)

Hay DOS carpetas con `.git`:

```
D:\comoire\               ← repo "raíz"  ❌ NUNCA usar para deploy
├── Cuándo - Design\      ← carpeta de diseño, NO debe ir a GitHub
├── TODAS-MIS-ENV.env     ← tus secretos (gitignored en ambos repos)
└── ondas\                ← repo del PROYECTO  ✅ ESTE se sube
    └── package.json       ← la raíz del proyecto Next.js ES ondas/
```

`ondas/` **es** la carpeta de archivos a usar: todo el proyecto (código, datos, package.json)
vive ahí. GitHub y Netlify necesitan que la raíz del repo tenga el `package.json` → es `ondas/`.
Remote ya configurado: `github.com/elmandress/ondas.git`, rama `main`.

→ Para CUALQUIER comando git: `cd D:\comoire\ondas` primero. Jamás parado en `D:\comoire`.

---

## 1. Subir a GitHub

### 1.a Si da error `403 Permission denied` (token viejo cacheado)

Pasa cuando Windows tiene guardado un token vencido. Solución (una vez):

```powershell
cd D:\comoire\ondas

# Que Git use el Credential Manager con login por navegador:
git config --global credential.helper manager
git config --global credential.gitHubAuthModes browser
git config --global user.name  "elmandress"
git config --global user.email "neptuno.rossello@gmail.com"

# Borrar el token podrido:
echo url=https://github.com | git credential-manager erase
cmdkey /delete:LegacyGeneric:target=git:https://github.com   REM si "Element not found", ignorar

# (si sigue fallando) Menú Inicio → "Administrador de credenciales" →
# Credenciales de Windows → borrar cualquier entrada "git:https://github.com" → Quitar.
```

### 1.b Push

```powershell
cd D:\comoire\ondas
git add -A
git status          REM CONFIRMÁ que NO aparezca .env.local ni "Cuándo - Design"
git commit -m "feat: ruteo + cobertura nacional + voz/compartir + Supabase"
git push -u origin main
```

En el push, GCM abre el **navegador** → logueate como **elmandress** → Authorize. Listo.

**Alternativa a prueba de balas (si el navegador no abre):** generá un Personal Access Token
(GitHub → Settings → Developer settings → Tokens classic → scope `repo`) y:
```powershell
git push -u https://elmandress:ghp_TUTOKEN@github.com/elmandress/ondas.git main
```

### 1.c Qué se sube y qué NO (verificado)
- ✅ Van: `src/`, `public/` (todos los .json), `scripts/`, `docs/`, `supabase/schema.sql`,
  `data/gtfs-v2.db` (6MB), `data/metro-schedule.db` (32MB), `.env.example`.
- ❌ No van (gitignored): `.env.local` (¡secretos!), `data/schedule.db` (84MB, supera el
  límite de GitHub), `node_modules/`, `.next/`, `Cuándo - Design`.

---

## 2. Netlify

1. Netlify → **Add new site → Import an existing project → GitHub** → autorizá → `elmandress/ondas`.
2. Build settings (el `netlify.toml` ya define casi todo):
   - **Base directory**: vacío (el repo YA es `ondas/`).
   - **Build command**: `npm run build`
   - **Publish directory**: vacío (lo maneja el plugin de Next/OpenNext).
3. Cargá las variables de entorno (sección 3) ANTES o justo después del primer deploy.

---

## 3. Variables de entorno en Netlify

Site settings → Environment variables. Copialas de `D:\comoire\TODAS-MIS-ENV.env`.

| Variable | Scope | Secreta? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | All | no (pública) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All | no (segura por RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Functions** | 🔒 SÍ |
| `MVD_API_CLIENT_ID` | Functions | 🔒 |
| `MVD_API_CLIENT_SECRET` | Functions | 🔒 |
| `MVD_API_TOKEN_URL` | Functions | — |
| `MVD_API_BASE` | Functions | — |
| `NODE_TLS_REJECT_UNAUTHORIZED` = `0` | Functions | — |
| `OSRM_URL` | Functions | — |

> Las secretas en scope **Functions** únicamente: así no quedan expuestas en el build del frontend.

---

## 4. Supabase (activar las cuentas)

El `schema.sql` ya está aplicado (tablas + RLS + buckets + RPC). Falta habilitar la sesión:

1. Supabase → **Authentication → URL Configuration**:
   - **Site URL**: `https://TU-SITIO.netlify.app`
   - **Redirect URLs**: agregá `https://TU-SITIO.netlify.app/**` y `http://localhost:3000/**`.
2. **Authentication → Providers**: **Email** habilitado (el login es magic link por email).

Cuando el usuario inicie sesión, los favoritos se sincronizan local↔nube automáticamente.

---

## 5. Redesplegar

Netlify redespliega solo en cada `git push origin main`. Tras cargar las env vars la primera
vez: **Trigger deploy → Clear cache and deploy site** (para que tome las variables nuevas).

---

## 6. Ciclo normal (cambios futuros)

```powershell
cd D:\comoire\ondas
git add -A
git commit -m "descripción"
git push          REM Netlify redespliega automático
```

---

## 7. ⚠️ Seguridad — rotar claves expuestas

La `service_role` y la `sb_secret` de Supabase, y el `MVD_API_CLIENT_SECRET`, estuvieron en
el chat de setup → tratarlas como comprometidas. **Rotalas:**
- Supabase → Project Settings → API → "Reset service_role key" (y la secret nueva). Actualizá
  el valor en `TODAS-MIS-ENV.env`, en `ondas/.env.local` y en Netlify.
- MVD → regenerar el client secret en `api.montevideo.gub.uy` y actualizar igual.
- Las claves `anon`/`publishable` NO hace falta rotarlas (son públicas por diseño).
