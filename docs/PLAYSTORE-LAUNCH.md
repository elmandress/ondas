# Cuándo — Lanzamiento en Play Store + arquitectura

## 0) El hecho que define todo
"Cuándo" **NO es un sitio estático**. Tiene un **backend server-side** (Next.js API routes con
runtime nodejs): SQLite GTFS (`gtfs-v2.db` 3.3MB, `schedule.db` 84MB), OAuth2 a la API del STM
(`api.montevideo.gub.uy`), y el quirk de TLS (`NODE_TLS_REJECT_UNAUTHORIZED=0` por la CA de AGESIC).

→ **La app Android (cualquier vía) tiene que hablar con un backend hosteado.** No puede ser un
bundle 100% offline. Lo PRIMERO es **dónde hosteamos el backend**; lo segundo, cómo empaquetamos.

Estado PWA: ✅ `manifest.json`, ✅ `public/sw.js` (service worker registrado por `PwaRegister`),
✅ iconos 192/512/apple-touch. **Estamos PWA-ready** → la vía más rápida a Play Store es viable ya.

---

## 1) Vía a Play Store

### A. TWA (Trusted Web Activity) — RECOMENDADA para el primer lanzamiento
Envuelve la PWA en una cáscara Android mínima que carga la web hosteada (Chrome Custom Tab full-screen).
- **Herramienta**: PWABuilder (web, genera el AAB) o Bubblewrap (CLI).
- **Requisitos**: la PWA en HTTPS + `assetlinks.json` (Digital Asset Links) para verificar el dominio
  (saca la barra de URL) + manifest válido (lo tenemos).
- **Pros**: 1 solo codebase; deploy = update instantáneo (no re-subir a la store); mínimo trabajo.
- **Contras**: depende de internet (es la web); push web en Android anda pero es más limitado.
- **Tiempo**: ~1 día una vez deployado en HTTPS.

### B. Capacitor — para una v2 más "nativa"
Envuelve la web y da plugins nativos (geolocalización nativa, **push FCM nativo**, splash, share).
- OJO: nuestras API routes server-side **no se pueden bundlear** (necesitan Node) → igual hay que
  hostear el backend; Capacitor apunta sus `fetch` a esa URL.
- **Pros**: push nativo (clave para "tu bus está llegando"), mejor offline, sensación nativa.
- **Contras**: más trabajo, segundo pipeline de build.
- **Cuándo**: cuando metamos notificaciones push y queramos calidad store-grade.

**Plan**: lanzar con **TWA** (rápido), migrar/duplicar a **Capacitor** cuando agreguemos push nativo.

---

## 2) Dónde hosteamos el backend (la decisión real)
El `schedule.db` (84MB) **NO entra en funciones serverless** de Vercel (límite ~50MB por función).
`gtfs-v2.db` (3.3MB) sí entra.

| Opción | Qué implica | Veredicto |
|---|---|---|
| **Vercel + slim** | Deploy directo; DROP `schedule.db`, usar solo `gtfs-v2.db` (arrival_seconds para ETAs). El fallback de horarios degrada (ya tenemos ETAs por GTFS). | ✅ **Más rápido para lanzar** |
| **Railway / Fly.io / Render** | Server Node con disco persistente; mantiene `schedule.db`. ~$5/mes. | Si queremos los horarios exactos |
| **VPS (Hetzner/DO)** | Control total + Docker; mantiene todo. Más ops. | Para escala/OTP futuro |

- TLS quirk: setear `NODE_TLS_REJECT_UNAUTHORIZED=0` + credenciales OAuth en las env vars del host.
- **Recomendación de lanzamiento**: **Vercel** (deploy en minutos) y decidir `schedule.db`:
  o lo dropeamos (ETAs por GTFS), o movemos los horarios a una tabla más chica / a Supabase (ver §3).

---

## 3) ¿Supabase? ¿Migrar algo a una DB?
**Hoy NO usamos ninguna DB de usuario**: favoritos, recientes y rutas guardadas viven en
`localStorage` (cliente). Los datos del transporte son archivos estáticos + SQLite read-only +
la API en vivo del STM. **Para lanzar v1 NO hace falta Supabase.**

Supabase (free tier, fácil de sumar) tiene sentido **cuando** agreguemos:
1. **Notificaciones push** ("tu bus está llegando") → guardar las suscripciones (endpoints/VAPID).
2. **Cuentas + sync** de favoritos/rutas entre dispositivos.
3. **Analytics propias** (qué paradas/líneas se consultan) → saber uso real para priorizar.
4. **Datos de las features de Guille** que necesiten persistencia (horas pico agregadas, zonas).
5. Mover ahí el **schedule.db** como tabla Postgres (resuelve el problema de los 84MB en serverless).

