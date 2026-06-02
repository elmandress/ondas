/**
 * Pill semántica — color + icono + texto (nunca color solo, por accesibilidad).
 * Tipos: live (en vivo), sched (horario), warn (acortado), access (accesible),
 * ac (aire acondicionado), fast, notrans, trans.
 */
import { Icons } from "@/components/brand/Icons";

export type PillKind =
  | "live"
  | "sched"
  | "warn"
  | "access"
  | "ac"
  | "fast"
  | "notrans"
  | "trans";

const ICON: Partial<Record<PillKind, React.ReactNode>> = {
  sched: <Icons.Clock size={12} />,
  warn: <Icons.Warn size={12} />,
  access: <Icons.Wheelchair size={12} />,
  ac: <Icons.Ac size={12} />,
};

export default function Pill({ kind, children }: { kind: PillKind; children: React.ReactNode }) {
  return (
    <span className={`pill ${kind}`}>
      {kind === "live" && <span className="dot" />}
      {ICON[kind]}
      {children}
    </span>
  );
}
