"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useStore } from "@/lib/store";
import type { CreateVacancyInput, ScreeningQuestion } from "@/lib/types";
import { SaveAsTemplateDialog } from "@/components/settings/SaveAsTemplateDialog";

type TemplateStage = {
  id: string;
  name: string;
  color: string;
  isFinal: boolean;
  isRejected: boolean;
  orderIndex: number;
};

type TemplateWithStages = {
  id: string;
  name: string;
  description?: string | null;
  stages: TemplateStage[];
};

const STEPS = [
  { label: "Basic Info" },
  { label: "App Flow" },
  { label: "Questions" },
  { label: "Stages" },
  { label: "Sources" },
  { label: "Review" },
];

const STAGE_COLORS: Record<string, string> = {
  new: "bg-gray-400",
  screening: "bg-blue-500",
  qualified: "bg-violet-500",
  test: "bg-amber-500",
  interview: "bg-orange-500",
  hired: "bg-green-500",
  rejected: "bg-red-500",
};

const STAGE_COLOR_KEYS = Object.keys(STAGE_COLORS);

const INPUT_CLS =
  "w-full bg-surface border border-border rounded-lg px-3 h-9 text-body-sm text-text outline-none focus:border-primary";
const TEXTAREA_CLS =
  "w-full bg-surface border border-border rounded-lg px-3 py-2 text-body-sm text-text outline-none focus:border-primary resize-none";
const LABEL_CLS = "block text-body-sm text-muted mb-1";
const SECTION_HEADER_CLS = "text-micro uppercase tracking-wider text-subtle mb-3";

type QuestionDraft = {
  id: string;
  text: string;
  type: ScreeningQuestion["type"];
  options?: string[];
  optionsRaw: string;
};

type StageDraft = {
  id: string;
  name: string;
  color: string;
  isFinal: boolean;
  isRejected: boolean;
};

type SourceDraft = {
  id: string;
  name: string;
};

