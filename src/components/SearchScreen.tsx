"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { STOPS_DATASET, searchStops, type BusStop } from "@/lib/stm";
import { useStopsDataset } from "@/hooks/useStopsDataset";
import StopArrivalSheet from "@/components/home/StopArrivalSheet";
import { setSelectedPlace } from "@/lib/selected-place";
import { setActiveTab } from "@/lib/active-tab";
import { LogoLockup } from "@/components/brand/Logo";
import { Icons } from "@/components/brand/Icons";
import LineBadge from "@/components/ui/LineBadge";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import VoiceOverlay from "@/components/ui/VoiceOverlay";
import { useMounted } from "@/hooks/useMounted";

interface GeoResult {
  id: string | number;
  name: string;
  fullName: string;
  lat: number;
  lon: number;
  type: string;
  class?: string;
  icon?: string;
  source?: "curated" | "nominatim";
}

const TRENDING_IDS = ["4521", "3301", "3302", "2201", "5501", "1101", "9001", "3003", "7703", "1900"];

type SearchMode = "idle" | "searching" | "stops" | "places" | "empty";

export default function SearchScreen() {
  const { ready: stopsReady } = useStopsDataset();
  const [query, setQuery] = useState("");
  const [stopResults, setStopResults] = useState<BusStop[]>([]);
  const [placeResults, setPlaceResults] = useState<GeoResult[]>([]);
  // Buses EN VIVO que van al destino buscado ("a Pocitos") — lo que la gente ama.
  const [liveToDest, setLiveToDest] = useState<{ count: number; lines: string[] }>({ count: 0, lines: [] });
  const [mode, setMode] = useState<SearchMode>("idle");
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [history, setHistory] = useState<BusStop[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeAbortRef = useRef<AbortController | null>(null);

  const mounted = useMounted();
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const voice = useVoiceInput({
    onResult: (transcript) => { setQuery(transcript); setVoiceError(null); },
    onError: (msg) => { setVoiceError(msg); setTimeout(() => setVoiceError(null), 3500); },
  });

  const trendingStops = useMemo<BusStop[]>(() => {
    if (!stopsReady) return [];
    return TRENDING_IDS
      .map((id) => STOPS_DATASET.find((s) => s.stopId === id))
      .filter(Boolean) as BusStop[];
  }, [stopsReady]);

  useEffect(() => {
    if (!stopsReady) return;
    try {
      const raw = localStorage.getItem("ondas_stop_history");
      if (raw) {
        const ids: string[] = JSON.parse(raw);
        setHistory(ids.map((id) => STOPS_DATASET.find((s) => s.stopId === id)).filter(Boolean) as BusStop[]);
      }
    } catch {}
  }, [stopsReady]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = query.trim();
    if (!q) {
      setMode("idle");
      setStopResults([]);
      setPlaceResults([]);
      setLiveToDest({ count: 0, lines: [] });
      return;
    }

    setMode("searching");

    debounceRef.current = setTimeout(async () => {
      geocodeAbortRef.current?.abort();
      const geocodeCtrl = new AbortController();
      geocodeAbortRef.current = geocodeCtrl;

      const localStops = searchStops(q);

      let places: GeoResult[] = [];
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { signal: geocodeCtrl.signal });
        const data = await res.json();
        places = data.results || [];
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
      }

      setStopResults(localStops);
      setPlaceResults(places);

      // Buses EN VIVO que van a este destino (F2.3). En paralelo, sin bloquear.
      fetch(`/api/stm/vehicles?dest=${encodeURIComponent(q)}`, { signal: geocodeCtrl.signal })
        .then((r) => r.json())
        .then((d) => {
          const v = (d.vehicles || []) as { lineName: string }[];
          const lines = [...new Set(v.map((x) => x.lineName))].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
          setLiveToDest({ count: v.length, lines });
        })
        .catch(() => setLiveToDest({ count: 0, lines: [] }));

      if (localStops.length === 0 && places.length === 0) setMode("empty");
      else if (localStops.length > 0 && places.length === 0) setMode("stops");
      else setMode("places");
    }, 320);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function handleSelectStop(stopId: string) {
    setSelectedStopId(stopId);
    try {
      const raw = localStorage.getItem("ondas_stop_history");
      const ids: string[] = raw ? JSON.parse(raw) : [];
      const updated = [stopId, ...ids.filter((id) => id !== stopId)].slice(0, 6);
      localStorage.setItem("ondas_stop_history", JSON.stringify(updated));
      setHistory(updated.map((id) => STOPS_DATASET.find((s) => s.stopId === id)).filter(Boolean) as BusStop[]);
    } catch {}
  }

  function handleSelectPlace(place: GeoResult) {
    setSelectedPlace({
      id: place.id,
      name: place.name,
      fullName: place.fullName,
      lat: place.lat,
      lon: place.lon,
      icon: place.icon,
      category: place.class || place.type,
    });
    setActiveTab("map");
  }

  return (
    <div className="screen-search" style={{ paddingTop: "max(env(safe-area-inset-top), 8px)" }}>
      {/* Header mobile */}
      <div className="app-header mobile-only">
        <LogoLockup size={24} ring="var(--text)" dot="var(--accent)" />
      </div>
      {/* Header desktop */}
      <div className="desktop-header desktop-only">
        <div>
          <h1>Buscar</h1>
          <div className="subhead">Encontrá cualquier parada por nombre, número o dirección</div>
        </div>
      </div>

      <div className="search-input-wrap">
        <span className="lead"><Icons.Search size={18} /></span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nuevo Centro, Isla de Gorriti, línea 103…"
          autoComplete="off"
          spellCheck={false}
          inputMode="search"
        />
        <div className="right-actions">
          {query && (
            <button className="clear" onClick={() => setQuery("")} aria-label="Limpiar">
              <Icons.Close size={14} />
            </button>
          )}
          {mounted && (
            <button
              className="mic"
              onClick={(e) => {
                e.stopPropagation();
                if (!voice.supported) {
                  setVoiceError("Tu navegador bloquea la búsqueda por voz. Probá en Chrome 🙏");
                  setTimeout(() => setVoiceError(null), 4500);
                  return;
                }
                if (voice.state === "listening") voice.stop(); else voice.start();
              }}
              aria-label="Buscar por voz"
              style={voice.state === "listening" ? { background: "var(--accent-soft)", color: "var(--accent)" } : undefined}
            >
              <Icons.Mic size={16} />
            </button>
          )}
        </div>
      </div>

      {voiceError && (
        <p style={{ font: "var(--font-small)", color: "var(--warn)", marginTop: 8 }}>{voiceError}</p>
      )}

      <VoiceOverlay open={voice.state === "listening"} onCancel={() => voice.stop()} />

      {/* Spinner */}
      {mode === "searching" && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 0" }}>
          <span style={{ display: "grid", color: "var(--accent)", animation: "spin 1s linear infinite" }}><Icons.Refresh size={16} /></span>
          <p style={{ font: "var(--font-small)", color: "var(--text-2)" }}>Buscando…</p>
        </div>
      )}

      {/* Sin resultados */}
      {mode === "empty" && (
        <div className="search-empty">
          <div className="big">No encontramos “{query}”</div>
          Probá con el número de parada o un nombre más corto.
        </div>
      )}

      {/* Buses EN VIVO que van al destino buscado (F2.3) — lo que la gente ama. */}
      {(mode === "stops" || mode === "places") && liveToDest.count > 0 && (
        <button
          className="live-to-dest"
          onClick={() => placeResults[0] ? handleSelectPlace(placeResults[0]) : undefined}
        >
          <span className="ltd-pulse"><span className="ltd-dot" /></span>
          <div className="ltd-body">
            <div className="ltd-title">{liveToDest.count} {liveToDest.count === 1 ? "bus va" : "buses van"} a “{query}” ahora</div>
            <div className="ltd-lines">{liveToDest.lines.slice(0, 8).join(" · ")}{liveToDest.lines.length > 8 ? "…" : ""}</div>
          </div>
          <Icons.Chevron size={16} />
        </button>
      )}

      {/* Resultados — FR-3.7: lugares antes que paradas */}
      {(mode === "stops" || mode === "places") && (
        <>
          {placeResults.length > 0 && (
            <>
              <div className="search-section-title">Lugares</div>
              {placeResults.map((place) => (
                <PlaceRow key={place.id} place={place} onTap={() => handleSelectPlace(place)} />
              ))}
            </>
          )}
          {stopResults.length > 0 && (
            <>
              <div className="search-section-title">Paradas</div>
              {stopResults.map((stop) => (
                <StopRow key={stop.stopId} stop={stop} onTap={() => handleSelectStop(stop.stopId)} query={query} />
              ))}
            </>
          )}
        </>
      )}

      {/* Estado inicial */}
      {mode === "idle" && (
        <>
          {history.length > 0 && (
            <>
              <div className="search-section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Recientes</span>
                <button onClick={() => { setHistory([]); localStorage.removeItem("ondas_stop_history"); }} style={{ font: "var(--font-badge)", color: "var(--text-3)" }}>Borrar</button>
              </div>
              {history.map((stop) => <StopRow key={stop.stopId} stop={stop} onTap={() => handleSelectStop(stop.stopId)} isHistory />)}
            </>
          )}

          {/* "Paradas frecuentes" curadas (TRENDING_IDS). Antes había también una
              sección "Explorá" = STOPS_DATASET.slice(0,10) (relleno sin criterio) →
              eliminada: paradas al azar no aportan, son ruido. Menos es más. */}
          <div className="search-section-title">Paradas frecuentes</div>
          {trendingStops.map((stop) => <StopRow key={stop.stopId} stop={stop} onTap={() => handleSelectStop(stop.stopId)} />)}
        </>
      )}

      <div style={{ height: 40 }} />

      <AnimatePresence>
        {selectedStopId && <StopArrivalSheet stopId={selectedStopId} onClose={() => setSelectedStopId(null)} />}
      </AnimatePresence>
    </div>
  );
}

