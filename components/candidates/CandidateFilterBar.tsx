"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { listMyFilterViews, saveFilterView, deleteFilterView } from "@/app/actions/candidate-actions";

type Props = {
  vacancies: { id: string; title: string }[];
  stages: { id: string; name: string; vacancyTitle: string }[];
  departments: string[];
};

type FilterView = { id: string; name: string; filters: Record<string, string> };

const LANG_LEVELS = [
  { value: "", label: "Any level" },
  { value: "none", label: "None" },
  { value: "a1_a2", label: "A1–A2" },
  { value: "b1_b2", label: "B1–B2" },
  { value: "c1_c2", label: "C1–C2" },
  { value: "native", label: "Native" },
];

const MARITAL_OPTIONS = [
  { value: "", label: "Any status" },
  { value: "single", label: "Single" },
  { value: "married", label: "Married" },
  { value: "divorced", label: "Divorced" },
  { value: "other", label: "Other" },
];

const FILTER_KEYS = ["q", "vacancyId", "stageId", "department", "englishMin", "russianMin", "marital"] as const;

export function CandidateFilterBar({ vacancies, stages, departments }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Views state
  const [views, setViews] = useState<FilterView[]>([]);
  const [viewsOpen, setViewsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState("");
  const viewsRef = useRef<HTMLDivElement>(null);

  // Sync q input when URL changes externally (e.g. browser back)
  useEffect(() => {
    setQ(searchParams.get("q") ?? "");
  }, [searchParams]);

  // Load saved views on mount
  useEffect(() => {
    listMyFilterViews().then(setViews).catch(() => {});
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!viewsOpen) return;
    function onOutside(e: MouseEvent) {
      if (viewsRef.current && !viewsRef.current.contains(e.target as Node)) {
        setViewsOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [viewsOpen]);

  function buildParams(overrides: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, val] of Object.entries(overrides)) {
      if (val) {
        next.set(key, val);
      } else {
        next.delete(key);
      }
    }
    return next.toString();
  }

  function handleQ(value: string) {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      router.replace(`${pathname}?${buildParams({ q: value })}`);
    }, 300);
  }

  function handleSelect(key: string, value: string) {
    router.replace(`${pathname}?${buildParams({ [key]: value })}`);
  }

  function handleClear() {
    setQ("");
    router.replace(pathname);
  }

  function applyView(view: FilterView) {
    const next = new URLSearchParams();
    for (const key of FILTER_KEYS) {
      const val = view.filters[key];
      if (val) next.set(key, val);
    }
    setQ(view.filters.q ?? "");
    router.replace(`${pathname}?${next.toString()}`);
    setViewsOpen(false);
  }

  async function handleSave() {
    const name = saveName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const currentFilters: Record<string, string> = {};
      for (const key of FILTER_KEYS) {
        const val = key === "q" ? q : (searchParams.get(key) ?? "");
        if (val) currentFilters[key] = val;
      }
      await saveFilterView({ name, filters: currentFilters });
      const updated = await listMyFilterViews();
      setViews(updated);
      setSaveName("");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteFilterView(id);
    setViews((prev) => prev.filter((v) => v.id !== id));
  }

  const hasFilters =
    !!searchParams.get("q") ||
    !!searchParams.get("vacancyId") ||
    !!searchParams.get("stageId") ||
    !!searchParams.get("department") ||
    !!searchParams.get("englishMin") ||
    !!searchParams.get("russianMin") ||
    !!searchParams.get("marital");

  const selectClass =
    "h-9 rounded-lg border border-border bg-surface px-3 text-body-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary cursor-pointer";

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {/* Search */}
      <input
        type="search"
        placeholder="Search name, phone, username…"
        value={q}
        onChange={(e) => handleQ(e.target.value)}
        className="h-9 flex-1 min-w-[180px] rounded-lg border border-border bg-surface px-3 text-body-sm text-text placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
      />

      {/* Vacancy */}
      <select
        value={searchParams.get("vacancyId") ?? ""}
        onChange={(e) => handleSelect("vacancyId", e.target.value)}
        className={selectClass}
      >
        <option value="">All vacancies</option>
        {vacancies.map((v) => (
          <option key={v.id} value={v.id}>
            {v.title}
          </option>
        ))}
      </select>

      {/* Stage */}
      <select
        value={searchParams.get("stageId") ?? ""}
        onChange={(e) => handleSelect("stageId", e.target.value)}
        className={selectClass}
      >
        <option value="">All stages</option>
        {stages.map((s) => (
          <option key={s.id} value={s.id}>
            {s.vacancyTitle} — {s.name}
          </option>
        ))}
      </select>

      {/* Department */}
      <select
        value={searchParams.get("department") ?? ""}
        onChange={(e) => handleSelect("department", e.target.value)}
        className={selectClass}
      >
        <option value="">All departments</option>
        {departments.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      {/* English level */}
      <select
        value={searchParams.get("englishMin") ?? ""}
        onChange={(e) => handleSelect("englishMin", e.target.value)}
        className={selectClass}
      >
        {LANG_LEVELS.map((l) => (
          <option key={l.value} value={l.value}>
            {l.value ? `EN ≥ ${l.label}` : "English (any)"}
          </option>
        ))}
      </select>

      {/* Russian level */}
      <select
        value={searchParams.get("russianMin") ?? ""}
        onChange={(e) => handleSelect("russianMin", e.target.value)}
        className={selectClass}
      >
        {LANG_LEVELS.map((l) => (
          <option key={l.value} value={l.value}>
            {l.value ? `RU ≥ ${l.label}` : "Russian (any)"}
          </option>
        ))}
      </select>

      {/* Marital status */}
      <select
        value={searchParams.get("marital") ?? ""}
        onChange={(e) => handleSelect("marital", e.target.value)}
        className={selectClass}
      >
        {MARITAL_OPTIONS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.value ? m.label : "Marital (any)"}
          </option>
        ))}
      </select>

      {/* Clear */}
      {hasFilters && (
        <button
          type="button"
          onClick={handleClear}
          className="h-9 px-3 rounded-lg border border-border bg-surface text-body-sm text-muted hover:text-text hover:bg-surface-2 transition-colors"
        >
          Clear
        </button>
      )}

      {/* Views dropdown */}
      <div className="relative" ref={viewsRef}>
        <button
          type="button"
          onClick={() => setViewsOpen((o) => !o)}
          className="h-9 px-3 rounded-lg border border-border bg-surface text-body-sm text-text hover:bg-surface-2 transition-colors flex items-center gap-1"
        >
          Views
          <span className="text-xs text-muted">▾</span>
        </button>

        {viewsOpen && (
          <div className="absolute right-0 top-10 z-20 w-64 rounded-lg border border-border bg-surface shadow-lg">
            {/* Saved views list */}
            {views.length === 0 ? (
              <p className="px-3 py-2 text-body-sm text-muted">No saved views</p>
            ) : (
              <ul className="max-h-48 overflow-y-auto">
                {views.map((view) => (
                  <li
                    key={view.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-surface-2 group"
                  >
                    <button
                      type="button"
                      onClick={() => applyView(view)}
                      className="flex-1 text-left text-body-sm text-text truncate"
                    >
                      {view.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(view.id)}
                      className="text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity text-xs px-1"
                      aria-label={`Delete view "${view.name}"`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Divider */}
            <div className="border-t border-border" />

            {/* Save current filters */}
            <div className="p-2 flex gap-1">
              <input
                type="text"
                placeholder="View name…"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
                maxLength={80}
                className="h-8 flex-1 rounded-md border border-border bg-canvas px-2 text-body-sm text-text placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !saveName.trim()}
                className="h-8 px-2 rounded-md bg-primary text-white text-body-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                {saving ? "…" : "Save"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
