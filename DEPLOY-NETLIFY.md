# Deploy a Netlify — Guía paso a paso

## ✅ Estado de preparación

Todo configurado para deploy. Lo único que tenés que hacer vos:

1. Crear repo en GitHub y subir el código
2. Conectar Netlify al repo
3. Pegar 4 variables de entorno
4. Listo

---

## Paso 1: Subir a GitHub (5 min)

```bash
cd d:/comoire/ondas

# Inicializar git si no está
git init
git add .
git commit -m "Ondas v0.7 — listo para deploy"

# Crear repo en https://github.com/new (privado o público, da igual)
# Después conectarlo:
git remote add origin https://github.com/TU_USUARIO/ondas.git
git branch -M main
git push -u origin main
```

⚠️ **Verificar que NO se subió `.env.local`** ni `data/schedule.db` (ya están en `.gitignore`).

```bash
git ls-files | grep -E "\.env|schedule\.db"
# Debe devolver vacío
```

---

## Paso 2: Conectar Netlify (5 min)

1. Ir a **https://app.netlify.com** → "Add new site" → "Import an existing project"
2. Elegir GitHub → tu repo `ondas`
3. Netlify autodetecta Next.js. Click "Deploy".
4. **El primer deploy va a fallar** porque faltan las variables de entorno. Es normal.

---

## Paso 3: Variables de entorno (3 min)

En Netlify: **Site configuration → Environment variables → Add a variable**

Agregá estas 4:

| Key | Value |
|---|---|
| `MVD_API_CLIENT_ID` | (tu client ID de api.montevideo.gub.uy) |
| `MVD_API_CLIENT_SECRET` | (regenerá uno nuevo y pegalo acá) |
| `MVD_API_TOKEN_URL` | `https://mvdapi-auth.montevideo.gub.uy/token` |
| `MVD_API_BASE` | `https://api.montevideo.gub.uy/api/transportepublico` |

⚠️ **Regenerá el secret** en https://api.montevideo.gub.uy/ antes de pegarlo (los anteriores quedaron expuestos en chat).

---

## Paso 4: Re-deploy

En Netlify: **Deploys → Trigger deploy → Clear cache and deploy site**.

El build tarda ~3 min. Cuando termine, tenés URL pública tipo `https://random-name.netlify.app`.

(Opcional: **Domain settings → Change site name** para ponerle algo lindo: `ondas-mvd.netlify.app`)

---

## ⚙️ Lo que ya configuré por vos

### `netlify.toml`
- Plugin oficial `@netlify/plugin-nextjs` (maneja SSR + API routes automático)
- Node 22 (fija la versión, evita problemas con better-sqlite3)
- `included_files`: bundlea `gtfs.db` (3MB), `mvd-pois.json` y `variant_to_line.json` con las API routes
- `external_node_modules`: better-sqlite3 se trata como módulo nativo (no se mete en el bundle)
- Cache headers para iconos, manifest, etc.

### `.gitignore`
- Excluye `.env*` (credenciales)
- Excluye `data/schedule.db` (84MB, no entra en Netlify Functions)

### `schedule-db.ts`
- Maneja graciosamente la ausencia de `schedule.db` en prod (la app sigue funcionando con la API oficial)

---

## 🔍 Verificar que funciona

Una vez deployado, probá:

1. **Homepage** → debe cargar el mapa + sugerir paradas cercanas
2. **Buscador** → "Nuevocentro Shopping" → debe aparecer el shopping
3. **Esquina** → "Garibaldi y Rivadavia" → debe devolver el cruce con coords exactas
4. **Cómo llegar** → poner origen y destino, ver opciones con líneas
5. **Mapa** → tocar una parada → ver llegadas con datos en vivo

Si algo falla, abrir DevTools console y mirar errores. Los más comunes:

| Error | Solución |
|---|---|
| `401 Authentication failed` | Faltó configurar `MVD_API_CLIENT_SECRET` o está vencido. Regenerá y volvé a deployar |
| `500` en `/api/stm/arrivals` | Falta la suscripción al servicio "Transporte Público" en tu app de api.montevideo.gub.uy |
| `Module did not self-register` (better-sqlite3) | Node version equivocada. Verificar que `NODE_VERSION=22` en `[build.environment]` |
| Búsqueda lenta primer click | Cold start de Netlify Functions. A partir del 2do click va rápido |

---

## 💰 Costo y límites del free tier de Netlify

- **Bandwidth**: 100GB/mes (suficiente para miles de usuarios)
- **Functions**: 125k invocaciones/mes
- **Build time**: 300 min/mes
- **Sites**: ilimitados

Para Ondas en arranque: gratis sobra. Cuando crezca, se ve.

---

## 🔄 Updates futuros

Cada `git push` a `main` deploya automático. Si querés probar antes:
- Hacé un branch nuevo
- Push → Netlify crea **deploy preview** con URL temporal
- Mergeás cuando estés conforme

---

## 🆘 Si algo se rompe

1. **Build falla**: revisar Deploys → último deploy → "Deploy log"
2. **Funciones fallan en runtime**: Functions → Functions log
3. **App carga pero sin datos**: probablemente faltan env vars → re-deploy después de agregarlas
