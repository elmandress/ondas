"use client";

// Store ultra-simple sin Redux/Zustand — solo localStorage
// Para un MVP esto es suficiente y sin dependencias extra

export interface FavoriteRoute {
  id: string;
  name: string;          // "Casa → Trabajo"
  fromStop: string;      // stopId
  fromName: string;
  toStop?: string;
  toName?: string;
  lines: string[];
  walkMinutes: number;   // minutos caminando hasta la parada
  emoji: string;
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
  localStorage.setItem("ondas_prefs", JSON.stringify(prefs));
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
