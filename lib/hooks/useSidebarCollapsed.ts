"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "sidebar-collapsed";

declare global {
  interface Window {
    __SIDEBAR_COLLAPSED__?: boolean;
  }
}

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.__SIDEBAR_COLLAPSED__ === true;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      // localStorage can be unavailable in locked-down browsing contexts.
    }
  }, [collapsed]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "\\" || (!event.metaKey && !event.ctrlKey)) return;
      event.preventDefault();
      setCollapsed((value) => !value);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return [collapsed, setCollapsed] as const;
}
