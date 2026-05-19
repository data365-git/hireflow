"use client";
import { useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { ColorPicker } from "./ColorPicker";
import { PermissionsGridEmbed, PermRow } from "./PermissionsGrid";
import { SCREENS_CONFIG } from "@/lib/permissions/screens";

const SCREENS = SCREENS_CONFIG.map((s) => s.key);

function emptyPerms(): PermRow[] {
  return SCREENS.map((s) => ({
    screenName: s,
    canRead: false,
    canCreate: false,
    canEdit: false,
    canDelete: false,
  }));
}

interface RoleInput {
  name: string;
  displayName?: string;
  description: string | null;
  color: string | null;
}

interface Props {
  open: boolean;
  role?: RoleInput | null;
  permissions?: PermRow[];
  onClose: (changed?: boolean) => void;
}

const DEFAULT_COLOR = "#6366f1";

export function RoleEditModal({ open, role, permissions, onClose }: Props) {
  const isCreate = !role;

  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [perms, setPerms] = useState<PermRow[]>(emptyPerms());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Populate form when role prop changes or modal opens
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (role) {
      setDisplayName(role.displayName ?? role.name);
      setDescription(role.description ?? "");
      setColor(role.color ?? DEFAULT_COLOR);
    } else {
      setDisplayName("");
      setDescription("");
      setColor(DEFAULT_COLOR);
    }
  }, [open, role]);

  // Populate permissions when provided
  useEffect(() => {
    if (!open) return;
    if (permissions && permissions.length > 0) {
      const byScreen = new Map(permissions.map((p) => [p.screenName, p]));
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
    } else if (isCreate) {
      setPerms(emptyPerms());
    }
  }, [open, permissions, isCreate]);

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleClose = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onClose();
  };

  const handleSave = async () => {
    setError(null);
    setSaving(true);

    try {
      if (isCreate) {
        // Create mode: POST to /api/roles
        const r = await fetch("/api/roles", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: displayName.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, ""),
            displayName,
            description: description || undefined,
            color,
          }),
        });
        if (!r.ok) {
          const json = await r.json().catch(() => ({}));
          setError(json.error ?? "Failed to create role");
          return;
        }
        const created = await r.json();
        // Then save permissions
        await savePermissions(created.name);
      } else {
        // Edit mode: PUT metadata, then PUT permissions
        const metaR = await fetch(`/api/roles/${role.name}`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName,
            description: description || undefined,
            color,
          }),
        });
        if (!metaR.ok) {
          const json = await metaR.json().catch(() => ({}));
          setError(json.error ?? "Failed to update role");
          return;
        }
        await savePermissions(role.name);
      }

      onClose(true);
    } finally {
      setSaving(false);
    }
  };

  const savePermissions = async (roleName: string) => {
    const r = await fetch(`/api/roles/${roleName}/permissions`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(perms),
    });
    if (!r.ok) {
      const json = await r.json().catch(() => ({}));
      setError(json.error ?? "Failed to save permissions");
      throw new Error("permissions save failed");
    }
  };

  const title = isCreate ? "Create role" : `Edit role — ${role?.displayName ?? role?.name ?? ""}`;

  return (
    <Dialog open={open} onClose={handleClose} title={title} size="lg">
      <div className="space-y-5">
        {/* Role metadata */}
        <div className="space-y-4">
          {/* Name slug — disabled on edit */}
          <Input
            label={isCreate ? "Role slug (auto-generated from display name)" : "Role slug"}
            value={
              isCreate
                ? displayName.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, "")
                : role?.name ?? ""
            }
            readOnly
            disabled
            placeholder="e.g. hr_manager"
          />

          <Input
            label="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            placeholder="e.g. HR Manager"
          />

          <div>
            <label className="block text-body-sm font-medium text-text mb-1">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this role"
              className="w-full rounded-lg border border-border px-3 py-2 text-body-sm bg-surface text-text placeholder:text-subtle outline-none transition-all focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
            />
          </div>

          <div>
            <label className="block text-body-sm font-medium text-text mb-2">Color</label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
        </div>

        {/* Permissions */}
        <div>
          <h3 className="text-body-sm font-semibold text-text mb-3">Permissions</h3>
          <PermissionsGridEmbed perms={perms} onChange={setPerms} />
        </div>

        {error && <p className="text-micro text-danger">{error}</p>}

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-lg text-body-sm font-medium text-muted hover:text-text hover:bg-surface-2 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !displayName.trim()}
            className="px-4 py-2 rounded-lg text-body-sm font-medium bg-primary text-primary-fg hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save role"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
