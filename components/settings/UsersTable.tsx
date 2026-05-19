"use client";
import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { RoleBadge } from "./RoleBadge";
import { StatusPill } from "./StatusPill";
import { UserEditModal } from "./UserEditModal";
import { DeleteUserDialog } from "./DeleteUserDialog";

interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  isActive: boolean;
  hasAccess: boolean;
  roles: string[];
  createdAt: string;
}

interface SystemRole {
  name: string;
  displayName: string;
  color: string | null;
  isSuperadmin: boolean;
}

export function UsersTable() {
  const { user: me, hasPermission } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [systemRoles, setSystemRoles] = useState<SystemRole[]>([]);
  const [loading, setLoading] = useState(true);

  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const load = async () => {
    setLoading(true);
    const [usersRes, rolesRes] = await Promise.all([
      fetch("/api/users", { credentials: "include" }),
      fetch("/api/roles", { credentials: "include" }),
    ]);
    if (usersRes.ok) setUsers(await usersRes.json());
    if (rolesRes.ok) setSystemRoles(await rolesRes.json());
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const roleColorMap = new Map<string, string | null>(
    systemRoles.map((r) => [r.name, r.color ?? null])
  );
  const superadminRoles = new Set(
    systemRoles.filter((r) => r.isSuperadmin).map((r) => r.name)
  );

  const canWrite = hasPermission("settings", "write");
  const canDelete = hasPermission("settings", "delete");

  const isSuperadminUser = (u: User) =>
    u.roles.some((r) => superadminRoles.has(r));

  if (loading) return <div className="text-muted text-body-sm">Loading...</div>;

  // Build roles prop for UserEditModal: unique roles with color
  const rolesForModal = systemRoles.map((r) => ({ name: r.name, color: r.color ?? null }));

  // Map user to form-compatible shape
  const toEditUser = (u: User) => ({
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    phone: u.phone,
    role: u.roles[0] ?? "",
    isActive: u.isActive,
    hasAccess: u.hasAccess,
  });

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-body-lg font-semibold text-text">Users</h2>
        <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-surface-3 text-micro font-semibold text-muted">
          {users.length}
        </span>
        <div className="flex-1" />
        {canWrite && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-fg text-body-sm font-medium hover:bg-primary-hover transition-colors"
          >
            + Add user
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-2 border-b border-border">
            <tr>
              <th className="text-left px-4 py-3 text-body-sm font-medium text-muted">Full Name</th>
              <th className="text-left px-4 py-3 text-body-sm font-medium text-muted">Login</th>
              <th className="text-left px-4 py-3 text-body-sm font-medium text-muted">Phone</th>
              <th className="text-left px-4 py-3 text-body-sm font-medium text-muted">Role</th>
              <th className="text-left px-4 py-3 text-body-sm font-medium text-muted">Status</th>
              {canWrite && (
                <th className="text-right px-4 py-3 text-body-sm font-medium text-muted">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={canWrite ? 6 : 5} className="px-4 py-8 text-center text-muted text-body-sm">
                  No users found.
                </td>
              </tr>
            )}
            {users.map((u) => {
              const primaryRole = u.roles[0] ?? null;
              const primaryColor = primaryRole ? roleColorMap.get(primaryRole) ?? null : null;
              const isSelf = me?.id === u.id;
              const isSuper = isSuperadminUser(u);
              const showDelete = canDelete && !isSuper && !isSelf;
              const showEdit = canWrite;

              return (
                <tr
                  key={u.id}
                  className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors"
                >
                  <td className="px-4 py-3 text-body-sm font-semibold text-text">{u.fullName}</td>
                  <td className="px-4 py-3 text-body-sm text-muted">{u.email}</td>
                  <td className="px-4 py-3 text-body-sm text-muted">{u.phone ?? "—"}</td>
                  <td className="px-4 py-3">
                    {primaryRole ? (
                      <RoleBadge role={primaryRole} color={primaryColor} />
                    ) : (
                      <span className="text-subtle text-body-sm">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill active={u.isActive && u.hasAccess} />
                  </td>
                  {canWrite && (
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        {showEdit && (
                          <button
                            onClick={() => setEditTarget(u)}
                            className="h-8 w-8 flex items-center justify-center rounded-lg text-subtle hover:text-text hover:bg-surface-3 transition-colors"
                            title="Edit user"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        {showDelete && (
                          <button
                            onClick={() => setDeleteTarget(u)}
                            className="h-8 w-8 flex items-center justify-center rounded-lg text-subtle hover:text-danger hover:bg-danger-soft transition-colors"
                            title="Delete user"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        {!showEdit && !showDelete && (
                          <span className="text-subtle text-body-xs">—</span>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      <UserEditModal
        open={showCreate}
        user={null}
        roles={rolesForModal}
        onClose={(changed) => {
          setShowCreate(false);
          if (changed) load();
        }}
      />

      {/* Edit modal */}
      <UserEditModal
        open={!!editTarget}
        user={editTarget ? toEditUser(editTarget) : null}
        roles={rolesForModal}
        onClose={(changed) => {
          setEditTarget(null);
          if (changed) load();
        }}
      />

      {/* Delete dialog */}
      <DeleteUserDialog
        open={!!deleteTarget}
        user={deleteTarget ? { id: deleteTarget.id, fullName: deleteTarget.fullName } : null}
        onClose={(deleted) => {
          setDeleteTarget(null);
          if (deleted) load();
        }}
      />
    </div>
  );
}
