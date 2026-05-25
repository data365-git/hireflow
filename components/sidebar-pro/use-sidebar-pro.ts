"use client";

import { useCallback, useState } from "react";

export type UseSidebarProOptions = {
  /** localStorage namespace. Defaults to "sidebar-pro". */
  storageKey?: string;
  defaultWidth?: number;
  defaultCollapsed?: boolean;
  defaultPins?: string[];
};

/**
 * Headless state hook. Use it directly if you want to build a custom visual
 * shell around the same pin / focus / width / collapse behaviour.
 */
export function useSidebarPro({
  storageKey = "sidebar-pro",
  defaultWidth = 256,
  defaultCollapsed = false,
  defaultPins = [],
}: UseSidebarProOptions = {}) {
  const pinsKey = `${storageKey}:pins`;
  const focusKey = `${storageKey}:focus`;
  const widthKey = `${storageKey}:width`;
  const collapsedKey = `${storageKey}:collapsed`;

  const [pins, setPinsState] = useState<string[]>(() => {
    if (typeof window === "undefined") return defaultPins;
    try {
      const stored = localStorage.getItem(pinsKey);
      return stored ? (JSON.parse(stored) as string[]) : defaultPins;
    } catch {
      return defaultPins;
    }
  });

  const [focusMode, setFocusModeState] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(focusKey) === "1";
  });

  const [width, setWidthState] = useState(() => {
    if (typeof window === "undefined") return defaultWidth;
    return Number(localStorage.getItem(widthKey)) || defaultWidth;
  });

  const [collapsed, setCollapsedState] = useState(() => {
    if (typeof window === "undefined") return defaultCollapsed;
    const stored = localStorage.getItem(collapsedKey);
    return stored === null ? defaultCollapsed : stored === "1";
  });

  const setPins = useCallback(
    (updater: string[] | ((prev: string[]) => string[])) => {
      setPinsState((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        try { localStorage.setItem(pinsKey, JSON.stringify(next)); } catch {}
        return next;
      });
    },
    [pinsKey]
  );

  const togglePin = useCallback(
    (id: string) =>
      setPins((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [id, ...prev])),
    [setPins]
  );

  const setFocusMode = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setFocusModeState((prev) => {
        const value = typeof next === "function" ? next(prev) : next;
        try { localStorage.setItem(focusKey, value ? "1" : "0"); } catch {}
        return value;
      });
    },
    [focusKey]
  );

  const toggleFocusMode = useCallback(() => setFocusMode((f) => !f), [setFocusMode]);

  const setWidth = useCallback(
    (w: number) => {
      setWidthState(w);
      try { localStorage.setItem(widthKey, String(w)); } catch {}
    },
    [widthKey]
  );

  const setCollapsed = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setCollapsedState((prev) => {
        const value = typeof next === "function" ? next(prev) : next;
        try { localStorage.setItem(collapsedKey, value ? "1" : "0"); } catch {}
        return value;
      });
    },
    [collapsedKey]
  );

  const toggleCollapsed = useCallback(() => setCollapsed((c) => !c), [setCollapsed]);

  return {
    pins, setPins, togglePin,
    focusMode, setFocusMode, toggleFocusMode,
    width, setWidth,
    collapsed, setCollapsed, toggleCollapsed,
  };
}
