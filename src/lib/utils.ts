import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatEta(minutes: number): string {
  if (minutes <= 0) return "Ahora";
  if (minutes === 1) return "1 min";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function etaClass(minutes: number): string {
  if (minutes <= 2) return "chip-arrive";
  if (minutes <= 8) return "chip-soon";
  return "chip-far";
}

export function etaColorClass(minutes: number): string {
  if (minutes <= 2) return "text-green-400";
  if (minutes <= 8) return "text-orange-400";
  return "text-slate-400";
}

export function walkToLeaveTime(walkMinutes: number, etaMinutes: number): number {
  // Cuántos minutos tenés para salir
  return Math.max(0, etaMinutes - walkMinutes);
}

export function leaveNowUrgency(leaveInMinutes: number): "now" | "soon" | "chill" {
  if (leaveInMinutes <= 1) return "now";
  if (leaveInMinutes <= 5) return "soon";
  return "chill";
}

export function lineColorFromId(lineId: string): string {
  const colors: Record<string, string> = {
    "103": "#2563eb",
    "174": "#7c3aed",
    "D1": "#ea580c",
    "189": "#0891b2",
    "G": "#16a34a",
    "H": "#dc2626",
    "21": "#ca8a04",
    "121": "#db2777",
    "20": "#0284c7",
  };
  return colors[lineId] || "#64748b";
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" });
}

export function bearing(from: [number, number], to: [number, number]): number {
  const [lat1, lon1] = from.map((d) => (d * Math.PI) / 180);
  const [lat2, lon2] = to.map((d) => (d * Math.PI) / 180);
  const dLon = lon2 - lon1;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
