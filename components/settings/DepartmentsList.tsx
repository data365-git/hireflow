"use client";

import { useMemo, useState } from "react";
import { Archive, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import {
  createDepartment,
  deleteDepartment,
  renameDepartment,
  setDepartmentActive,
  type DepartmentRow,
} from "@/app/actions/departments";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "@/lib/hooks/useToast";

type Props = {
  initial: DepartmentRow[];
};

export function DepartmentsList({ initial }: Props) {
  const [rows, setRows] = useState(initial);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<DepartmentRow | null>(null);
  const [adding, setAdding] = useState(false);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [rows]
  );

  async function handleAdd() {
    const displayName = newName.trim();
    if (!displayName) return;
    setAdding(true);
    try {
      const result = await createDepartment({ displayName });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setRows((current) => [...current, result.data]);
      setNewName("");
      setShowAdd(false);
      toast.success("Department added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add department");
    } finally {
      setAdding(false);
    }
  }

  function startRename(row: DepartmentRow) {
    setEditingId(row.id);
    setEditValue(row.displayName);
  }

  async function handleRename(id: string) {
    const displayName = editValue.trim();
    if (!displayName) {
      toast.error("Department name is required.");
      return;
    }

    setSavingId(id);
    try {
      const result = await renameDepartment(id, displayName);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setRows((current) =>
        current.map((row) => row.id === id ? { ...row, displayName } : row)
      );
      setEditingId(null);
      setEditValue("");
      toast.success("Department renamed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not rename department");
    } finally {
      setSavingId(null);
    }
  }

  async function toggleActive(row: DepartmentRow) {
    setSavingId(row.id);
    try {
      const result = await setDepartmentActive(row.id, !row.isActive);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setRows((current) =>
        current.map((item) =>
          item.id === row.id ? { ...item, isActive: !row.isActive } : item
        )
      );
      toast.success(row.isActive ? "Department archived" : "Department restored");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update department");
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setSavingId(deleting.id);
    try {
      const result = await deleteDepartment(deleting.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setRows((current) => current.filter((row) => row.id !== deleting.id));
      setDeleting(null);
      toast.success("Department deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete department");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-fg transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Add department
        </button>
      </div>

      {showAdd && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text">New department</h2>
            <button
              type="button"
              onClick={() => {
                setShowAdd(false);
                setNewName("");
              }}
              className="rounded-md p-1 text-muted transition-colors hover:bg-surface-2 hover:text-text"
              aria-label="Close add department form"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              autoFocus
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleAdd();
                if (event.key === "Escape") setShowAdd(false);
              }}
              placeholder="e.g. Engineering"
              className="h-10 flex-1 rounded-lg border border-border bg-bg px-3 text-sm text-text placeholder:text-subtle focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={adding || !newName.trim()}
              className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {adding ? "Adding..." : "Add"}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full">
          <thead className="border-b border-border bg-surface-2">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-subtle">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-subtle">Active vacancies</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-subtle">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-subtle">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted">
                  No departments yet. Add one to make it available in the vacancy creation form.
                </td>
              </tr>
            ) : (
              sortedRows.map((row) => {
                const isEditing = editingId === row.id;
                const isSaving = savingId === row.id;
                return (
                  <tr key={row.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          autoFocus
                          value={editValue}
                          onChange={(event) => setEditValue(event.target.value)}
                          onBlur={() => void handleRename(row.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") void handleRename(row.id);
                            if (event.key === "Escape") {
                              setEditingId(null);
                              setEditValue("");
                            }
                          }}
                          disabled={isSaving}
                          className="h-9 w-full rounded-lg border border-border bg-bg px-3 text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                        />
                      ) : (
                        <div>
                          <p className="text-sm font-medium text-text">{row.displayName}</p>
                          <p className="text-xs text-subtle">{row.name}</p>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">{row.vacancyCount}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.isActive
                          ? "bg-success-soft text-success"
                          : "bg-surface-3 text-muted"
                      }`}>
                        {row.isActive ? "Active" : "Archived"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => startRename(row)}
                          disabled={isSaving || isEditing}
                          className="rounded-md p-2 text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
                          title="Rename"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleActive(row)}
                          disabled={isSaving}
                          className="rounded-md p-2 text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
                          title={row.isActive ? "Archive" : "Restore"}
                        >
                          {row.isActive ? <Archive className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                        </button>
                        {row.vacancyCount === 0 && (
                          <button
                            type="button"
                            onClick={() => setDeleting(row)}
                            disabled={isSaving}
                            className="rounded-md p-2 text-muted transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete department"
        message={`Permanently delete "${deleting?.displayName ?? "this department"}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
