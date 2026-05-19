"use client";

import { useState } from "react";
import { X } from "lucide-react";

type WizardStage = {
  id: string;
  name: string;
  color: string;
  isFinal: boolean;
  isRejected: boolean;
  isReserve?: boolean;
};

interface Props {
  open: boolean;
  stages: WizardStage[];
  onClose: () => void;
}

export function SaveAsTemplateDialog({ open, stages, onClose }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/stage-templates", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          stages: stages.map((s, i) => ({
            name: s.name,
            color: s.color,
            isFinal: s.isFinal,
            isRejected: s.isRejected,
            isReserve: s.isReserve ?? false,
            orderIndex: i,
          })),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to save template");
        return;
      }

      setName("");
      setDescription("");
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-text">Save as template</h2>
          <button onClick={onClose} className="text-muted hover:text-text transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-muted mb-1">
              Template name <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              className="w-full bg-surface border border-border rounded-lg px-3 h-9 text-sm text-text outline-none focus:border-primary"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My custom pipeline"
            />
          </div>

          <div>
            <label className="block text-sm text-muted mb-1">Description (optional)</label>
            <input
              className="w-full bg-surface border border-border rounded-lg px-3 h-9 text-sm text-text outline-none focus:border-primary"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description…"
            />
          </div>

          <p className="text-xs text-muted">{stages.length} stage{stages.length !== 1 ? "s" : ""} will be saved.</p>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 border border-border rounded-lg text-sm text-text hover:bg-surface-2 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="h-9 px-4 bg-primary text-primary-fg text-sm rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
