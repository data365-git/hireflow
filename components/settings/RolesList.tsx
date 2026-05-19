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
        {roles.map((role) => {
          const isReadOnly = role.isSystem || role.isSuperadmin;
          return (
            <button
              key={role.name}
              onClick={isReadOnly ? undefined : () => setEditingRole(role)}
              disabled={isReadOnly}
              title={isReadOnly ? "System roles cannot be edited" : undefined}
              className={`relative overflow-hidden text-left bg-surface border border-border rounded-xl p-5 transition-all group ${isReadOnly ? "cursor-default opacity-75" : "cursor-pointer hover:border-primary/40 hover:shadow-sm"}`}
            >
              <div
                className="absolute left-0 inset-y-0 w-1 rounded-l-2xl"
                style={{ backgroundColor: role.color ?? "#3525CD" }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-base font-semibold text-text transition-colors ${isReadOnly ? "" : "group-hover:text-primary"}`}>
                    {role.displayName}
                  </span>
                  {role.isSuperadmin && <span title="Superadmin">👑</span>}
                  {role.isSystem && <span title="System role">🔒</span>}
                </div>
                <p className="text-xs font-medium text-subtle mt-0.5">{role.name}</p>
                {isReadOnly && (
                  <span className="text-xs text-subtle mt-0.5">Read-only</span>
                )}
                {role.description && (
                  <p className="text-body-xs text-muted mt-1 line-clamp-2">{role.description}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {editingRole && (
        <PermissionsGrid
          open={!!editingRole}
          role={editingRole}
          onClose={(changed) => {
            setEditingRole(null);
            if (changed) load();
          }}
        />
      )}

      <CreateRoleDialog
        open={showCreate}
        onClose={(changed) => {
          setShowCreate(false);
          if (changed) load();
        }}
      />
    </div>
  );
}
