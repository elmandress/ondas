"use client";

import { motion, AnimatePresence } from "framer-motion";
import HomeScreen from "@/components/home/HomeScreen";
import MapScreen from "@/components/map/MapScreen";
import SearchScreen from "@/components/SearchScreen";
import RouteScreen from "@/components/route/RouteScreen";
import { useStopsDataset } from "@/hooks/useStopsDataset";
import { useActiveTab, type Tab } from "@/lib/active-tab";

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: "home",
    label: "Inicio",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    id: "route",
    label: "Cómo llegar",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]">
        <circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/>
        <path d="M6 8v4a4 4 0 004 4h4"/>
      </svg>
    ),
  },
  {
    id: "map",
    label: "Mapa",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]">
        <polygon points="3 11 22 2 13 21 11 13 3 11" />
      </svg>
    ),
  },
  {
    id: "search",
    label: "Buscar",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
];

const screenVariants = {
  enter: { opacity: 0, y: 6 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
};

export default function AppShell() {
  const [activeTab, setActiveTab] = useActiveTab();
  // Disparar carga global del dataset
  useStopsDataset();

  return (
    <div className="flex flex-col h-full w-full max-w-md mx-auto relative" style={{ background: "var(--bg)" }}>
      <main className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={screenVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute inset-0"
          >
            {activeTab === "home" && <HomeScreen onTabChange={setActiveTab} />}
            {activeTab === "route" && <RouteScreen />}
            {activeTab === "map" && <MapScreen />}
            {activeTab === "search" && <SearchScreen />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation — estilo Apple, plano */}
      <nav
        className="relative z-50 nav-safe"
        style={{
          background: "rgba(11, 16, 24, 0.92)",
          backdropFilter: "blur(28px) saturate(180%)",
          borderTop: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center justify-around px-3 pt-2 pb-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex flex-col items-center gap-0.5 px-3 py-1.5 relative"
                aria-label={tab.label}
              >
                <motion.div
                  animate={{ scale: isActive ? 1.05 : 1 }}
                  transition={{ duration: 0.15 }}
                  style={{ color: isActive ? "#60a5fa" : "#6b7691" }}
                >
                  {tab.icon}
                </motion.div>
                <span
                  className="text-[10px] font-semibold tracking-tight"
                  style={{ color: isActive ? "#93c5fd" : "#475167" }}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
