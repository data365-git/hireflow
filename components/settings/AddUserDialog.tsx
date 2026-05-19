"use client";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";

interface Role {
  name: string;
  displayName: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AddUserDialog({ open, onClose }: Props) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    phone: "",
    role: "",
    hasAccess: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch("/api/roles", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setRoles)
      .catch(() => {});
  }, [open]);

  const handleClose = () => {
    setForm({ email: "", password: "", fullName: "", phone: "", role: "", hasAccess: true });
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        email: form.email,
        fullName: form.fullName,
        hasAccess: form.hasAccess,
      };
      if (form.hasAccess) body.password = form.password;
      if (form.phone) body.phone = form.phone;
      if (form.role) body.role = form.role;

      const r = await fetch("/api/users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!r.ok) {
        const json = await r.json().catch(() => ({}));
        setError(json.error ?? "Failed to create user");
        return;
      }

      handleClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} title="Add user" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Full name"
          value={form.fullName}
          onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
          required
          placeholder="Jane Smith"
        />
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          required
          placeholder="jane@example.com"
        />
        {form.hasAccess && (
          <Input
            label="Password"
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            required
            placeholder="Min. 8 characters"
          />
        )}
        <Input
          label="Phone (optional)"
          type="tel"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          placeholder="+1 555 000 0000"
        />

        <div>
          <label className="block text-body-sm font-medium text-text mb-1">Role (optional)</label>
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            className="w-full rounded-lg border border-border px-3 py-2 text-body-sm bg-surface text-text outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          >
            <option value="">— no role —</option>
            {roles.map((r) => (
              <option key={r.name} value={r.name}>
                {r.displayName}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.hasAccess}
            onChange={(e) => {
              const checked = e.target.checked;
              setForm((f) => ({ ...f, hasAccess: checked, password: checked ? f.password : "" }));
            }}
            className="rounded border-border accent-primary"
          />
          <span className="text-body-sm text-text">Grant access on creation</span>
        </label>

        {error && <p className="text-micro text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-lg text-body-sm font-medium text-muted hover:text-text hover:bg-surface-2 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-body-sm font-medium bg-primary text-primary-fg hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create user"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
