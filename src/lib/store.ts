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

// Rutas de ejemplo para primer uso
export const DEMO_FAVORITES: FavoriteRoute[] = [
  {
    id: "demo_1",
    name: "Casa → Trabajo",
    fromStop: "stop_001",
    fromName: "18 de Julio esq. Ejido",
    toName: "Ciudad Vieja",
    lines: ["103", "174"],
    walkMinutes: 4,
    emoji: "🏠",
  },
  {
    id: "demo_2",
    name: "Trabajo → Casa",
    fromStop: "stop_002",
    fromName: "18 de Julio esq. Río Branco",
    toName: "Pocitos",
    lines: ["174"],
    walkMinutes: 2,
    emoji: "💼",
  },
];

export function getPrefs(): UserPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem("ondas_prefs");
    if (!raw) {
      // Primera vez: cargamos rutas demo
      const demo = { ...DEFAULT_PREFS, favoriteRoutes: DEMO_FAVORITES };
      savePrefs(demo);
      return demo;
    }
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
