"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export type SidebarProDividerProps = {
  focusMode: boolean;
  onToggle: () => void;
  labelShowOnly: string;
  labelShowAll: string;
};

/**
 * Subtle divider between the Pinned section and the rest of the nav.
 * On hover, a chip is revealed that toggles focus mode (= show only pinned).
 */
export function SidebarProDivider({
  focusMode,
  onToggle,
  labelShowOnly,
  labelShowAll,
}: SidebarProDividerProps) {
  const [hovered, setHovered] = useState(false);
  const show = hovered || focusMode;

  return (
    <div
      className="relative cursor-pointer select-none"
      style={{ paddingBlock: "12px", marginBlock: "-8px" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onToggle}
      role="button"
      aria-pressed={focusMode}
      title={focusMode ? labelShowAll : labelShowOnly}
    >
      <div
        className={`absolute inset-x-3 top-1/2 -translate-y-1/2 h-px transition-colors duration-150 ${
          show ? "bg-border" : "bg-border/40"
        }`}
      />
      <div
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-150 ${
          show ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        }`}
      >
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-card border border-border shadow-sm text-[10px] font-medium text-muted-foreground whitespace-nowrap">
          {focusMode ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          {focusMode ? labelShowAll : labelShowOnly}
        </div>
      </div>
    </div>
  );
}
