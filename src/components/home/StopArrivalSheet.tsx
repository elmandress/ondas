"use client";

import { AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useArrivals } from "@/hooks/useArrivals";
import { useInteriorArrivals, isInteriorStop } from "@/hooks/useInteriorArrivals";
import { useStopInfo } from "@/hooks/useStopInfo";
import { useColdAlternatives } from "@/hooks/useColdAlternatives";
import { useBackClose } from "@/hooks/useBackClose";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { canonLine } from "@/lib/line-name";
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
import ColdModeSuggestion from "@/components/home/ColdModeSuggestion";

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
  const inZone = interior ? int.inZone : [];
  const loading = interior ? int.loading : stm.loading;
  const lastUpdated = interior ? new Date() : stm.lastUpdated;
  const lastFetchFailed = interior ? false : stm.lastFetchFailed;
  const isOffline = interior ? false : stm.isOffline;
  const inactiveLines = interior ? [] : stm.inactiveLines;
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
  // Atrás del sistema cierra el sheet, no la app (R58c).
  useBackClose(handleClose);

  // Drag-to-close (R58d): el handle invitaba a arrastrar y no hacía nada (affordance
  // falsa). Zona de drag = handle + header (no la lista, que necesita su scroll).
  // Soltar con >90px de arrastre cierra; menos, vuelve con la transición del sheet.
  const sheetRef = useRef<HTMLDivElement>(null);
  useFocusTrap(sheetRef); // R70: foco atrapado en la parada; el drill-down a recorrido apila el trap
  const dragStartY = useRef<number | null>(null);
  const dragDy = useRef(0);
  const onDragStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    dragDy.current = 0;
    if (sheetRef.current) sheetRef.current.style.transition = "none";
  };
  const onDragMove = (e: React.TouchEvent) => {
    if (dragStartY.current === null || !sheetRef.current) return;
    const dy = Math.max(0, e.touches[0].clientY - dragStartY.current);
    dragDy.current = dy;
    sheetRef.current.style.transform = `translateY(${dy}px)`;
  };
  const onDragEnd = () => {
    const el = sheetRef.current;
    if (el) { el.style.transition = ""; el.style.transform = ""; }
    if (dragDy.current > 90) handleClose();
    dragStartY.current = null;
    dragDy.current = 0;
  };

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

  // Modo frío proactivo: espera larga acá (>15 min o sin servicio) → alternativas
  // alcanzables a pasos con ETA en vivo. Solo con datos frescos, online y STM (las
  // paradas del interior usan otra fuente y no tienen densidad de paradas vecinas).
  const coldActive = !interior && !isOffline && !lastFetchFailed && lastUpdated !== null;
  const coldSuggestions = useColdAlternatives(
    stop,
    arrivals.length > 0 ? arrivals[0].eta : null,
    realLines,
    coldActive,
  );

  // Filtros por comodidad (dato oficial por bus). Independientes y acumulables.
  const [fAccess, setFAccess] = useState(false);
  const [fAc, setFAc] = useState(false);
  const shown = arrivals.filter((a) => (!fAccess || isAccessibleArrival(a)) && (!fAc || arrivalHasAc(a)));

  return (
    <>
      <div className={`sheet-backdrop mobile-only ${open ? "open" : ""}`} onClick={handleClose} />

      <div ref={sheetRef} className={`bottom-sheet ${open ? "open" : ""}`} role="dialog" aria-modal="true" aria-label={`Parada ${stop?.stopName || stopId}`}>
        <div onTouchStart={onDragStart} onTouchMove={onDragMove} onTouchEnd={onDragEnd}>
        <div className="sheet-handle" />

        {/* R58: acciones en fila propia junto al eyebrow — antes los 4 botones le
            robaban más de media pantalla al nombre ("Av Gral Garibal…"). El nombre
            ahora ocupa todo el ancho disponible (2 líneas reales). */}
        <div className="sheet-header">
          <div className="icon"><Icons.Bus size={22} /></div>
          <div className="text">
            <div className="head-row">
              <div className="eyebrow">Parada #{stop?.stopCode || stopId}</div>
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
            </div>
            <div className="name">{stop?.stopName || `Parada ${stopId}`}</div>
          </div>
          {copied && <div className="share-copied" role="status">Link copiado ✓</div>}
        </div>
        </div>{/* fin zona de drag */}

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
            <><span className="pip" style={{ background: "var(--accent-bg)" }} />Sin conexión · mostrando caché</>
          ) : lastFetchFailed ? (
            <><span className="pip" style={{ background: "var(--warn)" }} />Error al actualizar{lastUpdated ? ` · datos de ${formatRelativeTime(lastUpdated)}` : ""}</>
          ) : lastUpdated ? (
            <><span className="pip" style={{ background: "#10b981" }} />En vivo · actualizado {formatRelativeTime(lastUpdated)}</>
          ) : arrivals.length > 0 ? (
            <><span className="pip" style={{ background: "var(--text-3)" }} />Actualizando…</>
          ) : (
            <><span className="pip" style={{ background: "var(--text-3)" }} />Buscando servicios…</>
          )}
        </div>

        {firstUrgent && (
          <div className="urgent-banner"><Icons.Bus size={18} /><span>El bus está llegando — preparate para salir</span></div>
        )}

        <ColdModeSuggestion suggestions={coldSuggestions} />

        {arrivals.length > 0 && (
          <div className="arrival-filters">
            <button className={`filter-chip ${fAccess ? "on" : ""}`} onClick={() => setFAccess((v) => !v)} aria-pressed={fAccess} aria-label="Mostrar solo buses accesibles con piso bajo">
              <Icons.Wheelchair size={14} /> Accesible
            </button>
            <button className={`filter-chip ${fAc ? "on" : ""}`} onClick={() => setFAc((v) => !v)} aria-pressed={fAc} aria-label="Mostrar solo buses con aire acondicionado">
              <Icons.Ac size={15} /> Con aire
            </button>
          </div>
        )}

        {/* Live region (PG-4): anuncia el próximo bus al lector de pantalla cuando los
            datos del refresh cambian (polite, una línea — no satura cada 15s). */}
        {arrivals.length > 0 && (
          <p className="sr-only" role="status">
            Próximo bus: línea {arrivals[0].lineName} hacia {arrivals[0].destination},{" "}
            {!Number.isFinite(arrivals[0].eta) || arrivals[0].eta <= 0 ? "llegando ahora" : `en ${Math.round(arrivals[0].eta)} minutos`}
          </p>
        )}
        {/* Honestidad del interior: no hay horario oficial → el ETA sale de la posición
            en vivo y una estimación de tiempo entre paradas. Lo decimos la primera vez
            que aparece un "~", para no mostrarlo con la confianza de un ETA de MVD. */}
        {interior && arrivals.length > 0 && (
          <p className="interior-eta-note">
            <Icons.Clock size={13} /> Tiempos estimados (~): el interior no publica horario;
            los calculamos de la posición en vivo del bus.
          </p>
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
              <EmptyState
                icon={<Icons.Bus size={28} />}
                title="No viene ninguno ahora"
                sub={inactiveLines.length > 0
                  ? "Abajo te decimos a qué hora vuelven y qué para a pasos."
                  : "Sin servicios en los próximos 30 min. Mirá las paradas a pasos abajo."}
              />
            )
          ) : shown.length === 0 ? (
            <EmptyState icon={<Icons.Bus size={28} />} title="Ninguno confirma ese filtro" sub="El dato de accesibilidad/aire no siempre viene por bus. Probá sin filtro." />
          ) : (
            shown.map((a, i) => (
              // R58d: key ESTABLE por bus (no por índice) — con índice, cada refresh de
              // 20s remontaba las filas y la animación de entrada se repetía (parpadeo).
              <ArrivalRow key={a.vehicleId ? `v${a.vehicleId}` : `s-${a.lineId}-${i}`} arrival={a} stopId={stopId} onLinePress={(line, destination, company) => setLineDetail({ line, destination, company })} />
            ))
          )}
        </div>

        {arrivals.length > 0 && (
          <OccupancySection stopId={stopId} lines={[...new Set(arrivals.map((a) => a.lineName))]} />
        )}

        {/* R64: líneas que paran acá pero NO corren ahora — honestidad. En vez de
            ocultarlas (¿falló la app o no pasa el bus?), las mostramos con su retorno. */}
        {!interior && inactiveLines.length > 0 && (
          <div className="inactive-lines">
            <div className="il-head">No están pasando ahora</div>
            {inactiveLines.slice(0, 6).map((il) => (
              <div key={il.line} className="il-row">
                <LineBadge num={il.line} size="sm" />
                <span className="il-when">
                  vuelve ~<b>{il.resumesHHMM}</b>
                  {il.resumesInMin < 90 ? <span className="il-soon"> · en {il.resumesInMin} min</span> : null}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Interior: buses de líneas de esta parada que circulan cerca pero que el grafo
            no pudo atar a esta parada. Honestidad: no afirmamos que vienen (no hay ETA),
            pero no escondemos que el servicio está activo. Espejo de "No están pasando". */}
        {interior && inZone.length > 0 && (
          <div className="inactive-lines">
            <div className="il-head">Circulando en la zona</div>
            {inZone.map((z) => (
              <div key={z.line} className="il-row">
                <LineBadge num={z.line} size="sm" />
                <span className="il-when">
                  a ~<b>{(z.distM / 1000).toFixed(1)} km</b>
                  <span className="il-caveat"> · sin confirmar que viene</span>
                </span>
              </div>
            ))}
          </div>
        )}

        {stop && <NearbyAlternatives stop={stop} currentLines={realLines.length ? realLines : stop.lines} />}

        <div className="sheet-footer">
          {fAccess || fAc ? `${shown.length} de ${arrivals.length}` : arrivals.length} servicios próximos · {interior ? "posición en vivo del interior (Busmatick)" : "datos STM Montevideo"}
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
    // R58e: comparación CANÓNICA — currentLines viene de la API en vivo ("CE1") y
    // s.lines de stops.json/GTFS ("Ce1"). Sin canon, la misma línea aparecía como
    // "extra que acá no pasa" en la parada vecina (justo lo que esto debe evitar).
    const cur = new Set(currentLines.map(canonLine));
    return getNearbyStopsClient(stop.stopLat, stop.stopLon, 300, 8)
      .filter((s) => s.stopId !== stop.stopId)
      .map((s) => ({
        s,
        extra: s.lines.filter((l) => !cur.has(canonLine(l))),
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
