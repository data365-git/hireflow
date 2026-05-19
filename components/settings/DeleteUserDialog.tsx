"use client";
import { useState } from "react";

interface UserForDelete {
  id: string;
  fullName: string;
}

interface Props {
  open: boolean;
  user: UserForDelete | null;
  onClose: (deleted?: boolean) => void;
}

export function DeleteUserDialog({ open, user, onClose }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open || !user) return null;

  const handleCancel = () => {
    setError(null);
    onClose();
  };

  const doDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/users/${user.id}/permanent`, {
        method: "DELETE",
        credentials: "include",
      });
      if (r.ok) {
        onClose(true);
        return;
      }
      const json = await r.json().catch(() => ({}));
      if (r.status === 400 && json.error?.includes("access revoked")) {
        setError("User must be deactivated first.");
      } else {
        setError(json.error ?? "Delete failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const doDeactivateAndDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      // Step 1: revoke access (deactivate)
      const r1 = await fetch(`/api/users/${user.id}/access`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hasAccess: false }),
      });
      if (!r1.ok) {
        const json = await r1.json().catch(() => ({}));
        setError(json.error ?? "Deactivation failed");
        return;
      }
      // Step 2: delete
      const r2 = await fetch(`/api/users/${user.id}/permanent`, {
        method: "DELETE",
        credentials: "include",
      });
      if (r2.ok) {
        onClose(true);
        return;
      }
      const json = await r2.json().catch(() => ({}));
      setError(json.error ?? "Delete failed after deactivation");
    } finally {
      setLoading(false);
    }
  };

  const showDeactivateAndDelete =
    error === "User must be deactivated first.";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-user-dialog-title"
    >
      <div className="absolute inset-0 bg-black/40" onClick={handleCancel} />
      <div className="relative bg-surface border border-border rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 space-y-4">
        <h2 id="delete-user-dialog-title" className="text-h3 text-text">
          Delete user
        </h2>
        <p className="text-body-sm text-muted">
          Delete{" "}
          <span className="text-text font-medium">{user.fullName}</span>{" "}
          permanently? This cannot be undone.
        </p>

        {error && (
          <p className="text-body-sm text-danger">{error}</p>
        )}

        <div className="flex flex-col gap-2 pt-1">
          {showDeactivateAndDelete && (
            <button
              onClick={doDeactivateAndDelete}
              disabled={loading}
              className="w-full h-9 rounded-lg bg-danger text-white text-body-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? "Processing..." : "Deactivate & Delete"}
            </button>
          )}
          <div className="flex gap-2 justify-end">
            <button
              onClick={handleCancel}
              disabled={loading}
              className="h-9 px-4 rounded-lg border border-border text-body-sm font-medium text-muted hover:bg-surface-2 transition-colors"
            >
              Cancel
            </button>
            {!showDeactivateAndDelete && (
              <button
                onClick={doDelete}
                disabled={loading}
                className="h-9 px-4 rounded-lg bg-danger text-white text-body-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? "Deleting..." : "Delete"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
