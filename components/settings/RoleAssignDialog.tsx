"use client";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Checkbox } from "@/components/ui/Checkbox";

interface Role {
  name: string;
  displayName: string;
}

interface User {
  id: string;
  fullName: string;
  roles: string[];
}

interface Props {
  open: boolean;
  user: User;
  onClose: () => void;
}

export function RoleAssignDialog({ open, user, onClose }: Props) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(user.roles));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(user.roles));
    setError(null);
    fetch("/api/roles", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setRoles)
      .catch(() => {});
  }, [open, user.roles]);

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const r = await fetch(`/api/users/${user.id}/roles`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: Array.from(selected) }),
      });

      if (r.status === 409) {
        const json = await r.json().catch(() => ({}));
        setError(json.error ?? "Cannot remove the last admin from this role.");
        return;
      }
      if (!r.ok) {
        const json = await r.json().catch(() => ({}));
        setError(json.error ?? "Failed to update roles");
        return;
      }

      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={`Roles — ${user.fullName}`} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {roles.length === 0 ? (
          <p className="text-body-sm text-muted">Loading roles...</p>
        ) : (
          <div className="space-y-2">
            {roles.map((r) => (
              <Checkbox
                key={r.name}
                label={r.displayName}
                checked={selected.has(r.name)}
                onChange={() => toggle(r.name)}
                id={`role-${r.name}`}
              />
            ))}
          </div>
        )}

        {error && <p className="text-micro text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-body-sm font-medium text-muted hover:text-text hover:bg-surface-2 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-body-sm font-medium bg-primary text-primary-fg hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save roles"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
