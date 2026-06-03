"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getPrefs, addFavorite, removeFavorite, type FavoriteRoute } from "@/lib/store";
import { STOPS_DATASET } from "@/lib/stm";
import { setRouteInput } from "@/lib/route-input";
import { setActiveTab } from "@/lib/active-tab";
import { Icons } from "@/components/brand/Icons";

const EMOJIS = ["🏠", "💼", "🏫", "🏥", "🏋️", "🛒", "🎭", "🌊", "🏖️", "⚽", "🍕", "👨‍👩‍👧", "🎓", "🏦", "🌳"];

interface RoutesManagerProps {
  onClose: () => void;
  onChange: () => void;
}

interface PlaceVal { name: string; lat: number; lon: number }

interface Draft {
  id: string;
  name: string;
  emoji: string;
  fromCurrent: boolean;          // origen = "Mi ubicación" (GPS al abrir)
  from: PlaceVal | null;         // origen por dirección (si no es GPS)
  to: PlaceVal | null;           // destino por dirección
}

function newDraft(): Draft {
  return { id: `route_${Date.now()}`, name: "", emoji: "🏠", fromCurrent: true, from: null, to: null };
}

export default function RoutesManager({ onClose, onChange }: RoutesManagerProps) {
  const [routes, setRoutes] = useState<FavoriteRoute[]>([]);
  const [step, setStep] = useState<"list" | "edit">("list");
  const [draft, setDraft] = useState<Draft>(newDraft());

  useEffect(() => { setRoutes(getPrefs().favoriteRoutes); }, []);

  function refresh() { setRoutes(getPrefs().favoriteRoutes); onChange(); }

  function handleDelete(id: string) { removeFavorite(id); refresh(); }

  function handleEdit(r: FavoriteRoute) {
    setDraft({
      id: r.id,
      name: r.name,
      emoji: r.emoji || "🏠",
      fromCurrent: r.fromIsCurrentLocation ?? !(r.fromLat != null),
      from: r.fromLat != null && r.fromLon != null ? { name: r.fromAddress || r.fromName || "Origen", lat: r.fromLat, lon: r.fromLon } : null,
      to: r.toLat != null && r.toLon != null ? { name: r.toAddress || r.toName || "Destino", lat: r.toLat, lon: r.toLon } : null,
    });
    setStep("edit");
  }

  function handleNew() { setDraft(newDraft()); setStep("edit"); }

  const canSave = draft.name.trim() !== "" && !!draft.to && (draft.fromCurrent || !!draft.from);

  function handleSave() {
    if (!canSave) return;
    const route: FavoriteRoute = {
      id: draft.id,
      name: draft.name.trim(),
      emoji: draft.emoji,
      fromStop: "",
      fromName: draft.fromCurrent ? "Mi ubicación" : draft.from!.name,
      fromIsCurrentLocation: draft.fromCurrent,
      fromLat: draft.fromCurrent ? undefined : draft.from!.lat,
      fromLon: draft.fromCurrent ? undefined : draft.from!.lon,
      fromAddress: draft.fromCurrent ? undefined : draft.from!.name,
      toName: draft.to!.name,
      toLat: draft.to!.lat,
      toLon: draft.to!.lon,
      toAddress: draft.to!.name,
      lines: [],
      walkMinutes: 0,
    };
    addFavorite(route);
    refresh();
    setStep("list");
  }

  // Abrir una ruta guardada en el planificador (Rutas) con origen/destino prefijados.
  function openRoute(r: FavoriteRoute) {
    const to = r.toLat != null && r.toLon != null ? { lat: r.toLat, lon: r.toLon, name: r.toName || r.toAddress } : undefined;
    let from: { lat: number; lon: number; name?: string } | undefined;
    if (!r.fromIsCurrentLocation) {
      if (r.fromLat != null && r.fromLon != null) {
        from = { lat: r.fromLat, lon: r.fromLon, name: r.fromName || r.fromAddress };
      } else if (r.fromStop) {
        // Ruta vieja basada en parada de salida: usamos sus coords.
        const s = STOPS_DATASET.find((x) => x.stopId === r.fromStop);
        if (s) from = { lat: s.stopLat, lon: s.stopLon, name: s.stopName };
      }
    }
    setRouteInput({ from, to, fromCurrentLocation: r.fromIsCurrentLocation });
    setActiveTab("route");
    onClose();
  }

  function routeSubtitle(r: FavoriteRoute): string {
    const f = r.fromIsCurrentLocation ? "Mi ubicación" : (r.fromAddress || r.fromName || "Origen");
    const t = r.toAddress || r.toName;
    return t ? `${f} → ${t}` : f;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 flex flex-col"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", zIndex: 110 }}
    >
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="absolute bottom-0 left-0 right-0 rounded-t-[18px] overflow-hidden flex flex-col"
        style={{ background: "var(--bg-elevated)", height: "86dvh" }}
      >
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0"><div className="w-10 h-1 rounded-full bg-white/20" /></div>

        <div className="px-5 pt-3 pb-4 flex items-center justify-between flex-shrink-0">
          {step === "edit" ? (
            <button onClick={() => setStep("list")} aria-label="Volver" className="icon-btn sm">
              <span style={{ transform: "rotate(180deg)", display: "grid" }}><Icons.Chevron size={18} /></span>
            </button>
          ) : <div style={{ width: 40 }} />}
          <div className="text-center">
            <h2 className="text-lg font-black text-white">{step === "edit" ? "Nueva ruta" : "Mis rutas"}</h2>
            <p className="text-xs text-slate-500">{step === "edit" ? "Desde dónde salís, hasta dónde vas" : "Guardá tus viajes por dirección"}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="icon-btn sm"><Icons.Close size={18} /></button>
        </div>

        <AnimatePresence mode="wait">
          {step === "list" ? (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="px-5 flex-1 min-h-0 overflow-y-auto scrollbar-none" style={{ paddingBottom: "calc(28px + env(safe-area-inset-bottom))" }}>
              {routes.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="mx-auto mb-3" style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--surface)", display: "grid", placeItems: "center", color: "var(--text-3)" }}>
                    <Icons.Pin size={26} />
                  </div>
                  <p className="text-sm text-slate-300 font-semibold">Todavía no guardaste rutas</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-[260px] mx-auto">Guardá “Casa → Trabajo” por dirección o esquina y abrila de un toque.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {routes.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                      <button onClick={() => openRoute(r)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                        <span style={{ fontSize: 22 }}>{r.emoji || "📍"}</span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-white truncate">{r.name}</span>
                          <span className="block text-xs text-slate-500 truncate">{routeSubtitle(r)}</span>
                        </span>
                      </button>
                      <button onClick={() => handleEdit(r)} aria-label="Editar" className="icon-btn sm flex-shrink-0"><Icons.Settings size={15} /></button>
                      <button onClick={() => handleDelete(r.id)} aria-label="Borrar" className="icon-btn sm flex-shrink-0"><Icons.Close size={15} /></button>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={handleNew} className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold"
                style={{ background: "var(--accent)", color: "#1a1206" }}>
                <Icons.Plus size={18} /> Nueva ruta
              </button>
            </motion.div>
          ) : (
            <motion.div key="edit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="px-5 flex-1 min-h-0 overflow-y-auto scrollbar-none" style={{ paddingBottom: "calc(28px + env(safe-area-inset-bottom))" }}>
              {/* Nombre + emoji */}
              <label className="text-eyebrow">Nombre</label>
              <div className="flex gap-2 mt-1.5 mb-4">
                <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="Ej: Casa → Trabajo" maxLength={28}
                  className="flex-1 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }} />
              </div>
              <div className="flex gap-1.5 flex-wrap mb-5">
                {EMOJIS.map((e) => (
                  <button key={e} onClick={() => setDraft((d) => ({ ...d, emoji: e }))}
                    className="w-9 h-9 rounded-xl grid place-items-center text-lg"
                    style={{ background: draft.emoji === e ? "var(--accent-soft)" : "var(--surface)", border: `1px solid ${draft.emoji === e ? "var(--accent-border)" : "var(--border)"}` }}>
                    {e}
                  </button>
                ))}
              </div>

              {/* Origen */}
              <label className="text-eyebrow">Desde dónde salís</label>
              <div className="flex gap-2 mt-1.5 mb-2">
                <button onClick={() => setDraft((d) => ({ ...d, fromCurrent: true, from: null }))}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
                  style={{ background: draft.fromCurrent ? "var(--accent-soft)" : "var(--surface)", border: `1px solid ${draft.fromCurrent ? "var(--accent-border)" : "var(--border)"}`, color: draft.fromCurrent ? "var(--accent)" : "var(--text-2)" }}>
                  <Icons.Crosshair size={14} /> Mi ubicación
                </button>
                <button onClick={() => setDraft((d) => ({ ...d, fromCurrent: false }))}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
                  style={{ background: !draft.fromCurrent ? "var(--accent-soft)" : "var(--surface)", border: `1px solid ${!draft.fromCurrent ? "var(--accent-border)" : "var(--border)"}`, color: !draft.fromCurrent ? "var(--accent)" : "var(--text-2)" }}>
                  <Icons.Pin size={14} /> Una dirección
                </button>
              </div>
              {!draft.fromCurrent && (
                <PlaceField placeholder="Calle y número, o esquina…" value={draft.from} onPick={(p) => setDraft((d) => ({ ...d, from: p }))} />
              )}

              {/* Destino */}
              <label className="text-eyebrow mt-5 block">Hasta dónde vas</label>
              <div className="mt-1.5">
                <PlaceField placeholder="Calle y número, o esquina…" value={draft.to} onPick={(p) => setDraft((d) => ({ ...d, to: p }))} />
              </div>

              <button onClick={handleSave} disabled={!canSave}
                className="mt-6 w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold disabled:opacity-40"
                style={{ background: "var(--accent)", color: "#1a1206" }}>
                Guardar ruta
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

// ── Campo de búsqueda de lugar (dirección / esquina / POI) vía /api/geocode ──
function PlaceField({ placeholder, value, onPick }: { placeholder: string; value: PlaceVal | null; onPick: (p: PlaceVal) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Array<{ name: string; fullName?: string; lat: number; lon: number; icon?: string }>>([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (text.trim().length < 3) { setResults([]); setSearching(false); return; }
    setSearching(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(text.trim())}`);
        const data = await res.json();
        setResults(Array.isArray(data.results) ? data.results.slice(0, 6) : []);
      } catch { setResults([]); }
      setSearching(false);
    }, 350);
  }, []);

  if (value) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <Icons.Pin size={15} className="text-amber-400 flex-shrink-0" />
        <span className="flex-1 text-sm text-white truncate">{value.name}</span>
        <button onClick={() => { onPick(null as unknown as PlaceVal); setQ(""); setResults([]); }} aria-label="Cambiar" className="icon-btn sm"><Icons.Close size={14} /></button>
      </div>
    );
  }

  return (
    <div>
      <input value={q} onChange={(e) => { setQ(e.target.value); search(e.target.value); }} placeholder={placeholder}
        className="w-full rounded-2xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }} />
      {searching && <p className="text-xs text-slate-500 mt-2 px-1">Buscando…</p>}
      {results.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {results.map((r, i) => (
            <button key={i} onClick={() => { onPick({ name: r.name, lat: r.lat, lon: r.lon }); setQ(""); setResults([]); }}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left" style={{ background: "var(--surface)" }}>
              <span style={{ fontSize: 15 }}>{r.icon || "📍"}</span>
              <span className="min-w-0">
                <span className="block text-sm text-white truncate">{r.name}</span>
                {r.fullName && <span className="block text-xs text-slate-500 truncate">{r.fullName}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
