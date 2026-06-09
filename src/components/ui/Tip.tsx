"use client";

import { useEffect, useState } from "react";
import { Icons } from "@/components/brand/Icons";

/**
 * Microayuda contextual: aparece UNA vez (por id, en localStorage) donde tiene sentido,
 * no un onboarding genérico al inicio. Descartable. Explica lo que no es obvio del
 * diferencial sin obligar a estudiar nada.
 */
function seen(id: string): boolean {
  try { return localStorage.getItem("cuando_tip_" + id) === "1"; } catch { return false; }
}
function markSeen(id: string): void {
  try { localStorage.setItem("cuando_tip_" + id, "1"); } catch { /* sin storage */ }
}

export default function Tip({ id, children }: { id: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  useEffect(() => { if (!seen(id)) setShow(true); }, [id]);
  if (!show) return null;
  return (
    <div className="ctx-tip" role="note">
      <span className="ct-ico" aria-hidden>💡</span>
      <span className="ct-text">{children}</span>
      <button className="ct-close" onClick={() => { markSeen(id); setShow(false); }} aria-label="Entendido">
        <Icons.Close size={14} />
      </button>
    </div>
  );
}
