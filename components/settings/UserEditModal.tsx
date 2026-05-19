"use client";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { PASSWORD_SCHEMA } from "@/lib/auth/password";

interface UserForEdit {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  role: string;
  isActive: boolean;
  hasAccess: boolean;
}

interface Role {
  name: string;
  color: string | null;
}

interface Props {
  open: boolean;
  user?: UserForEdit | null; // null/undefined = create mode
  roles: Role[];
  onClose: (changed?: boolean) => void;
}

interface FormState {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  role: string;
  isActive: boolean;
}

function blankForm(roles: Role[]): FormState {
  return {
    fullName: "",
    email: "",
    password: "",
    phone: "",
    role: roles[0]?.name ?? "",
    isActive: true,
  };
}

function userToForm(user: UserForEdit): FormState {
  return {
    fullName: user.fullName,
    email: user.email,
    password: "",
    phone: user.phone ?? "",
    role: user.role,
    isActive: user.isActive && user.hasAccess,
  };
}

export function UserEditModal({ open, user, roles, onClose }: Props) {
  const isEdit = !!user;
  const [form, setForm] = useState<FormState>(() =>
    user ? userToForm(user) : blankForm(roles)
  );
  const [pwError, setPwError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Re-initialise form when user/open changes
  useEffect(() => {
    if (!open) return;
    setForm(user ? userToForm(user) : blankForm(roles));
    setPwError(null);
    setError(null);
  }, [open, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    onClose();
  };

  const validatePassword = (pw: string): string | null => {
    if (!pw) return null; // empty = ok in edit mode
    const result = PASSWORD_SCHEMA.safeParse(pw);
    return result.success ? null : result.error.issues[0].message;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Password validation
    if (!isEdit || form.password) {
      const err = validatePassword(form.password);
      if (err) { setPwError(err); return; }
      if (!isEdit && !form.password) {
        setPwError("Password is required");
        return;
      }
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        const body: Record<string, unknown> = {
          fullName: form.fullName,
          phone: form.phone || null,
          role: form.role,
          isActive: form.isActive,
          hasAccess: form.isActive,
        };
        if (form.password) body.password = form.password;

        const r = await fetch(`/api/users/${user!.id}`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) {
          const json = await r.json().catch(() => ({}));
          setError(json.error ?? "Failed to update user");
          return;
        }
      } else {
        const body: Record<string, unknown> = {
          email: form.email,
          password: form.password,
          fullName: form.fullName,
          hasAccess: true,
          isActive: true,
        };
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
      }
      onClose(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={isEdit ? "Edit user" : "Add user"}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Full name"
          value={form.fullName}
          onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
          required
          placeholder="Jane Smith"
        />

        <Input
          label="Login (email)"
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          required={!isEdit}
          disabled={isEdit}
          placeholder="jane@example.com"
        />

        <div>
          <Input
            label={isEdit ? "Password" : "Password"}
            type="password"
            value={form.password}
            onChange={(e) => {
              const pw = e.target.value;
              setForm((f) => ({ ...f, password: pw }));
              if (pwError) setPwError(validatePassword(pw));
            }}
            onBlur={() => {
              if (!isEdit && !form.password) {
                setPwError("Password is required");
                return;
              }
              setPwError(validatePassword(form.password));
            }}
            required={!isEdit}
            placeholder={isEdit ? "Leave blank to keep current" : "Min. 8 characters"}
            error={pwError ?? undefined}
          />
          <p className="text-micro text-muted mt-1">
            Min 8 characters · uppercase · lowercase · number
          </p>
        </div>

        <Input
          label="Phone (optional)"
          type="tel"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          placeholder="+1 555 000 0000"
        />

        <div>
          <label className="block text-body-sm font-medium text-text mb-1">Role</label>
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            className="w-full rounded-lg border border-border px-3 py-2 text-body-sm bg-surface text-text outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          >
            {roles.map((r) => (
              <option key={r.name} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        {isEdit && (
          <div>
            <label className="block text-body-sm font-medium text-text mb-1">Status</label>
            <select
              value={form.isActive ? "active" : "inactive"}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.value === "active" }))}
              className="w-full rounded-lg border border-border px-3 py-2 text-body-sm bg-surface text-text outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-danger-soft border border-danger/20 px-3 py-2">
            <p className="text-body-sm text-danger">{error}</p>
          </div>
        )}

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
            {submitting
              ? isEdit ? "Saving..." : "Creating..."
              : isEdit ? "Save changes" : "Create user"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
