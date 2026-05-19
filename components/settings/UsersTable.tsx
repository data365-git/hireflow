"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { AddUserDialog } from "./AddUserDialog";
import { RoleAssignDialog } from "./RoleAssignDialog";
import { ResetPasswordDialog } from "./ResetPasswordDialog";

interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  isActive: boolean;
  hasAccess: boolean;
  adminPassword?: string | null;
  roles: string[];
  createdAt: string;
}

export function UsersTable() {
  const { hasPermission } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingRolesFor, setEditingRolesFor] = useState<User | null>(null);
  const [resettingFor, setResettingFor] = useState<User | null>(null);

  const load = async () => {
    setLoading(true);
    const r = await fetch("/api/users", { credentials: "include" });
    if (r.ok) setUsers(await r.json());
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleRevoke = async (user: User) => {
    const reason = prompt("Reason for revoking access?");
    if (reason === null) return;
    await fetch(`/api/users/${user.id}/access`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hasAccess: false, reason }),
    });
    load();
  };

  const handleReactivate = async (user: User) => {
    if (!confirm(`Reactivate ${user.fullName}?`)) return;
    await fetch(`/api/users/${user.id}/reactivate`, {
      method: "POST",
      credentials: "include",
    });
    load();
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`PERMANENTLY delete ${user.fullName}? This cannot be undone.`)) return;
    const r = await fetch(`/api/users/${user.id}/permanent`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!r.ok) {
      const { error } = await r.json();
      alert(error ?? "Delete failed");
      return;
    }
    load();
  };

  if (loading) return <div className="text-muted text-body-sm">Loading...</div>;

  return (
    <div>
      {hasPermission("settings", "write") && (
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => setShowAdd(true)}
            className="bg-primary text-primary-fg rounded-lg px-4 py-2 text-body-sm font-medium hover:bg-primary-hover transition-colors"
          >
            + Add user
          </button>
        </div>
      )}

      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-2 border-b border-border">
            <tr>
              <th className="text-left px-4 py-3 text-body-sm font-medium text-muted">Name</th>
              <th className="text-left px-4 py-3 text-body-sm font-medium text-muted">Email</th>
              <th className="text-left px-4 py-3 text-body-sm font-medium text-muted">Roles</th>
              <th className="text-left px-4 py-3 text-body-sm font-medium text-muted">Status</th>
              <th className="text-right px-4 py-3 text-body-sm font-medium text-muted">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted text-body-sm">
                  No users found.
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                <td className="px-4 py-3 text-body-sm font-medium text-text">{u.fullName}</td>
                <td className="px-4 py-3 text-body-sm text-muted">{u.email}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {u.roles.map((r) => (
                      <span
                        key={r}
                        className="text-micro bg-primary/10 text-primary rounded-full px-2 py-0.5"
                      >
                        {r}
                      </span>
                    ))}
                    {u.roles.length === 0 && (
                      <span className="text-micro text-subtle">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {u.hasAccess ? (
                    u.isActive ? (
                      <span className="text-micro bg-success-soft text-success rounded-full px-2 py-0.5">
                        Active
                      </span>
                    ) : (
                      <span className="text-micro bg-warning-soft text-warning rounded-full px-2 py-0.5">
                        Inactive
                      </span>
                    )
                  ) : (
                    <span className="text-micro bg-danger-soft text-danger rounded-full px-2 py-0.5">
                      No access
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {hasPermission("settings", "write") && (
                    <div className="inline-flex gap-3 text-body-xs">
                      <button
                        onClick={() => setEditingRolesFor(u)}
                        className="text-primary hover:underline font-medium"
                      >
                        Roles
                      </button>
                      <button
                        onClick={() => setResettingFor(u)}
                        className="text-primary hover:underline font-medium"
                      >
                        Reset PW
                      </button>
                      {u.hasAccess ? (
                        <button
                          onClick={() => handleRevoke(u)}
                          className="text-warning hover:underline font-medium"
                        >
                          Revoke
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleReactivate(u)}
                            className="text-success hover:underline font-medium"
                          >
                            Reactivate
                          </button>
                          {hasPermission("settings", "delete") && (
                            <button
                              onClick={() => handleDelete(u)}
                              className="text-danger hover:underline font-medium"
                            >
                              Delete
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AddUserDialog
        open={showAdd}
        onClose={() => {
          setShowAdd(false);
          load();
        }}
      />
      {editingRolesFor && (
        <RoleAssignDialog
          open={!!editingRolesFor}
          user={editingRolesFor}
          onClose={() => {
            setEditingRolesFor(null);
            load();
          }}
        />
      )}
      {resettingFor && (
        <ResetPasswordDialog
          open={!!resettingFor}
          user={resettingFor}
          onClose={() => {
            setResettingFor(null);
            load();
          }}
        />
      )}
    </div>
  );
}
