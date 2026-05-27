# OpenTripPlanner setup — Fase 2B

Guía paso a paso para levantar OpenTripPlanner (OTP) y usarlo como motor real de "Cómo Llegar".

**Referencia SRS**: FR-4.10 + sección Fase 2B del roadmap.

---

## ¿Por qué OTP?

- Motor de planificación open-source usado por agencias reales (TriMet, BART, Helsinki HSL).
- Implementa Raptor + búsqueda multimodal (caminata + bus + transbordos).
- Entiende GTFS oficial (el mismo formato que publica Montevideo).
- API HTTP simple: enviás origen+destino, devuelve itinerarios con pasos detallados.

Para Ondas: corre como servicio aparte (Java + Docker). El frontend Next.js lo proxy-ea desde `/api/route/plan`. Si OTP cae, fallback al planner heurístico en TypeScript.

---

## Pre-requisitos

### 1. Cuenta en api.montevideo.gub.uy (GRATIS)

Necesitamos el GTFS oficial. Se descarga de un endpoint con autenticación gratuita:

```
https://api.montevideo.gub.uy/api/transportepublico/buses/gtfs/static/latest/google_transit.zip
```

Pasos:
1. Ir a https://api.montevideo.gub.uy/
2. Crear cuenta (registro gratuito)
3. Obtener API key / App ID
4. Suscribirse al plan "API de Transporte Publico"

Una vez con el key, descargar el GTFS con header de autenticación.

### 2. Docker + Docker Compose

OTP corre como contenedor Docker. Imagen oficial: `opentripplanner/opentripplanner:latest`.

### 3. Datos OSM de Uruguay (~200MB)

OTP necesita OSM para resolver la red peatonal (caminar por las calles):

```bash
mkdir -p data/otp
cd data/otp
curl -L -o uruguay-latest.osm.pbf \
  https://download.geofabrik.de/south-america/uruguay-latest.osm.pbf
```

---

## Estructura de archivos

```
ondas/
├── data/
│   └── otp/
│       ├── mvd.gtfs.zip         ← GTFS oficial (descargado con API key)
│       ├── uruguay-latest.osm.pbf
│       ├── router-config.json   ← config OTP
│       ├── build-config.json
│       └── graph.obj            ← se genera en build
├── docker/
│   └── otp/
│       ├── docker-compose.yml
│       └── README.md
```

### `data/otp/build-config.json`

```json
{
  "areaVisibility": true,
  "platformEntriesLinking": true,
  "transitFeeds": [
    { "type": "gtfs", "source": "mvd.gtfs.zip" }
  ],
  "osmDefaults": { "source": "uruguay-latest.osm.pbf" }
}
```

### `data/otp/router-config.json`

```json
{
  "routingDefaults": {
    "walkSpeed": 1.25,
    "maxWalkDistance": 2000,
    "transferPenalty": 120,
    "waitReluctance": 1.0
  },
  "transit": {
    "maxNumberOfTransfers": 2
  }
}
```

---

## docker-compose.yml

```yaml
version: "3.9"

services:
  otp-build:
    image: opentripplanner/opentripplanner:latest
    command: ["--build", "--save", "/var/opentripplanner/"]
    volumes:
      - ../../data/otp:/var/opentripplanner
    profiles: ["build"]

  otp:
    image: opentripplanner/opentripplanner:latest
    command: ["--load", "--serve", "/var/opentripplanner/"]
    ports:
      - "8080:8080"
    volumes:
      - ../../data/otp:/var/opentripplanner
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/otp/"]
      interval: 30s
      timeout: 5s
      retries: 3
```

---

## Workflow de uso

### Una sola vez: build del graph

```bash
cd docker/otp
docker compose --profile build run --rm otp-build
# Tarda ~5 min en una PC mid-range, ~10 min en VPS chico
# Genera data/otp/graph.obj (~500MB)
```

### Cada vez que arranco a desarrollar

```bash
cd docker/otp
docker compose up -d
# Verificar: http://localhost:8080/otp/
```

### Test manual

```bash
curl "http://localhost:8080/otp/routers/default/plan?\
fromPlace=-34.8689,-56.1697&\
toPlace=-34.8932,-56.1645&\
date=2026-05-25&time=14:30&\
mode=TRANSIT,WALK"
```

