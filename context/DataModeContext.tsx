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
    if (saved === "demo" || saved === "real") setMode(saved);
  }, []);
  const toggle = () => setMode(prev => {
    const next = prev === "demo" ? "real" : "demo";
    localStorage.setItem("hireflow-data-mode", next);
    return next;
  });
  return <DataModeContext.Provider value={{ mode, toggle }}>{children}</DataModeContext.Provider>;
}

export function useDataMode() {
  const ctx = useContext(DataModeContext);
  if (!ctx) throw new Error("useDataMode must be inside DataModeProvider");
  return ctx;
}
