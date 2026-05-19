"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { AddUserDialog } from "./AddUserDialog";
import { RoleAssignDialog } from "./RoleAssignDialog";
import { ResetPasswordDialog } from "./ResetPasswordDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";

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

  // Modal state for actions
  const [revokeTarget, setRevokeTarget] = useState<User | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [reactivateTarget, setReactivateTarget] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const r = await fetch("/api/users", { credentials: "include" });
    if (r.ok) setUsers(await r.json());
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const confirmRevoke = async () => {
    await fetch(`/api/users/${revokeTarget!.id}/access`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hasAccess: false, reason: revokeReason }),
    });
    setRevokeTarget(null);
    setRevokeReason("");
    load();
  };

  const confirmReactivate = async () => {
    await fetch(`/api/users/${reactivateTarget!.id}/reactivate`, {
      method: "POST",
      credentials: "include",
    });
    setReactivateTarget(null);
    load();
  };

  const confirmDelete = async () => {
    const r = await fetch(`/api/users/${deleteTarget!.id}/permanent`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!r.ok) {
      const { error } = await r.json();
      setDeleteError(error ?? "Delete failed");
      return;
    }
    setDeleteTarget(null);
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
                        className="text-xs font-medium bg-primary/10 text-primary rounded-full px-2 py-0.5 inline-flex items-center"
                      >
                        {r}
                      </span>
                    ))}
                    {u.roles.length === 0 && (
                      <span className="text-xs font-medium text-subtle">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {u.hasAccess ? (
                    u.isActive ? (
                      <span className="text-xs font-medium bg-success-soft text-success rounded-full px-2 py-0.5 inline-flex items-center">
                        Active
                      </span>
                    ) : (
                      <span className="text-xs font-medium bg-warning-soft text-warning rounded-full px-2 py-0.5 inline-flex items-center">
                        Inactive
                      </span>
                    )
                  ) : (
                    <span className="text-xs font-medium bg-danger-soft text-danger rounded-full px-2 py-0.5 inline-flex items-center">
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
                          onClick={() => setRevokeTarget(u)}
                          className="text-warning hover:underline font-medium"
                        >
                          Revoke
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => setReactivateTarget(u)}
                            className="text-success hover:underline font-medium"
                          >
                            Reactivate
                          </button>
                          {hasPermission("settings", "delete") && (
                            <button
                              onClick={() => { setDeleteTarget(u); setDeleteError(null); }}
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
        onClose={(changed) => {
          setShowAdd(false);
          if (changed) load();
        }}
      />
      {editingRolesFor && (
        <RoleAssignDialog
          open={!!editingRolesFor}
          user={editingRolesFor}
          onClose={(changed) => {
            setEditingRolesFor(null);
            if (changed) load();
          }}
        />
      )}
      {resettingFor && (
        <ResetPasswordDialog
          open={!!resettingFor}
          user={resettingFor}
          onClose={(changed) => {
            setResettingFor(null);
            if (changed) load();
          }}
        />
      )}

      {/* Revoke modal — needs a reason text area, so we build an inline modal */}
      {revokeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setRevokeTarget(null); setRevokeReason(""); }} />
          <div className="relative bg-surface border border-border rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 space-y-4">
            <h2 className="text-h3 text-text">Revoke access</h2>
            <p className="text-body-sm text-muted">
              Revoking access for <span className="text-text font-medium">{revokeTarget.fullName}</span>.
            </p>
            <div className="space-y-1">
              <label className="block text-body-sm font-medium text-text">Reason</label>
              <textarea
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                rows={3}
                placeholder="Optional reason…"
                className="w-full rounded-lg border border-border px-3 py-2 text-body-sm bg-surface text-text outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
              />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => { setRevokeTarget(null); setRevokeReason(""); }}
                className="h-9 px-4 rounded-lg border border-border text-body-sm font-medium text-muted hover:bg-surface-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRevoke}
                className="h-9 px-4 rounded-lg bg-warning text-white text-body-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Revoke access
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reactivate modal */}
      <ConfirmDialog
        open={!!reactivateTarget}
        title="Reactivate user"
        message={`Reactivate ${reactivateTarget?.fullName ?? ""}?`}
        confirmLabel="Reactivate"
        onConfirm={confirmReactivate}
        onCancel={() => setReactivateTarget(null)}
      />

      {/* Delete modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setDeleteTarget(null); setDeleteError(null); }} />
          <div className="relative bg-surface border border-border rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 space-y-4">
            <h2 className="text-h3 text-text">Permanently delete user</h2>
            <p className="text-body-sm text-muted">
              Delete <span className="text-text font-medium">{deleteTarget.fullName}</span>? This cannot be undone.
            </p>
            {deleteError && <p className="text-micro text-danger">{deleteError}</p>}
            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteError(null); }}
                className="h-9 px-4 rounded-lg border border-border text-body-sm font-medium text-muted hover:bg-surface-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="h-9 px-4 rounded-lg bg-danger text-white text-body-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
