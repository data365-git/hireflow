"use client";

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
      />

      {/* Card */}
      <div className="relative bg-surface border border-border rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 space-y-4">
        <h2 id="confirm-dialog-title" className="text-h3 text-text">
          {title}
        </h2>
        <p className="text-body-sm text-muted leading-relaxed">{message}</p>
        <div className="flex gap-2 justify-end pt-1">
          <button
            onClick={onCancel}
            className="h-9 px-4 rounded-lg border border-border text-body-sm font-medium text-muted hover:bg-surface-2 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="h-9 px-4 rounded-lg bg-danger text-white text-body-sm font-semibold hover:opacity-90 transition-opacity"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
