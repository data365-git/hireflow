"use client";
import { createContext, useContext, useState } from "react";

type DataMode = "demo" | "real";
const DataModeContext = createContext<{
  mode: DataMode;
  toggle: () => void;
} | null>(null);

function setCookie(mode: DataMode) {
  document.cookie = `hireflow-data-mode=${mode}; path=/; max-age=31536000; SameSite=Lax`;
}

function readInitialMode(): DataMode {
  if (typeof window === "undefined") return "real";
  const saved = localStorage.getItem("hireflow-data-mode");
  return saved === "demo" ? "demo" : "real";
}

function readInitialModeAndSyncCookie(): DataMode {
  const m = readInitialMode();
  if (typeof window !== "undefined") {
    // Set cookie synchronously during initialization — before any child effects fire
    setCookie(m);
    localStorage.setItem("hireflow-data-mode", m);
  }
  return m;
}

export function DataModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<DataMode>(readInitialModeAndSyncCookie);

  const toggle = () => setMode(prev => {
    const next = prev === "demo" ? "real" : "demo";
    localStorage.setItem("hireflow-data-mode", next);
    setCookie(next);
    return next;
  });
  return <DataModeContext.Provider value={{ mode, toggle }}>{children}</DataModeContext.Provider>;
}

export function useDataMode() {
  const ctx = useContext(DataModeContext);
  if (!ctx) throw new Error("useDataMode must be inside DataModeProvider");
  return ctx;
}
