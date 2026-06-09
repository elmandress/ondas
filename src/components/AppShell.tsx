"use client";

import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import HomeScreen from "@/components/home/HomeScreen";
import { useStopsDataset } from "@/hooks/useStopsDataset";
import { useActiveTab, type Tab } from "@/lib/active-tab";
import { isOnboardingDone } from "@/lib/store";
import { LogoMark } from "@/components/brand/Logo";
import { Icons, type IconName } from "@/components/brand/Icons";
import OfflineBanner from "@/components/ui/OfflineBanner";
import InstallPrompt from "@/components/InstallPrompt";
import { track } from "@/lib/analytics";
import { getDestino } from "@/lib/destinos";
import { setRouteInput } from "@/lib/route-input";
import { setPendingSearch } from "@/lib/search-query";

const OnboardingFlow = dynamic(() => import("@/components/onboarding/OnboardingFlow"), { ssr: false });

// Home es el landing → import estático. El resto se carga SOLO al visitarse por
// primera vez (code-splitting): el bundle inicial baja Home + lo compartido, no las
// 3 pantallas extra. Menos JS de arranque = más rápido y menos datos.
const MapScreen = dynamic(() => import("@/components/map/MapScreen"), { ssr: false });
const RouteScreen = dynamic(() => import("@/components/route/RouteScreen"), { ssr: false });
const SearchScreen = dynamic(() => import("@/components/SearchScreen"), { ssr: false });

// Orden de navegación según el diseño Cuándo: Inicio · Mapa · Rutas · Buscar.
const NAV: { id: Tab; label: string; icon: IconName }[] = [
  { id: "home", label: "Inicio", icon: "Home" },
  { id: "map", label: "Mapa", icon: "Map" },
  { id: "route", label: "Rutas", icon: "Route" },
  { id: "search", label: "Buscar", icon: "Search" },
];

const SCREEN_ORDER: Tab[] = ["home", "route", "map", "search"];

// Las pantallas se mantienen montadas para preservar estado (mapa Leaflet, scroll,
// inputs). La visibilidad se conmuta por opacidad — nunca conditional render.

export default function AppShell() {
  const [activeTab, setActiveTab] = useActiveTab();
  // Disparar carga global del dataset de paradas.
  useStopsDataset();

  // Keep-alive: una pantalla se monta al visitarse por primera vez y queda montada
  // (preserva estado: mapa, scroll, inputs). Las no visitadas no cargan su JS.
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set<Tab>([activeTab]));
  useEffect(() => {
    setVisited((v) => (v.has(activeTab) ? v : new Set(v).add(activeTab)));
    track("view_tab", { tab: activeTab }); // anónimo: qué pantalla se usa
  }, [activeTab]);

  useEffect(() => { track("open_app"); }, []);

  // Shortcuts del manifest PWA (/?tab=map, /?tab=route…) y deep links de pestaña.
  // Sin esto, los accesos directos "Mapa"/"Ruta" del ícono instalado abrían siempre
  // Inicio. Leemos ?tab una vez al arrancar y saltamos a esa pestaña.
  // /?ir=slug → viene de una landing "cómo llegar a X": prefija el destino y planifica
  // la ruta desde tu ubicación. La landing SEO aterriza directo en el viaje armado.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const t = sp.get("tab");
    if (t === "home" || t === "map" || t === "route" || t === "search") {
      setActiveTab(t);
      track("open_shortcut", { tab: t });
    }
    const ir = sp.get("ir");
    if (ir) {
      const d = getDestino(ir);
      if (d) {
        setRouteInput({ to: { lat: d.lat, lon: d.lon, name: d.name }, fromCurrentLocation: true });
        setActiveTab("route");
        track("deep_link_ir", { destino: ir });
        window.history.replaceState(null, "", window.location.pathname);
      }
    }
    // /?q=texto → sitelinks searchbox de Google / búsqueda compartida: aterriza en Buscar
    // con el término ya cargado.
    const q = sp.get("q");
    if (q) {
      setPendingSearch(q);
      setActiveTab("search");
      track("deep_link_search");
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [setActiveTab]);

  // Onboarding de primer uso (client-only para no romper SSR).
  const [showOnboarding, setShowOnboarding] = useState(false);
  useEffect(() => {
    if (!isOnboardingDone()) setShowOnboarding(true);
  }, []);

  const NavButton = ({ id, label, icon }: { id: Tab; label: string; icon: IconName }) => {
    const Icon = Icons[icon];
    return (
      <button
        className={`nav-item ${activeTab === id ? "active" : ""}`}
        onClick={() => setActiveTab(id)}
        aria-label={label}
      >
        <Icon size={20} />
        <span className="nlabel">{label}</span>
      </button>
    );
  };

  return (
    <div className="app-shell">
      <OfflineBanner />
      <InstallPrompt />
      {/* Sidebar — tablet (72px) / desktop (220px). CSS la oculta en mobile. */}
      <aside className="sidebar">
        <div className="brand" style={{ marginBottom: 28 }}>
          <LogoMark size={28} ring="var(--text)" dot="var(--accent)" />
          <span className="brand-word">Cuándo</span>
        </div>
        <nav aria-label="Navegación principal">
          {NAV.map((n) => (
            <NavButton key={n.id} {...n} />
          ))}
        </nav>
        <div className="footer-meta">
          <span className="v">v0.8 · build STM</span>
          Datos STM Montevideo
        </div>
      </aside>

      {/* Main */}
      <main className="main">
        <div className="content-col" style={{ position: "relative", height: "100%", overflow: "hidden" }}>
          {SCREEN_ORDER.map((tab) => {
            const active = activeTab === tab;
            return (
              // Opacidad CSS pura (sin transform de framer): así los `position: fixed`
              // de los sheets/modales escapan al viewport en vez de quedar atrapados.
              <div
                key={tab}
                className={`screen-layer scrollbar-none ${tab === "map" ? "map" : ""}`}
                style={{
                  opacity: active ? 1 : 0,
                  transition: "opacity 0.18s ease-out",
                  pointerEvents: active ? "auto" : "none",
                  zIndex: active ? 1 : 0,
                }}
              >
                {/* Solo se monta (y carga su JS) si la pestaña fue visitada. */}
                {visited.has(tab) && tab === "home" && <HomeScreen onTabChange={setActiveTab} />}
                {visited.has(tab) && tab === "route" && <RouteScreen />}
                {visited.has(tab) && tab === "map" && <MapScreen />}
                {visited.has(tab) && tab === "search" && <SearchScreen />}
              </div>
            );
          })}
        </div>
      </main>

      <AnimatePresence>
        {showOnboarding && <OnboardingFlow onDone={() => setShowOnboarding(false)} />}
      </AnimatePresence>

      {/* Bottom nav — mobile. CSS la oculta en tablet/desktop. */}
      <nav className="bottom-nav" aria-label="Navegación principal móvil">
        {NAV.map((n) => (
          <NavButton key={n.id} {...n} />
        ))}
      </nav>
    </div>
  );
}
