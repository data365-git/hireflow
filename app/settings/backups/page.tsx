"use client";

import { useEffect, useState } from "react";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import type { BackupRun } from "@/app/actions/backups";

function formatDateTime(d: Date | string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function KindPill({ kind }: { kind: string }) {
  if (kind === "pg_dump") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
        pg_dump
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
      csv
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "success") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        success
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
      running
    </span>
  );
}

export default function BackupsPage() {
  const [runs, setRuns] = useState<BackupRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    import("@/app/actions/backups").then(({ listBackupRuns }) =>
      listBackupRuns().then((data) => {
        if (!cancelled) {
          setRuns(data);
          setLoading(false);
        }
      }).catch(() => {
        if (!cancelled) setLoading(false);
      })
    );
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <SettingsPageHeader
        title="Backup History"
        description="Recent automated database backups. Up to the last 30 runs are shown."
      />

      <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-surface border border-border rounded-xl text-sm text-muted">
        <span className="text-text font-medium">Run backup now</span>
        <span className="text-subtle">—</span>
        <span>Trigger via Railway dashboard → your service → <strong className="text-text">Run Now</strong>.</span>
      </div>

      {loading ? (
        <p className="text-sm text-muted py-4">Loading…</p>
      ) : runs.length === 0 ? (
        <p className="text-sm text-muted py-4">No backup runs found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-subtle">
                <th className="pb-2 pr-4 font-medium">Started at</th>
                <th className="pb-2 pr-4 font-medium">Kind</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium">Rows</th>
                <th className="pb-2 pr-4 font-medium">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {runs.map((run) => (
                <tr key={run.id} className="hover:bg-surface-2 transition-colors">
                  <td className="py-3 pr-4 text-text whitespace-nowrap">
                    {formatDateTime(run.startedAt)}
                  </td>
                  <td className="py-3 pr-4">
                    <KindPill kind={run.kind} />
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-col gap-0.5">
                      <StatusPill status={run.status} />
                      {run.status === "failed" && run.errorMessage && (
                        <span className="text-xs text-red-500 max-w-xs truncate">
                          {run.errorMessage}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-text tabular-nums">
                    {run.rowCount != null ? run.rowCount.toLocaleString() : "—"}
                  </td>
                  <td className="py-3 pr-4 text-text tabular-nums">
                    {formatDuration(run.durationMs)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
