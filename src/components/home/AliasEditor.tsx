"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { setFavoriteAlias, SPECIAL_ALIASES, aliasIcon } from "@/lib/favorite-stops";

interface Props {
  stopId: string;
  stopName: string;
  currentAlias?: string;
  onClose: () => void;
}

/**
 * Modal pequeño para ponerle nombre/etiqueta a una parada favorita.
 * Sugerencias rápidas: Casa, Trabajo, Facu. Custom text input también.
 * Feedback de Guille (futuro de Matungos): "atajos Mi Casa / Mi Trabajo".
 */
export default function AliasEditor({ stopId, stopName, currentAlias, onClose }: Props) {
  const [custom, setCustom] = useState(currentAlias || "");

  function apply(alias: string | undefined) {
    setFavoriteAlias(stopId, alias);
    onClose();
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-[6px] z-[1100]"
      />
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        transition={{ type: "spring", damping: 26, stiffness: 320 }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[1101] w-[min(360px,90vw)]"
      >
        <div className="bg-[#0a0f1c] border border-white/[0.1] rounded-2xl p-5 shadow-[0_20px_60px_rgba(0,0,0,0.7)]">
          <p className="text-[11px] font-black uppercase tracking-[0.15em] text-amber-400 mb-1">Etiqueta</p>
          <p className="text-sm text-white font-bold mb-1 truncate">{stopName}</p>
          <p className="text-[11px] text-slate-500 mb-4">Poné un nombre para acceder rápido</p>

          {/* Atajos */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {SPECIAL_ALIASES.map((s) => (
              <button
                key={s}
                onClick={() => apply(s)}
                className="flex flex-col items-center gap-1 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors"
              >
                <span className="text-xl">{aliasIcon(s)}</span>
                <span className="text-[11px] text-slate-300 font-medium">{s}</span>
              </button>
            ))}
          </div>

          {/* Custom */}
          <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-1.5 font-bold">O personalizado</p>
          <input
            type="text"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="ej. Gym, Liceo, Casa de mamá…"
            maxLength={20}
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500/40 mb-3"
          />

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-400 bg-white/[0.04] border border-white/[0.06]"
            >
              Cancelar
            </button>
            {currentAlias && (
              <button
                onClick={() => apply(undefined)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-300 bg-white/[0.04] border border-white/[0.06]"
              >
                Quitar
              </button>
            )}
            <button
              onClick={() => apply(custom || undefined)}
              disabled={!custom}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 disabled:bg-white/[0.04]"
              style={{ background: custom ? "var(--accent)" : undefined }}
            >
              Guardar
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
