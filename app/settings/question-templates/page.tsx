"use client";

import { useEffect, useState } from "react";
import { Lock, Trash2, Plus, X, ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import { listQuestionTemplates, createQuestionTemplate, deleteQuestionTemplate } from "@/app/actions/question-templates";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import type { QuestionTemplate, ScreeningQuestion } from "@/lib/types";
import { toI18nText, hasI18nGap } from "@/lib/utils";

type QuestionType = ScreeningQuestion["type"];
type LangTab = "uz" | "ru" | "en";

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "short-text", label: "Short text" },
  { value: "long-text", label: "Long text" },
  { value: "phone", label: "Phone" },
  { value: "single-choice", label: "Single choice" },
  { value: "yes-no", label: "Yes / No" },
  { value: "rating", label: "Rating" },
];

const LANGS: LangTab[] = ["uz", "ru", "en"];
const LANG_LABELS: Record<LangTab, string> = { uz: "UZ", ru: "RU", en: "EN" };

type DraftQuestion = { text: { uz: string; ru: string; en: string }; type: QuestionType; options: string[] };

function emptyQuestion(): DraftQuestion {
  return { text: { uz: "", ru: "", en: "" }, type: "short-text", options: [] };
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
  const [formLangTabs, setFormLangTabs] = useState<LangTab[]>(() => formQuestions.map(() => "uz" as LangTab));
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
    setFormLangTabs(["uz"]);
    setFormError(null);
    setShowForm(false);
  }

  async function handleSave() {
    if (!formName.trim()) { setFormError("Name is required"); return; }
    const valid = formQuestions.filter((q) => q.text.uz.trim() || q.text.ru.trim() || q.text.en.trim());
    if (valid.length === 0) { setFormError("Add at least one question"); return; }
    setSaving(true);
    try {
      await createQuestionTemplate({
        name: formName.trim(),
        description: formDesc.trim() || undefined,
        questions: valid.map((q) => ({
          text: JSON.stringify({ uz: q.text.uz.trim(), ru: q.text.ru.trim(), en: q.text.en.trim() }),
          type: q.type,
          options: q.options.length > 0 ? q.options : undefined,
        })),
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

  function updateQuestionLang(idx: number, lang: LangTab, value: string) {
    setFormQuestions((prev) =>
      prev.map((q, i) => i === idx ? { ...q, text: { ...q.text, [lang]: value } } : q)
    );
  }

  function removeQuestion(idx: number) {
    setFormQuestions((prev) => prev.filter((_, i) => i !== idx));
    setFormLangTabs((prev) => prev.filter((_, i) => i !== idx));
  }

  function addEmptyQuestion() {
    setFormQuestions((prev) => [...prev, emptyQuestion()]);
    setFormLangTabs((prev) => [...prev, "uz"]);
  }

  function setQuestionLangTab(idx: number, lang: LangTab) {
    setFormLangTabs((prev) => prev.map((t, i) => i === idx ? lang : t));
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

          <div className="space-y-3">
            {formQuestions.map((q, idx) => {
              const activeLang = formLangTabs[idx] ?? "uz";
              const gap = hasI18nGap(q.text);
              return (
                <div key={idx} className="border border-border rounded-lg bg-bg overflow-hidden">
                  {/* Language tab bar */}
                  <div className="flex items-center gap-0 border-b border-border px-2 pt-1">
                    {LANGS.map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setQuestionLangTab(idx, lang)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-t transition-colors ${
                          activeLang === lang
                            ? "bg-surface text-primary border-b-2 border-primary"
                            : "text-muted hover:text-text"
                        } ${!q.text[lang].trim() ? "after:content-['*'] after:text-warning after:ml-0.5" : ""}`}
                      >
                        {LANG_LABELS[lang]}
                      </button>
                    ))}
                    <div className="flex-1" />
                    {gap && (
                      <span title="Some translations are missing" className="text-warning mr-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {formQuestions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeQuestion(idx)}
                        className="p-1 text-muted hover:text-red-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {/* Text area for active language */}
                  <div className="flex gap-2 items-center px-2 py-2">
                    <input
                      type="text"
                      placeholder={`Question ${idx + 1} (${activeLang.toUpperCase()})`}
                      value={q.text[activeLang]}
                      onChange={(e) => updateQuestionLang(idx, activeLang, e.target.value)}
                      className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text placeholder:text-subtle focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <select
                      value={q.type}
                      onChange={(e) => updateQuestion(idx, { type: e.target.value as QuestionType })}
                      className="px-2 py-2 bg-surface border border-border rounded-lg text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary shrink-0"
                    >
                      {QUESTION_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={addEmptyQuestion}
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
                    {tpl.questions.map((q, idx) => {
                      const i18n = toI18nText(q.text);
                      const gap = hasI18nGap(i18n);
                      return (
                        <div key={q.id} className="flex items-start gap-2 text-xs text-text">
                          <span className="text-subtle shrink-0 w-4">{idx + 1}.</span>
                          <span className="flex-1">{i18n.uz || i18n.ru || i18n.en || <em className="text-subtle">No text</em>}</span>
                          {gap && (
                            <span title="Some translations are missing" className="text-warning shrink-0">
                              <AlertCircle className="w-3 h-3" />
                            </span>
                          )}
                          <span className="text-subtle shrink-0">{q.type}</span>
                        </div>
                      );
                    })}
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
