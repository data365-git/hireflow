"use client";
import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";

const PRESET_COLORS = [
  "#3525CD", "#7C3AED", "#0284C7", "#059669",
  "#D97706", "#DC2626", "#475569", "#0F172A",
];

const SLUG_RE = /^[a-z0-9_-]+$/;

interface Props {
  open: boolean;
  onClose: () => void;
}

function toSlug(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "");
}

export function CreateRoleDialog({ open, onClose }: Props) {
  const [form, setForm] = useState({
    displayName: "",
    name: "",
    description: "",
    color: PRESET_COLORS[0],
    isSuperadmin: false,
  });
  const [slugManual, setSlugManual] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleDisplayNameChange = (v: string) => {
    setForm((f) => ({
      ...f,
      displayName: v,
      name: slugManual ? f.name : toSlug(v),
    }));
  };

  const handleSlugChange = (v: string) => {
    setSlugManual(true);
    setForm((f) => ({ ...f, name: v }));
    if (v && !SLUG_RE.test(v)) {
      setSlugError("Only lowercase letters, numbers, _ and - allowed");
    } else {
      setSlugError(null);
    }
  };

  const handleClose = () => {
    setForm({ displayName: "", name: "", description: "", color: PRESET_COLORS[0], isSuperadmin: false });
    setSlugManual(false);
    setError(null);
    setSlugError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!SLUG_RE.test(form.name)) {
      setSlugError("Only lowercase letters, numbers, _ and - allowed");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const r = await fetch("/api/roles", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: form.displayName,
          name: form.name,
          description: form.description || undefined,
          color: form.color,
          isSuperadmin: form.isSuperadmin,
        }),
      });

      if (!r.ok) {
        const json = await r.json().catch(() => ({}));
        setError(json.error ?? "Failed to create role");
        return;
      }

      handleClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} title="Create role" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Display name"
          value={form.displayName}
          onChange={(e) => handleDisplayNameChange(e.target.value)}
          required
          placeholder="e.g. HR Manager"
        />
        <Input
          label="Slug (auto-generated)"
          value={form.name}
          onChange={(e) => handleSlugChange(e.target.value)}
          required
          placeholder="e.g. hr_manager"
          error={slugError ?? undefined}
        />
        <Input
          label="Description (optional)"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Brief description of this role"
        />

        <div>
          <label className="block text-body-sm font-medium text-text mb-2">Color</label>
          <div className="flex gap-2 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setForm((f) => ({ ...f, color: c }))}
                className={`size-7 rounded-lg transition-all ${
                  form.color === c ? "ring-2 ring-offset-2 ring-primary scale-110" : "hover:scale-105"
                }`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
        </div>

        <Checkbox
          label="Superadmin (all permissions)"
          checked={form.isSuperadmin}
          onChange={(e) => setForm((f) => ({ ...f, isSuperadmin: e.target.checked }))}
          id="create-role-superadmin"
        />

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
            disabled={submitting || !!slugError}
            className="px-4 py-2 rounded-lg text-body-sm font-medium bg-primary text-primary-fg hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create role"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
