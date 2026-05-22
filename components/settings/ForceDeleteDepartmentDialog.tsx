"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import * as departmentActions from "@/app/actions/departments";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/hooks/useToast";
import type { DepartmentListRow } from "@/components/settings/DepartmentsList";

type ForceAction = "orphan" | "reassign" | "cascade-delete-vacancies";

type VacancyBlocker = {
  id: string;
  title?: string | null;
  status?: string | null;
};

type DepartmentBlockers = {
  closed?: VacancyBlocker[];
  deleted?: VacancyBlocker[];
  vacancies?: VacancyBlocker[];
};

type DepartmentOption = {
  id: string;
  name?: string;
  displayName?: string;
  isActive?: boolean;
};

type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error?: unknown };

type DepartmentActions = typeof departmentActions & {
  forceDeleteDepartment?: (
    deptId: string,
    action: ForceAction,
    reassignToId?: string,
  ) => Promise<ActionResult>;
  getDepartmentBlockers?: (deptId: string) => Promise<DepartmentBlockers>;
  listDepartments?: (includeInactive?: boolean) => Promise<DepartmentOption[]>;
};

type Props = {
  open: boolean;
  department: DepartmentListRow | null;
  departments: DepartmentListRow[];
  onClose: () => void;
  onDeleted: (departmentId: string) => void;
};

const actions = departmentActions as DepartmentActions;

function getActionError(result: ActionResult) {
  if (result.ok) return null;
  if (typeof result.error === "string") return result.error;
  if (result.error && typeof result.error === "object" && "message" in result.error) {
    const message = (result.error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Could not delete department.";
}

function optionLabel(option: DepartmentOption) {
  return option.displayName ?? option.name ?? option.id;
}

export function ForceDeleteDepartmentDialog({
  open,
  department,
  departments,
  onClose,
  onDeleted,
}: Props) {
  const [action, setAction] = useState<ForceAction>("orphan");
  const [reassignToId, setReassignToId] = useState("");
  const [blockers, setBlockers] = useState<DepartmentBlockers | null>(null);
  const [reassignOptions, setReassignOptions] = useState<DepartmentOption[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fallbackOptions = useMemo(
    () =>
      departments
        .filter((row) => row.id !== department?.id)
        .map((row) => ({
          id: row.id,
          name: row.name,
          displayName: row.displayName,
          isActive: row.isActive,
        })),
    [department?.id, departments],
  );

  const options = reassignOptions.length > 0 ? reassignOptions : fallbackOptions;
  const filteredOptions = options.filter((option) => option.id !== department?.id);
  const closedVacancies = blockers?.closed ?? blockers?.vacancies ?? [];
  const deletedVacancies = blockers?.deleted ?? [];

  useEffect(() => {
    if (!open || !department) {
      setAction("orphan");
      setReassignToId("");
      setBlockers(null);
      setReassignOptions([]);
      setLoadingDetails(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoadingDetails(true);
    setError(null);

    Promise.all([
      actions.getDepartmentBlockers?.(department.id).catch(() => null) ?? Promise.resolve(null),
      actions.listDepartments?.(true).catch(() => null) ?? Promise.resolve(null),
    ])
      .then(([nextBlockers, nextOptions]) => {
        if (cancelled) return;
        setBlockers(nextBlockers);
        if (Array.isArray(nextOptions)) setReassignOptions(nextOptions);
      })
      .finally(() => {
        if (!cancelled) setLoadingDetails(false);
      });

    return () => {
      cancelled = true;
    };
  }, [department, open]);

  function handleForceDelete() {
    if (!department) return;
    if (action === "reassign" && !reassignToId) {
      setError("Choose a department to receive the closed vacancies.");
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        if (!actions.forceDeleteDepartment) {
          throw new Error("Force delete action is not available yet.");
        }

        const result = await actions.forceDeleteDepartment(
          department.id,
          action,
          action === "reassign" ? reassignToId : undefined,
        );
        const actionError = getActionError(result);
        if (actionError) throw new Error(actionError);

        toast.success("Department deleted");
        onDeleted(department.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not delete department.";
        setError(message);
        toast.error(message);
      }
    });
  }

  return (
    <Dialog
      open={open && Boolean(department)}
      onClose={() => {
        if (!isPending) onClose();
      }}
      title="Delete department with closed vacancies"
      size="lg"
    >
      <div className="space-y-5">
        <div className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-3 text-body-sm text-danger">
          {department?.displayName ?? "This department"} has closed vacancy history. Choose what should happen to those vacancies before deleting the department.
        </div>

        <div className="space-y-2">
          <p className="text-body-sm font-medium text-text">Closed vacancy handling</p>
          <div className="grid gap-2">
            <ForceOption
              id="force-dept-orphan"
              checked={action === "orphan"}
              title="Keep vacancies without a department"
              description="The vacancy history stays available, but its department field is cleared."
              onChange={() => setAction("orphan")}
              disabled={isPending}
            />
            <ForceOption
              id="force-dept-reassign"
              checked={action === "reassign"}
              title="Reassign vacancies to another department"
              description="Move closed vacancy history to a different department before deleting this one."
              onChange={() => setAction("reassign")}
              disabled={isPending}
            />
            {action === "reassign" && (
              <select
                value={reassignToId}
                onChange={(event) => setReassignToId(event.target.value)}
                disabled={isPending}
                className="ml-7 h-9 rounded-lg border border-border bg-bg px-3 text-body-sm text-text focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
              >
                <option value="">Select department...</option>
                {filteredOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {optionLabel(option)}
                  </option>
                ))}
              </select>
            )}
            <ForceOption
              id="force-dept-cascade"
              checked={action === "cascade-delete-vacancies"}
              title="Delete closed vacancies too"
              description="Also remove the closed vacancies tied to this department."
              onChange={() => setAction("cascade-delete-vacancies")}
              disabled={isPending}
            />
          </div>
        </div>

        <div className="space-y-2 text-body-sm text-muted">
          {loadingDetails ? (
            <p>Checking vacancy history...</p>
          ) : closedVacancies.length > 0 ? (
            <div className="space-y-2">
              <p>{closedVacancies.length} closed vacancy{closedVacancies.length === 1 ? "" : "ies"} will be affected.</p>
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border bg-bg p-2">
                {closedVacancies.map((vacancy) => (
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
            <p>The server reported closed vacancy blockers for this department.</p>
          )}
          {deletedVacancies.length > 0 && (
            <p>{deletedVacancies.length} already deleted vacancy{deletedVacancies.length === 1 ? "" : "ies"} may also be updated.</p>
          )}
        </div>

        {error && <p className="text-body-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={handleForceDelete} disabled={isPending}>
            <Trash2 className="size-4" />
            {isPending ? "Deleting..." : "Delete department"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function ForceOption({
  id,
  checked,
  title,
  description,
  onChange,
  disabled,
}: {
  id: string;
  checked: boolean;
  title: string;
  description: string;
  onChange: () => void;
  disabled: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer gap-3 rounded-lg border border-border bg-bg px-3 py-2 transition-colors hover:bg-surface-2"
    >
      <input
        id={id}
        type="radio"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="mt-1"
      />
      <span className="space-y-0.5">
        <span className="block text-body-sm font-medium text-text">{title}</span>
        <span className="block text-xs text-muted">{description}</span>
      </span>
    </label>
  );
}
