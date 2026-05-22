"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Archive, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import * as departmentActions from "@/app/actions/departments";
import type { DepartmentRow } from "@/app/actions/departments";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { ForceDeleteDepartmentDialog } from "@/components/settings/ForceDeleteDepartmentDialog";
import { toast } from "@/lib/hooks/useToast";

type Props = {
  initial: DepartmentListRow[];
};

export type DepartmentListRow = DepartmentRow & {
  activeCount?: number;
  closedCount?: number;
  deletedCount?: number;
};

type DepartmentBlockerCode = "ACTIVE_VACANCIES_EXIST" | "CLOSED_VACANCIES_EXIST";

type VacancyBlocker = {
  id: string;
  title?: string | null;
  status?: string | null;
};

type DepartmentBlockers = {
  active?: VacancyBlocker[];
  closed?: VacancyBlocker[];
  deleted?: VacancyBlocker[];
  vacancies?: VacancyBlocker[];
};

type DepartmentActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error?: unknown; code?: unknown; blockers?: DepartmentBlockers };

type DepartmentActions = typeof departmentActions & {
  createDepartment: typeof departmentActions.createDepartment;
  deleteDepartment: (id: string) => Promise<DepartmentActionResult>;
  renameDepartment: typeof departmentActions.renameDepartment;
  setDepartmentActive: typeof departmentActions.setDepartmentActive;
  getDepartmentBlockers?: (deptId: string) => Promise<DepartmentBlockers>;
};

const actions = departmentActions as DepartmentActions;

function getCounts(row: DepartmentListRow) {
  return {
    active: row.activeCount ?? row.vacancyCount ?? 0,
    closed: row.closedCount ?? 0,
    deleted: row.deletedCount ?? 0,
  };
}

function getActionError(result: DepartmentActionResult) {
  if (result.ok) return null;
  if (typeof result.error === "string") return result.error;
  if (result.error && typeof result.error === "object" && "message" in result.error) {
    const message = (result.error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Could not delete department.";
}

function getBlockerCode(result: DepartmentActionResult): DepartmentBlockerCode | null {
  if (result.ok) return null;

  const candidates = [
    result.code,
    result.error && typeof result.error === "object" ? (result.error as { code?: unknown }).code : null,
  ];
  return candidates.find(
    (code): code is DepartmentBlockerCode =>
      code === "ACTIVE_VACANCIES_EXIST" || code === "CLOSED_VACANCIES_EXIST"
  ) ?? null;
}

function getResultBlockers(result: DepartmentActionResult): DepartmentBlockers | undefined {
  if (result.ok) return undefined;
  if ("blockers" in result) return result.blockers;
  if (result.error && typeof result.error === "object" && "blockers" in result.error) {
    return (result.error as { blockers?: DepartmentBlockers }).blockers;
  }
  return undefined;
}

function CountBadge({ label, count, tone }: { label: string; count: number; tone: "danger" | "muted" | "soft" }) {
  const toneClass = {
    danger: "border-danger/20 bg-danger-soft text-danger",
    muted: "border-border bg-surface-2 text-muted",
    soft: "border-border bg-bg text-subtle",
  }[tone];

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
      <span>{label}</span>
      <span className="tabular-nums">{count}</span>
    </span>
  );
}

export function DepartmentsList({ initial }: Props) {
  const [rows, setRows] = useState(initial);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<DepartmentListRow | null>(null);
  const [forceDeleting, setForceDeleting] = useState<DepartmentListRow | null>(null);
  const [activeBlockers, setActiveBlockers] = useState<{
    department: DepartmentListRow;
    blockers: DepartmentBlockers | null;
    loading: boolean;
  } | null>(null);
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
      const result = await actions.createDepartment({ displayName });
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
      const result = await actions.renameDepartment(id, displayName);
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
      const result = await actions.setDepartmentActive(row.id, !row.isActive);
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
      const result = await actions.deleteDepartment(deleting.id);
      if (!result.ok) {
        const code = getBlockerCode(result);
        if (code === "ACTIVE_VACANCIES_EXIST") {
          const message = getActionError(result) ?? "This department has active vacancies. Close or move them before deleting it.";
          toast.error(message);
          void openActiveBlockers(deleting, getResultBlockers(result));
          return;
        }
        if (code === "CLOSED_VACANCIES_EXIST") {
          setForceDeleting(deleting);
          setDeleting(null);
          return;
        }
        toast.error(getActionError(result) ?? "Could not delete department.");
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

  async function openActiveBlockers(department: DepartmentListRow, initialBlockers?: DepartmentBlockers) {
    setDeleting(null);
    setActiveBlockers({ department, blockers: initialBlockers ?? null, loading: !initialBlockers });
    if (initialBlockers || !actions.getDepartmentBlockers) return;

    try {
      const blockers = await actions.getDepartmentBlockers(department.id);
      setActiveBlockers((current) =>
        current?.department.id === department.id ? { department, blockers, loading: false } : current
      );
    } catch {
      setActiveBlockers((current) =>
        current?.department.id === department.id ? { department, blockers: null, loading: false } : current
      );
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
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-subtle">Vacancies</th>
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
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <CountBadge label="Active" count={getCounts(row).active} tone={getCounts(row).active > 0 ? "danger" : "muted"} />
                        <CountBadge label="Closed" count={getCounts(row).closed} tone={getCounts(row).closed > 0 ? "muted" : "soft"} />
                        <CountBadge label="Deleted" count={getCounts(row).deleted} tone="soft" />
                      </div>
                    </td>
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
                        <button
                          type="button"
                          onClick={() => setDeleting(row)}
                          disabled={isSaving}
                          className="rounded-md p-2 text-muted transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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

      <ActiveVacancyBlockersDialog
        state={activeBlockers}
        onClose={() => setActiveBlockers(null)}
      />

      <ForceDeleteDepartmentDialog
        open={Boolean(forceDeleting)}
        department={forceDeleting}
        departments={rows}
        onClose={() => setForceDeleting(null)}
        onDeleted={(departmentId) => {
          setRows((current) => current.filter((row) => row.id !== departmentId));
          setForceDeleting(null);
        }}
      />
    </div>
  );
}

function ActiveVacancyBlockersDialog({
  state,
  onClose,
}: {
  state: {
    department: DepartmentListRow;
    blockers: DepartmentBlockers | null;
    loading: boolean;
  } | null;
  onClose: () => void;
}) {
  const activeVacancies = state?.blockers?.active ?? state?.blockers?.vacancies ?? [];

  return (
    <Dialog
      open={Boolean(state)}
      onClose={onClose}
      title="Active vacancies block deletion"
      size="md"
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-3 text-body-sm text-danger">
          {state?.department.displayName ?? "This department"} cannot be deleted while it has active vacancies.
        </div>

        <div className="space-y-2 text-body-sm text-muted">
          {state?.loading ? (
            <p>Checking active vacancies...</p>
          ) : activeVacancies.length > 0 ? (
            <div className="space-y-2">
              <p>Close or reassign these vacancies first:</p>
              <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border bg-bg p-2">
                {activeVacancies.map((vacancy) => (
                  <li key={vacancy.id}>
                    <Link
                      href={`/vacancies/${vacancy.id}`}
                      className="block rounded-md px-2 py-1.5 text-text transition-colors hover:bg-surface-2"
                    >
                      {vacancy.title || vacancy.id}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p>Close or reassign the active vacancies in this department first, then try deleting it again.</p>
          )}
        </div>

        <div className="flex justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
