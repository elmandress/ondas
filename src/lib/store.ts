"use client";

// Store ultra-simple sin Redux/Zustand — solo localStorage
// Para un MVP esto es suficiente y sin dependencias extra

export interface FavoriteRoute {
  id: string;
  name: string;          // "Casa → Trabajo"
  fromStop: string;      // stopId (puede quedar vacío si la ruta es por dirección)
  fromName: string;
  toStop?: string;
  toName?: string;
  lines: string[];
  walkMinutes: number;   // minutos caminando hasta la parada
  emoji: string;

  // ── Rutas por DIRECCIÓN (no solo por parada) — idea de Guille ──
  // Backward-compatible: todos opcionales. Si están las coords, la ruta se puede
  // abrir directo en el planificador con origen/destino por dirección (y el origen
  // es editable: si `fromIsCurrentLocation` es true, se usa el GPS al abrir).
  fromLat?: number;
  fromLon?: number;
  fromAddress?: string;        // dirección textual del origen (si no es una parada)
  /** true: al abrir la ruta, el origen se toma del GPS actual en vez de coords fijas. */
  fromIsCurrentLocation?: boolean;
  toLat?: number;
  toLon?: number;
  toAddress?: string;          // dirección textual del destino
}

export interface UserPrefs {
  homeStop?: string;
  workStop?: string;
  favoriteRoutes: FavoriteRoute[];
  onboardingDone: boolean;
  theme: "dark";         // por ahora solo dark
}

const DEFAULT_PREFS: UserPrefs = {
  favoriteRoutes: [],
  onboardingDone: false,
  theme: "dark",
};

// Sin rutas demo con IDs falsos — los favoritos empiezan vacíos.
// El usuario los crea desde el flujo natural de la app (marcar parada como favorita).
export const DEMO_FAVORITES: FavoriteRoute[] = [];

export function getPrefs(): UserPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem("ondas_prefs");
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: UserPrefs): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("ondas_prefs", JSON.stringify(prefs));
  } catch {
    // QuotaExceededError (cuota llena) o Safari en modo privado: no romper el flujo
    // (guardar favorito, completar onboarding…). Se pierde la persistencia, no la app.
  }
}

export function addFavorite(route: FavoriteRoute): void {
  const prefs = getPrefs();
  prefs.favoriteRoutes = [...prefs.favoriteRoutes.filter((r) => r.id !== route.id), route];
  savePrefs(prefs);
}

export function removeFavorite(id: string): void {
  const prefs = getPrefs();
  prefs.favoriteRoutes = prefs.favoriteRoutes.filter((r) => r.id !== id);
  savePrefs(prefs);
}

// ── Onboarding (primer uso) ──
export function isOnboardingDone(): boolean {
  return getPrefs().onboardingDone === true;
}
export function setOnboardingDone(done = true): void {
  savePrefs({ ...getPrefs(), onboardingDone: done });
}
