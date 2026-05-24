"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import type { CreateVacancyInput, ScreeningQuestion, QuestionTemplate } from "@/lib/types";
import { toI18nText, hasI18nGap } from "@/lib/utils";
import { SaveAsTemplateDialog } from "@/components/settings/SaveAsTemplateDialog";
import { Combobox } from "@/components/ui/Combobox";
import { createVacancy } from "@/app/actions/vacancies";
import { listDepartments, type DepartmentOption } from "@/app/actions/departments";
import { getAssignableHrUsers, type AssignableHrUser } from "@/app/actions/users";
import {
  createMessageTemplate,
  listMessageTemplates,
  type MessageTemplateView,
} from "@/app/actions/message-templates";
import { UZ_LOCATIONS } from "@/lib/locations";

type TemplateStage = {
  id: string;
  name: string;
  color: string;
  isFinal: boolean;
  isRejected: boolean;
  isReserve?: boolean;
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
  "w-full bg-surface-elevated border border-border rounded-lg px-3 h-10 text-body-sm text-text shadow-xs outline-none transition-colors focus:border-primary";
const TEXTAREA_CLS =
  "w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-body-sm text-text shadow-xs outline-none transition-colors focus:border-primary resize-none";
const LABEL_CLS = "block text-body-sm text-muted mb-1";
const SECTION_HEADER_CLS = "text-micro uppercase tracking-wider text-subtle mb-3";
const PANEL_CLS = "bg-surface-elevated border border-border rounded-xl p-5 shadow-sm";

type I18nDraft = { uz: string; ru: string; en: string };
type LangTab = "uz" | "ru" | "en";
const Q_LANGS: LangTab[] = ["uz", "ru", "en"];
const Q_LANG_LABELS: Record<LangTab, string> = { uz: "UZ", ru: "RU", en: "EN" };

type QuestionDraft = {
  id: string;
  text: I18nDraft;
  activeLang: LangTab;
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
  isReserve?: boolean;
};

type VacancyFormState = Omit<CreateVacancyInput, "salaryMin" | "salaryMax"> & {
  salaryMin?: number;
  salaryMax?: number;
};

function formatThousands(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function parseSalary(value: string): number | undefined {
  const cleaned = value.replace(/[^\d]/g, "");
  if (!cleaned) return undefined;
  return Number(cleaned);
}

export default function NewVacancyPage() {
  const router = useRouter();
  const [questionTemplates, setQuestionTemplates] = useState<QuestionTemplate[]>([]);
  useEffect(() => {
    import("@/app/actions/question-templates").then(({ listQuestionTemplates }) => {
      listQuestionTemplates().then(setQuestionTemplates).catch(() => setQuestionTemplates([]));
    });
  }, []);

  const [step, setStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [responsibleHrs, setResponsibleHrs] = useState<AssignableHrUser[]>([]);
  const [isLoadingHrs, setIsLoadingHrs] = useState(true);
  const [hrLoadError, setHrLoadError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(true);
  const [departmentLoadError, setDepartmentLoadError] = useState<string | null>(null);
  const [messageTemplates, setMessageTemplates] = useState<MessageTemplateView[]>([]);
  const [isLoadingMessageTemplates, setIsLoadingMessageTemplates] = useState(true);
  const [messageTemplateError, setMessageTemplateError] = useState<string | null>(null);
  const [selectedIntroTemplateId, setSelectedIntroTemplateId] = useState("");
  const [selectedSuccessTemplateId, setSelectedSuccessTemplateId] = useState("");
  const [savingMessageTemplateKind, setSavingMessageTemplateKind] = useState<"intro" | "success" | null>(null);

  const [form, setForm] = useState<VacancyFormState>({
    title: "",
    department: "",
    workType: "office",
    employmentType: "full-time",
    location: "",
    salaryMin: undefined,
    salaryMax: undefined,
    description: "",
    language: "uz",
    responsibleHrId: "",
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
    sources: [],
  });

  // Local draft state for questions (need per-item id + optionsRaw)
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [newQText, setNewQText] = useState<I18nDraft>({ uz: "", ru: "", en: "" });
  const [newQLang, setNewQLang] = useState<LangTab>("uz");
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

  useEffect(() => {
    let cancelled = false;

    async function loadDepartments() {
      try {
        setIsLoadingDepartments(true);
        setDepartmentLoadError(null);
        const rows = await listDepartments();
        if (cancelled) return;
        setDepartments(rows);
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load departments", err);
          setDepartmentLoadError("Could not load departments.");
        }
      } finally {
        if (!cancelled) setIsLoadingDepartments(false);
      }
    }

    loadDepartments();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadResponsibleHrs() {
      try {
        setIsLoadingHrs(true);
        setHrLoadError(null);
        const hrs = await getAssignableHrUsers();
        if (cancelled) return;
        setResponsibleHrs(hrs);
        setForm((current) =>
          current.responsibleHrId || hrs.length === 0
            ? current
            : { ...current, responsibleHrId: hrs[0].id }
        );
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load assignable HR users", err);
          setHrLoadError("Could not load responsible HR users.");
        }
      } finally {
        if (!cancelled) setIsLoadingHrs(false);
      }
    }

    loadResponsibleHrs();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadMessageTemplates() {
      try {
        setIsLoadingMessageTemplates(true);
        setMessageTemplateError(null);
        const rows = await listMessageTemplates(undefined, form.language);
        if (cancelled) return;
        const filteredRows = rows.filter((template) => template.kind === "intro" || template.kind === "success");
        setMessageTemplates(filteredRows);

        const defaultIntro = filteredRows.find((template) => template.kind === "intro" && template.isSystem)
          ?? filteredRows.find((template) => template.kind === "intro");
        const defaultSuccess = filteredRows.find((template) => template.kind === "success" && template.isSystem)
          ?? filteredRows.find((template) => template.kind === "success");

        setSelectedIntroTemplateId(defaultIntro?.id ?? "");
        setSelectedSuccessTemplateId(defaultSuccess?.id ?? "");
        setForm((current) => ({
          ...current,
          introMessage: current.introMessage || defaultIntro?.content || "",
          successMessage: current.successMessage || defaultSuccess?.content || "",
        }));
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load message templates", err);
          setMessageTemplates([]);
          setMessageTemplateError("Could not load message templates.");
        }
      } finally {
        if (!cancelled) setIsLoadingMessageTemplates(false);
      }
    }

    loadMessageTemplates();

    return () => {
      cancelled = true;
    };
  }, [form.language]);

  function applyTemplate() {
    const tpl = templates.find((t) => t.id === selectedTemplateId);
    if (!tpl) return;
    const mapped: StageDraft[] = tpl.stages.map((s, i) => ({
      id: `stpl_${i}_${Date.now()}`,
      name: s.name,
      color: s.color,
      isFinal: s.isFinal,
      isRejected: s.isRejected,
      isReserve: s.isReserve ?? false,
    }));
    setStages(mapped);
    setSelectedTemplateId("");
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  function patchForm(patch: Partial<VacancyFormState>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  function applyMessageTemplate(kind: "intro" | "success", templateId: string) {
    const template = messageTemplates.find((item) => item.id === templateId);
    if (!template) return;
    if (kind === "intro") {
      patchForm({ introMessage: template.content });
      setSelectedIntroTemplateId(templateId);
    } else {
      patchForm({ successMessage: template.content });
      setSelectedSuccessTemplateId(templateId);
    }
  }

  async function refreshMessageTemplates() {
    const rows = await listMessageTemplates(undefined, form.language);
    setMessageTemplates(rows.filter((template) => template.kind === "intro" || template.kind === "success"));
  }

  async function saveCurrentMessageAsTemplate(kind: "intro" | "success") {
    const content = kind === "intro" ? form.introMessage : form.successMessage;
    if (!content.trim()) return;

    const fallbackName = `${kind === "intro" ? "Intro" : "Success"} - ${form.language.toUpperCase()}`;
    const name = window.prompt("Template name", fallbackName);
    if (!name?.trim()) return;

    try {
      setSavingMessageTemplateKind(kind);
      setMessageTemplateError(null);
      const template = await createMessageTemplate({
        kind,
        language: form.language,
        name,
        content,
      });
      await refreshMessageTemplates();
      if (kind === "intro") {
        setSelectedIntroTemplateId(template.id);
      } else {
        setSelectedSuccessTemplateId(template.id);
      }
    } catch (err) {
      console.error("Failed to save message template", err);
      setMessageTemplateError(err instanceof Error ? err.message : "Could not save message template.");
    } finally {
      setSavingMessageTemplateKind(null);
    }
  }

  // Questions
  function addQuestion() {
    if (!newQText.uz.trim() && !newQText.ru.trim() && !newQText.en.trim()) return;
    setQuestions((qs) => [
      ...qs,
      { id: `q_${Date.now()}`, text: { uz: newQText.uz.trim(), ru: newQText.ru.trim(), en: newQText.en.trim() }, activeLang: "uz", type: newQType, optionsRaw: "" },
    ]);
    setNewQText({ uz: "", ru: "", en: "" });
    setNewQLang("uz");
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
        text: toI18nText(q.text),
        activeLang: "uz" as LangTab,
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

  // ── Navigation ───────────────────────────────────────────────────────────

  function handleNext() {
    if (step < STEPS.length) setStep(step + 1);
  }

  function handleBack() {
    if (step > 1) setStep(step - 1);
  }

  function stepForCreateField(field?: string) {
    if (!field) return step;
    if (["title", "department", "location", "salaryMin", "salaryMax", "responsibleHrId"].includes(field)) return 1;
    if (["stages"].includes(field)) return 4;
    return step;
  }

  async function handleCreate() {
    if (isCreating) return;
    setCreateError(null);

    const finalQuestions = questions.map((q) => ({
      text: JSON.stringify({ uz: q.text.uz, ru: q.text.ru, en: q.text.en }),
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
      isReserve: s.isReserve ?? false,
    }));

    const input: CreateVacancyInput = {
      ...form,
      salaryMin: form.salaryMin ?? 0,
      salaryMax: form.salaryMax ?? 0,
      questions: finalQuestions,
      stages: finalStages,
      sources: [],
    };

    try {
      setIsCreating(true);
      const result = await createVacancy(input);
      if (!result.ok) {
        setCreateError(result.error.message);
        setStep(stepForCreateField(result.error.field));
        return;
      }
      router.push(`/vacancies/${result.vacancyId}`);
    } catch (err) {
      console.error("Vacancy create failed", err);
      setCreateError(err instanceof Error ? err.message : "Could not create vacancy. Please try again.");
    } finally {
      setIsCreating(false);
    }
  }

  // ── Render steps ─────────────────────────────────────────────────────────

  function renderStep1() {
    return (
      <div className="space-y-5">
        <p className={SECTION_HEADER_CLS}>Position Details</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
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
            {isLoadingDepartments || departments.length > 0 ? (
              <select
                className={INPUT_CLS}
                value={form.department}
                onChange={(e) => patchForm({ department: e.target.value })}
                disabled={isLoadingDepartments}
              >
                <option value="">
                  {isLoadingDepartments ? "Loading departments..." : "Select department..."}
                </option>
                {departments.map((department) => (
                  <option key={department.id} value={department.name}>
                    {department.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className={INPUT_CLS}
                value={form.department}
                onChange={(e) => patchForm({ department: e.target.value })}
                placeholder="e.g. Engineering"
              />
            )}
            {departmentLoadError && <p className="mt-1 text-caption text-danger">{departmentLoadError}</p>}
            {!isLoadingDepartments && departments.length === 0 && (
              <p className="mt-1 text-caption text-warning">
                No active departments found. You can type one now, then add departments in Settings.
              </p>
            )}
          </div>
          <div>
            <label className={LABEL_CLS}>Location</label>
            <Combobox
              className={INPUT_CLS}
              value={form.location}
              onChange={(location) => patchForm({ location })}
              options={UZ_LOCATIONS}
              placeholder="Start typing a city, region, or work mode..."
              allowCustom
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
              type="text"
              inputMode="numeric"
              value={form.salaryMin === undefined ? "" : formatThousands(form.salaryMin)}
              onChange={(e) => patchForm({ salaryMin: parseSalary(e.target.value) })}
              placeholder="e.g. 5,000,000"
            />
          </div>
          <div>
            <label className={LABEL_CLS}>Salary Max (UZS)</label>
            <input
              className={INPUT_CLS}
              type="text"
              inputMode="numeric"
              value={form.salaryMax === undefined ? "" : formatThousands(form.salaryMax)}
              onChange={(e) => patchForm({ salaryMax: parseSalary(e.target.value) })}
              placeholder="e.g. 10,000,000"
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
              disabled={isLoadingHrs || responsibleHrs.length === 0}
            >
              {isLoadingHrs && <option value="">Loading HR users...</option>}
              {!isLoadingHrs && responsibleHrs.length === 0 && (
                <option value="">No active HR users found</option>
              )}
              {responsibleHrs.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            {hrLoadError && <p className="mt-1 text-caption text-danger">{hrLoadError}</p>}
          </div>
        </div>
      </div>
    );
  }

  function renderStep2() {
    const introTemplates = messageTemplates.filter((template) => template.kind === "intro");
    const successTemplates = messageTemplates.filter((template) => template.kind === "success");

    return (
      <div className="space-y-5">
        <p className={SECTION_HEADER_CLS}>Candidate-facing Messages</p>
        {messageTemplateError && (
          <p className="text-caption text-danger" role="alert">
            {messageTemplateError}
          </p>
        )}
        <div className={PANEL_CLS}>
          <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
            <label className="text-body-sm text-muted">Intro Message</label>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <select
                className="max-w-48 bg-surface border border-border rounded-lg px-2 h-8 text-body-sm text-text outline-none focus:border-primary"
                value={selectedIntroTemplateId}
                onChange={(e) => applyMessageTemplate("intro", e.target.value)}
                disabled={isLoadingMessageTemplates || introTemplates.length === 0}
              >
                <option value="">
                  {isLoadingMessageTemplates ? "Loading..." : "Load template..."}
                </option>
                {introTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => saveCurrentMessageAsTemplate("intro")}
                disabled={!form.introMessage.trim() || savingMessageTemplateKind !== null}
                className="h-8 px-3 rounded-lg border border-border text-body-sm text-text hover:bg-surface-2 transition-colors disabled:opacity-40"
              >
                {savingMessageTemplateKind === "intro" ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
          <textarea
            className={TEXTAREA_CLS}
            rows={4}
            value={form.introMessage}
            onChange={(e) => patchForm({ introMessage: e.target.value })}
            placeholder="Welcome to our application process…"
          />
        </div>
        <div className={PANEL_CLS}>
          <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
            <label className="text-body-sm text-muted">Success Message</label>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <select
                className="max-w-48 bg-surface border border-border rounded-lg px-2 h-8 text-body-sm text-text outline-none focus:border-primary"
                value={selectedSuccessTemplateId}
                onChange={(e) => applyMessageTemplate("success", e.target.value)}
                disabled={isLoadingMessageTemplates || successTemplates.length === 0}
              >
                <option value="">
                  {isLoadingMessageTemplates ? "Loading..." : "Load template..."}
                </option>
                {successTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => saveCurrentMessageAsTemplate("success")}
                disabled={!form.successMessage.trim() || savingMessageTemplateKind !== null}
                className="h-8 px-3 rounded-lg border border-border text-body-sm text-text hover:bg-surface-2 transition-colors disabled:opacity-40"
              >
                {savingMessageTemplateKind === "success" ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
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

        <div className="rounded-xl bg-primary-soft border border-primary/20 px-4 py-3 mb-4 text-body-sm shadow-xs">
          <p className="font-semibold text-text mb-1">Bot already collects from every applicant:</p>
          <p className="text-muted">Full name · Date of birth · Address · Phone · Marital status · Education · Languages · Work history · Email · CV · Notes</p>
          <p className="text-subtle mt-1">Add <strong>vacancy-specific</strong> questions below (e.g. "Years of experience?", "Portfolio URL?").</p>
        </div>

        {questions.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-surface-2 p-5 text-center space-y-3">
            <p className="text-body-sm font-semibold text-text">No screening questions yet</p>
            <p className="text-body-sm text-muted">
              These are <strong>vacancy-specific</strong> questions — the bot already collects
              name, email, CV, and notes from every applicant automatically.
            </p>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {[
                { text: "Years of experience?",          type: "short-text" as const },
                { text: "Why are you interested?",       type: "long-text"  as const },
                { text: "Preferred salary (USD)?",       type: "short-text" as const },
                { text: "When can you start?",           type: "short-text" as const },
                { text: "GitHub or portfolio URL?",      type: "short-text" as const },
                { text: "Open to relocation?",           type: "yes-no"     as const },
              ].map((s) => (
                <button
                  key={s.text}
                  type="button"
                  onClick={() => {
                    setQuestions((qs) => [
                      ...qs,
                      { id: `q_${Date.now()}_${Math.random()}`, text: { uz: s.text, ru: "", en: "" }, activeLang: "uz" as LangTab, type: s.type, options: undefined, optionsRaw: "" },
                    ]);
                  }}
                  className="text-body-sm px-3 py-1.5 rounded-full bg-surface border border-border hover:border-primary hover:text-primary transition-colors"
                >
                  + {s.text}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {questions.map((q, i) => {
            const gap = hasI18nGap(q.text);
            return (
            <div key={q.id} className="bg-surface-elevated border border-border rounded-xl p-3 space-y-2 shadow-xs">
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
                  {/* Language tabs */}
                  <div className="flex gap-0 border-b border-border mb-1">
                    {Q_LANGS.map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => patchQuestion(q.id, { activeLang: lang })}
                        className={`px-2.5 py-0.5 text-xs font-medium transition-colors ${
                          q.activeLang === lang
                            ? "border-b-2 border-primary text-primary"
                            : "text-muted hover:text-text"
                        } ${!q.text[lang].trim() ? "after:content-['*'] after:text-warning after:ml-0.5" : ""}`}
                      >
                        {Q_LANG_LABELS[lang]}
                      </button>
                    ))}
                    {gap && (
                      <span title="Some translations are missing" className="ml-auto text-warning self-center pr-1">
                        <AlertCircle className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <input
                    className={INPUT_CLS}
                    value={q.text[q.activeLang]}
                    onChange={(e) => patchQuestion(q.id, { text: { ...q.text, [q.activeLang]: e.target.value } })}
                    placeholder={`Question text (${q.activeLang.toUpperCase()})`}
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
            );
          })}
        </div>

        {/* Add question row */}
        <div className="space-y-2 pt-1">
          {/* Language tabs for new question */}
          <div className="flex gap-0 border-b border-border">
            {Q_LANGS.map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setNewQLang(lang)}
                className={`px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  newQLang === lang
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted hover:text-text"
                } ${!newQText[lang].trim() ? "after:content-['*'] after:text-warning after:ml-0.5" : ""}`}
              >
                {Q_LANG_LABELS[lang]}
              </button>
            ))}
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <input
              className={INPUT_CLS + " min-w-56 flex-1"}
              value={newQText[newQLang]}
              onChange={(e) => setNewQText((t) => ({ ...t, [newQLang]: e.target.value }))}
              placeholder={`New question (${newQLang.toUpperCase()})…`}
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
      </div>
    );
  }

  function renderStep4() {
    return (
      <div className="space-y-5">
        <p className={SECTION_HEADER_CLS}>Pipeline Stages</p>

        {/* Template picker */}
        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border flex-wrap">
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
            <div key={s.id} className="bg-surface-elevated border border-border rounded-xl p-3 shadow-xs">
              <div className="flex items-center gap-2 flex-wrap">
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
        <div className="flex gap-2 items-center pt-1 flex-wrap">
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
            className={INPUT_CLS + " min-w-48 flex-1"}
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
            Save as template
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
    const hr = responsibleHrs.find((u) => u.id === form.responsibleHrId);
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
        <div className={PANEL_CLS + " space-y-2"}>
          <p className="text-body-sm font-semibold text-text">{form.title || "—"}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
            <ReviewRow label="Department" value={form.department || "—"} />
            <ReviewRow label="Location" value={form.location || "—"} />
            <ReviewRow label="Work Type" value={workTypeLabels[form.workType]} />
            <ReviewRow label="Employment" value={empTypeLabels[form.employmentType]} />
            <ReviewRow
              label="Salary"
              value={
                form.salaryMin !== undefined || form.salaryMax !== undefined
                  ? `${form.salaryMin === undefined ? "—" : formatThousands(form.salaryMin)} – ${form.salaryMax === undefined ? "—" : formatThousands(form.salaryMax)} UZS`
                  : "—"
              }
            />
            <ReviewRow label="Language" value={langLabels[form.language]} />
            <ReviewRow label="Responsible HR" value={hr?.name ?? "—"} />
          </div>
        </div>

        {/* Messages */}
        <div className={PANEL_CLS + " space-y-2"}>
          <p className={SECTION_HEADER_CLS + " mb-2"}>App Flow</p>
          <ReviewRow label="Intro message" value={form.introMessage || "—"} />
          <ReviewRow label="Success message" value={form.successMessage || "—"} />
        </div>

        {/* Counts */}
        <div className="grid grid-cols-2 gap-3">
          <CountCard label="Stages" count={stages.length} />
          <CountCard label="Questions" count={questions.length} />
        </div>

        {/* Stages preview */}
        {stages.length > 0 && (
          <div className={PANEL_CLS}>
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
              <BotBubble text={q.text[q.activeLang] || q.text.uz || q.text.ru || q.text.en || "…"} faint={false} />
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
      <aside className="w-56 shrink-0 border-r border-border bg-surface/70 flex flex-col py-8 px-5 gap-0">
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
                  aria-current={isActive ? "step" : undefined}
                  className={`flex items-center gap-3 w-full group rounded-lg px-2 py-1.5 text-left transition-colors ${
                    isActive ? "bg-primary-soft" : isDone ? "hover:bg-surface-2 cursor-pointer" : "cursor-default"
                  }`}
                >
                  {/* Circle */}
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-micro font-bold shrink-0 transition-colors ${
                      isActive
                        ? "bg-primary text-primary-fg shadow-md shadow-primary/20"
                        : isDone
                        ? "bg-success text-white"
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
                        ? "text-success"
                        : "text-muted"
                    }`}
                  >
                    {s.label}
                    {s.label === "Questions" && questions.length > 0 && (
                      <span className="ml-1 text-xs bg-primary/15 text-primary rounded-full px-1.5">{questions.length}</span>
                    )}
                  </span>
                </button>
                {/* Connector line */}
                {i < STEPS.length - 1 && (
                  <div className={`ml-[21px] w-px h-5 shrink-0 ${isDone ? "bg-success/40" : "bg-border"}`} />
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
          <div className="max-w-[620px] mx-auto px-6 py-8 space-y-6">
            {/* Step heading */}
            <div>
              <p className="text-micro uppercase tracking-wider text-subtle">Step {step} of {STEPS.length}</p>
              <h1 className="text-h1 text-text mt-1">{STEPS[step - 1].label}</h1>
            </div>

            {/* Step content */}
            <div className="bg-surface-elevated border border-border rounded-2xl p-6 shadow-lg shadow-slate-200/60">
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
              {step === 4 && renderStep4()}
              {step === 5 && renderStep5()}
            </div>
          </div>
        </div>

        {/* Sticky bottom nav bar */}
        <div className="shrink-0 sticky bottom-0 z-10 border-t border-border bg-surface/95 backdrop-blur px-6 py-4 flex items-center justify-between gap-4">
          {createError && (
            <p className="text-body-sm text-danger mr-4 truncate" role="alert">
              {createError}
            </p>
          )}
          <button
            onClick={handleBack}
            disabled={step === 1 || isCreating}
            className="h-9 px-5 border border-border rounded-lg text-body-sm text-text hover:bg-surface-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Back
          </button>

          {step < STEPS.length ? (
            <button
              onClick={handleNext}
              className="h-10 px-5 bg-primary text-primary-fg text-body-sm font-semibold rounded-lg shadow-md shadow-primary/20 hover:bg-primary-hover transition-colors"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={isCreating}
              className="h-10 px-5 bg-primary text-primary-fg text-body-sm font-semibold rounded-lg shadow-md shadow-primary/20 hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? "Creating..." : "Create Vacancy"}
            </button>
          )}
        </div>
      </div>

      {/* ── Right preview pane (steps 2 and 3 only) ──────────────────── */}
      {showPreview && (
        <aside className="w-80 shrink-0 border-l border-border bg-surface/70 flex flex-col overflow-y-auto">
          {/* Header */}
          <div className="px-4 pt-6 pb-3 shrink-0">
            <p className="text-micro uppercase tracking-wider text-subtle">Bot preview</p>
          </div>

          {/* Phone frame mockup */}
          <div className="flex-1 px-4 pb-6">
            <div className="bg-surface-elevated border border-border rounded-2xl overflow-hidden flex flex-col shadow-lg">
              {/* Phone status bar / chat header */}
              <div className="bg-primary text-primary-fg px-3 py-2 flex items-center gap-2 shrink-0">
                {/* Bot avatar */}
                <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center text-primary-fg text-micro font-bold shrink-0">
                  H
                </div>
                <div>
                  <p className="text-body-sm font-medium leading-tight">HireFlow Bot</p>
                  <p className="text-micro text-primary-fg/70 leading-tight">bot preview</p>
                </div>
              </div>

              {/* Chat messages */}
              <div className="flex-1 px-3 py-3 space-y-2 bg-surface-2 min-h-[260px]">
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
