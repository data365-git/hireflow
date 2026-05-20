"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SourcePerformanceRow, SourcePerformanceByNameRow } from "@/app/actions/sources";

type GroupBy = "name" | "vacancy";

type Props = {
  rowsByVacancy: SourcePerformanceRow[];
  rowsByName: SourcePerformanceByNameRow[];
  initialDays: string;
  initialGroupBy: GroupBy;
};

const DAY_OPTIONS = [
  { label: "Last 7 days", value: "7" },
  { label: "Last 30 days", value: "30" },
  { label: "Last 90 days", value: "90" },
  { label: "All time", value: "0" },
];

function pct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

export function SourcesReportClient({ rowsByVacancy, rowsByName, initialDays, initialGroupBy }: Props) {
  const router = useRouter();
  const [days, setDays] = useState(initialDays);
  const [groupBy, setGroupBy] = useState<GroupBy>(initialGroupBy);

  function applyFilters(newDays: string, newGroupBy: GroupBy) {
    const params = new URLSearchParams();
    params.set("days", newDays);
    params.set("groupBy", newGroupBy);
    router.push(`/reports/sources?${params.toString()}`);
  }

  const isEmpty = groupBy === "name" ? rowsByName.length === 0 : rowsByVacancy.length === 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-heading font-semibold text-text">Source Performance</h1>

        <div className="flex flex-wrap items-center gap-3">
          {/* Group-by segmented control */}
          <div className="flex items-center rounded-lg border border-border bg-surface overflow-hidden text-body-sm">
            <button
              type="button"
              onClick={() => { setGroupBy("name"); applyFilters(days, "name"); }}
              className={`h-9 px-4 font-medium transition-colors ${
                groupBy === "name"
                  ? "bg-primary text-primary-fg"
                  : "text-muted hover:text-text hover:bg-surface-2"
              }`}
            >
              Source name
            </button>
            <button
              type="button"
              onClick={() => { setGroupBy("vacancy"); applyFilters(days, "vacancy"); }}
              className={`h-9 px-4 font-medium transition-colors ${
                groupBy === "vacancy"
                  ? "bg-primary text-primary-fg"
                  : "text-muted hover:text-text hover:bg-surface-2"
              }`}
            >
              Source × Vacancy
            </button>
          </div>

          {/* Time-window filter */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              applyFilters(days, groupBy);
            }}
            className="flex items-center gap-2"
          >
            <select
              name="days"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="h-9 px-3 rounded-lg border border-border bg-surface text-body text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {DAY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="h-9 px-4 rounded-lg bg-primary text-primary-fg text-body-sm font-medium hover:opacity-90 transition-opacity"
            >
              Apply
            </button>
          </form>
        </div>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-body font-medium text-muted">No source data</p>
          <p className="text-body-sm text-subtle mt-1">
            Applications with a tracked source will appear here.
          </p>
        </div>
      ) : groupBy === "name" ? (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block rounded-xl border border-border bg-surface overflow-hidden">
            <table className="w-full text-body-sm">
              <thead>
                <tr className="border-b border-border bg-bg">
                  <th className="text-left px-4 py-3 font-medium text-subtle">Source</th>
                  <th className="text-right px-4 py-3 font-medium text-subtle"># Vacancies</th>
                  <th className="text-right px-4 py-3 font-medium text-subtle">Views</th>
                  <th className="text-right px-4 py-3 font-medium text-subtle">Submitted</th>
                  <th className="text-right px-4 py-3 font-medium text-subtle">Hired</th>
                  <th className="text-right px-4 py-3 font-medium text-subtle">Submission %</th>
                  <th className="text-right px-4 py-3 font-medium text-subtle">Hire %</th>
                </tr>
              </thead>
              <tbody>
                {rowsByName.map((row, i) => (
                  <tr
                    key={row.name}
                    className={`border-b border-border last:border-0 ${i % 2 === 1 ? "bg-bg/50" : ""}`}
                  >
                    <td className="px-4 py-3 font-medium text-text">{row.name}</td>
                    <td className="px-4 py-3 text-right text-muted">{row.vacancyCount}</td>
                    <td className="px-4 py-3 text-right font-semibold text-text">{row.views}</td>
                    <td className="px-4 py-3 text-right text-muted">{row.submitted}</td>
                    <td className="px-4 py-3 text-right text-muted">{row.hired}</td>
                    <td className="px-4 py-3 text-right text-muted">{pct(row.submissionRate)}</td>
                    <td className="px-4 py-3 text-right text-muted">{pct(row.hireRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 sm:hidden">
            {rowsByName.map((row) => (
              <div key={row.name} className="rounded-xl border border-border bg-surface px-4 py-4">
                <p className="font-semibold text-text mb-3">{row.name}</p>
                <div className="grid grid-cols-2 gap-y-2 text-body-sm">
                  <span className="text-muted">Vacancies</span>
                  <span className="text-right text-text">{row.vacancyCount}</span>
                  <span className="text-muted">Views</span>
                  <span className="text-right font-semibold text-text">{row.views}</span>
                  <span className="text-muted">Submitted</span>
                  <span className="text-right text-text">{row.submitted}</span>
                  <span className="text-muted">Hired</span>
                  <span className="text-right text-text">{row.hired}</span>
                  <span className="text-muted">Submission %</span>
                  <span className="text-right text-text">{pct(row.submissionRate)}</span>
                  <span className="text-muted">Hire %</span>
                  <span className="text-right text-text">{pct(row.hireRate)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Desktop table — Source × Vacancy */}
          <div className="hidden sm:block rounded-xl border border-border bg-surface overflow-hidden">
            <table className="w-full text-body-sm">
              <thead>
                <tr className="border-b border-border bg-bg">
                  <th className="text-left px-4 py-3 font-medium text-subtle">Source</th>
                  <th className="text-left px-4 py-3 font-medium text-subtle">Vacancy</th>
                  <th className="text-right px-4 py-3 font-medium text-subtle">Total</th>
                  <th className="text-right px-4 py-3 font-medium text-subtle">Browsing</th>
                  <th className="text-right px-4 py-3 font-medium text-subtle">In Progress</th>
                  <th className="text-right px-4 py-3 font-medium text-subtle">Submitted</th>
                  <th className="text-right px-4 py-3 font-medium text-subtle">Abandoned</th>
                  <th className="text-right px-4 py-3 font-medium text-subtle">Submission %</th>
                  <th className="text-right px-4 py-3 font-medium text-subtle">Hire %</th>
                </tr>
              </thead>
              <tbody>
                {rowsByVacancy.map((row, i) => {
                  const subRate = row.total > 0 ? row.submitted / row.total : 0;
                  const hireRate = 0; // no hired count in per-vacancy rows
                  return (
                    <tr
                      key={`${row.sourceId}-${row.vacancyId}`}
                      className={`border-b border-border last:border-0 ${i % 2 === 1 ? "bg-bg/50" : ""}`}
                    >
                      <td className="px-4 py-3 font-medium text-text">{row.sourceName}</td>
                      <td className="px-4 py-3 text-muted">{row.vacancyTitle}</td>
                      <td className="px-4 py-3 text-right font-semibold text-text">{row.total}</td>
                      <td className="px-4 py-3 text-right text-muted">{row.browsing}</td>
                      <td className="px-4 py-3 text-right text-muted">{row.in_progress}</td>
                      <td className="px-4 py-3 text-right text-muted">{row.submitted}</td>
                      <td className="px-4 py-3 text-right text-muted">{row.abandoned}</td>
                      <td className="px-4 py-3 text-right text-muted">{pct(subRate)}</td>
                      <td className="px-4 py-3 text-right text-muted">{pct(hireRate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards — Source × Vacancy */}
          <div className="flex flex-col gap-3 sm:hidden">
            {rowsByVacancy.map((row) => {
              const subRate = row.total > 0 ? row.submitted / row.total : 0;
              return (
                <div key={`${row.sourceId}-${row.vacancyId}`} className="rounded-xl border border-border bg-surface px-4 py-4">
                  <p className="font-semibold text-text">{row.sourceName}</p>
                  <p className="text-body-sm text-muted mb-3">{row.vacancyTitle}</p>
                  <div className="grid grid-cols-2 gap-y-2 text-body-sm">
                    <span className="text-muted">Total</span>
                    <span className="text-right font-semibold text-text">{row.total}</span>
                    <span className="text-muted">Submitted</span>
                    <span className="text-right text-text">{row.submitted}</span>
                    <span className="text-muted">Abandoned</span>
                    <span className="text-right text-text">{row.abandoned}</span>
                    <span className="text-muted">Submission %</span>
                    <span className="text-right text-text">{pct(subRate)}</span>
                    <span className="text-muted">Hire %</span>
                    <span className="text-right text-text">—</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
