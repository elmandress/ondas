"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getPrefs, savePrefs, addFavorite, removeFavorite, type FavoriteRoute } from "@/lib/store";
import { STOPS_DATASET, lineColorFromCode, searchStops, type BusStop } from "@/lib/stm";
import { useStopsDataset } from "@/hooks/useStopsDataset";

const EMOJIS = ["🏠", "💼", "🏫", "🏥", "🏋️", "🛒", "🎭", "🌊", "🏖️", "⚽", "🍕", "👨‍👩‍👧", "🎓", "🏦", "🌳"];

interface RoutesManagerProps {
  onClose: () => void;
  onChange: () => void;
}

type Step = "list" | "edit" | "pick-stop";

interface DraftRoute {
  id: string;
  name: string;
  emoji: string;
  fromStop: string;
  fromName: string;
  lines: string[];
  walkMinutes: number;
}

function newDraft(): DraftRoute {
  return {
    id: `route_${Date.now()}`,
    name: "",
    emoji: "🏠",
    fromStop: "",
    fromName: "",
    lines: [],
    walkMinutes: 5,
  };
}

export default function RoutesManager({ onClose, onChange }: RoutesManagerProps) {
  const { ready: stopsReady } = useStopsDataset();
  const [routes, setRoutes] = useState<FavoriteRoute[]>([]);
  const [step, setStep] = useState<Step>("list");
  const [draft, setDraft] = useState<DraftRoute>(newDraft());
  const [stopQuery, setStopQuery] = useState("");
  const [stopResults, setStopResults] = useState<BusStop[]>([]);

  useEffect(() => {
    setRoutes(getPrefs().favoriteRoutes);
  }, []);

  useEffect(() => {
    if (!stopsReady) return;
    const q = stopQuery.trim();
    if (!q) {
      setStopResults(STOPS_DATASET.slice(0, 8));
    } else {
      setStopResults(searchStops(q));
    }
  }, [stopQuery, stopsReady]);

  function handleDeleteRoute(id: string) {
    removeFavorite(id);
    setRoutes(getPrefs().favoriteRoutes);
    onChange();
  }

  function handleEditRoute(route: FavoriteRoute) {
    setDraft({
      id: route.id,
      name: route.name,
      emoji: route.emoji,
      fromStop: route.fromStop,
      fromName: route.fromName,
      lines: route.lines,
      walkMinutes: route.walkMinutes,
    });
    setStep("edit");
  }

  function handleNewRoute() {
    setDraft(newDraft());
    setStep("edit");
  }

  function handlePickStop(stop: BusStop) {
    setDraft((d) => ({
      ...d,
      fromStop: stop.stopId,
      fromName: stop.stopName,
      lines: stop.lines,
      walkMinutes: 5,
    }));
    setStopQuery("");
    setStep("edit");
  }

  function handleSave() {
    if (!draft.name.trim() || !draft.fromStop) return;
    const route: FavoriteRoute = {
      id: draft.id,
      name: draft.name.trim(),
      emoji: draft.emoji,
      fromStop: draft.fromStop,
      fromName: draft.fromName,
      lines: draft.lines,
      walkMinutes: draft.walkMinutes,
    };
    addFavorite(route);
    setRoutes(getPrefs().favoriteRoutes);
    onChange();
    setStep("list");
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl overflow-hidden"
        style={{ background: "#0f1117", maxHeight: "92dvh" }}
      >
        {/* ── HANDLE ── */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* ── STEP: LIST ── */}
        <AnimatePresence mode="wait">
          {step === "list" && (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col overflow-hidden"
              style={{ maxHeight: "calc(92dvh - 24px)" }}
            >
              {/* Header */}
              <div className="px-5 pt-4 pb-5 flex items-center justify-between flex-shrink-0">
                <div>
                  <h2 className="text-xl font-black text-white">Mis rutas</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Tus paradas favoritas de salida</p>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
                >
                  <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Routes list */}
              <div className="flex-1 overflow-y-auto px-5 pb-4">
                {routes.length === 0 ? (
                  <div className="py-12 flex flex-col items-center gap-3">
                    <div className="text-5xl">🚌</div>
                    <p className="text-slate-400 text-sm font-semibold">Todavía no tenés rutas guardadas</p>
                    <p className="text-slate-600 text-xs text-center max-w-[220px]">
                      Agregá una parada favorita para ver los próximos ómnibus de un vistazo
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 mb-4">
                    {routes.map((route, i) => (
                      <motion.div
                        key={route.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="glass rounded-2xl px-4 py-3.5 flex items-center gap-3"
                      >
                        <span className="text-2xl flex-shrink-0">{route.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate">{route.name}</p>
                          <p className="text-[10px] text-slate-500 truncate mt-0.5">{route.fromName}</p>
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {route.lines.slice(0, 4).map((l) => (
                              <span key={l} className="text-[9px] font-black px-1.5 py-0.5 rounded-md text-white" style={{ backgroundColor: lineColorFromCode(l) + "40" }}>
                                {l}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => handleEditRoute(route)}
                            className="w-8 h-8 rounded-xl bg-blue-600/20 flex items-center justify-center"
                          >
                            <svg className="w-3.5 h-3.5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteRoute(route.id)}
                            className="w-8 h-8 rounded-xl bg-red-600/20 flex items-center justify-center"
                          >
                            <svg className="w-3.5 h-3.5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                            </svg>
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add button */}
              <div className="px-5 pb-8 pt-3 flex-shrink-0 border-t border-white/5">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleNewRoute}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-2xl py-4 font-bold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Agregar ruta
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── STEP: EDIT ── */}
          {step === "edit" && (
            <motion.div
              key="edit"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex flex-col overflow-hidden"
              style={{ maxHeight: "calc(92dvh - 24px)" }}
            >
              {/* Header */}
              <div className="px-5 pt-4 pb-5 flex items-center gap-3 flex-shrink-0">
                <button
                  onClick={() => setStep("list")}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0"
                >
                  <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                </button>
                <div>
                  <h2 className="text-xl font-black text-white">{draft.id.startsWith("route_") && !getPrefs().favoriteRoutes.find(r => r.id === draft.id) ? "Nueva ruta" : "Editar ruta"}</h2>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
                {/* Emoji picker */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Ícono</p>
                  <div className="flex flex-wrap gap-2">
                    {EMOJIS.map((e) => (
                      <button
                        key={e}
                        onClick={() => setDraft((d) => ({ ...d, emoji: e }))}
                        className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${
                          draft.emoji === e ? "bg-blue-600/30 border border-blue-500/50 scale-110" : "bg-white/5 border border-transparent"
                        }`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Nombre */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Nombre de la ruta</p>
                  <input
                    type="text"
                    value={draft.name}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    placeholder="Ej: Casa → Trabajo"
                    className="w-full glass rounded-2xl px-4 py-3.5 text-sm text-white placeholder:text-slate-600 outline-none border border-transparent focus:border-blue-500/40 transition-all"
                    maxLength={40}
                  />
                </div>

                {/* Parada de salida */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Parada de salida</p>
                  {draft.fromStop ? (
                    <div className="glass rounded-2xl px-4 py-3.5 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="6" width="20" height="12" rx="2"/>
                          <path d="M22 10H2"/>
                          <circle cx="7" cy="18" r="1.5"/><circle cx="17" cy="18" r="1.5"/>
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{draft.fromName}</p>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {draft.lines.slice(0, 5).map((l) => (
                            <span key={l} className="text-[9px] font-black px-1.5 py-0.5 rounded-md text-white" style={{ backgroundColor: lineColorFromCode(l) + "40" }}>
                              {l}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => setStep("pick-stop")}
                        className="text-xs text-blue-400 font-semibold flex-shrink-0"
                      >
                        Cambiar
                      </button>
                    </div>
                  ) : (
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setStep("pick-stop")}
                      className="w-full glass rounded-2xl px-4 py-4 flex items-center gap-3 border border-dashed border-white/15"
                    >
                      <div className="w-9 h-9 rounded-xl bg-blue-600/10 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                      </div>
                      <p className="text-sm text-slate-500">Elegí una parada de salida</p>
                    </motion.button>
                  )}
                </div>
              </div>

              {/* Save button */}
              <div className="px-5 pb-8 pt-3 flex-shrink-0 border-t border-white/5">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSave}
                  disabled={!draft.name.trim() || !draft.fromStop}
                  className="w-full bg-blue-600 disabled:bg-blue-600/30 disabled:text-white/30 text-white rounded-2xl py-4 font-bold text-sm transition-colors"
                >
                  Guardar ruta
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── STEP: PICK STOP ── */}
          {step === "pick-stop" && (
            <motion.div
              key="pick-stop"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex flex-col overflow-hidden"
              style={{ maxHeight: "calc(92dvh - 24px)" }}
            >
              {/* Header */}
              <div className="px-5 pt-4 pb-4 flex items-center gap-3 flex-shrink-0">
                <button
                  onClick={() => setStep("edit")}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0"
                >
                  <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                </button>
                <h2 className="text-xl font-black text-white">Elegí una parada</h2>
              </div>

              {/* Search */}
              <div className="px-5 pb-3 flex-shrink-0">
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                  </div>
                  <input
                    autoFocus
                    type="text"
                    value={stopQuery}
                    onChange={(e) => setStopQuery(e.target.value)}
                    placeholder="Nombre de parada o línea…"
                    className="w-full glass rounded-2xl pl-11 pr-4 py-3.5 text-sm text-white placeholder:text-slate-600 outline-none border border-transparent focus:border-blue-500/40 transition-all"
                  />
                </div>
              </div>

              {/* Results */}
              <div className="flex-1 overflow-y-auto px-5 pb-8">
                <div className="space-y-2">
                  {stopResults.map((stop, i) => (
                    <motion.button
                      key={stop.stopId}
                      whileTap={{ scale: 0.98 }}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => handlePickStop(stop)}
                      className="w-full glass rounded-2xl px-4 py-3.5 flex items-center gap-3 text-left"
                    >
                      <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="6" width="20" height="12" rx="2"/>
                          <path d="M22 10H2"/>
                          <circle cx="7" cy="18" r="1.5"/><circle cx="17" cy="18" r="1.5"/>
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{stop.stopName}</p>
                        <p className="text-[10px] text-slate-600">#{stop.stopCode}</p>
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {stop.lines.slice(0, 6).map((l) => (
                            <span key={l} className="text-[9px] font-bold px-1.5 py-0.5 rounded-md text-white" style={{ backgroundColor: lineColorFromCode(l) + "40" }}>
                              {l}
                            </span>
                          ))}
                          {stop.lines.length > 6 && <span className="text-[9px] text-slate-600">+{stop.lines.length - 6}</span>}
                        </div>
                      </div>
                      <svg className="w-4 h-4 text-slate-700 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
