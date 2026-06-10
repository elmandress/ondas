"use client";

import { useEffect, useRef } from "react";
import type * as L from "leaflet";
import type { VehiclePosition, BusStop } from "@/lib/stm";
import { loadRoutesCache, loadLineShapes } from "@/lib/routes-cache";
import { getNetInfo } from "@/lib/network";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

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
        <span style="color:${isSelected ? "white" : "rgba(255,255,255,0.95)"};font-weight:900;font-size:${isSelected ? 10 : 8}px;font-family:system-ui,-apple-system,sans-serif;letter-spacing:-0.3px;line-height:1;">${esc(lineName)}</span>
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
    fromStopName?: string;
    toStopName?: string;
    durationS?: number;
    distanceM?: number;
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
  const mapInstanceRef = useRef<{ map: L.Map; L: typeof import("leaflet") } | null>(null);
  const vehicleMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const stopMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const userMarkerRef = useRef<L.Marker | null>(null);
  const initializedRef = useRef(false);
  const resizeObsRef = useRef<ResizeObserver | null>(null);

  // Inicialización del mapa — solo una vez
  useEffect(() => {
    if (!mapRef.current || initializedRef.current) return;
    initializedRef.current = true;

    import("leaflet").then((L) => {
      // Fix para Next.js / webpack
      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;

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

      // Tiles CARTO según TEMA (oscuro = dark matter, claro = positron) y RED:
      //  - celular/Data Saver: 1 sola capa con labels + tiles 1x (la mitad de tiles, sin @2x).
      //  - WiFi: base sin labels + capa de labels (look más limpio) y retina.
      const net = getNetInfo();
      const lite = net.cellular || net.saveData || net.slow;
      const r = lite ? "" : "{r}"; // {r} = @2x en pantallas retina
      const light = (typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "light");
      const base = light ? "light" : "dark";
      if (lite) {
        L.tileLayer(`https://{s}.basemaps.cartocdn.com/${base}_all/{z}/{x}/{y}${r}.png`, {
          attribution: '&copy; <a href="https://carto.com">CARTO</a> &copy; OSM',
          subdomains: "abcd",
          maxZoom: 19,
        }).addTo(map);
      } else {
        L.tileLayer(`https://{s}.basemaps.cartocdn.com/${base}_nolabels/{z}/{x}/{y}${r}.png`, {
          attribution: '&copy; <a href="https://carto.com">CARTO</a> &copy; OSM',
          subdomains: "abcd",
          maxZoom: 19,
        }).addTo(map);
        L.tileLayer(`https://{s}.basemaps.cartocdn.com/${base}_only_labels/{z}/{x}/{y}${r}.png`, {
          subdomains: "abcd",
          maxZoom: 19,
          opacity: 0.7,
        }).addTo(map);
      }

      // Controles de zoom en posición no molesta
      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Click en mapa cierra selecciones
      map.on("click", onMapClick);

      // Long-press en el mapa (FR-4.1): mantiene 600ms → callback con lat/lon
      // Implementación cross-platform (mouse + touch) sin libs externas.
      let pressTimer: ReturnType<typeof setTimeout> | null = null;
      let pressStart: { lat: number; lon: number } | null = null;
      const LONG_PRESS_MS = 600;

      const startPress = (e: L.LeafletEvent) => {
        const { latlng } = e as L.LeafletMouseEvent;
        pressStart = { lat: latlng.lat, lon: latlng.lng };
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

      // El mapa vive en una tab que arranca OCULTA (opacity:0). Leaflet calcula su
      // tamaño al crearse → con la tab oculta lo calcula mal y los tiles quedan en
      // negro hasta que el usuario interactúa. Un ResizeObserver detecta cuando el
      // contenedor recupera tamaño (al activarse la tab / abrir "Ver en el mapa") y
      // fuerza invalidateSize para que repinte los tiles. Sin esto, el mapa de la
      // ruta aparecía vacío.
      if (typeof ResizeObserver !== "undefined" && mapRef.current) {
        let lastW = 0, lastH = 0;
        resizeObsRef.current = new ResizeObserver((entries) => {
          const r = entries[0]?.contentRect;
          if (!r) return;
          // Solo invalidar cuando pasa de tamaño 0 a visible, o cambia de verdad.
          if (r.width > 0 && r.height > 0 && (r.width !== lastW || r.height !== lastH)) {
            lastW = r.width; lastH = r.height;
            map.invalidateSize({ animate: false });
          }
        });
        resizeObsRef.current.observe(mapRef.current);
      }

      // Exponer API imperativa al padre. Con prefers-reduced-motion saltamos
      // las animaciones de vuelo/zoom (framer-motion ya lo respeta; Leaflet no solo).
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      onReadyRef.current?.({
        flyTo: (lat, lon, zoom = 16) => {
          if (reducedMotion) map.setView([lat, lon], zoom, { animate: false });
          else map.flyTo([lat, lon], zoom, { duration: 0.8 });
        },
        fitBounds: (coords, padding = 60) => {
          if (!coords.length) return;
          const bounds = L.latLngBounds(coords);
          map.fitBounds(bounds, { padding: [padding, padding], maxZoom: 16, animate: !reducedMotion });
        },
      });
    });

    return () => {
      if (resizeObsRef.current) {
        resizeObsRef.current.disconnect();
        resizeObsRef.current = null;
      }
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
  const placeMarkerRef = useRef<L.Marker | null>(null);
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
        <div style="font-weight:700;font-size:12px;color:#fca5a5;">${esc(placePin.name)}</div>
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
            background:${isSelected ? "rgba(240,160,32,0.92)" : "rgba(18,24,38,0.88)"};
            border:${isSelected ? "2px solid rgba(255,255,255,0.9)" : "1.5px solid rgba(148,163,184,0.35)"};
            border-radius:${isSelected ? "50%" : "8px"};
            display:flex;align-items:center;justify-content:center;
            box-shadow:${isSelected ? "0 0 0 5px rgba(240,160,32,0.28),0 4px 16px rgba(0,0,0,0.5)" : "0 2px 8px rgba(0,0,0,0.4)"};
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
          .on("click", (e: L.LeafletMouseEvent) => {
            L.DomEvent.stopPropagation(e);
            onStopSelect(stop.stopId);
          });

        marker.bindTooltip(
          `<div style="font-family:system-ui;color:#f1f5f9;min-width:140px">
            <div style="font-weight:700;font-size:12px;margin-bottom:3px;color:#f8fafc">${esc(stop.stopName)}</div>
            <div style="font-size:9px;color:#64748b">Parada #${esc(stop.stopCode)} · Tocá para ver buses</div>
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
          .on("click", (e: L.LeafletMouseEvent) => {
            L.DomEvent.stopPropagation(e);
            onVehicleSelect(vehicle.vehicleId === selectedVehicleId ? null : vehicle.vehicleId);
          });

        vehicleMarkersRef.current.set(vehicle.vehicleId, marker);
      }
    });
  }, [vehicles, selectedVehicleId, onVehicleSelect]);

  // Dibujar recorrido del bus seleccionado (polyline)
  // routes.json se cachea a nivel módulo para no re-descargarlo en cada click.
  const polylineRef = useRef<L.Polyline | null>(null);
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const { map, L } = mapInstanceRef.current;

    // Limpiar polyline previa (siempre)
    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }

    const selectedVehicle = vehicles.find((v) => v.vehicleId === selectedVehicleId);
    if (!selectedVehicle) return;

    let cancelled = false;
    Promise.all([loadRoutesCache(), loadLineShapes()]).then(([routes, lineShapes]) => {
      if (cancelled || !mapInstanceRef.current) return;
      // routes.json está keyado por cod_variante. El bus en vivo trae variantCode
      // interno (no siempre coincide) y NO siempre lo trae. Estrategia robusta:
      //  1) cod_variante directo del bus (si vino y existe);
      //  2) cualquier cod_variante de la LÍNEA via line-shapes.json (la mejor disponible);
      //  3) fallback histórico: routes[lineName].
      // Así el recorrido aparece SIEMPRE que la línea tenga shape (ej: 582 → 8922/8923),
      // sin depender de que el bus traiga variantCode. (Bug: "no se ve la ruta del bondi").
      let coords: [number, number][] | undefined =
        selectedVehicle.variantCode ? routes[String(selectedVehicle.variantCode)] : undefined;
      if (!coords) {
        const candidates = lineShapes[selectedVehicle.lineName] || [];
        for (const cv of candidates) {
          if (routes[cv]?.length) { coords = routes[cv]; break; }
        }
      }
      if (!coords) coords = routes[selectedVehicle.lineName];
      if (!coords || coords.length === 0) return;

      // noClip + smoothFactor 0 + renderer SVG: sin esto, con preferCanvas Leaflet
      // recortaba la polyline al viewport y el recorrido del bus se veía como una
      // DIAGONAL RECTA de pocos puntos en vez del trazo real (~360 pts) siguiendo las
      // calles. Mismo fix que para las rutas planificadas.
      polylineRef.current = L.polyline(coords, {
        renderer: L.svg({ padding: 0.5 }),
        noClip: true,
        smoothFactor: 0,
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
  const variantStopsLayerRef = useRef<L.LayerGroup | null>(null);
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
              <div style="font-weight:600;font-size:11px;">${esc(stop.name)}</div>
              <div style="font-size:9px;color:#64748b">#${esc(stop.code)} · parada ${stop.sequence}</div>
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
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const { map, L } = mapInstanceRef.current;

    // Limpiar capa anterior siempre
    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    if (!routeLegs || routeLegs.length === 0) return;

    // Renderer SVG dedicado para la ruta (el mapa usa preferCanvas para los buses).
    // Las polylines llevan noClip:true y smoothFactor:0 — ver nota en cada polyline.
    const svgRenderer = L.svg({ padding: 0.5 });
    const layer = L.layerGroup();
    const allCoords: [number, number][] = [];

    // Paleta para buses (sub-rotamos colores si hay varios legs de bus distintos)
    const busColors = ["#3b82f6", "#a855f7", "#f59e0b", "#ef4444"];
    let busLegIdx = 0;

    for (const leg of routeLegs) {
      if (!leg.polyline || leg.polyline.length < 2) continue;
      allCoords.push(...leg.polyline);

      if (leg.type === "walk") {
        // Caminar: línea verde punteada.
        // noClip:true → NO recortar al viewport. Si Leaflet clippeaba la polyline al
        // área visible en el momento de añadirla (antes del fitBounds final), el trazo
        // real de ~50 puntos quedaba reducido a una RECTA de 3-5 vértices (bug que el
        // usuario veía: "rutas bugeadas, marcan mal"). smoothFactor:0 → no simplificar
        // vértices, así el recorrido sigue las calles exactas del GTFS oficial.
        const line = L.polyline(leg.polyline, {
          renderer: svgRenderer,
          noClip: true,
          smoothFactor: 0,
          color: "#10b981",
          weight: 4,
          opacity: 0.9,
          dashArray: "2,8",
          lineCap: "round",
        });
        layer.addLayer(line);

        // Etiqueta "🚶 N min" en el medio del tramo a pie — deja CLARO dónde y cuánto se
        // camina (queja del usuario: "dónde hay que caminar tampoco" se entendía).
        const walkMin = leg.durationS ? Math.max(1, Math.round(leg.durationS / 60)) : null;
        if (walkMin && leg.polyline.length >= 2) {
          const mid = leg.polyline[Math.floor(leg.polyline.length / 2)];
          const walkIcon = L.divIcon({
            className: "",
            html: `
              <div style="display:flex;align-items:center;gap:5px;background:rgba(16,185,129,0.95);
                color:white;font-weight:800;font-size:10.5px;line-height:1;padding:4px 8px;border-radius:999px;
                box-shadow:0 2px 6px rgba(0,0,0,0.4);white-space:nowrap;">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="4" r="1"/><path d="m9 20 3-6 1-2"/><path d="m5 9 3 3 4-2 2 4"/><path d="M14 16l-2-2"/></svg>
                ${walkMin} min
              </div>`,
            iconSize: [60, 18],
            iconAnchor: [30, 9],
          });
          layer.addLayer(L.marker(mid, { icon: walkIcon, zIndexOffset: 1550, interactive: false }));
        }
      } else {
        // Bus: línea sólida coloreada
        const color = busColors[busLegIdx % busColors.length];
        busLegIdx++;
        // halo blanco delgado para legibilidad sobre tiles oscuros
        const halo = L.polyline(leg.polyline, {
          renderer: svgRenderer,
          noClip: true,
          smoothFactor: 0,
          color: "white",
          weight: 8,
          opacity: 0.25,
          lineCap: "round",
          lineJoin: "round",
        });
        const line = L.polyline(leg.polyline, {
          renderer: svgRenderer,
          noClip: true,
          smoothFactor: 0,
          color,
          weight: 5,
          opacity: 0.95,
          lineCap: "round",
          lineJoin: "round",
        });
        layer.addLayer(halo);
        layer.addLayer(line);

        // Marcadores de PARADA (no del bus): un círculo en la parada física donde el
        // pasajero SE SUBE / SE BAJA, con una etiqueta clara al lado. La gente camina a
        // la parada y ahí toma el bondi — el mapa debe comunicar eso, no un bus suelto.
        const lineLabel = leg.lines?.[0] || "?";
        const boardName = leg.fromStopName ? String(leg.fromStopName) : "";
        const alightName = leg.toStopName ? String(leg.toStopName) : "";

        // Punto de SUBIDA: círculo-parada + etiqueta "Subís · 100"
        if (leg.polyline.length > 0) {
          const start = leg.polyline[0];
          const boardIcon = L.divIcon({
            className: "",
            html: `
              <div style="display:flex;align-items:center;gap:0;">
                <div style="width:18px;height:18px;border-radius:50%;background:white;
                  border:4px solid ${color};box-shadow:0 2px 6px rgba(0,0,0,0.45);flex:none;"></div>
                <div style="margin-left:-2px;background:${color};color:white;font-weight:800;
                  font-size:11px;line-height:1;padding:5px 8px 5px 10px;border-radius:0 8px 8px 0;
                  box-shadow:0 2px 6px rgba(0,0,0,0.4);white-space:nowrap;">
                  Subís · ${lineLabel}
                </div>
              </div>`,
            iconSize: [80, 22],
            iconAnchor: [9, 11], // ancla en el centro del círculo (la parada)
          });
          const m = L.marker(start, { icon: boardIcon, zIndexOffset: 1700 });
          if (boardName) m.bindTooltip(`Parada: ${esc(boardName)}`, { direction: "top", offset: [0, -10] });
          layer.addLayer(m);
        }

        // Punto de BAJADA: círculo-parada hueco + etiqueta "Bajás · 100"
        if (leg.polyline.length > 1) {
          const end = leg.polyline[leg.polyline.length - 1];
          const alightIcon = L.divIcon({
            className: "",
            html: `
              <div style="display:flex;align-items:center;gap:0;">
                <div style="width:16px;height:16px;border-radius:50%;background:${color};
                  border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.45);flex:none;"></div>
                <div style="margin-left:-2px;background:rgba(15,23,42,0.96);color:${color};font-weight:800;
                  font-size:11px;line-height:1;padding:5px 8px 5px 10px;border-radius:0 8px 8px 0;
                  border:1.5px solid ${color};box-shadow:0 2px 6px rgba(0,0,0,0.4);white-space:nowrap;">
                  Bajás · ${lineLabel}
                </div>
              </div>`,
            iconSize: [80, 22],
            iconAnchor: [8, 11],
          });
          const m = L.marker(end, { icon: alightIcon, zIndexOffset: 1650 });
          if (alightName) m.bindTooltip(`Parada: ${esc(alightName)}`, { direction: "top", offset: [0, -10] });
          layer.addLayer(m);
        }
      }
    }

    // Marcadores de origen ("Salís", verde) y destino ("Llegás", rojo) — con etiqueta
    // para que se entienda de un vistazo dónde empieza y termina el viaje.
    if (routeEndpoints) {
      const originIcon = L.divIcon({
        className: "",
        html: `
          <div style="display:flex;align-items:center;gap:0;">
            <div style="width:16px;height:16px;border-radius:50%;background:#10b981;
              border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5);flex:none;"></div>
            <div style="margin-left:-2px;background:#10b981;color:white;font-weight:800;font-size:10px;
              line-height:1;padding:4px 7px 4px 9px;border-radius:0 7px 7px 0;box-shadow:0 2px 6px rgba(0,0,0,0.4);
              white-space:nowrap;">Salís</div>
          </div>`,
        iconSize: [60, 16],
        iconAnchor: [8, 8],
      });
      const destIcon = L.divIcon({
        className: "",
        html: `
          <div style="display:flex;align-items:flex-end;gap:0;">
            <div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:#ef4444;
              transform:rotate(-45deg);border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5);flex:none;"></div>
            <div style="margin-left:3px;margin-bottom:2px;background:#ef4444;color:white;font-weight:800;font-size:10px;
              line-height:1;padding:4px 8px;border-radius:7px;box-shadow:0 2px 6px rgba(0,0,0,0.4);
              white-space:nowrap;">Llegás</div>
          </div>`,
        iconSize: [70, 24],
        iconAnchor: [11, 22],
      });
      layer.addLayer(L.marker(routeEndpoints.origin, { icon: originIcon, zIndexOffset: 1600 }));
      layer.addLayer(L.marker(routeEndpoints.destination, { icon: destIcon, zIndexOffset: 1600 }));
      allCoords.push(routeEndpoints.origin, routeEndpoints.destination);
    }

    // Auto-fit del mapa a la ruta ANTES de pintar las polylines. Clave: Leaflet recorta
    // (clip) cada polyline al viewport actual al añadirla. Si añadíamos primero y hacíamos
    // fitBounds después, el path SVG quedaba clippeado al zoom/centro viejo (zoom 14
    // centrado en otra zona) → se veía como una RECTA de pocos vértices aunque la
    // polyline real tuviera 49 puntos siguiendo las calles. Posicionando el mapa primero,
    // el clip se hace contra el viewport correcto y el trazo se ve completo.
    if (allCoords.length > 0) {
      const bounds = L.latLngBounds(allCoords);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16, animate: false });
    }

    layer.addTo(map);
    routeLayerRef.current = layer;
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
