"use client";
import { useState, useEffect } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { ColorPicker } from "@/components/settings/ColorPicker";

interface Props {
  open: boolean;
  role: { name: string; displayName: string; description: string | null; color: string | null } | null;
  onClose: (changed?: boolean) => void;
}

export function EditRoleDialog({ open, role, onClose }: Props) {
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync form state when role changes or dialog opens
  useEffect(() => {
    if (open && role) {
      setDisplayName(role.displayName);
      setDescription(role.description ?? "");
      setColor(role.color ?? "");
      setError(null);
    }
  }, [open, role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) return;
    setError(null);
    setSaving(true);
    try {
      const r = await fetch(`/api/roles/${role.name}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, description: description || null, color: color || null }),
      });
      if (!r.ok) {
        const json = await r.json().catch(() => ({}));
        setError(json.error ?? "Failed to save changes");
        return;
      }
      onClose(true);
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  };

  if (!role) return null;

  return (
    <Dialog open={open} onClose={() => onClose()} title="Edit role" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-body-sm font-medium text-text">Role identifier</label>
          <input
            type="text"
            value={role.name}
            disabled
            className="w-full px-3 py-2 rounded-lg border border-border bg-surface-2 text-body-sm text-muted cursor-not-allowed"
          />
          <p className="text-micro text-subtle">Role identifier cannot be changed.</p>
        </div>

        <div className="space-y-1">
          <label htmlFor="edit-role-displayname" className="text-body-sm font-medium text-text">
            Display name <span className="text-danger">*</span>
          </label>
          <input
            id="edit-role-displayname"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-body-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="edit-role-description" className="text-body-sm font-medium text-text">
            Description
          </label>
          <textarea
            id="edit-role-description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-body-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-body-sm font-medium text-text">Color</label>
          <ColorPicker value={color} onChange={setColor} />
        </div>

        {error && <p className="text-micro text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => onClose()}
            className="px-4 py-2 rounded-lg text-body-sm font-medium text-muted hover:text-text hover:bg-surface-2 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg text-body-sm font-medium bg-primary text-primary-fg hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
