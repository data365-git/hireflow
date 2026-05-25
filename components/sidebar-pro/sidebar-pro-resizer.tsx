"use client";

import { useRef } from "react";

export type SidebarProResizerProps = {
  onWidthChange: (width: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  /** Called on double-click to reset to the default width. */
  onReset?: () => void;
  minWidth?: number;
  maxWidth?: number;
};

/**
 * Thin drag handle pinned to the sidebar's right edge. Uses pointer capture
 * so no global listeners or imperative cleanup are needed.
 */
export function SidebarProResizer({
  onWidthChange,
  onResizeStart,
  onResizeEnd,
  onReset,
  minWidth = 180,
  maxWidth = 400,
}: SidebarProResizerProps) {
  const ref = useRef<HTMLDivElement>(null);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    ref.current?.setPointerCapture(e.pointerId);
    onResizeStart?.();
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!ref.current?.hasPointerCapture(e.pointerId)) return;
    onWidthChange(Math.min(Math.max(e.clientX, minWidth), maxWidth));
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (ref.current?.hasPointerCapture(e.pointerId)) {
      ref.current.releasePointerCapture(e.pointerId);
      onResizeEnd?.();
    }
  }

  return (
    <div
      ref={ref}
      role="separator"
      aria-orientation="vertical"
      className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize z-10 select-none hover:bg-primary/20 active:bg-primary/30 transition-colors duration-150"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onReset}
    />
  );
}
