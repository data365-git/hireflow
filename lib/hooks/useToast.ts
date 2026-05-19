"use client";
import { useState, useEffect } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  message: string;
  type?: ToastType;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

// Module-level singleton so it works without context provider in any component
let _listeners: Array<(toasts: Toast[]) => void> = [];
let _toasts: Toast[] = [];

function notify() {
  _listeners.forEach((fn) => fn([..._toasts]));
}

export const toast = {
  show(t: Omit<Toast, "id">) {
    const id = Math.random().toString(36).slice(2);
    _toasts = [..._toasts, { id, ...t }];
    notify();
    const dur = t.duration ?? 4000;
    if (dur > 0) setTimeout(() => toast.remove(id), dur);
    return id;
  },
  remove(id: string) {
    _toasts = _toasts.filter((t) => t.id !== id);
    notify();
  },
  success(message: string, opts?: Partial<Omit<Toast, "id" | "message" | "type">>) {
    return toast.show({ message, type: "success", ...opts });
  },
  error(message: string, opts?: Partial<Omit<Toast, "id" | "message" | "type">>) {
    return toast.show({ message, type: "error", ...opts });
  },
  info(message: string, opts?: Partial<Omit<Toast, "id" | "message" | "type">>) {
    return toast.show({ message, type: "info", ...opts });
  },
};

export function useToastStore(): { toasts: Toast[]; remove: (id: string) => void } {
  const [toasts, setToasts] = useState<Toast[]>(_toasts);
  useEffect(() => {
    _listeners.push(setToasts);
    return () => { _listeners = _listeners.filter((fn) => fn !== setToasts); };
  }, []);
  return { toasts, remove: toast.remove };
}
