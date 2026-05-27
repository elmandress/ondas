# Ondas — Estrategia, Lean Canvas y Roadmap a Producto

Versión 0.1 · Mayo 2026

---

## 1. Contexto del mercado

### Lo que ya existe en Uruguay

| App | Quién la hace | Modelo | Limitaciones |
|---|---|---|---|
| **Cómo Ir** | Intendencia de Montevideo (oficial) | Gratis | Sin acortados de madrugada bien, una alternativa por ruta, no compara apps de maps |
| **STM Montevideo** (Matungos) | **Privada** — Gabriel Yordi | Gratis con ads opcionales (~USD 1 lifetime para sacarlas) | Crashea seguido (reseñas), UI vieja, sin Apple Maps |
| **Moovit** | Empresa (Israel, compró Intel) | Freemium con ads | Datos genéricos, no especializada en MVD |
| **Google Maps** | Google | Gratis con ads | Gasta MUCHOS datos, no especializada en bondi MVD |

**Hallazgo clave (que me pasaste)**: la app "STM Montevideo" más usada **NO es del gobierno — es privada** y monetiza con un pago único de USD 1 para sacar ads. Eso confirma que **hay mercado pago para esto** y que el ticket bajo es viable.

### Lo que Ondas tiene como ventaja diferencial

1. **Datos enriquecidos REALES** que ninguna otra app usa: accesibilidad ♿ por bus, AC ❄, emisiones, destino acortado detectado automáticamente
2. **Filtro GTFS estricto** (sólo buses que realmente van a tu parada en la dirección correcta)
3. **Tracking lejano** (vés el bus desde 6km antes, no recién a 2 cuadras)
4. **Combinación live + horarios** (nunca te queda sin info)
5. **Búsqueda con POIs locales** ("Nuevo Centro" → Nuevocentro Shopping)
6. **Stack moderno y mantenible** (Next.js 16 + TypeScript)
7. **Web mobile-first** → cero fricción de "instalar app" en primer uso

---

## 2. Lean Canvas

```
┌─────────────────────────────┬──────────────────────────────┬──────────────────────────────┐
│ PROBLEMA                    │ SOLUCIÓN                     │ PROPUESTA ÚNICA DE VALOR     │
│ • Apps oficiales lentas/    │ • Filtro upstream GTFS       │ "Saber si tu bondi viene     │
│   con bugs                  │ • Combinación live+horarios  │  bien, sin invenciones ni    │
│ • Inventan datos cuando no  │ • Accesibilidad/AC reales    │  ruido visual."              │
│   tienen (ocupación falsa)  │ • Búsqueda inteligente MVD   │                              │
│ • Muestran buses en sentido │ • Cómo Llegar paso a paso    │ Alta señal/ruido vs apps     │
│   contrario                 │   (Fase 2)                   │ existentes.                  │
│ • "Sin ómnibus" cuando hay  │                              │                              │
│   programados               │                              │                              │
├─────────────────────────────┼──────────────────────────────┼──────────────────────────────┤
│ SEGMENTOS DE USUARIO        │ VENTAJA INJUSTA              │ CANALES                      │
│ Primario:                   │ • Stack moderno (Next 16 +   │ • Web URL compartible        │
│ • Montevideanos 18-45 que   │   TS) → iteración 5× más     │   (sin instalación)          │
│   usan bondi diariamente    │   rápida que Matungos        │ • PWA installable            │
│ Secundario:                 │ • Datos OAuth oficial nuevos │ • TWA/Capacitor → Play       │
│ • Turistas en MVD           │   que casi nadie está        │   Store + App Store          │
│ • Personas con movilidad    │   usando todavía             │ • Boca a boca (Guille y     │
│   reducida (badge ♿)        │ • Hipocresía cero — solo     │   amigos testers)            │
│                             │   mostramos lo que sabemos   │ • Reddit r/uruguay           │
├─────────────────────────────┼──────────────────────────────┼──────────────────────────────┤
│ MÉTRICAS CLAVE              │ ESTRUCTURA DE COSTOS         │ STREAMS DE INGRESO           │
│ • DAU / MAU                 │ • Hosting Vercel: gratis     │ Fase 0 (MVP): GRATIS         │
│ • Tiempo prom de uso        │   hasta 100GB/mes            │ Fase 1: ads no intrusivos    │
│ • Paradas consultadas       │ • API IMM: gratis (rate      │   en banner inferior         │
│   por usuario               │   limit moderado)            │ Fase 2: USD 1 lifetime para  │
│ • Errores reportados        │ • Dominio: USD 12/año        │   sacar ads (como Matungos)  │
│ • % rutas exitosas en       │ • OTP futuro: USD 5/mes VPS  │ Fase 3: Pro USD 2/mes:       │
│   Cómo Llegar               │ • Mantenimiento: 2-4h/sem    │   - Notifs push              │
│                             │                              │   - Cómo Llegar premium      │
│                             │                              │   - Sin ads                  │
└─────────────────────────────┴──────────────────────────────┴──────────────────────────────┘
```