**Recomendación**: lanzar con localStorage; sumar **Supabase en v1.x** junto con push notifications
(que es la primera que pide DB). No migrar nada urgente ahora.

---

## 4) Checklist de lanzamiento (concreto)
**Deploy / PWA**
- [ ] Deploy en HTTPS (Vercel) con env vars (OAuth STM + `NODE_TLS_REJECT_UNAUTHORIZED=0`).
- [ ] Decidir `schedule.db` (drop / Railway / Supabase).
- [ ] Pasar **Lighthouse PWA** (installable, manifest, SW, offline básico).
- [ ] `public/.well-known/assetlinks.json` con el fingerprint de la firma (para TWA sin barra URL).

**Play Console**
- [ ] Cuenta de desarrollador Google Play (**US$25** una vez).
- [ ] Generar AAB con **PWABuilder** (TWA) → firmar → subir.
- [ ] **Política de privacidad** hosteada (URL pública) — ya tenemos la postura ("no login, GPS local";
      el menú de Ajustes la resume; falta la página formal).
- [ ] **Data Safety form**: declarar que pedimos **ubicación** (y para qué); que NO la compartimos.
- [ ] Ficha: nombre "Cuándo", descripción, **screenshots** (mobile), **feature graphic** 1024×500, icono.
- [ ] Categoría: Mapas y navegación / Viajes.

**Calidad / store**
- [ ] Manejo de fallas de API con cara amigable (blindaje — ya iniciado; reforzar mensajes con marca).
- [ ] Probar en dispositivos reales (Android var.) — geolocalización, instalación, performance.

---

## 5) Riesgos / notas
- **Dependencia de la API del STM**: si se cae, la app no puede inventar. → estados de error con marca
  (postura de marketing: "los servidores de la ciudad están durmiendo 💤, nosotros listos"). Diferencial
  = velocidad + honestidad, no "te salvamos siempre".
- **Web push en TWA**: anda en Android (usa FCM por debajo) pero requiere VAPID + handler en el SW.
  Si push es prioridad → evaluar Capacitor antes.
- **Geolocalización**: TWA usa la web geolocation (prompt nativo del sistema) — funciona.
- **Actualizaciones**: con TWA, deploy a Vercel = update instantáneo sin pasar por revisión de la store
  (enorme ventaja para iterar). Solo cambios al wrapper requieren re-subir el AAB.

## 6) Resumen ejecutivo
1. **Hostear el backend** (Vercel; decidir `schedule.db`). 
2. **Empaquetar con TWA** (PWABuilder) — somos PWA-ready, es cuestión de días.
3. **Supabase NO para v1**; sumarlo con push/cuentas en v1.x.
4. **Capacitor** para la v2 nativa (push FCM, offline).

---

## 7) PASOS CONCRETOS — estado verificado (may 2026)

Lo verificado hoy en el repo (no teoría):
- ✅ `next build` de producción **compila OK** (exit 0).
- ✅ `next.config.ts` configurado para serverless: incluye en el trace los datos que se
  leen por `fs` (gtfs-v2.db, line-hours, mvd-pois, variant_to_line, routes.json, stops.json
  ≈ 8 MB) y **excluye `schedule.db` (84 MB)** y `gtfs.db` (v1).
- ✅ `schedule-db.ts` **degrada solo** si falta el archivo (`existsSync` → `null`, queries → `[]`);
  las ETAs salen del GTFS. Por eso Vercel es viable sin tocar la DB grande.
- ✅ PWA lista: `manifest.json` (iconos 192/512 any+maskable), `public/sw.js` + `PwaRegister`,
  `apple-touch-icon`, `theme-color`, `viewport-fit=cover`.
- ✅ `public/.well-known/assetlinks.json` template (package `uy.cuando.app`; falta el SHA256).

### A) Deploy del backend en Vercel
1. `vercel` (o conectar el repo en vercel.com). Framework: Next.js (autodetecta).
2. **Env vars** (Production): credenciales OAuth del STM + `NODE_TLS_REJECT_UNAUTHORIZED=0`
   (la CA de AGESIC). Copiar de `.env.local`.
3. Deploy → queda en `https://<algo>.vercel.app`. Verificar que andan:
   `/api/stm/arrivals?stopId=...`, `/api/route/plan`, `/api/geocode`.
   (Si una función supera 50 MB, revisar que `schedule.db` quedó excluido.)
4. (Opcional) dominio propio, ej. `cuando.uy` o `app.cuando.uy`.

### B) Empaquetar para Play Store (TWA)
Requisitos Google Play 2026: **target API 35 (Android 15)** desde 31/8/2025, **Lighthouse PWA ≥ 80**,
Digital Asset Links, cuenta de desarrollador **US$25** (única vez).
1. Pasar **Lighthouse** (Chrome DevTools → Lighthouse → PWA) sobre la URL deployada; apuntar ≥ 80.
2. **PWABuilder** (pwabuilder.com) → pegar la URL → "Package for Stores" → **Android** →
   asegurarse de que el paquete apunte a **API 35** → genera el **AAB** + un **keystore** (¡guardarlo!).
   - Package id: `uy.cuando.app` (debe coincidir con `assetlinks.json`).
