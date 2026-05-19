"use client";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";

interface User {
  id: string;
  fullName: string;
}

interface Props {
  open: boolean;
  user: User;
  onClose: () => void;
}

export function ResetPasswordDialog({ open, user, onClose }: Props) {
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTempPassword(null);
    setError(null);
    setCopied(false);

    fetch(`/api/users/${user.id}/reset-password`, {
      method: "POST",
      credentials: "include",
    })
      .then(async (r) => {
        if (!r.ok) {
          const json = await r.json().catch(() => ({}));
          setError(json.error ?? "Reset failed");
          return;
        }
        const json = await r.json();
        setTempPassword(json.temporaryPassword ?? null);
      })
      .catch(() => setError("Network error"));
  }, [open, user.id]);

  const handleCopy = () => {
    if (!tempPassword) return;
    navigator.clipboard.writeText(tempPassword).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title="Reset password" size="sm">
      <div className="space-y-4">
        <p className="text-body-sm text-muted">
          Generating a temporary password for <span className="text-text font-medium">{user.fullName}</span>.
        </p>

        {!tempPassword && !error && (
          <p className="text-body-sm text-muted">Generating...</p>
        )}

        {error && <p className="text-micro text-danger">{error}</p>}

        {tempPassword && (
          <div className="space-y-2">
            <p className="text-body-xs text-muted font-medium uppercase tracking-widest">
              Temporary password
            </p>
            <div className="flex items-center gap-2 bg-surface-2 border border-border rounded-lg px-3 py-2">
              <code className="flex-1 font-mono text-body-sm text-text select-all break-all">
                {tempPassword}
              </code>
              <button
                onClick={handleCopy}
                className="shrink-0 text-micro font-medium text-primary hover:underline transition-colors"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="text-micro text-subtle">
              Share this with the user. They should change it on first login.
            </p>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-body-sm font-medium bg-primary text-primary-fg hover:bg-primary-hover transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </Dialog>
  );
}
