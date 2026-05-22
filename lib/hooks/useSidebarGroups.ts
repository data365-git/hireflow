"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "sidebar-group-states";

export type SidebarGroupStates = Record<string, boolean>;

function readStoredStates(): SidebarGroupStates {
  if (typeof window === "undefined") return {};

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};

    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, boolean] => typeof entry[1] === "boolean"
      )
    );
  } catch {
    return {};
  }
}

function getDefaultStates(groupKeys: string[], activeGroupKey: string | null): SidebarGroupStates {
  return Object.fromEntries(groupKeys.map((key) => [key, activeGroupKey === key]));
}

export function useSidebarGroups(groupKeys: string[], activeGroupKey: string | null) {
  const [groupStates, setGroupStates] = useState<SidebarGroupStates>(() =>
    getDefaultStates(groupKeys, activeGroupKey)
  );

  useEffect(() => {
    const storedStates = readStoredStates();

    setGroupStates(
      Object.fromEntries(
        groupKeys.map((key) => [
          key,
          activeGroupKey === key ? true : storedStates[key] ?? false,
        ])
      )
    );
  }, []);

  useEffect(() => {
    setGroupStates((current) => {
      let changed = false;
      const next: SidebarGroupStates = {};

      for (const key of groupKeys) {
        const expanded = activeGroupKey === key ? true : current[key] ?? false;
        next[key] = expanded;
        changed ||= current[key] !== expanded;
      }

      return changed || Object.keys(current).length !== groupKeys.length ? next : current;
    });
  }, [activeGroupKey, groupKeys]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(groupStates));
    } catch {
      // localStorage can be unavailable in locked-down browsing contexts.
    }
  }, [groupStates]);

  const toggleGroup = useCallback((key: string) => {
    setGroupStates((current) => ({ ...current, [key]: !(current[key] ?? false) }));
  }, []);

  return { groupStates, toggleGroup } as const;
}
