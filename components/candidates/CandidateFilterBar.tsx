"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

type Props = {
  vacancies: { id: string; title: string }[];
  stages: { id: string; name: string; vacancyTitle: string }[];
  departments: string[];
};

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

export function CandidateFilterBar({ vacancies, stages, departments }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync q input when URL changes externally (e.g. browser back)
  useEffect(() => {
    setQ(searchParams.get("q") ?? "");
  }, [searchParams]);

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
    </div>
  );
}