---

## 3. Camino a app móvil

### Opción A — PWA installable (MÁS FÁCIL, 1 día)

Lo que ya tenés casi listo:
- Manifest existente (`public/manifest.json`)
- Service worker para offline básico (pendiente agregar)
- Iconos en `public/icons/` (pendiente verificar)

Setup:
1. Agregar service worker (`next-pwa` o equivalente para Next 16)
2. Iconos 192px y 512px
3. En móvil Android: "Agregar a pantalla de inicio" funciona y queda como app
4. En iOS: igual, pero ojo con limitaciones de Safari (notif push limitadas)

**Resultado**: el usuario abre la URL una vez, "instalar", y queda con ícono en home. Funciona offline básico (paradas cacheadas).

### Opción B — Capacitor (NATIVO en stores, 2-5 días)

Como confirmó la búsqueda, podés tomar el código de Next.js y empaquetarlo en una app nativa para Play Store / App Store **sin reescribir nada**.

Steps:
1. `npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios`
2. Configurar para que Next.js export estático (con SSR servido remoto)
3. `npx cap init`, `npx cap add android`, `npx cap add ios`
4. Build APK para Play Store ($25 una sola vez)
5. iOS necesita Mac para compilar (o servicio cloud tipo Codemagic)

### Opción C — TWA (Trusted Web Activity) — solo Android

La opción más rápida para Android: TWA convierte una PWA en un APK que Play Store acepta. Solo Android (no iOS). 30 minutos de setup con [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap).

**Mi recomendación**:
- Ahora (V1.0): **PWA installable** (Opción A) — cubre 90% del valor sin complejidad
- En 2 meses si hay tracción: **Capacitor** (Opción B) — para tener presencia oficial en stores

---

## 4. Monetización por fases

### Fase 0 — Pre-launch (ahora hasta tener 100 usuarios)
- Gratis total. Sin ads. Foco: validación.

### Fase 1 — Launch público (100-1000 usuarios)
- Sigue gratis. Sin ads.
- Agregar feedback button para acumular learnings.
- Métricas: si el 30%+ vuelve a la semana → estás resolviendo un problema real.

### Fase 2 — Monetización suave (1000+ usuarios)
**Banner discreto en footer del mapa** (no popups, no full-screen):
- AdSense / EthicalAds: ~USD 1-3 por 1000 impresiones
- Con 1000 usuarios × 5 sesiones/semana × 4 vistas/sesión = 20k impresiones/semana
- Estimado: USD 80-240/mes (no es living salary pero paga el hosting)

**Pago único USD 1 para sacar ads** (modelo Matungos):
- Si 5% de los 1000 usuarios pagan: USD 50 únicos
- A medida que crezca, escala

### Fase 3 — Pro tier USD 2/mes (cuando tengas 5000+)
- Notificaciones push "tu bondi llega en 5 min" (necesita backend)
- Atajos guardados ("Mi casa", "Mi trabajo")
- Sin ads
- Soporte por mail
- Posiblemente: planificador OTP premium (más alternativas, modo accesible)

### Fase 4 — Otros ingresos
- API revendida a otros (PYMES que necesitan info de transporte)
- White-label para otras ciudades (Canelones, Maldonado, etc.)

---

## 5. Stack y arquitectura para escalar

### Lo que tenemos hoy (V0.6)
```
Next.js 16 (web)
  ├── Frontend SSR + cliente React
  ├── API routes serverless (Node 22)
  ├── better-sqlite3 → gtfs.db (3MB), schedule.db (84MB)
  ├── routes.json (3.8MB), stops.json, mvd-pois.json
  ├── OAuth2 a api.montevideo.gub.uy
  └── Fallback chain a APIs legacy sin auth
```

### Lo que falta para escala
1. **CDN para assets estáticos** → Vercel/Netlify lo hacen automático
2. **Cache de respuestas API** → Redis o KV (Vercel KV gratis 30k reads/día)
3. **Telemetría** → PostHog / Plausible (gratis para low volume)
4. **CI/CD** → GitHub Actions con tests + deploy automático
5. **OpenTripPlanner** → cuando Cómo Llegar necesite ser serio
6. **Backend persistente** → para notificaciones push (Phase 3)

---

## 6. Comparativo competitivo detallado

