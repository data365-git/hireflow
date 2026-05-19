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
  onClose: (changed?: boolean) => void;
}

export function ResetPasswordDialog({ open, user, onClose }: Props) {
  const [confirmed, setConfirmed] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setConfirmed(false);
      setTempPassword(null);
      setError(null);
      setCopied(false);
    }
  }, [open]);

  const doReset = () => {
    setTempPassword(null);
    setError(null);
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
  };

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
        {/* Step 1: Confirmation screen */}
        {!confirmed && !tempPassword && (
          <>
            <p className="text-body-sm text-muted">
              Reset password for <strong className="text-text">{user.fullName}</strong>?
            </p>
            <p className="text-micro text-subtle">
              This will sign them out of all sessions.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => onClose()}
                className="px-4 py-2 rounded-lg text-body-sm font-medium text-muted hover:text-text hover:bg-surface-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { setConfirmed(true); doReset(); }}
                className="px-4 py-2 rounded-lg text-body-sm font-medium bg-primary text-primary-fg hover:bg-primary-hover transition-colors"
              >
                Reset password
              </button>
            </div>
          </>
        )}

        {/* Step 2: Generating */}
        {confirmed && !tempPassword && !error && (
          <p className="text-body-sm text-muted">Generating...</p>
        )}

        {/* Error */}
        {error && <p className="text-micro text-danger">{error}</p>}

        {/* Step 3: Show temp password */}
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

        {(tempPassword || error) && (
          <div className="flex justify-end pt-2">
            <button
              onClick={() => onClose(!!tempPassword)}
              className="px-4 py-2 rounded-lg text-body-sm font-medium bg-primary text-primary-fg hover:bg-primary-hover transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