Respuesta esperada: itinerarios con legs (caminar / bus) y horarios reales.

---

## Integración con la app

### Variable de entorno

`.env.local`:
```
OTP_URL=http://localhost:8080
```

Producción (VPS):
```
OTP_URL=http://otp:8080
```

### Endpoint Next.js

`src/app/api/route/plan/route.ts` (crear en Fase 2B):

```typescript
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { from, to, time } = await req.json();
  const otpUrl = process.env.OTP_URL || "http://localhost:8080";
  
  // Timeout 3s — si OTP no responde, devolvemos null para que el cliente
  // haga fallback al planner heurístico.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  
  try {
    const url = `${otpUrl}/otp/routers/default/plan?fromPlace=${from.lat},${from.lon}&toPlace=${to.lat},${to.lon}&mode=TRANSIT,WALK&numItineraries=5`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return NextResponse.json({ ok: false, fallback: true });
    const data = await res.json();
    return NextResponse.json({ ok: true, itineraries: data.plan?.itineraries || [] });
  } catch {
    return NextResponse.json({ ok: false, fallback: true });
  }
}
```

### Adaptador OTP → RouteCandidate

Convertir el JSON de OTP al formato `RouteCandidate` que ya usa la UI. Esto mantiene cero cambios en `RouteScreen.tsx`.

```typescript
// src/lib/otp-adapter.ts
import type { RouteCandidate } from "./route-planner";

interface OtpItinerary {
  duration: number;
  walkDistance: number;
  transfers: number;
  legs: OtpLeg[];
}

interface OtpLeg {
  mode: "WALK" | "BUS";
  route?: string;
  from: { name: string; stopId?: string; lat: number; lon: number };
  to: { name: string; stopId?: string; lat: number; lon: number };
  duration: number;
  distance: number;
  steps?: { streetName: string; distance: number }[];
}

export function adaptOtp(itineraries: OtpItinerary[]): RouteCandidate[] {
  // ... convertir cada itinerario OTP a RouteCandidate
}
```

---

## Deploy en producción

### Opción 1: VPS DigitalOcean (~$5/mes)

- Droplet básico (1GB RAM, 1 vCPU) NO alcanza para OTP — necesita 2GB+
- Recomendado: Premium 2GB RAM ($12/mes) o usar swap agresivo en 1GB
- Build del graph: hacer en la VPS o subir `graph.obj` por SCP

### Opción 2: Hetzner CX22 (~€4/mes)

- 4GB RAM, 2 vCPU — alcanza cómodo
- Build local, deploy con scp + docker compose

### Opción 3: Tu propia PC

- Para desarrollo o si tenés una PC siempre prendida
- ngrok para exponer si querés acceder desde celular: `ngrok http 8080`

---

## Refresh periódico del GTFS

El GTFS cambia (nuevas líneas, horarios). Cron semanal:

```bash
# /etc/cron.weekly/otp-refresh.sh
#!/bin/bash
cd /opt/ondas/data/otp
curl -H "Authorization: Bearer $MVD_API_KEY" \
  -o mvd.gtfs.zip.new \
  https://api.montevideo.gub.uy/api/transportepublico/buses/gtfs/static/latest/google_transit.zip
if [ -s mvd.gtfs.zip.new ]; then
  mv mvd.gtfs.zip.new mvd.gtfs.zip
  cd /opt/ondas/docker/otp
  docker compose --profile build run --rm otp-build
  docker compose restart otp
fi
```

---

## Validación de éxito

Una vez funcionando:

1. **Test "Nuevocentro → Tres Cruces"**: debe devolver 3-5 itinerarios con bus + caminata
2. **Tiempo de respuesta**: <2s para queries dentro de MVD
3. **Pasos peatonales**: con nombres de calle reales
4. **Comparación con app oficial Cómo Ir**: itinerarios similares en líneas y tiempos

---

## Troubleshooting

- **OTP no levanta**: revisar logs con `docker compose logs otp`
- **OOM (Out of Memory) en build**: aumentar swap, o `JAVA_OPTS=-Xmx4g`
- **GTFS rechazado**: verificar que el ZIP tiene `stops.txt, routes.txt, trips.txt, stop_times.txt, calendar.txt` mínimo
- **Resultados raros**: revisar `router-config.json`, especialmente `transferPenalty` y `walkSpeed`
