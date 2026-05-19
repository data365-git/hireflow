"use client";
import { useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Checkbox } from "@/components/ui/Checkbox";

const SCREENS = [
  "dashboard",
  "vacancies",
  "candidates",
  "inbox",
  "leads",
  "analytics",
  "automations",
  "templates",
  "settings",
];

interface PermRow {
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

function emptyPerms(): PermRow[] {
  return SCREENS.map((s) => ({
    screenName: s,
    canRead: false,
    canCreate: false,
    canEdit: false,
    canDelete: false,
  }));
}

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

  const toggle = (screenName: string, field: keyof Omit<PermRow, "screenName">) => {
    setPerms((prev) =>
      prev.map((p) =>
        p.screenName === screenName ? { ...p, [field]: !p[field] } : p,
      ),
    );
  };

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

  const isReadOnly = role.isSystem || role.isSuperadmin;

  return (
    <Dialog open={open} onClose={onClose} title={`Permissions — ${role.displayName}`} size="lg">
      <div className="space-y-4">
        {(role.isSuperadmin || role.isSystem) && (
          <div className="rounded-lg bg-warning-soft border border-warning/20 px-4 py-2 text-body-xs text-warning">
            {role.isSuperadmin
              ? "This is a superadmin role — it has all permissions by default and cannot be restricted."
              : "This is a system role and its permissions cannot be edited."}
          </div>
        )}

        {loading ? (
          <p className="text-body-sm text-muted">Loading...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-body-sm font-medium text-muted w-40">Screen</th>
                  <th className="py-2 px-3 text-body-sm font-medium text-muted text-center">View</th>
                  <th className="py-2 px-3 text-body-sm font-medium text-muted text-center">Create</th>
                  <th className="py-2 px-3 text-body-sm font-medium text-muted text-center">Edit</th>
                  <th className="py-2 px-3 text-body-sm font-medium text-muted text-center">Delete</th>
                </tr>
              </thead>
              <tbody>
                {perms.map((p) => (
                  <tr key={p.screenName} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                    <td className="py-2.5 px-3 text-body-sm text-text capitalize">{p.screenName}</td>
                    {(["canRead", "canCreate", "canEdit", "canDelete"] as const).map((field) => (
                      <td key={field} className="py-2.5 px-3 text-center">
                        <div className="flex justify-center">
                          <Checkbox
                            checked={role.isSuperadmin || p[field]}
                            onChange={() => !isReadOnly && toggle(p.screenName, field)}
                            disabled={isReadOnly}
                            id={`perm-${p.screenName}-${field}`}
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
