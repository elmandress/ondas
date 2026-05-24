"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import HomeScreen from "@/components/home/HomeScreen";
import MapScreen from "@/components/map/MapScreen";
import SearchScreen from "@/components/SearchScreen";

type Tab = "home" | "map" | "search";

const tabs: { id: Tab; label: string; icon: React.ReactNode; activeIcon: React.ReactNode }[] = [
  {
    id: "home",
    label: "Inicio",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    activeIcon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
      </svg>
    ),
  },
  {
    id: "map",
    label: "Mapa",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <polygon points="3 11 22 2 13 21 11 13 3 11" />
      </svg>
    ),
    activeIcon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <polygon points="3 11 22 2 13 21 11 13 3 11" />
      </svg>
    ),
  },
  {
    id: "search",
    label: "Buscar",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
    activeIcon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
];

const screenVariants = {
  enter: { opacity: 0, y: 8 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export default function AppShell() {
  const [activeTab, setActiveTab] = useState<Tab>("home");

  return (
    <div className="flex flex-col h-full w-full max-w-md mx-auto relative">
      {/* Fondo con gradiente sutil */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0d1529] to-[#080d1a] pointer-events-none" />

      {/* Contenido de pantallas */}
      <main className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={screenVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute inset-0"
          >
            {activeTab === "home" && <HomeScreen onTabChange={setActiveTab} />}
            {activeTab === "map" && <MapScreen />}
            {activeTab === "search" && <SearchScreen />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="relative z-50 glass-dark border-t border-white/5 nav-safe">
        <div className="flex items-center justify-around px-4 pt-3 pb-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex flex-col items-center gap-1 px-5 py-1.5 relative group"
                aria-label={tab.label}
              >
                {/* Indicador activo */}
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute inset-0 rounded-2xl bg-blue-600/10"
                    transition={{ type: "spring", bounce: 0.25, duration: 0.4 }}
                  />
                )}

                {/* Icono */}
                <motion.div
                  animate={{ scale: isActive ? 1.1 : 1, color: isActive ? "#60a5fa" : "#64748b" }}
                  transition={{ duration: 0.15 }}
                  className="relative"
                  style={{ color: isActive ? "#60a5fa" : "#64748b" }}
                >
                  {isActive ? tab.activeIcon : tab.icon}
                </motion.div>

                {/* Label */}
                <span
                  className="text-[10px] font-medium tracking-wide"
                  style={{ color: isActive ? "#93c5fd" : "#475569" }}
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
