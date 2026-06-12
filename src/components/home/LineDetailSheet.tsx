"use client";

import { useEffect, useRef, useState } from "react";
import { useBackClose } from "@/hooks/useBackClose";
import { motion } from "framer-motion";
import { useLineStops } from "@/hooks/useLineStops";
import { titleCaseDestination } from "@/lib/utils";
import { loadOperators, resolveOperator, type OperatorInfo } from "@/lib/operators";
import { shareLine } from "@/lib/share";
import { Icons } from "@/components/brand/Icons";
import { haptic } from "@/lib/haptics";

interface LineDetailSheetProps {
  line: string;
  destination?: string;
  highlightStopId?: string;
  /** Empresa del bus en vivo (de la API), si se conoce — prioriza sobre el mapeo estático. */
  liveCompany?: string;
  onClose: () => void;
}

export default function LineDetailSheet({
  line,
  destination = "",
  highlightStopId,
  liveCompany,
  onClose,
}: LineDetailSheetProps) {
  // Atrás del sistema cierra el sheet, no la app (R58c).
  useBackClose(onClose);
  const { stops, headsign, loading, notFound } = useLineStops(line, destination);
  const highlightRef = useRef<HTMLDivElement | null>(null);

  // Empresa operadora + contacto + WiFi (datos reales; sin clave inventada).
  const [operator, setOperator] = useState<OperatorInfo | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadOperators().then((data) => {
      if (!cancelled) setOperator(resolveOperator(data, line, liveCompany));
    });
    return () => { cancelled = true; };
  }, [line, liveCompany]);

  // Scroll automático a la parada resaltada cuando carguen las paradas
  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [stops, highlightStopId]);

  const totalStops = stops.length;

  // Compartir línea → /linea/{line}. Feedback honesto en desktop (copiar).
  const [copied, setCopied] = useState(false);
  const handleShare = async () => {
    haptic(10);
    const r = await shareLine(line, headsign || destination);
    if (r === "copied") { setCopied(true); setTimeout(() => setCopied(false), 1800); }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-[6px] z-[1100]"
      />

      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 340 }}
        className="fixed bottom-0 left-0 right-0 z-[1110] max-w-md mx-auto"
        style={{ maxHeight: "90vh" }}
        // Drag-to-close (R58d): el handle ya no es decorativo.
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info) => { if (info.offset.y > 100 || info.velocity.y > 600) onClose(); }}
      >
        <div
          className="flex flex-col overflow-hidden rounded-t-[18px] border-t border-white/[0.07]"
          style={{ background: "rgba(8,13,26,0.97)", backdropFilter: "blur(32px)", maxHeight: "90vh" }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-8 h-[3px] rounded-full bg-white/15" />
          </div>

          {/* Header */}
          <div className="px-5 pt-2 pb-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg text-white flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.07)", border: "1.5px solid rgba(255,255,255,0.12)" }}
              >
                {line}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                  Recorrido completo
                </p>
                <h2 className="text-[16px] font-bold text-white leading-tight mt-0.5 truncate">
                  {titleCaseDestination(headsign || destination || `Línea ${line}`)}
                </h2>
                {totalStops > 0 && (
                  <p className="text-[11px] text-slate-500 mt-0.5">{totalStops} paradas · tiempo desde el inicio del recorrido</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleShare}
                  aria-label="Compartir línea"
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-300"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                >
                  <Icons.Share size={17} />
                </button>
                <button
                  onClick={onClose}
                  aria-label="Cerrar"
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Empresa operadora + WiFi (datos reales). */}
          {operator && (
            <div className="line-operator">
              <div className="lo-row">
                <span className="lo-label">Empresa</span>
                <span className="lo-empresa">{operator.empresa}</span>
                {operator.web && (
                  <a className="lo-link" href={operator.web} target="_blank" rel="noopener noreferrer">
                    Sitio web
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
                  </a>
                )}
              </div>
              {operator.wifi && (
                <div className="lo-wifi">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12.55a11 11 0 0 1 14 0"/><path d="M8.5 16.4a6 6 0 0 1 7 0"/><path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/></svg>
                  <span><b>WiFi a bordo:</b> {operator.wifi.via}</span>
                  {operator.wifi.appUrl && (
                    <a className="lo-link" href={operator.wifi.appUrl} target="_blank" rel="noopener noreferrer">app</a>
                  )}
                </div>
              )}
            </div>
          )}

          {copied && <div className="share-copied" role="status">Link copiado ✓</div>}

          <div className="h-px mx-5 flex-shrink-0" style={{ background: "rgba(255,255,255,0.05)" }} />

          {/* Stop list */}
          <div className="flex-1 overflow-y-auto py-2">
            {(loading || (!notFound && stops.length === 0)) ? (
              <div className="px-5 space-y-2 py-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-12 skeleton rounded-xl" />
                ))}
              </div>
            ) : notFound ? (
              <div className="py-16 flex flex-col items-center gap-3 px-5 text-center">
                <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <svg className="w-7 h-7 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <p className="text-slate-400 text-sm font-semibold">No se encontró el recorrido</p>
                <p className="text-slate-600 text-xs">La línea {line} puede no estar en la base de datos local</p>
              </div>
            ) : (
              <div className="relative">
                {stops.map((stop, idx) => {
                  const isHighlight = stop.stopId === highlightStopId;
                  const isFirst = idx === 0;
                  const isLast = idx === stops.length - 1;
                  // Tiempo de viaje ACUMULADO desde la cabecera (dato duro del GTFS:
                  // arrival_seconds relativo). Honesto: "este bus tarda +N min en llegar
                  // acá desde el inicio del recorrido". No es una hora del reloj inventada.
                  const base = stops[0]?.arrivalSeconds ?? 0;
                  const offset = stop.arrivalSeconds - base;
                  const eta = !isFirst && offset > 30 ? `+${Math.round(offset / 60)} min` : null;

                  return (
                    <div
                      key={stop.stopId}
                      ref={isHighlight ? highlightRef : undefined}
                      className="flex items-stretch px-5 py-0"
                    >
                      {/* Timeline line + dot */}
                      <div className="flex flex-col items-center mr-3 flex-shrink-0" style={{ width: 20 }}>
                        {/* Line top */}
                        <div
                          className="w-0.5 flex-1"
                          style={{
                            background: isFirst ? "transparent" : "rgba(255,255,255,0.08)",
                            minHeight: 12,
                          }}
                        />
                        {/* Dot */}
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0 border-2"
                          style={{
                            background: isHighlight ? "var(--accent)" : isFirst || isLast ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.1)",
                            borderColor: isHighlight ? "var(--accent-deep)" : isFirst || isLast ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.08)",
                            boxShadow: isHighlight ? "0 0 0 3px rgba(240,160,32,0.25)" : "none",
                          }}
                        />
                        {/* Line bottom */}
                        <div
                          className="w-0.5 flex-1"
                          style={{
                            background: isLast ? "transparent" : "rgba(255,255,255,0.08)",
                            minHeight: 12,
                          }}
                        />
                      </div>

                      {/* Stop info */}
                      <div
                        className="flex-1 flex items-center justify-between py-2.5 min-h-[48px]"
                        style={{
                          borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.03)",
                        }}
                      >
                        <div className="min-w-0">
                          <p
                            className="text-[13px] font-semibold leading-snug truncate"
                            style={{ color: isHighlight ? "var(--accent)" : "#e2e8f0" }}
                          >
                            {stop.name}
                          </p>
                          <p className="text-[11px] text-slate-600 mt-0.5">#{stop.code}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                          {isHighlight && (
                            <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                              Aquí
                            </span>
                          )}
                          {eta && (
                            <span className="text-[11px] text-slate-600 font-mono">{eta}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}