3. PWABuilder te da el **SHA256** del keystore → pegarlo en `public/.well-known/assetlinks.json`
   y **re-deployar** (así Android verifica el dominio y saca la barra de URL).
4. **Play Console**: crear la app, subir el AAB, completar ficha (nombre "Cuándo", descripción,
   screenshots mobile, feature graphic 1024×500, icono), categoría Mapas y navegación / Viajes.
5. **Data Safety form**: declarar que se pide **ubicación** (para paradas/rutas), que **no se comparte**
   ni se vende, y que no hay cuentas. Política de privacidad: hostear la URL pública (el menú Ajustes
   ya tiene el texto; falta exponerlo como página).
6. Revisión de Google (~días) → publicación.

### C) Notas
- Con TWA, **cada deploy a Vercel = update instantáneo** (la app carga la web); solo cambios al
  wrapper requieren re-subir AAB.
- **Push nativo** ("tu bus está llegando") → recién ahí conviene **Capacitor + FCM** (ver §1B). El web-push
  en TWA anda pero es más limitado.

---

## 8) ¿Se puede GRATIS? Sí — y por qué Vercel (investigado may 2026)

### El punto que confunde
"Cuándo" **no es un sitio estático**: tiene backend (proxy OAuth al STM + SQLite). Por eso NO
sirve un hosting estático gratis (GitHub Pages, etc.) — necesita un host que corra **Node**.

### Camino 100% GRATIS (sin pagar un peso)
1. **Hosting: Vercel plan Hobby = gratis** (para apps **no comerciales**). Incluye 100 GB de tráfico/mes
   (≈ 100k visitas), 1M de invocaciones de función, deploy automático. Nuestro build ya entra
   (excluimos el `schedule.db` de 84 MB; el resto ≈ 8 MB).
2. **La app como "instalable": GRATIS desde el navegador.** Una PWA se instala con
   "Agregar a pantalla de inicio" (Chrome/Android la ofrece solo → queda como app real: ícono,
   pantalla completa, en el cajón de apps, vía WebAPK). **No hace falta la Play Store ni pagar nada.**

→ **Vercel Hobby + instalar desde el navegador = totalmente gratis.**

### La Play Store es OPCIONAL y cuesta US$25 (una vez, de Google)
Solo sirve para que la app **aparezca cuando alguien busca en la tienda**. La app funciona igual
instalada desde el navegador. Si se quiere estar en la tienda: US$25 una vez (cuenta de desarrollador
Google) + empaquetar con PWABuilder (§7). No es plata nuestra, es la tarifa de Google.

### ¿Por qué Vercel y no otro?
| Opción | Gratis | ¿Corre nuestro stack? | Veredicto |
|---|---|---|---|
| **Vercel Hobby** | ✅ (no comercial) | ✅ Node serverless + `better-sqlite3` nativo + lee los `.db`. Cero config. | **Recomendado para lanzar** |
| **Cloudflare Pages** | ✅ (tráfico ilimitado) | ❌ Corre en V8 isolates, **NO** módulos nativos ni `better-sqlite3`/fs. Habría que rehacer la capa de datos. | No sin reescribir |
| **Netlify** | ✅ | ⚠️ Posible vía OpenNext, pero más fricción con módulos nativos. | Alternativa B |
| **Render / Railway** | Parcial | ✅ Server Node real (mantiene `schedule.db`). Render free hace cold-start lento; Railway da ~$5 crédito. | Si querés un server siempre-on |
| **VPS (Hetzner/Contabo)** | ❌ ~US$4–6/mes | ✅ Control total. | Si monetiza/escala |

### Aviso honesto (importante)
El plan **Hobby de Vercel es solo para uso NO comercial**. Mientras "Cuándo" sea gratis y sin
ingresos/publicidad, está perfecto. Si algún día monetiza: Vercel **Pro** (US$20/mes) o mover a un
**VPS (~US$5/mes)** / Render. Nada de esto bloquea el lanzamiento gratis hoy.

### ¿Lo sube Claude solo?
No: el deploy necesita **tus cuentas** (Vercel/Google) y las **credenciales del STM** — eso no lo puedo
hacer yo. Pero dejé todo listo. El deploy real es: crear cuenta en vercel.com → conectar el repo (o
`npx vercel`) → pegar las env vars (OAuth STM + `NODE_TLS_REJECT_UNAUTHORIZED=0`) → deploy. Minutos.
Te puedo acompañar paso a paso cuando quieras.
