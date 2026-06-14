"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import type { Arrival } from "@/lib/stm";
import CountUp from "@/components/ui/CountUp";
import { walkToLeaveTime, leaveNowUrgency, atStopUrgency, formatEta, dynamicBuffer } from "@/lib/utils";
import { Icons } from "@/components/brand/Icons";
import LineBadge from "@/components/ui/LineBadge";

interface LeaveNowHeroProps {
  arrivals: Arrival[];
  loading: boolean;
  walkMinutes: number;
  stopName?: string;
  stopAlias?: string;
  /** La ubicación coincide con la parada (≤40 m) → "estás parado acá ahora". */
  atStop?: boolean;
  /** Líneas de la parada que no corren ahora, con su retorno (R64). Para el empty state. */
  inactiveLines?: Array<{ line: string; resumesHHMM: string; resumesInMin: number }>;
  /** Parada alternativa a pasos (≤150 m) — sugerencia cuando no viene ninguno. */
  altStop?: { stopId: string; name: string; dist: number; lines: number } | null;
  onTap: () => void;
  /** Abrir la parada alternativa sugerida. */
  onAltTap?: () => void;
}

export default function LeaveNowHero({ arrivals, loading, walkMinutes, stopName, stopAlias, atStop, inactiveLines, altStop, onTap, onAltTap }: LeaveNowHeroProps) {
  // Bug B (R67): anclar en el primer bus ALCANZABLE, no en el más próximo. El más
  // próximo puede estar ya demasiado cerca para llegar caminando — anclar ahí mostraba
  // "¡Ya!" para un bus imposible: el usuario corría, lo perdía y llegaba tarde
  // sistemáticamente. Saltamos al siguiente que SÍ da tiempo (caminata − 1 min de gracia
  // para "correr" uno marginal). Si estás EN la parada (atStop) no caminás → vale el más
  // próximo. El contador y los chips arrancan en ese bus (coherencia número↔primer chip).
  const effWalk = atStop ? 0 : walkMinutes;
  let firstIdx = arrivals.findIndex((a) => a.eta >= effWalk - 1);
  if (firstIdx < 0) firstIdx = Math.max(0, arrivals.length - 1);
  const first = arrivals[firstIdx];

  // Tick de 1s para re-renderizar el countdown; el valor no se lee directamente.
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const tick = () => setNowTick(Math.floor(Date.now() / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const leaveInMin = first ? walkToLeaveTime(walkMinutes, first.eta) : 99;
  // A4 (R68): si estás EN la parada no "salís", esperás → el contador muestra la LLEGADA
  // del bus y la urgencia sale de su ETA. El cálculo de salida (Bug B / walkToLeaveTime)
  // queda intacto: solo cambia QUÉ se muestra, no cómo se calcula el tiempo de salida.
  const atStopMode = !!atStop && !!first;
  const busEta = first?.eta ?? 99;
  const urgency = atStopMode ? atStopUrgency(busEta) : leaveNowUrgency(leaveInMin); // "now" | "soon" | "chill"

  // Segundos exactos para cuando queda poco (< 3 min). Restamos caminata + el mismo
  // buffer de seguridad (3–5 min) que usa walkToLeaveTime → coherente con el contador.
  const etaSec = first?.etaSeconds ?? (first ? first.eta * 60 : null);
  const walkSec = walkMinutes * 60;
  const leaveInSec = etaSec !== null ? Math.max(0, etaSec - walkSec - dynamicBuffer(walkMinutes) * 60) : null;
  const showSeconds = leaveInSec !== null && leaveInSec < 180 && urgency !== "chill";

  const progressBase = atStopMode ? busEta : leaveInMin;
  const progressPct = progressBase >= 20 ? 0 : Math.min(1, (20 - progressBase) / 20);

  if (loading && !arrivals.length) {
    return <div className="hero-card skel" style={{ display: "block", minHeight: 180 }} />;
  }

  if (!arrivals.length) {
    // Empty state útil (no seco): decimos a qué hora VUELVE el próximo servicio y
    // ofrecemos una parada alternativa a pasos. "No viene ninguno" a secas manda al
    // usuario a adivinar; esto le da la próxima acción concreta.
    const emptyName = stopAlias || stopName?.split(" – ")[0] || stopName;
    const soonest = inactiveLines && inactiveLines.length > 0 ? inactiveLines[0] : null;
    return (
      <div className="hero-card hero-empty">
        <button onClick={onTap} className="he-main" aria-label={emptyName ? `Ver la parada ${emptyName}` : "Ver la parada"}>
          <span className="he-icon"><Icons.Bus size={22} /></span>
          <span className="he-text">
            <span className="he-title">No viene ninguno ahora</span>
            {soonest ? (
              <span className="he-sub">El próximo vuelve ~<b>{soonest.resumesHHMM}</b>{soonest.resumesInMin < 120 ? ` · en ${soonest.resumesInMin} min` : ""}</span>
            ) : (
              <span className="he-sub">Sin servicios en los próximos 30 min{emptyName ? ` en ${emptyName}` : ""}</span>
            )}
          </span>
          <Icons.Chevron size={18} />
        </button>

        {inactiveLines && inactiveLines.length > 0 && (
          <div className="he-lines" aria-label="Líneas que vuelven a pasar más tarde">
            {inactiveLines.slice(0, 6).map((il) => <LineBadge key={il.line} num={il.line} size="xs" />)}
            {inactiveLines.length > 6 && <span className="he-more">+{inactiveLines.length - 6}</span>}
          </div>
        )}

        {altStop && onAltTap && (
          <button className="he-alt" onClick={onAltTap}>
            <Icons.Walk size={15} />
            <span className="he-alt-txt">A <b>{altStop.dist} m</b> tenés otra parada · {altStop.name}</span>
            <Icons.Chevron size={15} />
          </button>
        )}
      </div>
    );
  }

  // A4: en la parada el rótulo habla de la LLEGADA del bus, no de "salir".
  const label = atStopMode
    ? (urgency === "now" ? "tu bus" : "tu bus en")
    : (urgency === "now" ? "¡Salí ahora!" : urgency === "soon" ? "salí en" : "tenés tiempo");
  const displayName = stopAlias || stopName?.split(" – ")[0] || stopName;

  // Texto del contador grande
  let countNode: React.ReactNode;
  if (atStopMode) {
    // En la parada: mostramos la llegada del bus ("¡Ahí viene!" / "N min"), no "salí ya".
    countNode = urgency === "now"
      ? <span>¡Ahí viene!</span>
      : (
        <>
          <CountUp value={busEta} className="tnum" />
          <span className="unit">min</span>
        </>
      );
  } else if (urgency === "now") {
    countNode = <span>¡Ya!</span>;
  } else if (showSeconds && leaveInSec !== null) {
    countNode = <span className="tnum">{Math.floor(leaveInSec / 60)}:{String(leaveInSec % 60).padStart(2, "0")}</span>;
  } else {
    countNode = (
      <>
        <CountUp value={leaveInMin} className="tnum" />
        <span className="unit">min</span>
      </>
    );
  }

  // Label contextual para lector de pantalla (PG-4): el contador grande no dice qué
  // significa. Acá sí: en la parada = llegada del bus; si no = cuándo salir + caminata.
  const heroAria = atStopMode
    ? `Estás en la parada. Tu bus, el ${first.lineName}, ${busEta <= 1 ? "está llegando" : `llega en ${busEta} minutos`}${displayName ? ` a ${displayName}` : ""}.`
    : urgency === "now"
    ? `Salí ahora para tomar el ${first.lineName}${displayName ? ` desde ${displayName}` : ""}`
    : `Te quedan ${leaveInMin} minutos para salir. ${walkMinutes} minutos a pie${displayName ? ` hasta ${displayName}` : ""}. Próximo ${first.lineName} ${formatEta(first.eta, first.etaApprox)}.`;

  return (
    <motion.button
      whileTap={{ scale: 0.985 }}
      onClick={onTap}
      aria-label={heroAria}
      className={`hero-card state-${urgency}`}
      style={{ display: "grid", width: "100%", cursor: "pointer", textAlign: "left", "--progress": `${progressPct * 100}%` } as React.CSSProperties}
    >
      <div className="hero-left">
        <div className="hero-label">{label}</div>
        <div className="hero-count">{countNode}</div>
        <div className="hero-walk">
          {atStop ? (
            <>
              <Icons.Pin size={15} />
              <span><b>Estás acá</b>{displayName ? ` · ${displayName}` : ""}</span>
            </>
          ) : (
            <>
              <Icons.Walk size={15} />
              <span><b>{walkMinutes} min</b> a pie{displayName ? ` · ${displayName}` : ""}</span>
            </>
          )}
        </div>
      </div>

      <div className="hero-right">
        {/* Solo badge + ETA: el destino completo NO entra en ~160px y truncado a
            "CURV…" no informa y parece roto. Va en title/aria; el detalle, al tocar. */}
        {arrivals.slice(firstIdx, firstIdx + 3).map((a, i) => (
          <div
            key={i}
            className={`hero-chip ${a.realtime ? "" : "sched"}`}
            title={a.destination ? `${a.lineName} → ${a.destination}` : a.lineName}
            aria-label={`Línea ${a.lineName}${a.destination ? ` hacia ${a.destination}` : ""}, ${formatEta(a.eta)}`}
          >
            {/* R59: badge NEUTRO también acá — era el único lugar que pasaba el color
                hash por línea (violaba la decisión v2 documentada en LineBadge). */}
            <LineBadge num={a.lineName} size="sm" />
            <span className="hc-eta">{formatEta(a.eta, false, true)}<span className="live-dot" /></span>
          </div>
        ))}
      </div>

      <span className="hero-seeall">Ver todos <Icons.Chevron size={13} /></span>
      <div className="hero-progress" />
    </motion.button>
  );
}
