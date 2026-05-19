"use client";
import { useState, useEffect } from "react";

type AppRow = {
  application: {
    id: string;
    candidateId: string;
    vacancyId: string;
    currentStageId: string;
    appliedAt: Date;
    lastActivityAt: Date;
  };
  candidate: {
    id: string;
    fullName: string;
    phone: string;
    telegramUsername: string;
    telegramFirstName: string;
    telegramUserId: string | null;
    language: string;
    city: string;
    createdAt: Date;
  };
};

interface Props {
  appRows: AppRow[];
  stages: Array<{ id: string; name: string }>;
  onFilter: (rows: AppRow[]) => void;
}

export function ApplicationSearch({ appRows, stages, onFilter }: Props) {
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");

  useEffect(() => {
    let filtered = appRows;
    if (query.trim()) {
      const q = query.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.candidate.fullName.toLowerCase().includes(q) ||
          r.candidate.phone.toLowerCase().includes(q) ||
          r.candidate.telegramUsername.toLowerCase().includes(q)
      );
    }
    if (stageFilter !== "all") {
      filtered = filtered.filter(
        (r) => r.application.currentStageId === stageFilter
      );
    }
    onFilter(filtered);
  }, [query, stageFilter, appRows]);

  return (
    <div className="flex items-center gap-2 px-8 pt-4 pb-2">
      <div className="relative flex-1 max-w-xs">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4 pointer-events-none"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M9 3a6 6 0 100 12A6 6 0 009 3zM1 9a8 8 0 1114.32 4.906l3.387 3.387a1 1 0 01-1.414 1.414l-3.387-3.387A8 8 0 011 9z"
            clipRule="evenodd"
          />
        </svg>
        <input
          type="text"
          placeholder="Search candidates…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-surface-2 border border-border rounded-lg pl-9 pr-3 py-2 text-body-sm text-text outline-none focus:border-primary placeholder:text-muted"
        />
      </div>
      <select
        value={stageFilter}
        onChange={(e) => setStageFilter(e.target.value)}
        className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-body-sm text-text outline-none focus:border-primary"
      >
        <option value="all">All stages</option>
        {stages.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}
