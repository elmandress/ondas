"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import type { Arrival } from "@/lib/stm";
import { walkToLeaveTime, leaveNowUrgency, formatEta, dynamicBuffer } from "@/lib/utils";
import { Icons } from "@/components/brand/Icons";
import LineBadge from "@/components/ui/LineBadge";

interface LeaveNowHeroProps {
  arrivals: Arrival[];
  loading: boolean;
  walkMinutes: number;
  stopName?: string;
  stopAlias?: string;
  onTap: () => void;
}

export default function LeaveNowHero({ arrivals, loading, walkMinutes, stopName, stopAlias, onTap }: LeaveNowHeroProps) {
  const first = arrivals[0];

  // Tick de 1s para re-renderizar el countdown; el valor no se lee directamente.
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const tick = () => setNowTick(Math.floor(Date.now() / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const leaveInMin = first ? walkToLeaveTime(walkMinutes, first.eta) : 99;
  const urgency = leaveNowUrgency(leaveInMin); // "now" | "soon" | "chill"

  // Segundos exactos para cuando queda poco (< 3 min). Restamos caminata + el mismo
  // buffer de seguridad (3–5 min) que usa walkToLeaveTime → coherente con el contador.
  const etaSec = first?.etaSeconds ?? (first ? first.eta * 60 : null);
  const walkSec = walkMinutes * 60;
  const leaveInSec = etaSec !== null ? Math.max(0, etaSec - walkSec - dynamicBuffer(walkMinutes) * 60) : null;
  const showSeconds = leaveInSec !== null && leaveInSec < 180 && urgency !== "chill";

  const progressPct = leaveInMin >= 20 ? 0 : Math.min(1, (20 - leaveInMin) / 20);

  if (loading && !arrivals.length) {
    return <div className="hero-card skel" style={{ display: "block", minHeight: 180 }} />;
  }

  if (!arrivals.length) {
    return (
      <div className="hero-card" style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: "var(--surface)", display: "grid", placeItems: "center", color: "var(--text-3)" }}>
          <Icons.Bus size={24} />
        </div>
        <p style={{ font: "var(--font-small)", color: "var(--text-3)" }}>No viene ninguno por ahora</p>
      </div>
    );
  }

  const label = urgency === "now" ? "¡Salí ahora!" : urgency === "soon" ? "salí en" : "tenés tiempo";
  const displayName = stopAlias || stopName?.split(" – ")[0] || stopName;

  // Texto del contador grande
  let countNode: React.ReactNode;
  if (urgency === "now") {
    countNode = <span>¡Ya!</span>;
  } else if (showSeconds && leaveInSec !== null) {
    countNode = <span className="tnum">{Math.floor(leaveInSec / 60)}:{String(leaveInSec % 60).padStart(2, "0")}</span>;
  } else {
    countNode = (
      <>
        <span className="tnum">{leaveInMin}</span>
        <span className="unit">min</span>
      </>
    );
  }

  return (
    <motion.button
      whileTap={{ scale: 0.985 }}
      onClick={onTap}
      className={`hero-card state-${urgency}`}
      style={{ display: "grid", width: "100%", cursor: "pointer", textAlign: "left", "--progress": `${progressPct * 100}%` } as React.CSSProperties}
    >
      <div className="hero-left">
        <div className="hero-label">{label}</div>
        <div className="hero-count">{countNode}</div>
        <div className="hero-walk">
          <Icons.Walk size={15} />
          <span><b>{walkMinutes} min</b> a pie{displayName ? ` · ${displayName}` : ""}</span>
        </div>
      </div>

      <div className="hero-right">
        {arrivals.slice(0, 3).map((a, i) => (
          <div key={i} className={`hero-chip ${a.realtime ? "" : "sched"}`}>
            <LineBadge num={a.lineName} size="sm" color={a.lineColor} />
            <span className="hc-dest">{a.destination || a.lineName}</span>
            <span className="hc-eta">{formatEta(a.eta)}<span className="live-dot" /></span>
          </div>
        ))}
      </div>

      <span className="hero-seeall">Ver todos <Icons.Chevron size={13} /></span>
      <div className="hero-progress" />
    </motion.button>
  );
}
