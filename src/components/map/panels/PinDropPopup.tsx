"use client";

/**
 * Popup del long-press en el mapa (FR-4.1): elegir el punto fijado como
 * origen/destino de Cómo Llegar. El estado del pin (coords + nombre
 * reverse-geocodeado) vive en MapScreen porque también lo usa LeafletMap
 * para dibujar el marcador.
 */
import { motion } from "framer-motion";
import { setRouteInput } from "@/lib/route-input";
import { setActiveTab } from "@/lib/active-tab";

interface Props {
  pin: { lat: number; lon: number };
  /** null = reverse-geocode en curso ("Buscando dirección…") */
  pinName: string | null;
  onClose: () => void;
}

export default function PinDropPopup({ pin, pinName, onClose }: Props) {
  function pick(slot: "from" | "to") {
    setRouteInput({ slot, point: { lat: pin.lat, lon: pin.lon, name: pinName ?? "Punto en el mapa" } });
    onClose();
    setActiveTab("route");
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="absolute left-3 right-3 z-[1005]"
      style={{ top: "calc(env(safe-area-inset-top) + 70px)" }}
    >
      <div className="bg-[#0a0f1c]/97 backdrop-blur-xl p-3 border border-amber-500/30" style={{ borderRadius: "var(--r-card)", boxShadow: "var(--shadow-card)" }}>
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-400 mb-1">Punto seleccionado</p>
        <p className="text-[12px] text-white font-semibold mb-0.5 truncate">
          {pinName ?? "Buscando dirección…"}
        </p>
        <p className="text-[10px] text-slate-500 mb-2.5">
          {pin.lat.toFixed(4)}, {pin.lon.toFixed(4)}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => pick("from")}
            className="flex-1 py-2 rounded-xl text-xs font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30"
          >
            Desde aquí
          </button>
          <button
            onClick={() => pick("to")}
            className="flex-1 py-2 rounded-xl text-xs font-bold text-red-300 bg-red-500/15 border border-red-500/30"
          >
            Hasta aquí
          </button>
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 bg-white/[0.05]"
          >
            Cerrar
          </button>
        </div>
      </div>
    </motion.div>
  );
}
