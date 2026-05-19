"use client";
import { useDataMode } from "@/context/DataModeContext";

export function DataModeToggle() {
  const { mode, toggle } = useDataMode();
  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
        mode === "demo"
          ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
          : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${mode === "demo" ? "bg-amber-500" : "bg-emerald-500"}`} />
      {mode === "demo" ? "Demo data" : "Live data"}
    </button>
  );
}
