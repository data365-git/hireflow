"use client";

import { useState, useTransition } from "react";
import { ArchiveRestore, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { permanentlyDeleteVacancy, restoreVacancy } from "@/app/actions/vacancies";
import { toast } from "@/lib/hooks/useToast";

type TrashVacancy = {
  id: string;
  title: string;
  department: string;
  deletedAt: Date | string | null;
  restoreExpiresAt: Date | string | null;
  deletedByName: string | null;
};

function formatDate(value: Date | string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function TrashVacanciesList({ initialRows }: { initialRows: TrashVacancy[] }) {
  const [rows, setRows] = useState(initialRows);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function removeRow(id: string) {
    setRows((current) => current.filter((row) => row.id !== id));
  }

  function handleRestore(row: TrashVacancy) {
    setPendingId(row.id);
    startTransition(async () => {
      const result = await restoreVacancy(row.id);
      setPendingId(null);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      removeRow(row.id);
      toast.success(`Restored "${row.title}" as paused`);
    });
  }

  function handlePermanentDelete(row: TrashVacancy) {
    const confirmed = window.confirm(`Permanently delete "${row.title}"? This cannot be undone.`);
    if (!confirmed) return;

    setPendingId(row.id);
    startTransition(async () => {
      const result = await permanentlyDeleteVacancy(row.id);
      setPendingId(null);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      removeRow(row.id);
      toast.success(`Permanently deleted "${row.title}"`);
    });
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-10 text-center">
        <h2 className="text-h3 text-text">Trash is empty</h2>
        <p className="mt-1 text-body-sm text-muted">Deleted vacancies will appear here for 30 days.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <table className="w-full text-body-sm">
        <thead className="border-b border-border bg-surface-2">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-muted">Vacancy</th>
            <th className="px-4 py-3 text-left font-semibold text-muted">Deleted</th>
            <th className="px-4 py-3 text-left font-semibold text-muted">Restore until</th>
            <th className="px-4 py-3 text-right font-semibold text-muted">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const pending = pendingId === row.id;
            return (
              <tr key={row.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium text-text">{row.title}</p>
                  <p className="text-micro text-muted">{row.department}</p>
                </td>
                <td className="px-4 py-3 text-muted">
                  <p>{formatDate(row.deletedAt)}</p>
                  <p className="text-micro">{row.deletedByName ?? "Unknown user"}</p>
                </td>
                <td className="px-4 py-3 text-muted">{formatDate(row.restoreExpiresAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button type="button" size="sm" onClick={() => handleRestore(row)} disabled={pending}>
                      <ArchiveRestore className="size-3.5" />
                      Restore
                    </Button>
                    <Button type="button" size="sm" variant="danger" onClick={() => handlePermanentDelete(row)} disabled={pending}>
                      <Trash2 className="size-3.5" />
                      Delete forever
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
