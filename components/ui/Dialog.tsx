"use client";
import { ReactNode, useEffect } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
}

export function Dialog({ open, onClose, title, children, size = "md" }: Props) {
  // ESC key handler
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const sizeClass = size === "lg" ? "max-w-3xl" : size === "sm" ? "max-w-sm" : "max-w-lg";

  return (
    <>
      {/* Full-bleed backdrop — click to close */}
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      {/* Centered modal — NOT the click target */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className={`w-full ${sizeClass} bg-surface rounded-2xl shadow-xl border border-border max-h-[90vh] overflow-y-auto pointer-events-auto`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-surface rounded-t-2xl">
            <h2 className="text-body-lg font-semibold text-text">{title}</h2>
            <button
              onClick={onClose}
              className="text-subtle hover:text-text text-2xl leading-none transition-colors"
            >
              ×
            </button>
          </div>
          <div className="p-6">{children}</div>
        </div>
      </div>
    </>
  );
}
