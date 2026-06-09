"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { STOPS_DATASET, searchStops, type BusStop } from "@/lib/stm";
import { useStopsDataset } from "@/hooks/useStopsDataset";
import { useLocation } from "@/hooks/useLocation";
import StopArrivalSheet from "@/components/home/StopArrivalSheet";
import { setSelectedPlace } from "@/lib/selected-place";
import { setActiveTab } from "@/lib/active-tab";
import { LogoLockup } from "@/components/brand/Logo";
import { Icons } from "@/components/brand/Icons";
import LineBadge from "@/components/ui/LineBadge";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import VoiceOverlay from "@/components/ui/VoiceOverlay";
import { useMounted } from "@/hooks/useMounted";
import { takePendingSearch } from "@/lib/search-query";

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

export default function SearchScreen() {
  const { ready: stopsReady } = useStopsDataset();
  const { location } = useLocation();
  const [query, setQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<GeoResult[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  // Buses EN VIVO que van al destino buscado ("a Pocitos") — lo que la gente ama.
  const [liveToDest, setLiveToDest] = useState<{ count: number; lines: string[] }>({ count: 0, lines: [] });
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [history, setHistory] = useState<BusStop[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeAbortRef = useRef<AbortController | null>(null);
  const voiceErrTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Búsqueda pendiente de un deep link /?q= (o el sitelinks searchbox de Google).
  useEffect(() => {
    const pending = takePendingSearch();
    if (pending) setQuery(pending);
  }, []);

  const mounted = useMounted();
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const voice = useVoiceInput({
    onResult: (transcript) => { setQuery(transcript); setVoiceError(null); },
    onError: (msg) => {
      if (voiceErrTimerRef.current) clearTimeout(voiceErrTimerRef.current);
      setVoiceError(msg);
      voiceErrTimerRef.current = setTimeout(() => setVoiceError(null), 3500);
    },
  });
  useEffect(() => () => { if (voiceErrTimerRef.current) clearTimeout(voiceErrTimerRef.current); }, []);

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

  // Debounce de 150 ms para la búsqueda de paradas (itera ~5000 paradas por keystroke).
  // El input visual sigue respondiendo instantáneamente; solo el cómputo se frena.
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 150);
    return () => clearTimeout(id);
  }, [query]);

  const stopResults = useMemo<BusStop[]>(() => {
    const q = debouncedQuery.trim();
    if (!q || !stopsReady) return [];
    const near = location ? { lat: location.lat, lon: location.lon } : undefined;
    return searchStops(q, near);
  }, [debouncedQuery, location, stopsReady]);

  // REMOTO — con debounce: lugares (geocode) y buses al destino. No bloquean a las paradas.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = query.trim();
    if (!q) {
      setPlaceResults([]);
      setGeoLoading(false);
      setLiveToDest({ count: 0, lines: [] });
      return;
    }

    setGeoLoading(true);

    debounceRef.current = setTimeout(async () => {
      geocodeAbortRef.current?.abort();
      const geocodeCtrl = new AbortController();
      geocodeAbortRef.current = geocodeCtrl;

      let places: GeoResult[] = [];
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { signal: geocodeCtrl.signal });
        const data = await res.json();
        places = data.results || [];
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
      }

      setPlaceResults(places);
      setGeoLoading(false);

      // Buses EN VIVO que van a este destino (F2.3). En paralelo, sin bloquear.
      fetch(`/api/stm/vehicles?dest=${encodeURIComponent(q)}`, { signal: geocodeCtrl.signal })
        .then((r) => r.json())
        .then((d) => {
          const v = (d.vehicles || []) as { lineName: string }[];
          const lines = [...new Set(v.map((x) => x.lineName))].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
          setLiveToDest({ count: v.length, lines });
        })
        .catch(() => setLiveToDest({ count: 0, lines: [] }));
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
          placeholder="Parada, lugar o línea…"
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

      {/* Buses EN VIVO que van al destino buscado (F2.3) — lo que la gente ama. */}
      {query.trim() && liveToDest.count > 0 && (
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

      {/* Resultados — las PARADAS salen al instante (local); los LUGARES llegan de la red.
          FR-3.7: cuando hay lugares, van primero. */}
      {query.trim() && (placeResults.length > 0 || stopResults.length > 0) && (
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
          {/* Indicador sutil: ya ves las paradas, los lugares siguen cargando. */}
          {geoLoading && placeResults.length === 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 2px", color: "var(--text-3)" }}>
              <span style={{ display: "grid", color: "var(--accent)", animation: "spin 1s linear infinite" }}><Icons.Refresh size={14} /></span>
              <span style={{ font: "var(--font-small)" }}>Buscando lugares…</span>
            </div>
          )}
        </>
      )}

      {/* Sin resultados (recién cuando terminó de buscar lugares y no hay nada). */}
      {query.trim() && !geoLoading && placeResults.length === 0 && stopResults.length === 0 && (
        <div className="search-empty">
          <div className="big">No encontramos “{query}”</div>
          Probá con el número de parada o un nombre más corto.
        </div>
      )}

      {/* Estado inicial */}
      {!query.trim() && (
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
      {/* Ícono VECTORIAL de marca (Pin ámbar), no emoji en caja morada. Un solo sistema
          de íconos = coherencia visual. Antes: place.icon era un emoji (🛍️📍) = look de IA. */}
      <div className="icon" style={{ background: "var(--accent-soft)", color: "var(--accent)", display: "grid", placeItems: "center" }}>
        <Icons.Pin size={18} />
      </div>
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
