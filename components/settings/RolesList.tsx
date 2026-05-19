"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { RoleRow } from "./RoleRow";
import { RoleEditModal } from "./RoleEditModal";
import { EditRoleDialog } from "./EditRoleDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { PermRow } from "./PermissionsGrid";

interface Role {
  name: string;
  displayName: string;
  description: string | null;
  color: string | null;
  isSuperadmin: boolean;
  isSystem: boolean;
}

interface RoleWithPerms extends Role {
  permissions: PermRow[];
}

export function RolesList() {
  const { hasPermission } = useAuth();
  const [roles, setRoles] = useState<RoleWithPerms[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit / create modal state
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editingPerms, setEditingPerms] = useState<PermRow[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  // Meta-edit (display name / description / color) state
  const [editingMeta, setEditingMeta] = useState<RoleWithPerms | null>(null);

  // Delete confirm state
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const rolesRes = await fetch("/api/roles", { credentials: "include" });
      if (!rolesRes.ok) return;
      const roleList: Role[] = await rolesRes.json();

      // Load permissions for all roles in parallel
      const withPerms: RoleWithPerms[] = await Promise.all(
        roleList.map(async (role) => {
          try {
            const r = await fetch(`/api/roles/${role.name}/permissions`, { credentials: "include" });
            const perms: PermRow[] = r.ok ? await r.json() : [];
            return { ...role, permissions: perms };
          } catch {
            return { ...role, permissions: [] };
          }
        }),
      );

      setRoles(withPerms);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleEditClick = (role: RoleWithPerms) => {
    setEditingRole(role);
    setEditingPerms(role.permissions);
  };

  const handleDeleteClick = (role: Role) => {
    setDeleteError(null);
    setDeletingRole(role);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingRole) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const r = await fetch(`/api/roles/${deletingRole.name}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) {
        const json = await r.json().catch(() => ({}));
        setDeleteError(json.error ?? "Failed to delete role");
        return;
      }
      setDeletingRole(null);
      load();
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className="text-muted text-body-sm">Loading...</div>;

  return (
    <div>
      {hasPermission("settings", "write") && (
        <div className="mb-6 flex justify-end">
          <button
            onClick={() => setShowCreate(true)}
            className="bg-primary text-primary-fg rounded-lg px-4 py-2 text-body-sm font-medium hover:bg-primary-hover transition-colors"
          >
            + New role
          </button>
        </div>
      )}

      <div className="space-y-2">
        {roles.map((role) => (
          <RoleRow
            key={role.name}
            role={role}
            permissions={role.permissions}
            onEdit={() => handleEditClick(role)}
            onDelete={() => handleDeleteClick(role)}
            onEditMeta={() => setEditingMeta(role)}
          />
        ))}
      </div>

      {/* Edit modal */}
      {editingRole && (
        <RoleEditModal
          open={!!editingRole}
          role={editingRole}
          permissions={editingPerms}
          onClose={(changed) => {
            setEditingRole(null);
            setEditingPerms([]);
            if (changed) load();
          }}
        />
      )}

      {/* Create modal */}
      <RoleEditModal
        open={showCreate}
        role={null}
        onClose={(changed) => {
          setShowCreate(false);
          if (changed) load();
        }}
      />

      {/* Edit role metadata (display name / description / color) */}
      <EditRoleDialog
        open={!!editingMeta}
        role={editingMeta}
        onClose={(changed) => {
          setEditingMeta(null);
          if (changed) load();
        }}
      />

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={!!deletingRole}
        title="Delete role"
        message={
          deleteError
            ? deleteError
            : `Are you sure you want to delete the role "${deletingRole?.displayName ?? deletingRole?.name}"? This cannot be undone.`
        }
        confirmLabel={deleting ? "Deleting..." : "Delete"}
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setDeletingRole(null);
          setDeleteError(null);
        }}
      />
    </div>
  );
}
