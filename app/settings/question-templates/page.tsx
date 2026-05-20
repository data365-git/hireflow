"use client";

import { useEffect, useState } from "react";
import { Lock, Trash2, Plus, X, ChevronDown, ChevronRight } from "lucide-react";
import { listQuestionTemplates, createQuestionTemplate, deleteQuestionTemplate } from "@/app/actions/question-templates";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import type { QuestionTemplate, ScreeningQuestion } from "@/lib/types";

type QuestionType = ScreeningQuestion["type"];

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "short-text", label: "Short text" },
  { value: "long-text", label: "Long text" },
  { value: "phone", label: "Phone" },
  { value: "single-choice", label: "Single choice" },
  { value: "yes-no", label: "Yes / No" },
  { value: "rating", label: "Rating" },
];

type DraftQuestion = { text: string; type: QuestionType; options: string[] };

function emptyQuestion(): DraftQuestion {
  return { text: "", type: "short-text", options: [] };
}

export default function QuestionTemplatesPage() {
  const [templates, setTemplates] = useState<QuestionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // New template form
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formQuestions, setFormQuestions] = useState<DraftQuestion[]>([emptyQuestion()]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setTemplates(await listQuestionTemplates());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function resetForm() {
    setFormName("");
    setFormDesc("");
    setFormQuestions([emptyQuestion()]);
    setFormError(null);
    setShowForm(false);
  }

  async function handleSave() {
    if (!formName.trim()) { setFormError("Name is required"); return; }
    const valid = formQuestions.filter((q) => q.text.trim());
    if (valid.length === 0) { setFormError("Add at least one question"); return; }
    setSaving(true);
    try {
      await createQuestionTemplate({
        name: formName.trim(),
        description: formDesc.trim() || undefined,
        questions: valid.map((q) => ({ text: q.text.trim(), type: q.type, options: q.options.length > 0 ? q.options : undefined })),
      });
      resetForm();
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(tpl: QuestionTemplate) {
    if (!window.confirm(`Delete "${tpl.name}"?`)) return;
    setDeletingId(tpl.id);
    try {
      await deleteQuestionTemplate(tpl.id);
      await load();
    } finally {
      setDeletingId(null);
    }
  }

  function updateQuestion(idx: number, patch: Partial<DraftQuestion>) {
    setFormQuestions((prev) => prev.map((q, i) => i === idx ? { ...q, ...patch } : q));
  }

  function removeQuestion(idx: number) {
    setFormQuestions((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <SettingsPageHeader
        title="Question Templates"
        description="Reusable screening question sets you can load when creating a vacancy."
      />

      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-fg rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          New template
        </button>
      </div>

      {/* New template form */}
      {showForm && (
        <div className="mb-4 bg-surface border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text">New template</span>
            <button onClick={resetForm} className="text-muted hover:text-text transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <input
            type="text"
            placeholder="Template name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text placeholder:text-subtle focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={formDesc}
            onChange={(e) => setFormDesc(e.target.value)}
            className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text placeholder:text-subtle focus:outline-none focus:ring-1 focus:ring-primary"
          />

          <div className="space-y-2">
            {formQuestions.map((q, idx) => (
              <div key={idx} className="flex gap-2 items-start">
                <input
                  type="text"
                  placeholder={`Question ${idx + 1}`}
                  value={q.text}
                  onChange={(e) => updateQuestion(idx, { text: e.target.value })}
                  className="flex-1 px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text placeholder:text-subtle focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <select
                  value={q.type}
                  onChange={(e) => updateQuestion(idx, { type: e.target.value as QuestionType })}
                  className="px-2 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {QUESTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                {formQuestions.length > 1 && (
                  <button
                    onClick={() => removeQuestion(idx)}
                    className="p-2 text-muted hover:text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={() => setFormQuestions((prev) => [...prev, emptyQuestion()])}
            className="flex items-center gap-1.5 text-sm text-primary hover:opacity-80 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            Add question
          </button>

          {formError && <p className="text-xs text-red-500">{formError}</p>}

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
              className="px-4 py-2 bg-primary text-primary-fg rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* Template list */}
      {loading ? (
        <p className="text-sm text-muted py-4">Loading…</p>
      ) : templates.length === 0 ? (
        <p className="text-sm text-muted py-4">No templates yet.</p>
      ) : (
        <div className="space-y-2">
          {templates.map((tpl) => {
            const expanded = expandedId === tpl.id;
            return (
              <div key={tpl.id} className="bg-surface border border-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => setExpandedId(expanded ? null : tpl.id)}
                    className="text-muted hover:text-text transition-colors shrink-0"
                  >
                    {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text truncate">{tpl.name}</span>
                      {tpl.isSystem && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-surface-2 border border-border rounded text-micro text-muted">
                          <Lock className="w-2.5 h-2.5" />
                          System
                        </span>
                      )}
                    </div>
                    {tpl.description && (
                      <p className="text-xs text-muted mt-0.5 truncate">{tpl.description}</p>
                    )}
                  </div>

                  <span className="text-xs text-subtle shrink-0">
                    {tpl.questions.length} question{tpl.questions.length !== 1 ? "s" : ""}
                  </span>

                  {!tpl.isSystem && (
                    <button
                      onClick={() => handleDelete(tpl)}
                      disabled={deletingId === tpl.id}
                      className="p-1.5 rounded text-muted hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40 shrink-0"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {expanded && (
                  <div className="border-t border-border px-4 py-3 bg-surface-2 space-y-1.5">
                    {tpl.questions.map((q, idx) => (
                      <div key={q.id} className="flex items-start gap-2 text-xs text-text">
                        <span className="text-subtle shrink-0 w-4">{idx + 1}.</span>
                        <span className="flex-1">{q.text}</span>
                        <span className="text-subtle shrink-0">{q.type}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