function Highlight({ text, q }: { text: string; q?: string }) {
  if (!q) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <b style={{ color: "var(--accent)" }}>{text.slice(idx, idx + q.length)}</b>
      {text.slice(idx + q.length)}
    </>
  );
}

function StopRow({ stop, onTap, isHistory, query }: { stop: BusStop; onTap: () => void; isHistory?: boolean; query?: string }) {
  return (
    <button className="search-result stop" onClick={onTap}>
      <div className="icon">{isHistory ? <Icons.Clock size={16} /> : <Icons.Bus size={16} />}</div>
      <div className="body">
        <div className="name"><Highlight text={stop.stopName} q={query} /></div>
        <div className="meta" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span>#{stop.stopCode}</span>
          {stop.lines.slice(0, 6).map((l) => <LineBadge key={l} num={l} size="xs" />)}
          {stop.lines.length > 6 && <span>+{stop.lines.length - 6}</span>}
        </div>
      </div>
      <Icons.Chevron size={16} />
    </button>
  );
}

function PlaceRow({ place, onTap }: { place: GeoResult; onTap: () => void }) {
  return (
    <button className="search-result place" onClick={onTap}>
      <div className="icon" style={{ fontSize: 18 }}>{place.icon || "📍"}</div>
      <div className="body">
        <div className="name">{place.name}</div>
        <div className="meta">{place.fullName.split(",").slice(0, 3).join(",")}</div>
      </div>
      <span className="distance" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--accent)" }}>
        Paradas <Icons.Chevron size={12} />
      </span>
    </button>
  );
}
