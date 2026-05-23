"use client";
import { useEffect, useState } from "react";
import { getVacancyAuditLog } from "@/app/actions/vacancies";

type LogRow = Awaited<ReturnType<typeof getVacancyAuditLog>>[number];

export function VacancyHistoryTab({ vacancyId }: { vacancyId: string }) {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getVacancyAuditLog(vacancyId).then((r) => { setRows(r); setLoading(false); });
  }, [vacancyId]);

  if (loading) return <div className="p-6 text-muted text-sm">Loading history…</div>;
  if (!rows.length) return <div className="p-6 text-muted text-sm">No history yet.</div>;

  return (
    <div className="divide-y divide-border">
      {rows.map((r) => (
        <div key={r.id} className="flex items-start gap-3 px-6 py-3 text-sm">
          <span className="font-mono text-xs text-muted w-36 shrink-0 pt-0.5">
            {new Date(r.createdAt).toLocaleString()}
          </span>
          <div className="flex-1 min-w-0">
            <span className="font-medium">{r.action}</span>
            {r.actorEmail && <span className="text-muted ml-2">by {r.actorEmail}</span>}
            {r.description && <p className="text-muted truncate">{r.description}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