| Feature | Cómo Ir (IMM) | STM (Matungos) | Moovit | Google Maps | **Ondas** |
|---|---|---|---|---|---|
| Llegadas en vivo | ✅ | ✅ | ⚠️ | ❌ | ✅ |
| Filtro upstream correcto | ⚠️ | ⚠️ | ⚠️ | ❌ | ✅ |
| Accesibilidad por bus | ❌ | ❌ | ❌ | ❌ | ✅ |
| AC por bus | ❌ | ❌ | ❌ | ❌ | ✅ |
| Combinación live+horarios | ⚠️ | ✅ | ✅ | ❌ | ✅ |
| Tracking lejano | ⚠️ | ⚠️ | ⚠️ | ❌ | ✅ |
| Búsqueda POIs locales | ⚠️ | ⚠️ | ✅ | ✅ | ✅ |
| Cómo Llegar paso a paso | ⚠️ | ⚠️ | ✅ | ✅ | 🚧 |
| Alternativas múltiples | ⚠️ | ❌ | ✅ | ✅ | ✅ |
| Datos bajos | ✅ | ✅ | ✅ | ❌ | ✅ |
| Apple Maps switch (iOS) | ❌ | ✅ | ❌ | ❌ | 🚧 |
| Open source | ❌ | ❌ | ❌ | ❌ | 🚧 (decisión) |
| Gratis sin ads | ✅ | ❌ ads | ❌ ads | ❌ ads | ✅ (Fase 0) |

🚧 = pendiente

---

## 7. Decisiones estratégicas a tomar

### Decisión A: ¿Open source o cerrado?

**Pro open source**:
- Comunidad puede contribuir mejoras
- Credibilidad técnica
- Replicable a otras ciudades (revenue indirecto)

**Contra open source**:
- Alguien puede copiar y monetizar
- Hay que mantener docs

**Mi recomendación**: **half-open**. Código frontend público, scripts de procesamiento privados, datos curados (POIs) privados.

### Decisión B: ¿Web-first o app-first?

**Web-first** (lo que tenemos):
- Lanzamiento inmediato
- URL compartible
- Iteración rápida (sin esperar review de stores)
- iOS PWA tiene limitaciones (sin notif push real)

**App-first** (Capacitor):
- Presencia en stores → credibilidad
- Notif push reales
- Acceso a hardware (GPS background)
- Pero: 2-5 días setup, $25+$99/año de tiendas, reviews lentas

**Mi recomendación**: **Web → PWA → App nativa** en ese orden, según tracción.

### Decisión C: ¿Cuándo lanzar?

Opciones:
1. **Lanzar ya** (V0.6) con disclaimer "beta" → testers reales, feedback rápido
2. **Esperar a V1.0** (con Cómo Llegar serio) → polish primero
3. **Lanzamiento privado** (con Guille y 5-10 personas) → validar antes de público

**Mi recomendación**: **opción 3**. Lanzamiento privado esta semana, ajustes 2 semanas, público después.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| API IMM cambia o se rompe | Media | Alto | Cadena de fallback ya implementada |
| Rate limit de IMM nos bloquea | Baja | Medio | Cachear respuestas, no hammerear |
| Matungos saca features que copiamos | Baja | Bajo | Innovamos más rápido (stack moderno) |
| Google Maps mejora bondi MVD | Media | Alto | Diferenciar por especialización local |
| Costo crece con usuarios | Media | Medio | Migrar a VPS cuando supere free tier |
| Yo me canso de mantenerlo | Alta | Alto | Documentar bien, open source frontend |

---

## 9. Próximos pasos concretos (orden de prioridad)

### Esta semana
1. **Regenerar secret** de api.montevideo.gub.uy (está expuesto en chat)
2. **Subir a GitHub** (repo privado por ahora)
3. **Deploy Vercel** (resolver schedule.db: deshabilitar en prod o migrar a GTFS)
4. **Compartir URL con Guille** + 3-5 testers más
5. **Setup PWA mínima** (manifest + iconos + agregar a pantalla de inicio)

### Próximas 2 semanas
6. **Capturar feedback** de testers
7. **Fix bugs reportados**
8. **Decidir motor de Cómo Llegar** (Raptor TS vs OTP)
9. **Implementar long-press en mapa** para Cómo Llegar

### Mes 2
10. **Capacitor wrapper** si hay tracción
11. **Publicar en Play Store** (Bubblewrap o Capacitor)
12. **Ads suaves** si pasa de 500 usuarios

---

## 10. Por qué creo que esto puede funcionar

1. **Matungos demuestra que hay usuarios pagos** dispuestos a USD 1 por una mejor app de bondi
2. **La API nueva de IMM nos da datos que NADIE más usa todavía** (accesibilidad real, AC, etc.)
3. **Stack moderno** = iteración 5× más rápida que apps existentes (Matungos parece estar estancada según reseñas)
4. **Web-first** = launch sin fricción de instalación
5. **Especialización local** vs Google Maps = mejor calidad en lo que nos importa
6. **El sistema STM cambia poco** = una vez bien hecho, mantenimiento bajo

El moat real no es la tecnología — es la **disciplina de no inventar datos** y la **velocidad de respuesta a feedback**.
