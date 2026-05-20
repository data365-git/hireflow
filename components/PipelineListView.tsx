"use client";

import Link from "next/link";
import type { UnifiedApplication } from "@/app/actions/applications";
import { formatRelativeTime } from "@/lib/utils";

type Props = {
  apps: UnifiedApplication[];
  vacancies: { id: string; title: string }[];
};

const STAGE_DOT_COLOR: Record<string, string> = {
  new: "var(--color-stage-new-fg)",
  screening: "var(--color-stage-screening-fg)",
  qualified: "var(--color-stage-qualified-fg)",
  test: "var(--color-stage-test-fg)",
  interview: "var(--color-stage-interview-fg)",
  hired: "var(--color-stage-hired-fg)",
  rejected: "var(--color-stage-rejected-fg)",
};

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    in_progress: { label: "In progress", cls: "bg-warning/10 text-warning" },
    submitted: { label: "Submitted", cls: "bg-surface-3 text-muted" },
    hired: { label: "Hired", cls: "bg-success/10 text-success" },
    rejected: { label: "Rejected", cls: "bg-danger/10 text-danger" },
    abandoned: { label: "Abandoned", cls: "bg-danger/10 text-danger" },
  };
  const entry = map[status] ?? { label: status, cls: "bg-surface-3 text-muted" };
  return (
    <span className={`inline-flex items-center h-5 px-2 rounded-full text-micro font-medium ${entry.cls}`}>
      {entry.label}
    </span>
  );
}

export function PipelineListView({ apps }: Props) {
  if (apps.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-body-sm text-subtle">
        No candidates match your filters.
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <table className="w-full text-body-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-4 py-2.5 text-micro font-semibold text-subtle uppercase tracking-wide">
              Full Name
            </th>
            <th className="px-4 py-2.5 text-micro font-semibold text-subtle uppercase tracking-wide">
              Vacancy
            </th>
            <th className="px-4 py-2.5 text-micro font-semibold text-subtle uppercase tracking-wide">
              Stage
            </th>
            <th className="px-4 py-2.5 text-micro font-semibold text-subtle uppercase tracking-wide">
              Status
            </th>
            <th className="px-4 py-2.5 text-micro font-semibold text-subtle uppercase tracking-wide">
              Source
            </th>
            <th className="px-4 py-2.5 text-micro font-semibold text-subtle uppercase tracking-wide">
              Last activity
            </th>
            <th className="px-4 py-2.5 text-micro font-semibold text-subtle uppercase tracking-wide">
              Applied
            </th>
          </tr>
        </thead>
        <tbody>
          {apps.map((app) => (
            <tr
              key={app.id}
              className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/candidates/${app.id}`}
                  className="font-semibold text-text hover:text-primary transition-colors"
                >
                  {app.candidateName}
                </Link>
              </td>
              <td className="px-4 py-3 text-muted">{app.vacancyTitle}</td>
              <td className="px-4 py-3">
                {app.stageName ? (
                  <div className="flex items-center gap-1.5">
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          STAGE_DOT_COLOR[app.stageColor ?? ""] ?? "var(--color-border)",
                      }}
                    />
                    <span className="text-text">{app.stageName}</span>
                  </div>
                ) : (
                  <span className="text-subtle">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                <StatusPill status={app.status} />
              </td>
              <td className="px-4 py-3">
                {app.sourceName ? (
                  <span className="inline-flex items-center text-micro text-muted bg-surface-2 rounded-full px-2 py-0.5">
                    {app.sourceName}
                  </span>
                ) : (
                  <span className="text-subtle">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-muted">
                {formatRelativeTime(app.lastActivityAt)}
              </td>
              <td className="px-4 py-3 text-muted">
                {formatRelativeTime(app.appliedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
