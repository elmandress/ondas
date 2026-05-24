"use client";

import { useEffect, useRef } from "react";
import type { VehiclePosition } from "@/lib/stm";
import { lineColorFromId } from "@/lib/utils";

interface LeafletMapProps {
  center: [number, number];
  vehicles: VehiclePosition[];
  selectedVehicle: string | null;
  onVehicleSelect: (id: string | null) => void;
}

export default function LeafletMap({
  center,
  vehicles,
  selectedVehicle,
  onVehicleSelect,
}: LeafletMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Importación dinámica de Leaflet
    import("leaflet").then((L) => {
      // Fix icono default leaflet con webpack
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      // Cargar CSS de Leaflet
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      const map = L.map(mapRef.current!, {
        center,
        zoom: 14,
        zoomControl: false,
        attributionControl: true,
      });

      // Tiles oscuros — CartoDB Dark Matter
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          attribution: '&copy; <a href="https://carto.com">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
          maxZoom: 19,
          subdomains: "abcd",
        }
      ).addTo(map);

      // Marcador de ubicación del usuario
      const userIcon = L.divIcon({
        className: "",
        html: `<div style="
          width:18px; height:18px;
          background:#3b82f6;
          border:3px solid #fff;
          border-radius:50%;
          box-shadow: 0 0 0 6px rgba(59,130,246,0.25);
        "></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      L.marker(center, { icon: userIcon, zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup("<strong>Tu ubicación</strong>");

      mapInstanceRef.current = { map, L };
    });

    return () => {
      if (mapInstanceRef.current?.map) {
        mapInstanceRef.current.map.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Actualizar marcadores de vehículos cuando cambian
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const { map, L } = mapInstanceRef.current;

    // Eliminar marcadores de vehículos que ya no existen
    const currentIds = new Set(vehicles.map((v) => v.vehicleId));
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        map.removeLayer(marker);
        markersRef.current.delete(id);
      }
    });

    // Crear o actualizar marcadores
    vehicles.forEach((vehicle) => {
      const color = lineColorFromId(vehicle.lineId);
      const isSelected = vehicle.vehicleId === selectedVehicle;

      const busIcon = L.divIcon({
        className: "",
        html: `<div style="
          position:relative;
          width:${isSelected ? 42 : 34}px;
          height:${isSelected ? 42 : 34}px;
          background:${color}${isSelected ? "ff" : "cc"};
          border:${isSelected ? "3px" : "2px"} solid ${isSelected ? "#fff" : color}99;
          border-radius:${isSelected ? "12px" : "10px"};
          display:flex;
          align-items:center;
          justify-content:center;
          color:white;
          font-weight:900;
          font-size:${isSelected ? "11px" : "9px"};
          font-family:system-ui;
          box-shadow:0 4px 16px ${color}66;
          transform:rotate(${vehicle.bearing}deg);
          transition:all 0.3s ease;
          cursor:pointer;
        ">
          ${vehicle.lineName}
        </div>`,
        iconSize: [isSelected ? 42 : 34, isSelected ? 42 : 34],
        iconAnchor: [isSelected ? 21 : 17, isSelected ? 21 : 17],
      });

      const existing = markersRef.current.get(vehicle.vehicleId);
      if (existing) {
        existing.setLatLng([vehicle.lat, vehicle.lon]);
        existing.setIcon(busIcon);
      } else {
        const marker = L.marker([vehicle.lat, vehicle.lon], { icon: busIcon })
          .addTo(map)
          .on("click", () => {
            onVehicleSelect(vehicle.vehicleId === selectedVehicle ? null : vehicle.vehicleId);
          });
        markersRef.current.set(vehicle.vehicleId, marker);
      }
    });
  }, [vehicles, selectedVehicle, onVehicleSelect]);

  return (
    <div
      ref={mapRef}
      className="w-full h-full"
      style={{ minHeight: "100%" }}
    />
  );
}
