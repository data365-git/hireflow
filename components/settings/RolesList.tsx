"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { PermissionsGrid } from "./PermissionsGrid";
import { CreateRoleDialog } from "./CreateRoleDialog";

interface Role {
  name: string;
  displayName: string;
  description?: string | null;
  color?: string | null;
  isSuperadmin: boolean;
  isSystem: boolean;
}

export function RolesList() {
  const { hasPermission } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    const r = await fetch("/api/roles", { credentials: "include" });
    if (r.ok) setRoles(await r.json());
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map((role) => (
          <button
            key={role.name}
            onClick={() => setEditingRole(role)}
            className="text-left bg-surface border border-border rounded-xl p-4 hover:border-primary/40 hover:shadow-sm transition-all group"
          >
            <div className="flex items-start gap-3">
              <div
                className="size-8 rounded-lg shrink-0 mt-0.5"
                style={{ backgroundColor: role.color ?? "#3525CD" }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-body-sm font-semibold text-text group-hover:text-primary transition-colors">
                    {role.displayName}
                  </span>
                  {role.isSuperadmin && <span title="Superadmin">👑</span>}
                  {role.isSystem && <span title="System role">🔒</span>}
                </div>
                <p className="text-micro text-subtle mt-0.5">{role.name}</p>
                {role.description && (
                  <p className="text-body-xs text-muted mt-1 line-clamp-2">{role.description}</p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {editingRole && (
        <PermissionsGrid
          open={!!editingRole}
          role={editingRole}
          onClose={() => {
            setEditingRole(null);
            load();
          }}
        />
      )}

      <CreateRoleDialog
        open={showCreate}
        onClose={() => {
          setShowCreate(false);
          load();
        }}
      />
    </div>
  );
}
