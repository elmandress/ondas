"use client";

/**
 * Estados no-resultado del planificador: vacío (enseña el valor), sin rutas
 * (paradas cercanas a ambos puntos) y fuera de cobertura/interdepartamental
 * (con salidas oficiales MTOP cuando aplica).
 */
import { useState, useEffect, useMemo } from "react";
import { STOPS_DATASET } from "@/lib/stm";
import { distanceTo } from "@/lib/utils";
import type { AreaCheck } from "@/lib/route-area";
import { Icons, type IconName } from "@/components/brand/Icons";
import type { Place } from "@/components/route/types";

export function PlannerEmptyState() {
  // Empty state que ENSEÑA el valor en vez de pedir trabajo: dice qué vas a obtener,
  // con pasos claros (para que cualquiera —incluido alguien de 60— entienda sin pensar).
  const steps: Array<{ icon: IconName; title: string; sub: string }> = [
    { icon: "Pin", title: "Elegí a dónde vas", sub: "Una dirección, un lugar o una parada" },
    { icon: "Bus", title: "Te decimos qué bus", sub: "Qué línea tomar y dónde subirte" },
    { icon: "Clock", title: "Y cuándo salir", sub: "Cuánto falta y cuánto tardás, en vivo" },
  ];
  return (
    <div className="flex flex-col items-center text-center py-12 px-6">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "var(--accent-soft)" }}>
        <span style={{ color: "var(--accent)" }}><Icons.Route size={30} /></span>
      </div>
      <h3 className="text-headline mb-1">¿A dónde querés ir?</h3>
      <p className="text-body text-slate-500 mb-7" style={{ maxWidth: 300 }}>Elegí desde dónde salís y a dónde vas. Te armamos el viaje, sin vueltas.</p>
      <div className="w-full" style={{ maxWidth: 340, display: "flex", flexDirection: "column", gap: 10 }}>
        {steps.map((s, i) => {
          const Ico = Icons[s.icon];
          return (
            <div key={s.title} style={{ display: "flex", alignItems: "center", gap: 13, padding: "12px 14px", borderRadius: "var(--r-card)", background: "var(--surface)", border: "1px solid var(--border)", textAlign: "left" }}>
              <span style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", background: "var(--accent-soft)", color: "var(--accent)", font: "800 14px/1 var(--ff)" }}>{i + 1}</span>
              <span style={{ flexShrink: 0, color: "var(--text-2)", display: "grid" }}><Ico size={18} /></span>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: "700 14px/1.2 var(--ff)", color: "var(--text)" }}>{s.title}</div>
                <div style={{ font: "var(--font-small)", color: "var(--text-3)", marginTop: 2 }}>{s.sub}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function NoRoutesState({ from, to }: { from: Place; to: Place }) {
  // SRS FR-4.8: mensaje útil con paradas cercanas a AMBOS puntos.
  const fromStops = useMemo(() => {
    return STOPS_DATASET
      .map(s => ({ s, d: distanceTo(from.lat, from.lon, s.stopLat, s.stopLon) }))
      .filter(x => x.d <= 800)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
  }, [from]);

  const toStops = useMemo(() => {
    return STOPS_DATASET
      .map(s => ({ s, d: distanceTo(to.lat, to.lon, s.stopLat, s.stopLon) }))
      .filter(x => x.d <= 800)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
  }, [to]);

  const directDist = distanceTo(from.lat, from.lon, to.lat, to.lon);

  return (
    <div className="flex flex-col py-8 px-4">
      <div className="flex items-center gap-3 mb-4 px-2">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--surface)" }}>
          <svg className="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-headline">No encontramos una ruta directa</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {directDist < 1000 ? "Está muy cerca, considerá caminar." : `Distancia directa: ${(directDist/1000).toFixed(1)} km.`}
            {" "}Tocá una parada para ver llegadas o probá otro destino.
          </p>
        </div>
      </div>

      {fromStops.length > 0 && (
        <div className="w-full text-left mb-4">
          <p className="text-eyebrow mb-2">Paradas cerca del origen</p>
          <div className="space-y-1.5">
            {fromStops.map(({ s, d }) => (
              <div key={s.stopId} className="card-soft p-2.5 flex justify-between items-center">
                <div className="min-w-0 flex-1 pr-2">
                  <p className="text-sm font-semibold text-white truncate">{s.stopName}</p>
                  <p className="text-[11px] text-slate-500">{d}m · {s.lines.length} {s.lines.length === 1 ? "línea" : "líneas"}</p>
                </div>
                <div className="flex gap-1 flex-wrap justify-end max-w-[50%]">
                  {s.lines.slice(0, 3).map(l => (
                     <span key={l} className="text-[10px] font-black px-1.5 py-0.5 rounded text-white"
                     style={{ background: "rgba(255,255,255,0.08)", border: "1px solid var(--border-strong)" }}>{l}</span>
                  ))}
                  {s.lines.length > 3 && <span className="text-[10px] text-slate-500">+{s.lines.length - 3}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {toStops.length > 0 && (
        <div className="w-full text-left">
          <p className="text-eyebrow mb-2">Paradas cerca del destino</p>
          <div className="space-y-1.5">
            {toStops.map(({ s, d }) => (
              <div key={s.stopId} className="card-soft p-2.5 flex justify-between items-center">
                <div className="min-w-0 flex-1 pr-2">
                  <p className="text-sm font-semibold text-white truncate">{s.stopName}</p>
                  <p className="text-[11px] text-slate-500">{d}m · {s.lines.length} {s.lines.length === 1 ? "línea" : "líneas"}</p>
                </div>
                <div className="flex gap-1 flex-wrap justify-end max-w-[50%]">
                  {s.lines.slice(0, 3).map(l => (
                     <span key={l} className="text-[10px] font-black px-1.5 py-0.5 rounded text-white"
                     style={{ background: "rgba(255,255,255,0.08)", border: "1px solid var(--border-strong)" }}>{l}</span>
                  ))}
                  {s.lines.length > 3 && <span className="text-[10px] text-slate-500">+{s.lines.length - 3}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {fromStops.length === 0 && toStops.length === 0 && (
        <p className="text-body text-slate-500 text-center mt-2">
          No hay paradas STM cerca. Probá un punto más cercano al centro de Montevideo.
        </p>
      )}
    </div>
  );
}

// ── OutOfAreaState (FR-4.6) ───────────────────────────────────────
interface InterdeptSalida { empresa: string; salida: string; llegada: string; dias: string }
interface InterdeptResp { found: boolean; ciudad?: string; depto?: string; totalDiarias?: number; empresas?: string[]; terminal?: string; salidas: InterdeptSalida[]; fuente?: string }

export function OutOfAreaState({ info, destName, onPlanToTerminal }: { info: AreaCheck; destName?: string; onPlanToTerminal?: () => void }) {
  const isInterdept = info.kind === "interdepartmental";
  // Para viajes interdepartamentales, traemos las próximas salidas oficiales del MTOP.
  const [inter, setInter] = useState<InterdeptResp | null>(null);
  useEffect(() => {
    if (!isInterdept || !destName) { setInter(null); return; }
    let cancelled = false;
    fetch(`/api/interdept?dest=${encodeURIComponent(destName)}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setInter(d); })
      .catch(() => { if (!cancelled) setInter(null); });
    return () => { cancelled = true; };
  }, [isInterdept, destName]);

  if (info.kind === "ok") return null;

  const whichLabel = info.which === "from" ? "El origen" :
                     info.which === "to" ? "El destino" : "Origen y destino";

  const title = isInterdept ? "Viaje interdepartamental" : "Fuera del área de cobertura";

  return (
    <div className="flex flex-col items-center text-center py-10 px-6">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
           style={{ background: isInterdept ? "rgba(168,85,247,0.15)" : "rgba(251,191,36,0.15)" }}>
        {isInterdept ? (
          <svg className="w-7 h-7 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><circle cx="9" cy="15" r="1.5"/><circle cx="15" cy="15" r="1.5"/>
          </svg>
        ) : (
          <svg className="w-7 h-7 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        )}
      </div>
      <h3 className="text-headline mb-1.5">{title}</h3>

      {/* Salidas interdepartamentales reales (horario oficial MTOP). */}
      {isInterdept && inter?.found && inter.salidas.length > 0 ? (
        <div className="w-full max-w-sm mt-1">
          {/* A dónde ir y por qué */}
          {inter.terminal && (
            <div className="interdept-where">
              <Icons.Pin size={15} />
              <span>Estos servicios salen de la <b>{inter.terminal}</b>. Es de larga distancia: comprás el pasaje ahí o por la empresa.</span>
            </div>
          )}
          {inter.empresas && inter.empresas.length > 0 && (
            <p className="text-[12px] text-slate-500 mb-2">
              {inter.empresas.length === 1 ? "Compañía: " : `${inter.empresas.length} compañías: `}
              <span className="text-slate-300">{inter.empresas.join(" · ")}</span>
            </p>
          )}
          <p className="text-body text-slate-500 mb-3">
            Próximas salidas desde Montevideo hacia <b className="text-slate-300">{inter.ciudad}</b>:
          </p>
          <div className="interdept-list">
            {inter.salidas.map((s, i) => (
              <div key={i} className="interdept-row">
                <span className="id-time tnum">{s.salida}</span>
                <div className="id-body">
                  <span className="id-emp">{s.empresa}</span>
                  <span className="id-sub">llega {s.llegada || "—"}</span>
                </div>
                <span className="id-tag">horario</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-600 mt-2.5">
            {inter.totalDiarias} salidas hoy · datos oficiales MTOP (programados)
          </p>
          <div className="flex flex-col gap-2 mt-3">
            {/* Cómo llegar a la terminal en bus desde donde estás. */}
            {onPlanToTerminal && (
              <button
                onClick={onPlanToTerminal}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: "var(--accent)", color: "#1a1206" }}
              >
                <Icons.Bus size={16} /> Cómo llegar a la Terminal Tres Cruces
              </button>
            )}
            <a
              href="https://www.trescruces.com.uy/horarios" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-purple-300"
              style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.25)" }}
            >
              Comprar pasaje / más horarios
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
              </svg>
            </a>
          </div>
        </div>
      ) : (
        <>
          <p className="text-body text-slate-500 leading-relaxed max-w-sm">
            {isInterdept ? (
              <>{whichLabel} {info.which === "both" ? "están" : "está"} a más de 80km de Montevideo. Es un viaje interdepartamental — salís desde el Terminal Tres Cruces.</>
            ) : (
              <>{whichLabel} {info.which === "both" ? "están" : "está"} fuera del área de cobertura (Montevideo + Canelones metropolitano). Probá moviendo el pin más cerca de la ciudad.</>
            )}
          </p>
          {isInterdept && (
            <a
              href="https://www.trescruces.com.uy/horarios" target="_blank" rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-purple-300"
              style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.25)" }}
            >
              Ver horarios Terminal Tres Cruces
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
              </svg>
            </a>
          )}
        </>
      )}
    </div>
  );
}
