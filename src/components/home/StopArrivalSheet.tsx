"use client";

import { AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useArrivals } from "@/hooks/useArrivals";
import { useInteriorArrivals, isInteriorStop } from "@/hooks/useInteriorArrivals";
import { useStopInfo } from "@/hooks/useStopInfo";
import { STOPS_DATASET, isAccessibleArrival, arrivalHasAc, type BusStop } from "@/lib/stm";
import { formatRelativeTime, getNearbyStopsClient, distanceTo } from "@/lib/utils";
import { useFavoriteStops, toggleFavoriteStop } from "@/lib/favorite-stops";
import { shareStop } from "@/lib/share";
import { track } from "@/lib/analytics";
import { haptic } from "@/lib/haptics";
import LineDetailSheet from "@/components/home/LineDetailSheet";
import { Icons } from "@/components/brand/Icons";
import LineBadge from "@/components/ui/LineBadge";
import EmptyState from "@/components/ui/EmptyState";
import ArrivalRow from "@/components/ui/ArrivalRow";
import OccupancySection from "@/components/home/OccupancySection";

interface StopArrivalSheetProps {
  stopId: string;
  onClose: () => void;
}

const CLOSE_MS = 340;

export default function StopArrivalSheet({ stopId, onClose }: StopArrivalSheetProps) {
  const stop = STOPS_DATASET.find((s) => s.stopId === stopId);
  const interior = isInteriorStop(stopId);
  const { info } = useStopInfo(interior ? null : stopId);
  // Parada del interior → llegadas del GPS en vivo (Busmatick); STM → API oficial.
  const stm = useArrivals(interior ? null : stopId, 20000);
  const int = useInteriorArrivals(interior ? stopId : null, stop?.stopLat, stop?.stopLon, stop?.lines);
  const arrivals = interior ? int.arrivals : stm.arrivals;
  const loading = interior ? int.loading : stm.loading;
  const lastUpdated = interior ? new Date() : stm.lastUpdated;
  const lastFetchFailed = interior ? false : stm.lastFetchFailed;
  const isOffline = interior ? false : stm.isOffline;
  const refetch = interior ? () => {} : stm.refetch;
  const realLines = info?.variants.map((v) => v.lineCode) || stop?.lines || [];
  const [lineDetail, setLineDetail] = useState<{ line: string; destination?: string; company?: string } | null>(null);

  // Animación CSS (.open). Montamos cerrado, abrimos en el próximo frame; al cerrar
  // diferimos onClose hasta terminar la transición para que se vea el slide-out.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const handleClose = useCallback(() => {
    setOpen(false);
    setTimeout(onClose, CLOSE_MS);
  }, [onClose]);

  const favorites = useFavoriteStops();
  const isFav = favorites.some((f) => f.stopId === stopId);
  const [favPulse, setFavPulse] = useState(false);
  const handleToggleFav = () => {
    if (!stop) return;
    const added = toggleFavoriteStop({
      stopId: stop.stopId,
      stopCode: stop.stopCode,
      stopName: stop.stopName,
      lines: realLines.length > 0 ? realLines : stop.lines,
    });
    // Delight: haptic + un pulso de la estrella al guardar. Pequeño, pero hace que la
    // acción se SIENTA. Antes: guardabas un favorito y no pasaba nada (transaccional).
    if (added) { haptic(15); setFavPulse(true); setTimeout(() => setFavPulse(false), 400); }
    track("save_favorite", { kind: "stop", on: added }); // retención: guardar = volver
  };

  // Compartir parada → link limpio /parada/{code}. Feedback honesto: si no hay Web
  // Share (desktop), copiamos y avisamos "Link copiado".
  const [copied, setCopied] = useState(false);
  const handleShare = async () => {
    if (!stop) return;
    haptic(10);
    // Si hay un bus en camino, compartimos la ETA ("el 121 en ~5 min") → mensaje útil.
    const first = arrivals[0];
    const next = first ? { line: first.lineName, etaMin: Math.max(0, first.eta) } : undefined;
    const r = await shareStop(stop.stopId, stop.stopName, stop.stopCode, next);
    if (r === "copied") { setCopied(true); setTimeout(() => setCopied(false), 1800); }
  };

  const firstUrgent = arrivals[0]?.eta <= 3;

  // Filtros por comodidad (dato oficial por bus). Independientes y acumulables.
  const [fAccess, setFAccess] = useState(false);
  const [fAc, setFAc] = useState(false);
  const shown = arrivals.filter((a) => (!fAccess || isAccessibleArrival(a)) && (!fAc || arrivalHasAc(a)));

  return (
    <>
      <div className={`sheet-backdrop mobile-only ${open ? "open" : ""}`} onClick={handleClose} />

      <div className={`bottom-sheet ${open ? "open" : ""}`}>
        <div className="sheet-handle" />

        <div className="sheet-header">
          <div className="icon"><Icons.Bus size={22} /></div>
          <div className="text">
            <div className="eyebrow">Parada #{stop?.stopCode || stopId}</div>
            <div className="name">{stop?.stopName || `Parada ${stopId}`}</div>
          </div>
          <div className="actions">
            <button className={`icon-btn sm ${isFav ? "active" : ""} ${favPulse ? "fav-pulse" : ""}`} onClick={handleToggleFav} aria-label={isFav ? "Quitar de favoritos" : "Agregar a favoritos"}>
              <Icons.Star size={18} filled={isFav} />
            </button>
            <button className="icon-btn sm" onClick={handleShare} aria-label="Compartir parada">
              <Icons.Share size={18} />
            </button>
            <button className="icon-btn sm" onClick={refetch} aria-label="Actualizar">
              <span style={loading ? { animation: "spin 1s linear infinite", display: "grid" } : undefined}><Icons.Refresh size={18} /></span>
            </button>
            <button className="icon-btn sm" onClick={handleClose} aria-label="Cerrar">
              <Icons.Close size={18} />
            </button>
          </div>
          {copied && <div className="share-copied" role="status">Link copiado ✓</div>}
        </div>

        {/* Líneas — tocar para ver recorrido completo */}
        {realLines.length > 0 && (
          <div className="sheet-lines">
            {realLines.slice(0, 14).map((l) => (
              <button key={l} onClick={() => setLineDetail({ line: l })} title={`Ver recorrido línea ${l}`} className="tap-card">
                <LineBadge num={l} size="sm" />
              </button>
            ))}
            {realLines.length > 14 && <span style={{ alignSelf: "center", font: "var(--font-small)", color: "var(--text-3)" }}>+{realLines.length - 14}</span>}
          </div>
        )}

        <div className="sheet-status">
          {isOffline ? (
            <><span className="pip" style={{ background: "var(--accent)" }} />Sin conexión · mostrando caché</>
          ) : lastFetchFailed ? (
            <><span className="pip" style={{ background: "var(--warn)" }} />Error al actualizar{lastUpdated ? ` · datos de ${formatRelativeTime(lastUpdated)}` : ""}</>
          ) : lastUpdated ? (
            <><span className="pip" />En vivo · actualizado {formatRelativeTime(lastUpdated)}</>
          ) : arrivals.length > 0 ? (
            <><span className="pip" />Actualizando…</>
          ) : (
            <><span className="pip" />Buscando servicios…</>
          )}
        </div>

        {firstUrgent && (
          <div className="urgent-banner"><Icons.Bus size={18} /><span>El bus está llegando — preparate para salir</span></div>
        )}

        {arrivals.length > 0 && (
          <div className="arrival-filters">
            <button className={`filter-chip ${fAccess ? "on" : ""}`} onClick={() => setFAccess((v) => !v)} aria-pressed={fAccess}>
              <Icons.Wheelchair size={14} /> Accesible
            </button>
            <button className={`filter-chip ${fAc ? "on" : ""}`} onClick={() => setFAc((v) => !v)} aria-pressed={fAc}>
              <Icons.Ac size={15} /> Con aire
            </button>
          </div>
        )}

        <div className="sheet-arrivals scrollbar-none">
          {loading && !arrivals.length ? (
            Array.from({ length: 5 }).map((_, i) => <div key={i} className="skel" style={{ height: 64, marginBottom: 8 }} />)
          ) : arrivals.length === 0 ? (
            isOffline ? (
              <EmptyState emoji="📡" title="Sin conexión" sub="No hay internet ahora. Cuando vuelva, actualizamos solos." onRetry={refetch} />
            ) : lastFetchFailed ? (
              <EmptyState emoji="💤" title="Los servidores del STM están durmiendo" sub="No pudimos traer las llegadas en este momento. Nosotros estamos listos — probá de nuevo." onRetry={refetch} />
            ) : interior ? (
              <EmptyState icon={<Icons.Bus size={28} />} title="Ningún bus se acerca ahora" sub="Mostramos los buses del interior en vivo cuando esta parada es su próxima. Mirá el mapa para ver todos los que circulan en la zona." />
            ) : (
              <EmptyState icon={<Icons.Bus size={28} />} title="Sin buses próximamente" sub="No hay servicios en los próximos 30 min." />
            )
          ) : shown.length === 0 ? (
            <EmptyState icon={<Icons.Bus size={28} />} title="Ninguno confirma ese filtro" sub="El dato de accesibilidad/aire no siempre viene por bus. Probá sin filtro." />
          ) : (
            shown.map((a, i) => (
              <ArrivalRow key={`${a.lineId}-${i}`} arrival={a} stopId={stopId} onLinePress={(line, destination, company) => setLineDetail({ line, destination, company })} />
            ))
          )}
        </div>

        {arrivals.length > 0 && (
          <OccupancySection stopId={stopId} lines={[...new Set(arrivals.map((a) => a.lineName))]} />
        )}

        {stop && <NearbyAlternatives stop={stop} currentLines={realLines.length ? realLines : stop.lines} />}

        <div className="sheet-footer">
          {fAccess || fAc ? `${shown.length} de ${arrivals.length}` : arrivals.length} servicios próximos · datos STM Montevideo
        </div>
      </div>

      <AnimatePresence>
        {lineDetail && (
          <LineDetailSheet
            line={lineDetail.line}
            destination={lineDetail.destination}
            liveCompany={lineDetail.company}
            highlightStopId={stopId}
            onClose={() => setLineDetail(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * Paradas a pasos con LÍNEAS QUE ACÁ NO PASAN. Lo "mágico" de la experiencia de parada:
 * "caminá 90 m y tenés el 121 que por esta no para". Solo aparece si hay líneas extra
 * reales (sino no aporta). Informativo (no navega) para no romper la animación del sheet.
 */
function NearbyAlternatives({ stop, currentLines }: { stop: BusStop; currentLines: string[] }) {
  const others = useMemo(() => {
    const cur = new Set(currentLines);
    return getNearbyStopsClient(stop.stopLat, stop.stopLon, 300, 8)
      .filter((s) => s.stopId !== stop.stopId)
      .map((s) => ({
        s,
        extra: s.lines.filter((l) => !cur.has(l)),
        dist: Math.round(distanceTo(stop.stopLat, stop.stopLon, s.stopLat, s.stopLon)),
      }))
      .filter((x) => x.extra.length > 0)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 3);
  }, [stop, currentLines]);

  if (others.length === 0) return null;

  return (
    <div className="nearby-alt">
      <div className="na-head"><Icons.Walk size={14} /> A pasos también pasan</div>
      {others.map(({ s, extra, dist }) => (
        <div key={s.stopId} className="na-row">
          <div className="na-info">
            <div className="na-name">{s.stopName.split(" – ")[0]} <span>· {dist} m</span></div>
            <div className="na-lines">
              {extra.slice(0, 8).map((l) => <LineBadge key={l} num={l} size="xs" />)}
              {extra.length > 8 && <span className="na-more">+{extra.length - 8}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
