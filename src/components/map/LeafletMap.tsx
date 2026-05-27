"use client";

import { useEffect, useRef } from "react";
import type { VehiclePosition, BusStop } from "@/lib/stm";
import { loadRoutesCache } from "@/lib/routes-cache";

// Unified bus icon — white bus silhouette on a dark pill, with line number below
/** Color determinístico para una línea (hash → HSL). Igual que lineColorFromCode pero local. */
function colorForLine(line: string): string {
  // Colores conocidos para líneas comunes
  const knownColors: Record<string, string> = {
    "76": "#ef4444", "187": "#a855f7", "329": "#3b82f6",
    "103": "#10b981", "104": "#f59e0b", "105": "#ec4899",
    "109": "#06b6d4", "110": "#8b5cf6", "111": "#22c55e",
    "180": "#f97316", "181": "#0ea5e9", "183": "#facc15",
    "188": "#84cc16",
  };
  if (knownColors[line]) return knownColors[line];
  // Hash a HSL para líneas sin color asignado
  let h = 0;
  for (let i = 0; i < line.length; i++) h = (h * 31 + line.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360},70%,60%)`;
}

function busIconHtml(lineName: string, isSelected: boolean): string {
  const w = isSelected ? 46 : 34;
  const h = isSelected ? 54 : 42;
  const color = colorForLine(lineName);
  const pulse = isSelected ? `<div style="position:absolute;inset:-6px;border-radius:18px;border:2px solid ${color}cc;animation:pulse-ring 1.8s ease-out infinite;pointer-events:none;"></div>` : "";
  return `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;">
      ${pulse}
      <div style="
        width:${w}px;height:${h}px;
        background:${isSelected ? color : "rgba(18,24,38,0.92)"};
        border:${isSelected ? `2px solid white` : `1.5px solid ${color}`};
        border-radius:${isSelected ? "16px" : "12px"};
        display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;
        box-shadow:${isSelected ? `0 0 0 3px ${color}55,0 8px 24px rgba(0,0,0,0.5)` : "0 3px 10px rgba(0,0,0,0.45)"};
        cursor:pointer;
        backdrop-filter:blur(8px);
      ">
        <svg width="${isSelected ? 20 : 15}" height="${isSelected ? 20 : 15}" viewBox="0 0 24 24" fill="none" stroke="${isSelected ? "white" : color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="4" width="20" height="14" rx="2"/>
          <path d="M22 9H2"/>
          <circle cx="7" cy="19" r="1.5" fill="${isSelected ? "white" : color}"/>
          <circle cx="17" cy="19" r="1.5" fill="${isSelected ? "white" : color}"/>
        </svg>
        <span style="color:${isSelected ? "white" : "rgba(255,255,255,0.95)"};font-weight:900;font-size:${isSelected ? 10 : 8}px;font-family:system-ui,-apple-system,sans-serif;letter-spacing:-0.3px;line-height:1;">${lineName}</span>
      </div>
    </div>
    <style>
      @keyframes pulse-ring{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.5);opacity:0}}
    </style>
  `;
}

interface LeafletMapProps {
  center: [number, number];
  vehicles: VehiclePosition[];
  stops: BusStop[];
  selectedStopId: string | null;
  selectedVehicleId: string | null;
  /** Pin opcional para un lugar buscado (FR-3.8). */
  placePin?: { lat: number; lon: number; name: string; icon?: string } | null;
  /** Legs de una ruta planificada para dibujar en el mapa (FR-4 visualización).
   *  Cada leg tiene polyline + tipo. Se dibujan con estilos diferenciados:
   *   - walk: línea verde punteada
   *   - bus:  línea azul gruesa
   */
  routeLegs?: Array<{
    type: "walk" | "bus";
    polyline?: [number, number][];
    lines?: string[];
  }> | null;
  /** Origen y destino de la ruta planificada (para marcadores especiales). */
  routeEndpoints?: { origin: [number, number]; destination: [number, number] } | null;
  onStopSelect: (stopId: string) => void;
  onVehicleSelect: (vehicleId: string | null) => void;
  onMapClick: () => void;
  /** Callback de long-press (≥500ms tocando un punto del mapa). FR-4.1. */
  onMapLongPress?: (lat: number, lon: number) => void;
  onBoundsChange?: (bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number; zoom: number }) => void;
  /** Callback que se invoca con una función `(lat, lon, zoom?) => void` para que el padre pueda centrar el mapa.
   *  Incluye también fitBounds. */
  onReady?: (api: {
    flyTo: (lat: number, lon: number, zoom?: number) => void;
    fitBounds: (coords: [number, number][], padding?: number) => void;
  }) => void;
}

export default function LeafletMap({
  center,
  vehicles,
  stops,
  selectedStopId,
  selectedVehicleId,
  placePin,
  routeLegs,
  routeEndpoints,
  onStopSelect,
  onVehicleSelect,
  onMapClick,
  onMapLongPress,
  onBoundsChange,
  onReady,
}: LeafletMapProps) {
  const onBoundsChangeRef = useRef(onBoundsChange);
  onBoundsChangeRef.current = onBoundsChange;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onLongPressRef = useRef(onMapLongPress);
  onLongPressRef.current = onMapLongPress;
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<{ map: any; L: any } | null>(null);
  const vehicleMarkersRef = useRef<Map<string, any>>(new Map());
  const stopMarkersRef = useRef<Map<string, any>>(new Map());
  const userMarkerRef = useRef<any>(null);
  const initializedRef = useRef(false);

  // Inicialización del mapa — solo una vez
  useEffect(() => {
    if (!mapRef.current || initializedRef.current) return;
    initializedRef.current = true;

    import("leaflet").then((L) => {
      // Fix para Next.js / webpack
      delete (L.Icon.Default.prototype as any)._getIconUrl;

      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      if (!mapRef.current) return;

      const map = L.map(mapRef.current, {
        center,
        zoom: 14,
        zoomControl: false,
        attributionControl: true,
        preferCanvas: true, // mejor performance para muchos marcadores
      });

      // Tiles CartoDB Dark Matter — sin labels molestos
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
        {
          attribution: '&copy; <a href="https://carto.com">CARTO</a> &copy; OSM',
          subdomains: "abcd",
          maxZoom: 19,
        }
      ).addTo(map);

      // Labels layer encima (separado para mayor control visual)
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png",
        { subdomains: "abcd", maxZoom: 19, opacity: 0.7 }
      ).addTo(map);

      // Controles de zoom en posición no molesta
      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Click en mapa cierra selecciones
      map.on("click", onMapClick);

      // Long-press en el mapa (FR-4.1): mantiene 600ms → callback con lat/lon
      // Implementación cross-platform (mouse + touch) sin libs externas.
      let pressTimer: ReturnType<typeof setTimeout> | null = null;
      let pressStart: { lat: number; lon: number } | null = null;
      const LONG_PRESS_MS = 600;

      const startPress = (e: any) => {
        pressStart = { lat: e.latlng.lat, lon: e.latlng.lng };
        pressTimer = setTimeout(() => {
          if (pressStart && onLongPressRef.current) {
            onLongPressRef.current(pressStart.lat, pressStart.lon);
          }
          pressTimer = null;
        }, LONG_PRESS_MS);
      };
      const cancelPress = () => {
        if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
        pressStart = null;
      };
      map.on("mousedown", startPress);
      map.on("touchstart", startPress);
      map.on("mouseup", cancelPress);
      map.on("touchend", cancelPress);
      map.on("touchcancel", cancelPress);
      map.on("dragstart", cancelPress);
      map.on("movestart", cancelPress);
      map.on("zoomstart", cancelPress);

      // Reportar bounds en cada move/zoom
      const emitBounds = () => {
        const b = map.getBounds();
        const zoom = map.getZoom();
        onBoundsChangeRef.current?.({
          minLat: b.getSouth(),
          maxLat: b.getNorth(),
          minLon: b.getWest(),
          maxLon: b.getEast(),
          zoom,
        });
      };
      map.on("moveend", emitBounds);
      map.on("zoomend", emitBounds);
      // emit inicial
      setTimeout(emitBounds, 0);

      mapInstanceRef.current = { map, L };

      // Exponer API imperativa al padre
      onReadyRef.current?.({
        flyTo: (lat, lon, zoom = 16) => {
          map.flyTo([lat, lon], zoom, { duration: 0.8 });
        },
        fitBounds: (coords, padding = 60) => {
          if (!coords.length) return;
          const bounds = L.latLngBounds(coords);
          map.fitBounds(bounds, { padding: [padding, padding], maxZoom: 16 });
        },
      });
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.map.remove();
        mapInstanceRef.current = null;
        vehicleMarkersRef.current.clear();
        stopMarkersRef.current.clear();
        initializedRef.current = false;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Actualizar marcador de usuario
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const { map, L } = mapInstanceRef.current;

    const userIcon = L.divIcon({
      className: "",
      html: `
        <div style="position:relative;width:20px;height:20px;">
          <div style="position:absolute;inset:0;border-radius:50%;background:rgba(59,130,246,0.25);animation:ping 1.5s ease-out infinite;"></div>
          <div style="position:absolute;inset:3px;border-radius:50%;background:#3b82f6;border:2.5px solid white;box-shadow:0 2px 8px rgba(59,130,246,0.6);"></div>
        </div>
        <style>@keyframes ping{0%{transform:scale(1);opacity:.8}100%{transform:scale(2.5);opacity:0}}</style>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng(center);
    } else {
      userMarkerRef.current = L.marker(center, { icon: userIcon, zIndexOffset: 2000 })
        .addTo(map)
        .bindTooltip("Tu ubicación", { permanent: false, direction: "top" });
    }
  }, [center]);

  // Pin para lugar buscado (FR-3.8) — marker rojo destacado encima de todo
  const placeMarkerRef = useRef<any>(null);
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const { map, L } = mapInstanceRef.current;

    // Limpiar el pin anterior siempre
    if (placeMarkerRef.current) {
      map.removeLayer(placeMarkerRef.current);
      placeMarkerRef.current = null;
    }

    if (!placePin) return;

    const placeIcon = L.divIcon({
      className: "",
      html: `
        <div style="position:relative;width:36px;height:48px;">
          <div style="position:absolute;left:50%;top:0;transform:translateX(-50%);width:36px;height:36px;border-radius:50% 50% 50% 0;transform-origin:center;rotate:-45deg;background:linear-gradient(135deg,#dc2626,#991b1b);border:2px solid white;box-shadow:0 4px 12px rgba(220,38,38,0.55);display:flex;align-items:center;justify-content:center;">
            <span style="rotate:45deg;font-size:16px;line-height:1;">${placePin.icon || "📍"}</span>
          </div>
          <div style="position:absolute;left:50%;bottom:-4px;transform:translateX(-50%);width:14px;height:6px;border-radius:50%;background:rgba(0,0,0,0.35);filter:blur(2px);"></div>
        </div>
      `,
      iconSize: [36, 48],
      iconAnchor: [18, 46], // punta del pin abajo
    });

    placeMarkerRef.current = L.marker([placePin.lat, placePin.lon], {
      icon: placeIcon,
      zIndexOffset: 2500, // encima de paradas/buses
    }).addTo(map);

    placeMarkerRef.current.bindTooltip(
      `<div style="font-family:system-ui;color:#f1f5f9;min-width:140px">
        <div style="font-weight:700;font-size:12px;color:#fca5a5;">${placePin.name}</div>
      </div>`,
      { direction: "top", className: "leaflet-tooltip-dark", offset: [0, -38], permanent: false }
    );
  }, [placePin]);

  // Actualizar marcadores de PARADAS
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const { map, L } = mapInstanceRef.current;

    // Limpiar paradas que ya no existen
    const currentStopIds = new Set(stops.map((s) => s.stopId));
    stopMarkersRef.current.forEach((marker, id) => {
      if (!currentStopIds.has(id)) {
        map.removeLayer(marker);
        stopMarkersRef.current.delete(id);
      }
    });

    stops.forEach((stop) => {
      const isSelected = stop.stopId === selectedStopId;

      const sz = isSelected ? 38 : 26;
      const stopIcon = L.divIcon({
        className: "",
        html: `
          <div style="
            width:${sz}px;height:${sz}px;
            background:${isSelected ? "rgba(59,130,246,0.9)" : "rgba(18,24,38,0.88)"};
            border:${isSelected ? "2px solid rgba(255,255,255,0.9)" : "1.5px solid rgba(148,163,184,0.35)"};
            border-radius:${isSelected ? "50%" : "8px"};
            display:flex;align-items:center;justify-content:center;
            box-shadow:${isSelected ? "0 0 0 5px rgba(59,130,246,0.25),0 4px 16px rgba(0,0,0,0.5)" : "0 2px 8px rgba(0,0,0,0.4)"};
            cursor:pointer;
            backdrop-filter:blur(6px);
          ">
            <svg width="${isSelected ? 17 : 12}" height="${isSelected ? 17 : 12}" viewBox="0 0 24 24" fill="none" stroke="${isSelected ? "white" : "#94a3b8"}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="4" width="20" height="14" rx="2"/>
              <path d="M22 9H2"/>
              <circle cx="7" cy="19" r="1.5" fill="${isSelected ? "white" : "#94a3b8"}"/>
              <circle cx="17" cy="19" r="1.5" fill="${isSelected ? "white" : "#94a3b8"}"/>
            </svg>
          </div>
        `,
        iconSize: [sz, sz],
        iconAnchor: [sz / 2, sz / 2],
      });

      const existing = stopMarkersRef.current.get(stop.stopId);
      if (existing) {
        existing.setIcon(stopIcon);
      } else {
        const marker = L.marker([stop.stopLat, stop.stopLon], {
          icon: stopIcon,
          zIndexOffset: isSelected ? 500 : 100,
        })
          .addTo(map)
          .on("click", (e: any) => {
            L.DomEvent.stopPropagation(e);
            onStopSelect(stop.stopId);
          });

        marker.bindTooltip(
          `<div style="font-family:system-ui;color:#f1f5f9;min-width:140px">
            <div style="font-weight:700;font-size:12px;margin-bottom:3px;color:#f8fafc">${stop.stopName}</div>
            <div style="font-size:9px;color:#64748b">Parada #${stop.stopCode} · Tocá para ver buses</div>
          </div>`,
          { direction: "top", className: "leaflet-tooltip-dark", offset: [0, -10] }
        );

        stopMarkersRef.current.set(stop.stopId, marker);
      }
    });
  }, [stops, selectedStopId, onStopSelect]);

  // Actualizar marcadores de BUSES en tiempo real
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const { map, L } = mapInstanceRef.current;

    const currentVehicleIds = new Set(vehicles.map((v) => v.vehicleId));
    vehicleMarkersRef.current.forEach((marker, id) => {
      if (!currentVehicleIds.has(id)) {
        map.removeLayer(marker);
        vehicleMarkersRef.current.delete(id);
      }
    });

    vehicles.forEach((vehicle) => {
      const isSelected = vehicle.vehicleId === selectedVehicleId;

      const w = isSelected ? 46 : 34;
      const h = isSelected ? 54 : 42;
      const busIcon = L.divIcon({
        className: "",
        html: busIconHtml(vehicle.lineName, isSelected),
        iconSize: [w, h],
        iconAnchor: [w / 2, h / 2],
      });

      const existing = vehicleMarkersRef.current.get(vehicle.vehicleId);
      if (existing) {
        existing.setLatLng([vehicle.lat, vehicle.lon]);
        existing.setIcon(busIcon);
      } else {
        const marker = L.marker([vehicle.lat, vehicle.lon], {
          icon: busIcon,
          zIndexOffset: isSelected ? 1000 : 200,
        })
          .addTo(map)
          .on("click", (e: any) => {
            L.DomEvent.stopPropagation(e);
            onVehicleSelect(vehicle.vehicleId === selectedVehicleId ? null : vehicle.vehicleId);
          });

        vehicleMarkersRef.current.set(vehicle.vehicleId, marker);
      }
    });
  }, [vehicles, selectedVehicleId, onVehicleSelect]);

  // Dibujar recorrido del bus seleccionado (polyline)
  // routes.json se cachea a nivel módulo para no re-descargarlo en cada click.
  const polylineRef = useRef<any>(null);
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const { map, L } = mapInstanceRef.current;

    // Limpiar polyline previa (siempre)
    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }

    const selectedVehicle = vehicles.find((v) => v.vehicleId === selectedVehicleId);
    if (!selectedVehicle || !selectedVehicle.variantCode) return;

    let cancelled = false;
    loadRoutesCache().then((routes) => {
      if (cancelled || !mapInstanceRef.current) return;
      // Busca por variantCode primero (ej "9220"), fallback por nombre de línea (ej "76")
      // El fallback cubre variantes nuevas que no están en el shapefile (ej: 9221 → usa polyline de 76)
      const variantKey = String(selectedVehicle.variantCode);
      const coords = routes[variantKey] || routes[selectedVehicle.lineName];
      if (!coords || coords.length === 0) return;

      polylineRef.current = L.polyline(coords, {
        color: "#60a5fa",
        weight: 4,
        opacity: 0.85,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedVehicleId, vehicles]);

  // SRS FR-5.4: dibujar puntos de TODAS las paradas del trip del bondi seleccionado
  const variantStopsLayerRef = useRef<any>(null);
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const { map, L } = mapInstanceRef.current;

    // Limpiar capa anterior
    if (variantStopsLayerRef.current) {
      map.removeLayer(variantStopsLayerRef.current);
      variantStopsLayerRef.current = null;
    }

    const selectedVehicle = vehicles.find((v) => v.vehicleId === selectedVehicleId);
    if (!selectedVehicle) return;

    let cancelled = false;
    const params = new URLSearchParams({
      line: selectedVehicle.lineName,
      destination: selectedVehicle.destinoDesc || "",
    });
    fetch(`/api/stm/variant-stops?${params}`)
      .then((r) => r.json())
      .then((data: { stops?: Array<{ sequence: number; name: string; code: string; lat: number; lon: number }>; directionId?: number }) => {
        if (cancelled || !mapInstanceRef.current || !data.stops) return;
        // Color por sentido: 0=ida verde, 1=vuelta rojo (inspirado en v3.17 Matungos)
        const dirColor = data.directionId === 0 ? "#22c55e" : data.directionId === 1 ? "#f87171" : "#60a5fa";

        // Si ya hay una polyline del bus, recolorearla según sentido
        if (polylineRef.current) {
          polylineRef.current.setStyle({ color: dirColor });
        }

        const layer = L.layerGroup();
        for (const stop of data.stops) {
          const dot = L.circleMarker([stop.lat, stop.lon], {
            radius: 4,
            color: dirColor,
            fillColor: "#1e293b",
            fillOpacity: 0.95,
            weight: 1.5,
            opacity: 0.7,
          });
          dot.bindTooltip(
            `<div style="font-family:system-ui;color:#f1f5f9;min-width:140px">
              <div style="font-weight:600;font-size:11px;">${stop.name}</div>
              <div style="font-size:9px;color:#64748b">#${stop.code} · parada ${stop.sequence}</div>
            </div>`,
            { direction: "top", className: "leaflet-tooltip-dark", offset: [0, -6] }
          );
          layer.addLayer(dot);
        }
        layer.addTo(map);
        variantStopsLayerRef.current = layer;
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [selectedVehicleId, vehicles]);

  // SRS FR-4: dibujar polylines de la ruta planificada en Cómo Llegar
  const routeLayerRef = useRef<any>(null);
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const { map, L } = mapInstanceRef.current;

    // Limpiar capa anterior siempre
    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    if (!routeLegs || routeLegs.length === 0) return;

    const layer = L.layerGroup();
    const allCoords: [number, number][] = [];

    // Paleta para buses (sub-rotamos colores si hay varios legs de bus distintos)
    const busColors = ["#3b82f6", "#a855f7", "#f59e0b", "#ef4444"];
    let busLegIdx = 0;

    for (const leg of routeLegs) {
      if (!leg.polyline || leg.polyline.length < 2) continue;
      allCoords.push(...leg.polyline);

      if (leg.type === "walk") {
        // Caminar: línea verde punteada
        const line = L.polyline(leg.polyline, {
          color: "#10b981",
          weight: 4,
          opacity: 0.9,
          dashArray: "2,8",
          lineCap: "round",
        });
        layer.addLayer(line);
      } else {
        // Bus: línea sólida coloreada
        const color = busColors[busLegIdx % busColors.length];
        busLegIdx++;
        // halo blanco delgado para legibilidad sobre tiles oscuros
        const halo = L.polyline(leg.polyline, {
          color: "white",
          weight: 8,
          opacity: 0.25,
          lineCap: "round",
          lineJoin: "round",
        });
        const line = L.polyline(leg.polyline, {
          color,
          weight: 5,
          opacity: 0.95,
          lineCap: "round",
          lineJoin: "round",
        });
        layer.addLayer(halo);
        layer.addLayer(line);

        // Marcador en parada de subida y bajada
        const lineLabel = leg.lines?.[0] || "?";
        if (leg.polyline.length > 0) {
          const start = leg.polyline[0];
          const startIcon = L.divIcon({
            className: "",
            html: `
              <div style="background:${color};color:white;font-weight:900;font-size:10px;
                padding:4px 6px;border-radius:8px;border:2px solid white;
                box-shadow:0 2px 6px rgba(0,0,0,0.4);white-space:nowrap;">
                ⇧ ${lineLabel}
              </div>`,
            iconSize: [40, 22],
            iconAnchor: [20, 11],
          });
          layer.addLayer(L.marker(start, { icon: startIcon, zIndexOffset: 1500 }));
        }
        if (leg.polyline.length > 1) {
          const end = leg.polyline[leg.polyline.length - 1];
          const endIcon = L.divIcon({
            className: "",
            html: `
              <div style="background:rgba(15,23,42,0.95);color:${color};font-weight:900;font-size:10px;
                padding:4px 6px;border-radius:8px;border:2px solid ${color};
                box-shadow:0 2px 6px rgba(0,0,0,0.4);white-space:nowrap;">
                ⇩ ${lineLabel}
              </div>`,
            iconSize: [40, 22],
            iconAnchor: [20, 11],
          });
          layer.addLayer(L.marker(end, { icon: endIcon, zIndexOffset: 1500 }));
        }
      }
    }

    // Marcadores de origen (verde) y destino (rojo)
    if (routeEndpoints) {
      const originIcon = L.divIcon({
        className: "",
        html: `
          <div style="width:18px;height:18px;border-radius:50%;background:#10b981;
            border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5);"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      const destIcon = L.divIcon({
        className: "",
        html: `
          <div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:#ef4444;
            transform:rotate(-45deg);border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5);"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 22],
      });
      layer.addLayer(L.marker(routeEndpoints.origin, { icon: originIcon, zIndexOffset: 1600 }));
      layer.addLayer(L.marker(routeEndpoints.destination, { icon: destIcon, zIndexOffset: 1600 }));
      allCoords.push(routeEndpoints.origin, routeEndpoints.destination);
    }

    layer.addTo(map);
    routeLayerRef.current = layer;

    // Auto-fit del mapa a la ruta completa
    if (allCoords.length > 0) {
      const bounds = L.latLngBounds(allCoords);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
    }
  }, [routeLegs, routeEndpoints]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />

      {/* CSS para tooltips personalizados */}
      <style jsx global>{`
        .leaflet-tooltip-dark {
          background: rgba(8, 13, 26, 0.95) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          border-radius: 10px !important;
          color: #f1f5f9 !important;
          padding: 8px 12px !important;
          font-family: system-ui !important;
          box-shadow: 0 8px 24px rgba(0,0,0,0.4) !important;
          backdrop-filter: blur(12px);
        }
        .leaflet-tooltip-dark::before {
          border-top-color: rgba(255,255,255,0.1) !important;
        }
        .leaflet-control-zoom {
          border: none !important;
          box-shadow: none !important;
        }
        .leaflet-control-zoom a {
          background: rgba(8,13,26,0.9) !important;
          color: #94a3b8 !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          border-radius: 10px !important;
          margin-bottom: 4px !important;
          width: 32px !important;
          height: 32px !important;
          line-height: 30px !important;
          display: block !important;
        }
        .leaflet-control-zoom a:hover {
          background: rgba(30,41,59,0.95) !important;
          color: #f1f5f9 !important;
        }
        .leaflet-control-attribution {
          background: rgba(8,13,26,0.7) !important;
          color: #475569 !important;
          font-size: 8px !important;
        }
        .leaflet-control-attribution a {
          color: #64748b !important;
        }
      `}</style>
    </div>
  );
}
