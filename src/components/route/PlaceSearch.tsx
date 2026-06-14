"use client";

/**
 * Panel de búsqueda de lugares del planificador: input con voz, atajos
 * ("Mi ubicación", "Elegir en el mapa"), historial y resultados.
 * El estado de búsqueda (query/sugerencias/voz) vive en RouteScreen porque el
 * mismo buscador sirve para Desde/Hacia/waypoints (activeInput compartido).
 */
import { motion, AnimatePresence } from "framer-motion";
import { Icons } from "@/components/brand/Icons";
import type { Place } from "@/components/route/types";

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  placeholder: string;
  /** Atajo "Mi ubicación" (solo con GPS y buscando el origen). null lo oculta. */
  myLocation: Place | null;
  history: Place[];
  suggestions: Place[];
  searching: boolean;
  /** false hasta el mount (el botón de voz depende de APIs del navegador). */
  voiceReady: boolean;
  voiceListening: boolean;
  onVoiceToggle: () => void;
  voiceError: string | null;
  onCancel: () => void;
  onPick: (place: Place) => void;
  onChooseOnMap: () => void;
}

export default function PlaceSearch({
  query, onQueryChange, placeholder, myLocation, history, suggestions, searching,
  voiceReady, voiceListening, onVoiceToggle, voiceError, onCancel, onPick, onChooseOnMap,
}: Props) {
  return (
    <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
      <div className="card-soft px-3 py-2 flex items-center gap-2">
        <svg className="w-4 h-4 text-slate-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          autoFocus
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 min-w-0 bg-transparent outline-none text-body text-white placeholder:text-slate-600"
        />
        {voiceReady && (
          <button
            onClick={(e) => { e.stopPropagation(); onVoiceToggle(); }}
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
            style={{
              background: voiceListening
                ? "rgba(239,68,68,0.2)"
                : "rgba(255,255,255,0.05)",
            }}
            aria-label={voiceListening ? "Detener grabación" : "Buscar por voz"}
          >
            {voiceListening ? (
              <svg className="w-3.5 h-3.5 text-red-400 animate-pulse" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            )}
          </button>
        )}
        <button onClick={onCancel} className="text-xs text-[var(--accent)] font-semibold flex-shrink-0">Cancelar</button>
      </div>
      {/* Toast de error de voz */}
      <AnimatePresence>
        {voiceError && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-[11px] text-red-400 px-1"
          >
            {voiceError}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Mi ubicación rápida si activeInput=from y hay location */}
      {myLocation && !query && (
        <button
          onClick={() => onPick(myLocation)}
          className="w-full card-soft px-3 py-3 flex items-center gap-3 text-left"
        >
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "var(--accent-soft)" }}>
            <svg className="w-4 h-4 text-[var(--accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
            </svg>
          </div>
          <div>
            <p className="text-body font-semibold text-white">Mi ubicación</p>
            <p className="text-xs text-slate-500">Usar GPS actual</p>
          </div>
        </button>
      )}

      {/* Atajo: elegir punto en el mapa con long-press (FR-4.1) */}
      {!query && (
        <button
          onClick={onChooseOnMap}
          className="w-full card-soft px-3 py-3 flex items-center gap-3 text-left"
        >
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(168,85,247,0.15)" }}>
            <svg className="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <div>
            <p className="text-body font-semibold text-white">Elegir en el mapa</p>
            <p className="text-xs text-slate-500">Mantené apretado un punto del mapa</p>
          </div>
        </button>
      )}

      {/* Historial */}
      {!query && history.length > 0 && (
        <>
          <div className="search-section-title">Recientes</div>
          {history.map((h, i) => (
            <button key={i} onClick={() => onPick(h)} className="search-result">
              <div className="icon"><Icons.Clock size={16} /></div>
              <div className="body">
                <div className="name">{h.name}</div>
                {h.subtitle && <div className="meta">{h.subtitle}</div>}
              </div>
              <Icons.Chevron size={16} />
            </button>
          ))}
        </>
      )}

      {/* Resultados de búsqueda */}
      {searching && (
        <p className="text-xs text-slate-500 text-center py-3">Buscando…</p>
      )}
      {!searching && query && suggestions.length === 0 && (
        <p className="text-xs text-slate-500 text-center py-6">Sin resultados</p>
      )}
      {suggestions.length > 0 && (
        <>
          {suggestions.map((s, i) => {
            const isStop = s.subtitle?.startsWith("Parada");
            return (
            <button key={i} onClick={() => onPick(s)} className={`search-result ${isStop ? "stop" : "place"}`}>
              {/* R59: SIEMPRE vector (el geocoder manda emojis 🏥🛍️ que cada OS dibuja
                  distinto — un solo sistema de íconos, como ya hace Buscar desde R55). */}
              <div className="icon">{isStop ? <Icons.Bus size={16} /> : <Icons.Pin size={16} />}</div>
              <div className="body">
                <div className="name">{s.name}</div>
                {s.subtitle && <div className="meta">{s.subtitle}</div>}
              </div>
              <Icons.Chevron size={16} />
            </button>
            );
          })}
        </>
      )}
    </motion.div>
  );
}
