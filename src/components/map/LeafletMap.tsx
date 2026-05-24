"use client";

import { useEffect, useRef, useCallback } from "react";
import type { VehiclePosition, BusStop } from "@/lib/stm";
import { lineColorFromCode } from "@/lib/stm";

interface LeafletMapProps {
  center: [number, number];
  vehicles: VehiclePosition[];
  stops: BusStop[];
  selectedStopId: string | null;
  selectedVehicleId: string | null;
  onStopSelect: (stopId: string) => void;
  onVehicleSelect: (vehicleId: string | null) => void;
  onMapClick: () => void;
}

export default function LeafletMap({
  center,
  vehicles,
  stops,
  selectedStopId,
  selectedVehicleId,
  onStopSelect,
  onVehicleSelect,
  onMapClick,
}: LeafletMapProps) {
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

      mapInstanceRef.current = { map, L };
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

      const stopIcon = L.divIcon({
        className: "",
        html: `
          <div style="
            width:${isSelected ? 40 : 28}px;
            height:${isSelected ? 40 : 28}px;
            background:${isSelected ? "#3b82f6" : "rgba(30,41,59,0.9)"};
            border:${isSelected ? "2.5px solid white" : "1.5px solid rgba(100,116,139,0.5)"};
            border-radius:${isSelected ? "12px" : "8px"};
            display:flex;align-items:center;justify-content:center;
            box-shadow:${isSelected ? "0 0 0 4px rgba(59,130,246,0.3),0 4px 16px rgba(0,0,0,0.4)" : "0 2px 8px rgba(0,0,0,0.3)"};
            transition:all 0.2s ease;
            cursor:pointer;
          ">
            <svg width="${isSelected ? 18 : 13}" height="${isSelected ? 18 : 13}" viewBox="0 0 24 24" fill="none" stroke="${isSelected ? "white" : "#94a3b8"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="6" width="20" height="12" rx="2"/>
              <path d="M22 10H2"/>
              <circle cx="7" cy="18" r="1.5" fill="${isSelected ? "white" : "#94a3b8"}"/>
              <circle cx="17" cy="18" r="1.5" fill="${isSelected ? "white" : "#94a3b8"}"/>
            </svg>
          </div>
        `,
        iconSize: [isSelected ? 40 : 28, isSelected ? 40 : 28],
        iconAnchor: [isSelected ? 20 : 14, isSelected ? 20 : 14],
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

        // Tooltip con nombre y líneas
        const linesHtml = stop.lines.slice(0, 4).map(l =>
          `<span style="background:${lineColorFromCode(l)}33;border:1px solid ${lineColorFromCode(l)}66;color:${lineColorFromCode(l)};padding:1px 5px;border-radius:4px;font-size:10px;font-weight:700">${l}</span>`
        ).join(" ");

        marker.bindTooltip(
          `<div style="font-family:system-ui;color:#f1f5f9">
            <div style="font-weight:600;font-size:13px;margin-bottom:4px">${stop.stopName}</div>
            <div style="display:flex;gap:4px;flex-wrap:wrap">${linesHtml}</div>
          </div>`,
          { direction: "top", className: "leaflet-tooltip-dark", offset: [0, -8] }
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
      const color = lineColorFromCode(vehicle.lineId);
      const isSelected = vehicle.vehicleId === selectedVehicleId;

      const size = isSelected ? 44 : 32;
      const busIcon = L.divIcon({
        className: "",
        html: `
          <div style="
            width:${size}px;height:${size}px;
            background:${color}${isSelected ? "ff" : "dd"};
            border:${isSelected ? "2.5px solid white" : "1.5px solid " + color + "88"};
            border-radius:${isSelected ? "14px" : "10px"};
            display:flex;align-items:center;justify-content:center;
            color:white;font-weight:900;font-size:${isSelected ? 11 : 9}px;
            font-family:system-ui;letter-spacing:-0.5px;
            box-shadow:0 ${isSelected ? 6 : 3}px ${isSelected ? 20 : 10}px ${color}55;
            transform:rotate(${vehicle.bearing}deg);
            transition:all 0.3s ease;
            cursor:pointer;
          ">${vehicle.lineName}</div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
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