export default function NewVacancyPage() {
  const router = useRouter();
  const users = useStore((s) => s.users);
  const questionTemplates = useStore((s) => s.questionTemplates);
  const createVacancy = useStore((s) => s.createVacancy);

  const [step, setStep] = useState(1);

  const [form, setForm] = useState<CreateVacancyInput>({
    title: "",
    department: "",
    workType: "office",
    employmentType: "full-time",
    location: "Tashkent",
    salaryMin: 0,
    salaryMax: 0,
    description: "",
    language: "uz",
    responsibleHrId: users[0]?.id ?? "",
    introMessage: "",
    successMessage: "",
    stages: [
      { name: "New", color: "new", isFinal: false, isRejected: false },
      { name: "Screening", color: "screening", isFinal: false, isRejected: false },
      { name: "Interview", color: "interview", isFinal: false, isRejected: false },
      { name: "Hired", color: "hired", isFinal: true, isRejected: false },
      { name: "Rejected", color: "rejected", isFinal: true, isRejected: true },
    ],
    questions: [],
    sources: [{ name: "Telegram" }],
  });

  // Local draft state for questions (need per-item id + optionsRaw)
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [newQText, setNewQText] = useState("");
  const [newQType, setNewQType] = useState<ScreeningQuestion["type"]>("short-text");

  // Local draft state for stages (need per-item id)
  const [stages, setStages] = useState<StageDraft[]>([
    { id: "s0", name: "New", color: "new", isFinal: false, isRejected: false },
    { id: "s1", name: "Screening", color: "screening", isFinal: false, isRejected: false },
    { id: "s2", name: "Interview", color: "interview", isFinal: false, isRejected: false },
    { id: "s3", name: "Hired", color: "hired", isFinal: true, isRejected: false },
    { id: "s4", name: "Rejected", color: "rejected", isFinal: true, isRejected: true },
  ]);
  const [newStageName, setNewStageName] = useState("");
  const [newStageColor, setNewStageColor] = useState("new");

  // Stage templates
  const [templates, setTemplates] = useState<TemplateWithStages[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);

  useEffect(() => {
    fetch("/api/stage-templates", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setTemplates(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  function applyTemplate() {
    const tpl = templates.find((t) => t.id === selectedTemplateId);
    if (!tpl) return;
    const mapped: StageDraft[] = tpl.stages.map((s, i) => ({
      id: `stpl_${i}_${Date.now()}`,
      name: s.name,
      color: s.color,
      isFinal: s.isFinal,
      isRejected: s.isRejected,
    }));
    setStages(mapped);
    setSelectedTemplateId("");
  }

  // Local draft state for sources (need per-item id)
  const [sources, setSources] = useState<SourceDraft[]>([{ id: "src0", name: "Telegram" }]);
  const [newSourceName, setNewSourceName] = useState("");

  // ── Helpers ──────────────────────────────────────────────────────────────

  function patchForm(patch: Partial<CreateVacancyInput>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  // Questions
  function addQuestion() {
    if (!newQText.trim()) return;
    setQuestions((qs) => [
      ...qs,
      { id: `q_${Date.now()}`, text: newQText.trim(), type: newQType, optionsRaw: "" },
    ]);
    setNewQText("");
    setNewQType("short-text");
  }

  function removeQuestion(id: string) {
    setQuestions((qs) => qs.filter((q) => q.id !== id));
  }

  function moveQuestion(index: number, dir: -1 | 1) {
    setQuestions((qs) => {
      const next = [...qs];
      const target = index + dir;
      if (target < 0 || target >= next.length) return qs;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function patchQuestion(id: string, patch: Partial<QuestionDraft>) {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  function loadTemplate(templateId: string) {
    const tpl = questionTemplates.find((t) => t.id === templateId);
    if (!tpl) return;
    setQuestions(
      tpl.questions.map((q, i) => ({
        id: `qtpl_${i}_${Date.now()}`,
        text: q.text,
        type: q.type,
        options: q.options,
        optionsRaw: q.options?.join(", ") ?? "",
      }))
    );
  }

  // Stages
  function addStage() {
    if (!newStageName.trim()) return;
    setStages((ss) => [
      ...ss,
      { id: `s_${Date.now()}`, name: newStageName.trim(), color: newStageColor, isFinal: false, isRejected: false },
    ]);
    setNewStageName("");
    setNewStageColor("new");
  }

  function removeStage(id: string) {
    setStages((ss) => ss.filter((s) => s.id !== id));
  }

  function moveStage(index: number, dir: -1 | 1) {
    setStages((ss) => {
      const next = [...ss];
      const target = index + dir;
      if (target < 0 || target >= next.length) return ss;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function patchStage(id: string, patch: Partial<StageDraft>) {
    setStages((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  // Sources
  function addSource() {
    if (!newSourceName.trim()) return;
    setSources((ss) => [...ss, { id: `src_${Date.now()}`, name: newSourceName.trim() }]);
    setNewSourceName("");
  }

  function removeSource(id: string) {
    setSources((ss) => ss.filter((s) => s.id !== id));
  }

  // ── Navigation ───────────────────────────────────────────────────────────

  function handleNext() {
    if (step < 6) setStep(step + 1);
  }

  function handleBack() {
    if (step > 1) setStep(step - 1);
  }

  function handleCreate() {
    const finalQuestions = questions.map((q) => ({
      text: q.text,
      type: q.type,
      options: q.type === "single-choice" && q.optionsRaw
        ? q.optionsRaw.split(",").map((o) => o.trim()).filter(Boolean)
        : undefined,
    }));

    const finalStages = stages.map((s) => ({
      name: s.name,
      color: s.color,
      isFinal: s.isFinal,
      isRejected: s.isRejected,
    }));

    const finalSources = sources.map((s) => ({ name: s.name }));

    const input: CreateVacancyInput = {
      ...form,
      questions: finalQuestions,
      stages: finalStages,
      sources: finalSources,
    };

    const newId = createVacancy(input);
    router.push(`/vacancies/${newId}`);
  }

  // ── Render steps ─────────────────────────────────────────────────────────

  function renderStep1() {
    return (
      <div className="space-y-5">
        <p className={SECTION_HEADER_CLS}>Position Details</p>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={LABEL_CLS}>Job Title</label>
            <input
              className={INPUT_CLS}
              value={form.title}
              onChange={(e) => patchForm({ title: e.target.value })}
              placeholder="e.g. Frontend Developer"
            />
          </div>
          <div>
            <label className={LABEL_CLS}>Department</label>
            <input
              className={INPUT_CLS}
              value={form.department}
              onChange={(e) => patchForm({ department: e.target.value })}
              placeholder="e.g. Engineering"
            />
          </div>
          <div>
            <label className={LABEL_CLS}>Location</label>
            <input
              className={INPUT_CLS}
              value={form.location}
              onChange={(e) => patchForm({ location: e.target.value })}
              placeholder="e.g. Tashkent"
            />
          </div>
          <div>
            <label className={LABEL_CLS}>Work Type</label>
            <select
              className={INPUT_CLS}
              value={form.workType}
              onChange={(e) => patchForm({ workType: e.target.value as typeof form.workType })}
            >
              <option value="office">Office</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>
          <div>
            <label className={LABEL_CLS}>Employment Type</label>
            <select
              className={INPUT_CLS}
              value={form.employmentType}
              onChange={(e) => patchForm({ employmentType: e.target.value as typeof form.employmentType })}
            >
              <option value="full-time">Full-time</option>
              <option value="part-time">Part-time</option>
              <option value="trial">Trial</option>
              <option value="internship">Internship</option>
            </select>
          </div>
          <div>
            <label className={LABEL_CLS}>Salary Min (UZS)</label>
            <input
              className={INPUT_CLS}
              type="number"
              value={form.salaryMin}
              onChange={(e) => patchForm({ salaryMin: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className={LABEL_CLS}>Salary Max (UZS)</label>
            <input
              className={INPUT_CLS}
              type="number"
              value={form.salaryMax}
              onChange={(e) => patchForm({ salaryMax: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className={LABEL_CLS}>Language</label>
            <select
              className={INPUT_CLS}
              value={form.language}
              onChange={(e) => patchForm({ language: e.target.value as typeof form.language })}
            >
              <option value="uz">Uzbek</option>
              <option value="en">English</option>
              <option value="ru">Russian</option>
            </select>
          </div>
          <div>
            <label className={LABEL_CLS}>Responsible HR</label>
            <select
              className={INPUT_CLS}
              value={form.responsibleHrId}
              onChange={(e) => patchForm({ responsibleHrId: e.target.value })}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    );
  }

  function renderStep2() {
    return (
      <div className="space-y-5">
        <p className={SECTION_HEADER_CLS}>Candidate-facing Messages</p>
        <div>
          <label className={LABEL_CLS}>Intro Message</label>
          <textarea
            className={TEXTAREA_CLS}
            rows={4}
            value={form.introMessage}
            onChange={(e) => patchForm({ introMessage: e.target.value })}
            placeholder="Welcome to our application process…"
          />
        </div>
        <div>
          <label className={LABEL_CLS}>Success Message</label>
          <textarea
            className={TEXTAREA_CLS}
            rows={4}
            value={form.successMessage}
            onChange={(e) => patchForm({ successMessage: e.target.value })}
            placeholder="Thank you for applying! We'll be in touch soon."
          />
        </div>
      </div>
    );
  }

  function renderStep3() {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <p className={SECTION_HEADER_CLS + " mb-0"}>Screening Questions</p>
          {questionTemplates.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-body-sm text-muted">Load template:</span>
              <select
                className="bg-surface border border-border rounded-lg px-2 h-7 text-body-sm text-text outline-none focus:border-primary"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) loadTemplate(e.target.value);
                  e.target.value = "";
                }}
              >
                <option value="" disabled>
                  Select…
                </option>
                {questionTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {questions.length === 0 && (
          <p className="text-body-sm text-muted italic">No questions yet. Add one below.</p>
        )}

        <div className="space-y-3">
          {questions.map((q, i) => (
            <div key={q.id} className="bg-surface-2 border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-2">
                <div className="flex flex-col gap-1 pt-1 shrink-0">
                  <button
                    onClick={() => moveQuestion(i, -1)}
                    disabled={i === 0}
                    className="w-5 h-5 flex items-center justify-center text-muted hover:text-text disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveQuestion(i, 1)}
                    disabled={i === questions.length - 1}
                    className="w-5 h-5 flex items-center justify-center text-muted hover:text-text disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move down"
                  >
                    ↓
                  </button>
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <input
                    className={INPUT_CLS}
                    value={q.text}
                    onChange={(e) => patchQuestion(q.id, { text: e.target.value })}
                    placeholder="Question text"
                  />
                  <select
                    className="bg-surface border border-border rounded-lg px-2 h-8 text-body-sm text-text outline-none focus:border-primary"
                    value={q.type}
                    onChange={(e) =>
                      patchQuestion(q.id, { type: e.target.value as ScreeningQuestion["type"] })
                    }
                  >
                    <option value="short-text">Short text</option>
                    <option value="long-text">Long text</option>
                    <option value="phone">Phone</option>
                    <option value="single-choice">Single choice</option>
                    <option value="yes-no">Yes / No</option>
                    <option value="rating">Rating</option>
                  </select>
                  {q.type === "single-choice" && (
                    <input
                      className={INPUT_CLS}
                      value={q.optionsRaw}
                      onChange={(e) => patchQuestion(q.id, { optionsRaw: e.target.value })}
                      placeholder="Options, comma-separated (e.g. Yes, No, Maybe)"
                    />
                  )}
                </div>
                <button
                  onClick={() => removeQuestion(q.id)}
                  className="shrink-0 text-muted hover:text-red-500 transition-colors px-1"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add question row */}
        <div className="flex gap-2 items-center pt-1">
          <input
            className={INPUT_CLS + " flex-1"}
            value={newQText}
            onChange={(e) => setNewQText(e.target.value)}
            placeholder="New question…"
            onKeyDown={(e) => e.key === "Enter" && addQuestion()}
          />
          <select
            className="bg-surface border border-border rounded-lg px-2 h-9 text-body-sm text-text outline-none focus:border-primary shrink-0"
            value={newQType}
            onChange={(e) => setNewQType(e.target.value as ScreeningQuestion["type"])}
          >
            <option value="short-text">Short text</option>
            <option value="long-text">Long text</option>
            <option value="phone">Phone</option>
            <option value="single-choice">Single choice</option>
            <option value="yes-no">Yes / No</option>
            <option value="rating">Rating</option>
          </select>
          <button
            onClick={addQuestion}
            className="h-9 px-4 bg-primary text-primary-fg text-body-sm rounded-lg shrink-0 hover:opacity-90 transition-opacity"
          >
            Add
          </button>
        </div>
      </div>
    );
  }

  function renderStep4() {
    return (
      <div className="space-y-5">
        <p className={SECTION_HEADER_CLS}>Pipeline Stages</p>

        {/* Template picker */}
        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border">
          <span className="text-body-sm text-muted shrink-0">Start from template:</span>
          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="flex-1 h-8 px-2 rounded-lg border border-border bg-surface text-body-sm text-text outline-none focus:border-primary"
          >
            <option value="">— select —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={applyTemplate}
            disabled={!selectedTemplateId}
            className="h-8 px-3 rounded-lg bg-primary text-primary-fg text-body-sm font-medium disabled:opacity-40"
          >
            Apply
          </button>
        </div>

        <div className="space-y-2">
          {stages.map((s, i) => (
            <div key={s.id} className="bg-surface-2 border border-border rounded-lg p-3">
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    onClick={() => moveStage(i, -1)}
                    disabled={i === 0}
                    className="w-5 h-5 flex items-center justify-center text-muted hover:text-text disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveStage(i, 1)}
                    disabled={i === stages.length - 1}
                    className="w-5 h-5 flex items-center justify-center text-muted hover:text-text disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move down"
                  >
                    ↓
                  </button>
                </div>

                {/* Color dot selector */}
                <div className="flex gap-1 shrink-0">
                  {STAGE_COLOR_KEYS.map((ck) => (
                    <button
                      key={ck}
                      title={ck}
                      onClick={() => patchStage(s.id, { color: ck })}
                      className={`w-4 h-4 rounded-full transition-all ${STAGE_COLORS[ck]} ${
                        s.color === ck ? "ring-2 ring-offset-1 ring-text" : "opacity-60 hover:opacity-100"
                      }`}
                    />
                  ))}
                </div>

                <input
                  className="flex-1 bg-surface border border-border rounded-lg px-2 h-8 text-body-sm text-text outline-none focus:border-primary min-w-0"
                  value={s.name}
                  onChange={(e) => patchStage(s.id, { name: e.target.value })}
                />

                <label className="flex items-center gap-1 text-body-sm text-muted shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={s.isFinal}
                    onChange={(e) => patchStage(s.id, { isFinal: e.target.checked })}
                    className="accent-primary"
                  />
                  Final
                </label>

                <label className="flex items-center gap-1 text-body-sm text-muted shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={s.isRejected}
                    onChange={(e) => patchStage(s.id, { isRejected: e.target.checked })}
                    className="accent-primary"
                  />
                  Reject
                </label>

                <button
                  onClick={() => removeStage(s.id)}
                  className="shrink-0 text-muted hover:text-red-500 transition-colors px-1"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add stage row */}
        <div className="flex gap-2 items-center pt-1">
          <div className="flex gap-1 shrink-0">
            {STAGE_COLOR_KEYS.map((ck) => (
              <button
                key={ck}
                title={ck}
                onClick={() => setNewStageColor(ck)}
                className={`w-4 h-4 rounded-full transition-all ${STAGE_COLORS[ck]} ${
                  newStageColor === ck ? "ring-2 ring-offset-1 ring-text" : "opacity-60 hover:opacity-100"
                }`}
              />
            ))}
          </div>
          <input
            className={INPUT_CLS + " flex-1"}
            value={newStageName}
            onChange={(e) => setNewStageName(e.target.value)}
            placeholder="Stage name…"
            onKeyDown={(e) => e.key === "Enter" && addStage()}
          />
          <button
            onClick={addStage}
            className="h-9 px-4 bg-primary text-primary-fg text-body-sm rounded-lg shrink-0 hover:opacity-90 transition-opacity"
          >
            Add
          </button>
        </div>

        {/* Save as template */}
        <div className="pt-1 border-t border-border">
          <button
            type="button"
            onClick={() => setSaveTemplateOpen(true)}
            className="text-body-sm text-primary hover:opacity-80 transition-opacity"
          >
            💾 Save as template
          </button>
        </div>

        <SaveAsTemplateDialog
          open={saveTemplateOpen}
          stages={stages}
          onClose={() => setSaveTemplateOpen(false)}
        />
      </div>
    );
  }

  function renderStep5() {
    return (
      <div className="space-y-5">
        <p className={SECTION_HEADER_CLS}>Source Channels</p>

        <div className="space-y-2">
          {sources.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <input
                className={INPUT_CLS + " flex-1"}
                value={s.name}
                onChange={(e) =>
                  setSources((ss) => ss.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)))
                }
                placeholder="Source name"
              />
              <button
                onClick={() => removeSource(s.id)}
                className="text-muted hover:text-red-500 transition-colors px-2"
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2 items-center">
          <input
            className={INPUT_CLS + " flex-1"}
            value={newSourceName}
            onChange={(e) => setNewSourceName(e.target.value)}
            placeholder="Add source channel…"
            onKeyDown={(e) => e.key === "Enter" && addSource()}
          />
          <button
            onClick={addSource}
            className="h-9 px-4 bg-primary text-primary-fg text-body-sm rounded-lg shrink-0 hover:opacity-90 transition-opacity"
          >
            Add
          </button>
        </div>
      </div>
    );
  }

  function renderStep6() {
    const hr = users.find((u) => u.id === form.responsibleHrId);
    const workTypeLabels = { office: "Office", remote: "Remote", hybrid: "Hybrid" };
    const empTypeLabels = {
      "full-time": "Full-time",
      "part-time": "Part-time",
      trial: "Trial",
      internship: "Internship",
    };
    const langLabels = { uz: "Uzbek", en: "English", ru: "Russian" };

    return (
      <div className="space-y-6">
        <p className={SECTION_HEADER_CLS}>Review & Confirm</p>

        {/* Basic Info */}
        <div className="bg-surface-2 border border-border rounded-lg p-4 space-y-2">
          <p className="text-body-sm font-semibold text-text">{form.title || "—"}</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            <ReviewRow label="Department" value={form.department || "—"} />
            <ReviewRow label="Location" value={form.location || "—"} />
            <ReviewRow label="Work Type" value={workTypeLabels[form.workType]} />
            <ReviewRow label="Employment" value={empTypeLabels[form.employmentType]} />
            <ReviewRow
              label="Salary"
              value={
                form.salaryMin || form.salaryMax
                  ? `${form.salaryMin.toLocaleString()} – ${form.salaryMax.toLocaleString()} UZS`
                  : "—"
              }
            />
            <ReviewRow label="Language" value={langLabels[form.language]} />
            <ReviewRow label="Responsible HR" value={hr?.name ?? "—"} />
          </div>
        </div>

        {/* Messages */}
        <div className="bg-surface-2 border border-border rounded-lg p-4 space-y-2">
          <p className={SECTION_HEADER_CLS + " mb-2"}>App Flow</p>
          <ReviewRow label="Intro message" value={form.introMessage || "—"} />
          <ReviewRow label="Success message" value={form.successMessage || "—"} />
        </div>

        {/* Counts */}
        <div className="grid grid-cols-3 gap-3">
          <CountCard label="Stages" count={stages.length} />
          <CountCard label="Questions" count={questions.length} />
          <CountCard label="Sources" count={sources.length} />
        </div>

        {/* Stages preview */}
        {stages.length > 0 && (
          <div className="bg-surface-2 border border-border rounded-lg p-4">
            <p className={SECTION_HEADER_CLS + " mb-3"}>Pipeline</p>
            <div className="flex flex-wrap gap-2">
              {stages.map((s) => (
                <span key={s.id} className="flex items-center gap-1.5 text-body-sm text-text">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STAGE_COLORS[s.color] ?? "bg-gray-400"}`} />
                  {s.name}
                  {s.isFinal && (
                    <span className="text-micro text-muted">({s.isRejected ? "reject" : "final"})</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Telegram preview pane (steps 2 and 3) ────────────────────────────────

  function renderPreview() {
    if (step === 2) {
      return (
        <div className="space-y-3">
          {/* Intro message bubble */}
          <BotBubble
            text={form.introMessage || "Welcome to our application process…"}
            faint={!form.introMessage}
          />
          {/* Placeholder for questions */}
          <div className="text-micro text-subtle italic px-1">…questions will appear here…</div>
          {/* Success message bubble */}
          <BotBubble
            text={form.successMessage || "Thank you for applying! We'll be in touch soon."}
            faint={!form.successMessage}
          />
        </div>
      );
    }

    if (step === 3) {
      if (questions.length === 0) {
        return (
          <p className="text-body-sm text-subtle italic px-1">Add questions to see a preview.</p>
        );
      }
      return (
        <div className="space-y-3">
          {questions.map((q) => (
            <div key={q.id} className="space-y-1.5">
              <BotBubble text={q.text} faint={false} />
              {/* Candidate answer placeholder */}
              <div className="flex justify-end">
                <div className="max-w-[80%] bg-primary/10 text-primary text-body-sm rounded-xl rounded-br-sm px-3 py-2 italic opacity-50">
                  Candidate answer…
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    return null;
  }

  const showPreview = step === 2 || step === 3;

  // ── Layout ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full bg-bg">
      {/* ── Left rail: vertical stepper ──────────────────────────────── */}
      <aside className="w-52 shrink-0 border-r border-border flex flex-col py-8 px-5 gap-0">
        <div className="flex-1">
          {STEPS.map((s, i) => {
            const num = i + 1;
            const isActive = num === step;
            const isDone = num < step;
            return (
              <div key={num} className="flex flex-col items-start">
                {/* Step row */}
                <button
                  onClick={() => isDone && setStep(num)}
                  className={`flex items-center gap-3 w-full group ${isDone ? "cursor-pointer" : "cursor-default"}`}
                >
                  {/* Circle */}
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-micro font-bold shrink-0 transition-colors ${
                      isActive
                        ? "bg-primary text-primary-fg"
                        : isDone
                        ? "bg-primary text-primary-fg"
                        : "bg-surface-2 border border-border text-muted"
                    }`}
                  >
                    {isDone ? "✓" : num}
                  </span>
                  {/* Label */}
                  <span
                    className={`text-body-sm transition-colors ${
                      isActive
                        ? "text-text font-medium"
                        : isDone
                        ? "text-primary"
                        : "text-muted"
                    }`}
                  >
                    {s.label}
                  </span>
                </button>
                {/* Connector line */}
                {i < STEPS.length - 1 && (
                  <div className="ml-3.5 w-px h-6 bg-border shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        {/* Cancel link at bottom of rail */}
        <Link
          href="/vacancies"
          className="text-body-sm text-muted hover:text-text transition-colors mt-4"
        >
          Cancel
        </Link>
      </aside>

      {/* ── Center: form + nav bar ────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Scrollable form area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[520px] mx-auto px-6 py-8 space-y-6">
            {/* Step heading */}
            <h1 className="text-h1 text-text">{STEPS[step - 1].label}</h1>

            {/* Step content */}
            <div className="bg-surface border border-border rounded-xl p-6">
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
              {step === 4 && renderStep4()}
              {step === 5 && renderStep5()}
              {step === 6 && renderStep6()}
            </div>
          </div>
        </div>

        {/* Sticky bottom nav bar */}
        <div className="shrink-0 border-t border-border bg-bg px-6 py-4 flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className="h-9 px-5 border border-border rounded-lg text-body-sm text-text hover:bg-surface-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Back
          </button>

          {step < 6 ? (
            <button
              onClick={handleNext}
              className="h-9 px-5 bg-primary text-primary-fg text-body-sm rounded-lg hover:opacity-90 transition-opacity"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleCreate}
              className="h-9 px-5 bg-primary text-primary-fg text-body-sm rounded-lg hover:opacity-90 transition-opacity"
            >
              Create Vacancy
            </button>
          )}
        </div>
      </div>

      {/* ── Right preview pane (steps 2 and 3 only) ──────────────────── */}
      {showPreview && (
        <aside className="w-72 shrink-0 border-l border-border flex flex-col overflow-y-auto">
          {/* Header */}
          <div className="px-4 pt-6 pb-3 shrink-0">
            <p className="text-micro uppercase tracking-wider text-subtle">Bot preview</p>
          </div>

          {/* Phone frame mockup */}
          <div className="flex-1 px-4 pb-6">
            <div className="bg-surface border border-border rounded-2xl overflow-hidden flex flex-col">
              {/* Phone status bar / chat header */}
              <div className="bg-surface-2 border-b border-border px-3 py-2 flex items-center gap-2 shrink-0">
                {/* Bot avatar */}
                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-fg text-micro font-bold shrink-0">
                  H
                </div>
                <div>
                  <p className="text-body-sm font-medium text-text leading-tight">HireFlow Bot</p>
                  <p className="text-micro text-muted leading-tight">bot</p>
                </div>
              </div>

              {/* Chat messages */}
              <div className="flex-1 px-3 py-3 space-y-2 bg-bg min-h-[200px]">
                {renderPreview()}
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────

function BotBubble({ text, faint }: { text: string; faint: boolean }) {
  return (
    <div className="flex items-end gap-2">
      {/* Bot avatar dot */}
      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-fg shrink-0 self-end" style={{ fontSize: "10px", fontWeight: 700 }}>
        H
      </div>
      <div
        className={`max-w-[80%] bg-surface border border-border text-body-sm rounded-xl rounded-bl-sm px-3 py-2 transition-opacity ${
          faint ? "text-muted italic" : "text-text"
        }`}
      >
        {text}
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-micro text-muted uppercase tracking-wider">{label}: </span>
      <span className="text-body-sm text-text">{value}</span>
    </div>
  );
}

function CountCard({ label, count }: { label: string; count: number }) {
  return (
    <div className="bg-surface-2 border border-border rounded-lg p-4 text-center">
      <div className="text-h2 text-text font-bold">{count}</div>
      <div className="text-micro text-muted mt-0.5">{label}</div>
    </div>
  );
}
