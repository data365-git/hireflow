"use client";

import type { ReactNode } from "react";
import { useState } from "react";

type TooltipSide = "right" | "top" | "bottom";

export function Tooltip({
  children,
  content,
  side = "right",
}: {
  children: ReactNode;
  content: string;
  side?: TooltipSide;
}) {
  const [visible, setVisible] = useState(false);
  const sideClass =
    side === "right"
      ? "left-full ml-2 top-1/2 -translate-y-1/2"
      : side === "top"
        ? "bottom-full mb-2 left-1/2 -translate-x-1/2"
        : "top-full mt-2 left-1/2 -translate-x-1/2";

  return (
    <span
      className="relative inline-flex"
      onBlur={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span
          className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-text px-2 py-1 text-micro font-medium text-bg shadow-lg ${sideClass}`}
          role="tooltip"
        >
          {content}
        </span>
      )}
    </span>
  );
}
