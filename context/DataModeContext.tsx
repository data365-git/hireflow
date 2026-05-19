"use client";
import { createContext, useContext, useState, useEffect } from "react";

type DataMode = "demo" | "real";
const DataModeContext = createContext<{
  mode: DataMode;
  toggle: () => void;
} | null>(null);

export function DataModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<DataMode>("real");
  useEffect(() => {
    const saved = localStorage.getItem("hireflow-data-mode") as DataMode | null;
    if (saved === "demo" || saved === "real") {
      setMode(saved);
      document.cookie = `hireflow-data-mode=${saved}; path=/; max-age=31536000`;
    }
  }, []);
  const toggle = () => setMode(prev => {
    const next = prev === "demo" ? "real" : "demo";
    localStorage.setItem("hireflow-data-mode", next);
    document.cookie = `hireflow-data-mode=${next}; path=/; max-age=31536000`;
    return next;
  });
  return <DataModeContext.Provider value={{ mode, toggle }}>{children}</DataModeContext.Provider>;
}

export function useDataMode() {
  const ctx = useContext(DataModeContext);
  if (!ctx) throw new Error("useDataMode must be inside DataModeProvider");
  return ctx;
}
