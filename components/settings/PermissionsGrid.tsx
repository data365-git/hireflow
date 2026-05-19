"use client";
import { useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Checkbox } from "@/components/ui/Checkbox";
import { SCREENS_CONFIG } from "@/lib/permissions/screens";
import { useAuth } from "@/context/AuthContext";

const SCREENS = SCREENS_CONFIG.map((s) => s.key);

export interface PermRow {
  screenName: string;
  canRead: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

interface Role {
  name: string;
  displayName: string;
  isSuperadmin: boolean;
  isSystem: boolean;
}

interface Props {
  open: boolean;
  role: Role;
  onClose: (changed?: boolean) => void;
}

/** Props for embedding the grid inside another component (no Dialog wrapper) */
export interface PermissionsGridEmbedProps {
  perms: PermRow[];
  onChange: (perms: PermRow[]) => void;
  disabled?: boolean;
}

function emptyPerms(): PermRow[] {
  return SCREENS.map((s) => ({
    screenName: s,
    canRead: false,
    canCreate: false,
    canEdit: false,
    canDelete: false,
  }));
}

const ACTIONS = ["canRead", "canCreate", "canEdit", "canDelete"] as const;
type ActionField = (typeof ACTIONS)[number];

/** 3-state value: true = all checked, false = none, null = mixed */
function triState(values: boolean[]): boolean | null {
  const allTrue = values.every(Boolean);
  const allFalse = values.every((v) => !v);
  if (allTrue) return true;
  if (allFalse) return false;
  return null; // mixed
}

/** Renders the permissions table (no Dialog wrapper). Can be used standalone. */
export function PermissionsGridEmbed({ perms, onChange, disabled = false }: PermissionsGridEmbedProps) {
  const toggle = (screenName: string, field: ActionField) => {
    onChange(
      perms.map((p) =>
        p.screenName === screenName ? { ...p, [field]: !p[field] } : p,
      ),
    );
  };

  const setRowAll = (screenName: string, checked: boolean) => {
    onChange(
      perms.map((p) =>
        p.screenName === screenName
          ? { ...p, canRead: checked, canCreate: checked, canEdit: checked, canDelete: checked }
          : p,
      ),
    );
  };

  const setColAll = (field: ActionField, checked: boolean) => {
    onChange(perms.map((p) => ({ ...p, [field]: checked })));
  };

  const setMasterAll = (checked: boolean) => {
    onChange(
      perms.map((p) => ({
        ...p,
        canRead: checked,
        canCreate: checked,
        canEdit: checked,
        canDelete: checked,
      })),
    );
  };

  // Compute master state
  const allCells = perms.flatMap((p) => ACTIONS.map((a) => p[a]));
  const masterState = triState(allCells);

  // Compute per-column state
  const colState = (field: ActionField) => triState(perms.map((p) => p[field]));

  // Indeterminate checkbox handler
  const IndeterminateCheckbox = ({
    state,
    onToggle,
    id,
  }: {
    state: boolean | null;
    onToggle: (checked: boolean) => void;
    id: string;
  }) => {
    const ref = useRef<HTMLInputElement>(null);
    useEffect(() => {
      if (ref.current) {
        ref.current.indeterminate = state === null;
      }
    }, [state]);

    return (
      <input
        ref={ref}
        id={id}
        type="checkbox"
        checked={state === true}
        onChange={(e) => onToggle(e.target.checked)}
        disabled={disabled}
        className="rounded border-border accent-primary cursor-pointer disabled:cursor-not-allowed"
      />
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 px-3 text-body-sm font-medium text-muted w-40">Screen</th>
            {/* Per-column master checkboxes */}
            {ACTIONS.map((field) => {
              const state = colState(field);
              const label = field === "canRead" ? "View" : field === "canCreate" ? "Create" : field === "canEdit" ? "Edit" : "Delete";
              return (
                <th key={field} className="py-2 px-3 text-body-sm font-medium text-muted text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span>{label}</span>
                    <IndeterminateCheckbox
                      state={state}
                      onToggle={(checked) => setColAll(field, checked)}
                      id={`col-all-${field}`}
                    />
                  </div>
                </th>
              );
            })}
            {/* All column header with master checkbox */}
            <th className="py-2 px-3 text-body-sm font-medium text-muted text-center">
              <div className="flex flex-col items-center gap-1">
                <span>All</span>
                <IndeterminateCheckbox
                  state={masterState}
                  onToggle={setMasterAll}
                  id="master-all"
                />
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {perms.map((p) => {
            const rowLabel = SCREENS_CONFIG.find((s) => s.key === p.screenName)?.label ?? p.screenName;
            const rowState = triState(ACTIONS.map((a) => p[a]));
            return (
              <tr key={p.screenName} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                <td className="py-2.5 px-3 text-body-sm text-text">{rowLabel}</td>
                {ACTIONS.map((field) => (
                  <td key={field} className="py-2.5 px-3 text-center">
                    <div className="flex justify-center">
                      <Checkbox
                        checked={p[field]}
                        onChange={() => !disabled && toggle(p.screenName, field)}
                        disabled={disabled}
                        id={`perm-${p.screenName}-${field}`}
                      />
                    </div>
                  </td>
                ))}
                {/* Row "All" column */}
                <td className="py-2.5 px-3 text-center">
                  <div className="flex justify-center">
                    <IndeterminateCheckbox
                      state={rowState}
                      onToggle={(checked) => setRowAll(p.screenName, checked)}
                      id={`row-all-${p.screenName}`}
                    />
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

/** Dialog-wrapped permissions grid (backwards compatible with existing usage). */
export function PermissionsGrid({ open, role, onClose }: Props) {
  const [perms, setPerms] = useState<PermRow[]>(emptyPerms());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Clear timer when dialog closes externally
  useEffect(() => {
    if (!open && timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setSaved(false);
    setError(null);
    setLoading(true);

    fetch(`/api/roles/${role.name}/permissions`, { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) return;
        const data: PermRow[] = await r.json();
        const byScreen = new Map(data.map((p) => [p.screenName, p]));
        setPerms(
          SCREENS.map((s) =>
            byScreen.get(s) ?? {
              screenName: s,
              canRead: false,
              canCreate: false,
              canEdit: false,
              canDelete: false,
            },
          ),
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, role.name]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const r = await fetch(`/api/roles/${role.name}/permissions`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(perms),
      });

      if (!r.ok) {
        const json = await r.json().catch(() => ({}));
        setError(json.error ?? "Failed to save permissions");
        return;
      }

      setSaved(true);
      timerRef.current = setTimeout(() => {
        setSaved(false);
        onClose(true);
      }, 1000);
    } finally {
      setSaving(false);
    }
  };

  const { user } = useAuth();
  const isReadOnly = role.isSuperadmin || (role.isSystem && !user?.isSuperadmin);

  return (
    <Dialog open={open} onClose={onClose} title={`Permissions — ${role.displayName}`} size="lg">
      <div className="space-y-4">
        {isReadOnly && (
          <div className="rounded-lg bg-warning-soft border border-warning/20 px-4 py-2 text-body-xs text-warning">
            {role.isSuperadmin
              ? "The superadmin role bypasses all permission checks — its rows have no effect."
              : "This is a system role and its permissions cannot be edited."}
          </div>
        )}

        {loading ? (
          <p className="text-body-sm text-muted">Loading...</p>
        ) : (
          <PermissionsGridEmbed
            perms={perms}
            onChange={setPerms}
            disabled={isReadOnly}
          />
        )}

        {error && <p className="text-micro text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => onClose()}
            className="px-4 py-2 rounded-lg text-body-sm font-medium text-muted hover:text-text hover:bg-surface-2 transition-colors"
          >
            Close
          </button>
          {!isReadOnly && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || saved}
              className="px-4 py-2 rounded-lg text-body-sm font-medium bg-primary text-primary-fg hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {saved ? "Saved!" : saving ? "Saving..." : "Save"}
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
