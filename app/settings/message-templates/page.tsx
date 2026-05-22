"use client";

import { useEffect, useMemo, useState } from "react";
import { Lock, Plus, Save, Trash2, X } from "lucide-react";
import {
  createMessageTemplate,
  deleteMessageTemplate,
  listMessageTemplates,
  updateMessageTemplate,
  type MessageTemplateView,
} from "@/app/actions/message-templates";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";

const KINDS = [
  { value: "all", label: "All" },
  { value: "intro", label: "Intro" },
  { value: "success", label: "Success" },
] as const;

type FormState = {
  kind: string;
  name: string;
  content: string;
  isGlobal: boolean;
};

const EMPTY_FORM: FormState = {
  kind: "intro",
  name: "",
  content: "",
  isGlobal: false,
};

export default function MessageTemplatesPage() {
  const [templates, setTemplates] = useState<MessageTemplateView[]>([]);
  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState<(typeof KINDS)[number]["value"]>("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setTemplates(await listMessageTemplates());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const visibleTemplates = useMemo(() => {
    if (kindFilter === "all") return templates;
    return templates.filter((template) => template.kind === kindFilter);
  }, [kindFilter, templates]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError(null);
    setShowForm(false);
  }

  function startEdit(template: MessageTemplateView) {
    if (template.isSystem) return;
    setEditingId(template.id);
    setForm({
      kind: template.kind,
      name: template.name,
      content: template.content,
      isGlobal: template.isGlobal,
    });
    setError(null);
    setShowForm(true);
  }

  async function handleSave() {
    setError(null);
    if (!form.kind.trim()) { setError("Kind is required"); return; }
    if (!form.name.trim()) { setError("Name is required"); return; }
    if (!form.content.trim()) { setError("Content is required"); return; }

    setSaving(true);
    try {
      if (editingId) {
        await updateMessageTemplate(editingId, form);
      } else {
        await createMessageTemplate(form);
      }
      resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(template: MessageTemplateView) {
    if (!window.confirm(`Delete "${template.name}"?`)) return;
    await deleteMessageTemplate(template.id);
    await load();
  }

  return (
    <div>
      <SettingsPageHeader
        title="Message Templates"
        description="Reusable intro and success messages for vacancy communication."
      />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="inline-flex rounded-lg border border-border overflow-hidden">
          {KINDS.map((kind) => (
            <button
              key={kind.value}
              onClick={() => setKindFilter(kind.value)}
              className={`px-3 py-1.5 text-sm border-r border-border last:border-r-0 ${
                kindFilter === kind.value
                  ? "bg-primary-soft text-primary font-medium"
                  : "text-muted hover:bg-surface-2"
              }`}
            >
              {kind.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-fg rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          New template
        </button>
      </div>

      {showForm && (
        <div className="mb-4 bg-surface border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text">
              {editingId ? "Edit template" : "New template"}
            </span>
            <button onClick={resetForm} className="text-muted hover:text-text transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid md:grid-cols-[160px_1fr] gap-2">
            <select
              value={form.kind}
              onChange={(e) => setForm((prev) => ({ ...prev, kind: e.target.value }))}
              className="px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="intro">Intro</option>
              <option value="success">Success</option>
              <option value="followup">Follow-up</option>
            </select>
            <input
              type="text"
              placeholder="Template name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text placeholder:text-subtle focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <textarea
            rows={5}
            placeholder="Message content"
            value={form.content}
            onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
            className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text placeholder:text-subtle focus:outline-none focus:ring-1 focus:ring-primary resize-y"
          />

          <label className="inline-flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={form.isGlobal}
              onChange={(e) => setForm((prev) => ({ ...prev, isGlobal: e.target.checked }))}
              className="rounded border-border"
            />
            Make visible to all HR users
          </label>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2 justify-end">
            <button
              onClick={resetForm}
              className="px-3 py-2 text-sm text-muted hover:text-text transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-fg rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted py-4">Loading...</p>
      ) : visibleTemplates.length === 0 ? (
        <p className="text-sm text-muted py-4">No templates yet.</p>
      ) : (
        <div className="space-y-2">
          {visibleTemplates.map((template) => (
            <div key={template.id} className="bg-surface border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-medium text-text">{template.name}</h3>
                    <span className="px-1.5 py-0.5 bg-surface-2 border border-border rounded text-micro text-muted uppercase">
                      {template.kind}
                    </span>
                    {template.isSystem && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-surface-2 border border-border rounded text-micro text-muted">
                        <Lock className="w-2.5 h-2.5" />
                        System
                      </span>
                    )}
                    {template.isGlobal && (
                      <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-micro">
                        Global
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted mt-2 whitespace-pre-wrap">{template.content}</p>
                </div>

                {!template.isSystem && (
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => startEdit(template)}
                      className="px-2 py-1.5 rounded text-xs text-muted hover:text-text hover:bg-surface-2 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(template)}
                      className="p-1.5 rounded text-muted hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
