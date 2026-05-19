"use client";

import { Search } from "lucide-react";

type Props = {
  vacancies: { id: string; title: string }[];
  vacancyId: string;
  onVacancyChange: (id: string) => void;
  status: string;
  onStatusChange: (s: string) => void;
  search: string;
  onSearchChange: (s: string) => void;
};

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "in_progress", label: "In progress" },
  { value: "submitted", label: "Submitted" },
  { value: "hired", label: "Hired" },
  { value: "rejected", label: "Rejected" },
  { value: "abandoned", label: "Abandoned" },
];

export function PipelineFilters({
  vacancies,
  vacancyId,
  onVacancyChange,
  status,
  onStatusChange,
  search,
  onSearchChange,
}: Props) {
  return (
    <div className="flex items-center gap-2">
      <select
        value={vacancyId}
        onChange={(e) => onVacancyChange(e.target.value)}
        className="h-8 px-2 rounded-md border border-border bg-surface text-body-sm text-text outline-none"
      >
        <option value="all">All vacancies</option>
        {vacancies.map((v) => (
          <option key={v.id} value={v.id}>
            {v.title}
          </option>
        ))}
      </select>

      <select
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
        className="h-8 px-2 rounded-md border border-border bg-surface text-body-sm text-text outline-none"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-subtle pointer-events-none" />
        <input
          type="text"
          placeholder="Search candidates…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-8 pl-7 pr-3 rounded-md border border-border bg-surface text-body-sm text-text placeholder:text-subtle outline-none focus:border-primary/50 transition-colors w-48"
        />
      </div>
    </div>
  );
}
