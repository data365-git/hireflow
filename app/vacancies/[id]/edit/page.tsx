"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "@/lib/hooks/useToast";
import type { ScreeningQuestion, VacancyStage, Vacancy, User, Source, TestTask, Application } from "@/lib/types";
import {
  getVacancyEditData,
  getScreeningQuestions,
  createScreeningQuestion,
  updateScreeningQuestion,
  deleteScreeningQuestion,
  reorderScreeningQuestions,
  getVacancyModeInfo,
  updateVacancyDetails,
  addVacancyStage,
  updateVacancyStage,
  removeVacancyStage,
  reorderVacancyStages,
  addVacancySource,
  removeVacancySource,
  createVacancyTestTask,
  removeVacancyTestTask,
  type VacancyEditData,
} from "@/app/actions/vacancies";

// ── Constants ────────────────────────────────────────────────────────────────

const STAGE_COLOR_OPTIONS = [
  { key: "new", bg: "bg-gray-400" },
  { key: "screening", bg: "bg-blue-500" },
  { key: "qualified", bg: "bg-violet-500" },
  { key: "test", bg: "bg-amber-500" },
  { key: "interview", bg: "bg-orange-500" },
  { key: "hired", bg: "bg-green-500" },
  { key: "rejected", bg: "bg-red-500" },
] as const;

const STAGE_COLOR_MAP: Record<string, string> = {
  new: "bg-gray-400",
  screening: "bg-blue-500",
  qualified: "bg-violet-500",
  test: "bg-amber-500",
  interview: "bg-orange-500",
  hired: "bg-green-500",
  rejected: "bg-red-500",
};

const QUESTION_TYPES: ScreeningQuestion["type"][] = [
  "short-text", "long-text", "phone", "single-choice", "yes-no", "rating",
];

const QUESTION_TYPE_LABELS: Record<ScreeningQuestion["type"], string> = {
  "short-text": "Short text",
  "long-text": "Long text",
  "phone": "Phone",
  "single-choice": "Single choice",
  "yes-no": "Yes / No",
  "rating": "Rating",
};

const STATUS_STYLES: Record<string, string> = {
  active: "bg-success-soft text-success",
  paused: "bg-warning-soft text-warning",
  closed: "bg-surface-3 text-muted",
};

// ── Input component ──────────────────────────────────────────────────────────

const INPUT_CLS =
  "bg-surface border border-border rounded-lg px-3 h-9 text-body-sm text-text outline-none focus:border-primary w-full";
const TEXTAREA_CLS =
  "bg-surface border border-border rounded-lg px-3 py-2 text-body-sm text-text outline-none focus:border-primary w-full resize-none";
const SELECT_CLS =
  "bg-surface border border-border rounded-lg px-3 h-9 text-body-sm text-text outline-none focus:border-primary w-full";
const LABEL_CLS = "text-body-sm font-semibold text-text block mb-1";

// ── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = "details" | "questions" | "stages" | "sources" | "tasks";

// ── Page ─────────────────────────────────────────────────────────────────────

export default function EditVacancyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [modeInfo, setModeInfo] = useState<Awaited<ReturnType<typeof getVacancyModeInfo>> | null>(null);
  const [editData, setEditData] = useState<VacancyEditData | null>(null);
  const [questions, setQuestions] = useState<ScreeningQuestion[]>([]);
  const vacancy = editData?.vacancy ?? null;
  const users = editData?.users ?? [];
  const stages = editData?.stages ?? [];
  const sources = editData?.sources ?? [];
  const applications = editData?.applications ?? [];
  const testTasks = editData?.testTasks ?? [];

  useEffect(() => {
    let cancelled = false;
    setModeInfo(null);
    setEditData(null);
    setQuestions([]);

    Promise.all([getVacancyModeInfo(id), getVacancyEditData(id), getScreeningQuestions(id)])
      .then(([info, data, questionRows]) => {
        if (cancelled) return;
        setModeInfo(info);
        setEditData(data);
        setQuestions(questionRows as ScreeningQuestion[]);
      })
      .catch(() => {
        if (!cancelled) {
          setModeInfo({ exists: false, currentIsDemo: false });
          setEditData(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function refreshEditData() {
    const data = await getVacancyEditData(id);
    setEditData(data);
  }

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: "", message: "", onConfirm: () => {} });

  function closeConfirm() {
    setConfirmDialog((d) => ({ ...d, open: false }));
  }

  function handleRemoveStage(stageId: string) {
    const count = applications.filter((application) => application.currentStageId === stageId).length;
    if (count > 0) {
      setConfirmDialog({
        open: true,
        title: "Cannot delete stage",
        message: `Move ${count} application${count === 1 ? "" : "s"} out of this stage first before deleting it.`,
        onConfirm: closeConfirm,
      });
    } else {
      setConfirmDialog({
        open: true,
        title: "Delete stage?",
        message: "This will permanently remove the stage. This cannot be undone.",
        onConfirm: async () => {
          try {
            await removeVacancyStage(stageId);
            await refreshEditData();
            toast.success("Stage deleted");
            closeConfirm();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not delete stage");
          }
        },
      });
    }
  }

  function handleRemoveTestTask(taskId: string) {
    setConfirmDialog({
      open: true,
      title: "Delete test task?",
      message: "This will permanently remove the test task. This cannot be undone.",
      onConfirm: async () => {
        try {
          await removeVacancyTestTask(taskId);
          await refreshEditData();
          toast.success("Test task deleted");
          closeConfirm();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Could not delete test task");
        }
      },
    });
  }
  const activeApplicationCount = applications.filter((application) => {
    if (application.vacancyId !== id) return false;
    const currentStage = stages.find((stage) => stage.id === application.currentStageId);
    return !currentStage || (!currentStage.isFinal && !currentStage.isRejected);
  }).length;

  const [activeTab, setActiveTab] = useState<Tab>("details");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskDays, setNewTaskDays] = useState(3);
  const [showAddTask, setShowAddTask] = useState(false);

  if (modeInfo === null) {
    return (
      <div className="px-8 py-8">
        <EmptyState title="Checking vacancy mode" description="One moment while we verify where this vacancy lives." />
      </div>
    );
  }

  if (modeInfo.exists && modeInfo.isDemo !== modeInfo.currentIsDemo) {
    const targetMode = modeInfo.isDemo ? "Demo" : "Live";
    return (
      <div className="px-8 py-8">
        <div className="bg-surface border border-border rounded-xl">
          <EmptyState
            title={`This vacancy is in ${targetMode} mode`}
            description={`Switch to ${targetMode} mode to view "${modeInfo.title}".`}
          />
          <div className="flex justify-center pb-10">
            <Link
              href="/vacancies"
              className="h-9 px-4 inline-flex items-center rounded-lg border border-border text-body-sm text-text hover:bg-surface-2 transition-colors"
            >
              Back to vacancies
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!modeInfo.exists || !vacancy) {
    return (
      <div className="px-8 py-8">
        <EmptyState title="Vacancy not found" description="This vacancy does not exist or was deleted." />
      </div>
    );
  }

  const statusLabel = vacancy.status.charAt(0).toUpperCase() + vacancy.status.slice(1);

  return (
    <div className="flex flex-col h-full">
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.title.startsWith("Cannot") ? "OK" : "Delete"}
        onConfirm={confirmDialog.onConfirm}
        onCancel={closeConfirm}
      />
      {/* Header */}
      <div className="px-8 py-5 border-b border-border bg-bg sticky top-0 z-10">
        <div className="mb-1">
          <Link
            href={`/vacancies/${id}`}
            className="text-body-sm text-muted hover:text-text transition-colors"
          >
            ← {vacancy.title}
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-h2 text-text">Edit Vacancy</h1>
          <span
            className={`text-micro px-2 h-5 rounded-full inline-flex items-center font-semibold ${STATUS_STYLES[vacancy.status]}`}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-8 border-b border-border bg-bg">
        <div className="flex gap-1">
          {(["details", "questions", "stages", "sources", "tasks"] as Tab[]).map((tab) => {
            const badge = tab === "tasks" && testTasks.length > 0 ? testTasks.length : undefined;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-body-sm font-semibold border-b-2 transition-colors capitalize inline-flex items-center gap-1.5 ${
                  activeTab === tab
                    ? "border-primary text-primary"
                    : "border-transparent text-muted hover:text-text"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {badge !== undefined && (
                  <span className="text-micro px-1.5 h-4 rounded-full bg-surface-3 text-muted inline-flex items-center">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-8 py-8">
        {activeTab === "details" && (
          <DetailsTab
            vacancy={vacancy}
            users={users}
            activeApplicationCount={activeApplicationCount}
            onSave={async (patch) => {
              const updated = await updateVacancyDetails(id, patch);
              setEditData((current) => current ? { ...current, vacancy: updated } : current);
            }}
            onConfirm={(message, action) =>
              setConfirmDialog({
                open: true,
                title: "Confirm",
                message,
                onConfirm: async () => {
                  try {
                    await action();
                    closeConfirm();
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Could not save changes");
                  }
                },
              })
            }
          />
        )}
        {activeTab === "questions" && (
          <QuestionsTab
            questions={questions}
            vacancyId={id}
            onAdd={async (q) => {
              const { id: newId } = await createScreeningQuestion({
                vacancyId: id,
                text: q.text,
                type: q.type,
                options: q.options,
                orderIndex: questions.length,
              });
              setQuestions((qs) => [
                ...qs,
                {
                  id: newId,
                  vacancyId: id,
                  text: q.text,
                  type: q.type as ScreeningQuestion["type"],
                  options: q.options ?? undefined,
                  orderIndex: qs.length,
                },
              ]);
            }}
            onRemove={async (qId) => {
              await deleteScreeningQuestion(qId);
              setQuestions((qs) => qs.filter((q) => q.id !== qId));
            }}
            onUpdate={async (qId, patch) => {
              await updateScreeningQuestion(qId, patch);
              setQuestions((qs) =>
                qs.map((q) => (q.id === qId ? { ...q, ...patch } : q))
              );
            }}
            onReorder={async (orderedIds) => {
              await reorderScreeningQuestions(id, orderedIds);
              setQuestions((qs) =>
                orderedIds.map((oid) => qs.find((q) => q.id === oid)!)
              );
            }}
          />
        )}
        {activeTab === "stages" && (
          <StagesTab
            stages={stages}
            vacancyId={id}
            onAdd={async (s) => {
              try {
                const stage = await addVacancyStage(id, s);
                setEditData((current) =>
                  current
                    ? {
                        ...current,
                        vacancy: { ...current.vacancy, stageIds: [...current.vacancy.stageIds, stage.id] },
                        stages: [...current.stages, stage],
                      }
                    : current
                );
                toast.success("Stage added");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not add stage");
              }
            }}
            onUpdate={async (stageId, patch) => {
              try {
                const stage = await updateVacancyStage(stageId, patch);
                setEditData((current) =>
                  current
                    ? { ...current, stages: current.stages.map((item) => (item.id === stage.id ? stage : item)) }
                    : current
                );
                toast.success("Stage updated");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not update stage");
              }
            }}
            onRemove={handleRemoveStage}
            onReorder={async (orderedIds) => {
              try {
                const rows = await reorderVacancyStages(id, orderedIds);
                setEditData((current) =>
                  current ? { ...current, vacancy: { ...current.vacancy, stageIds: orderedIds }, stages: rows } : current
                );
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not reorder stages");
              }
            }}
          />
        )}
        {activeTab === "sources" && (
          <SourcesTab
            sources={sources}
            onAdd={async (name) => {
              try {
                const source = await addVacancySource(id, name);
                setEditData((current) => current ? { ...current, sources: [...current.sources, source] } : current);
                toast.success("Source added");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not add source");
              }
            }}
            onRemove={async (sourceId) => {
              try {
                await removeVacancySource(sourceId);
                setEditData((current) =>
                  current ? { ...current, sources: current.sources.filter((source) => source.id !== sourceId) } : current
                );
                toast.success("Source removed");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not remove source");
              }
            }}
          />
        )}
        {activeTab === "tasks" && (
          <div className="space-y-4 max-w-2xl">
            {/* Existing tasks */}
            {testTasks.length === 0 && !showAddTask ? (
              <div className="text-center py-8 text-muted text-body-sm">
                No test tasks yet. Add one below.
              </div>
            ) : (
              testTasks.map((task: TestTask) => (
                <div key={task.id} className="bg-surface border border-border rounded-xl p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm font-semibold text-text">{task.title}</p>
                    <p className="text-body-sm text-muted mt-1 leading-relaxed">{task.description}</p>
                    <p className="text-micro text-subtle mt-2">Due in {task.dueInDays} day{task.dueInDays !== 1 ? "s" : ""} of assignment</p>
                  </div>
                  <button
                    onClick={() => handleRemoveTestTask(task.id)}
                    className="shrink-0 text-subtle hover:text-danger transition-colors text-body-sm"
                  >✕</button>
                </div>
              ))
            )}

            {/* Add task form */}
            {showAddTask ? (
              <div className="bg-surface-2 border border-border rounded-xl p-4 space-y-3">
                <p className="text-body-sm font-semibold text-text">New test task</p>
                <div>
                  <label className="text-body-sm text-muted block mb-1">Title</label>
                  <input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
                    className="w-full bg-surface border border-border rounded-lg px-3 h-9 text-body-sm text-text outline-none focus:border-primary"
                    placeholder="e.g. Frontend Component Challenge" />
                </div>
                <div>
                  <label className="text-body-sm text-muted block mb-1">Description</label>
                  <textarea value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} rows={3}
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-body-sm text-text outline-none focus:border-primary resize-none"
                    placeholder="Describe the task in detail…" />
                </div>
                <div>
                  <label className="text-body-sm text-muted block mb-1">Due in (days from assignment)</label>
                  <input type="number" min={1} max={30} value={newTaskDays} onChange={e => setNewTaskDays(Number(e.target.value))}
                    className="w-24 bg-surface border border-border rounded-lg px-3 h-9 text-body-sm text-text outline-none focus:border-primary" />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      if (!newTaskTitle.trim()) return;
                      try {
                        const task = await createVacancyTestTask(id, {
                          title: newTaskTitle.trim(),
                          description: newTaskDesc.trim(),
                          dueInDays: newTaskDays,
                        });
                        setEditData((current) =>
                          current ? { ...current, testTasks: [...current.testTasks, task] } : current
                        );
                        setNewTaskTitle(""); setNewTaskDesc(""); setNewTaskDays(3); setShowAddTask(false);
                        toast.success("Test task saved");
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Could not save test task");
                      }
                    }}
                    className="h-8 px-4 bg-primary text-primary-fg text-body-sm font-medium rounded-lg"
                  >Save task</button>
                  <button onClick={() => setShowAddTask(false)}
                    className="h-8 px-4 bg-surface-2 text-muted text-body-sm rounded-lg">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAddTask(true)}
                className="w-full h-9 border border-dashed border-border rounded-xl text-body-sm text-muted hover:text-text hover:border-primary transition-colors">
                + Add test task
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Details Tab ──────────────────────────────────────────────────────────────

type VacancyPatch = Partial<
  Pick<
    Vacancy,
    | "title" | "department" | "workType" | "employmentType" | "location"
    | "salaryMin" | "salaryMax" | "description" | "status" | "language"
    | "responsibleHrId" | "introMessage" | "successMessage"
  >
>;

type DetailsForm = {
  title: string;
  department: string;
  workType: Vacancy["workType"];
  employmentType: Vacancy["employmentType"];
  location: string;
  salaryMin: string;
  salaryMax: string;
  description: string;
  language: Vacancy["language"];
  responsibleHrId: string;
  status: Vacancy["status"];
  introMessage: string;
  successMessage: string;
};

type DetailsErrors = Partial<Record<keyof DetailsForm, string>>;

function getDetailsForm(vacancy: Vacancy): DetailsForm {
  return {
    title: vacancy.title,
    department: vacancy.department,
    workType: vacancy.workType,
    employmentType: vacancy.employmentType,
    location: vacancy.location,
    salaryMin: String(vacancy.salaryMin),
    salaryMax: String(vacancy.salaryMax),
    description: vacancy.description,
    language: vacancy.language,
    responsibleHrId: vacancy.responsibleHrId,
    status: vacancy.status,
    introMessage: vacancy.introMessage ?? "",
    successMessage: vacancy.successMessage ?? "",
  };
}

function isValidSalary(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const amount = Number(trimmed);
  return Number.isFinite(amount) && amount >= 0;
}

function validateDetails(form: DetailsForm): DetailsErrors {
  const errors: DetailsErrors = {};
  const salaryMin = Number(form.salaryMin.trim());
  const salaryMax = Number(form.salaryMax.trim());

  if (!form.title.trim()) errors.title = "Job title is required.";
  if (!form.department.trim()) errors.department = "Department is required.";
  if (!form.location.trim()) errors.location = "Location is required.";
  if (!isValidSalary(form.salaryMin)) errors.salaryMin = "Enter a valid non-negative number.";
  if (!isValidSalary(form.salaryMax)) errors.salaryMax = "Enter a valid non-negative number.";
  if (!errors.salaryMin && !errors.salaryMax && salaryMin > salaryMax) {
    errors.salaryMin = "Minimum salary cannot be greater than maximum salary.";
    errors.salaryMax = "Maximum salary must be at least the minimum salary.";
  }

  return errors;
}

function DetailsTab({
  vacancy,
  users,
  activeApplicationCount,
  onSave,
  onConfirm,
}: {
  vacancy: Vacancy;
  users: User[];
  activeApplicationCount: number;
  onSave: (patch: VacancyPatch) => Promise<void>;
  onConfirm: (message: string, action: () => Promise<void>) => void;
}) {
  const [form, setForm] = useState<DetailsForm>(() => getDetailsForm(vacancy));
  const [submitted, setSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setForm(getDetailsForm(vacancy));
    setSubmitted(false);
  }, [vacancy]);

  const errors = validateDetails(form);
  const hasErrors = Object.keys(errors).length > 0;
  const savedForm = getDetailsForm(vacancy);
  const isDirty = (Object.keys(form) as Array<keyof DetailsForm>).some((key) => form[key] !== savedForm[key]);
  const showErrors = submitted && hasErrors;

  function updateField<K extends keyof DetailsForm>(field: K, value: DetailsForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleDiscard() {
    setForm(savedForm);
    setSubmitted(false);
  }

  async function savePatch(patch: VacancyPatch) {
    setIsSaving(true);
    try {
      await onSave(patch);
      toast.success("Saved");
      setSubmitted(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save changes");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSave() {
    setSubmitted(true);
    if (hasErrors) return;

    const patch: VacancyPatch = {
      title: form.title.trim(),
      department: form.department.trim(),
      workType: form.workType,
      employmentType: form.employmentType,
      location: form.location.trim(),
      salaryMin: Number(form.salaryMin.trim()),
      salaryMax: Number(form.salaryMax.trim()),
      description: form.description,
      status: form.status,
      language: form.language,
      responsibleHrId: form.responsibleHrId,
      introMessage: form.introMessage,
      successMessage: form.successMessage,
    };

    const needsConfirm =
      vacancy.status !== "closed" &&
      form.status === "closed" &&
      activeApplicationCount > 0;

    if (needsConfirm) {
      onConfirm(
        `Close this vacancy with ${activeApplicationCount} active application${activeApplicationCount === 1 ? "" : "s"}?`,
        () => savePatch(patch)
      );
    } else {
      await savePatch(patch);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {showErrors && (
        <div className="bg-warning-soft border border-warning/30 rounded-lg px-3 py-2">
          <p className="text-body-sm font-semibold text-warning">Fix the highlighted fields before saving.</p>
        </div>
      )}

      {/* Title */}
      <div>
        <label className={LABEL_CLS}>Job Title</label>
        <input
          className={INPUT_CLS}
          value={form.title}
          onChange={(e) => updateField("title", e.target.value)}
        />
        {submitted && errors.title && <p className="text-micro text-warning mt-1">{errors.title}</p>}
      </div>

      {/* Department + Location */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL_CLS}>Department</label>
          <input
            className={INPUT_CLS}
            value={form.department}
            onChange={(e) => updateField("department", e.target.value)}
          />
          {submitted && errors.department && <p className="text-micro text-warning mt-1">{errors.department}</p>}
        </div>
        <div>
          <label className={LABEL_CLS}>Location</label>
          <input
            className={INPUT_CLS}
            value={form.location}
            onChange={(e) => updateField("location", e.target.value)}
          />
          {submitted && errors.location && <p className="text-micro text-warning mt-1">{errors.location}</p>}
        </div>
      </div>

      {/* Work Type + Employment Type */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL_CLS}>Work Type</label>
          <select
            className={SELECT_CLS}
            value={form.workType}
            onChange={(e) => updateField("workType", e.target.value as DetailsForm["workType"])}
          >
            <option value="office">Office</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </div>
        <div>
          <label className={LABEL_CLS}>Employment Type</label>
          <select
            className={SELECT_CLS}
            value={form.employmentType}
            onChange={(e) => updateField("employmentType", e.target.value as DetailsForm["employmentType"])}
          >
            <option value="full-time">Full-time</option>
            <option value="part-time">Part-time</option>
            <option value="trial">Trial</option>
            <option value="internship">Internship</option>
          </select>
        </div>
      </div>

      {/* Salary */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL_CLS}>Salary Min</label>
          <input
            className={INPUT_CLS}
            type="number"
            min={0}
            value={form.salaryMin}
            onChange={(e) => updateField("salaryMin", e.target.value)}
          />
          {submitted && errors.salaryMin && <p className="text-micro text-warning mt-1">{errors.salaryMin}</p>}
        </div>
        <div>
          <label className={LABEL_CLS}>Salary Max</label>
          <input
            className={INPUT_CLS}
            type="number"
            min={0}
            value={form.salaryMax}
            onChange={(e) => updateField("salaryMax", e.target.value)}
          />
          {submitted && errors.salaryMax && <p className="text-micro text-warning mt-1">{errors.salaryMax}</p>}
        </div>
      </div>

      {/* Language + Status */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL_CLS}>Language</label>
          <select
            className={SELECT_CLS}
            value={form.language}
            onChange={(e) => updateField("language", e.target.value as DetailsForm["language"])}
          >
            <option value="uz">Uzbek</option>
            <option value="ru">Russian</option>
            <option value="en">English</option>
          </select>
        </div>
        <div>
          <label className={LABEL_CLS}>Status</label>
          <select
            className={SELECT_CLS}
            value={form.status}
            onChange={(e) => updateField("status", e.target.value as DetailsForm["status"])}
          >
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Responsible HR */}
      <div>
        <label className={LABEL_CLS}>Responsible HR</label>
        <select
          className={SELECT_CLS}
          value={form.responsibleHrId}
          onChange={(e) => updateField("responsibleHrId", e.target.value)}
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div>
        <label className={LABEL_CLS}>Description</label>
        <textarea
          className={TEXTAREA_CLS}
          rows={5}
          value={form.description}
          onChange={(e) => updateField("description", e.target.value)}
        />
      </div>

      {/* Intro Message */}
      <div>
        <label className={LABEL_CLS}>Intro Message</label>
        <textarea
          className={TEXTAREA_CLS}
          rows={3}
          value={form.introMessage}
          onChange={(e) => updateField("introMessage", e.target.value)}
        />
      </div>

      {/* Success Message */}
      <div>
        <label className={LABEL_CLS}>Success Message</label>
        <textarea
          className={TEXTAREA_CLS}
          rows={3}
          value={form.successMessage}
          onChange={(e) => updateField("successMessage", e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
        <p className="text-body-sm text-muted">
          {isDirty ? "Unsaved changes" : "All details are saved"}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDiscard}
            disabled={!isDirty}
            className="h-9 px-4 rounded-lg bg-surface-2 text-muted text-body-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:text-text transition-colors"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="h-9 px-4 rounded-lg bg-primary text-primary-fg text-body-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary-hover transition-colors"
          >
            {isSaving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Questions Tab ────────────────────────────────────────────────────────────

function QuestionsTab({
  questions,
  vacancyId,
  onAdd,
  onRemove,
  onUpdate,
  onReorder,
}: {
  questions: ScreeningQuestion[];
  vacancyId: string;
  onAdd: (q: { text: string; type: ScreeningQuestion["type"]; options?: string[] }) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Pick<ScreeningQuestion, "text" | "type" | "options">>) => void;
  onReorder: (orderedIds: string[]) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    text: string;
    type: ScreeningQuestion["type"];
    options: string;
  } | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [addDraft, setAddDraft] = useState<{
    text: string;
    type: ScreeningQuestion["type"];
    options: string;
  }>({ text: "", type: "short-text", options: "" });

  function openEdit(q: ScreeningQuestion) {
    setExpandedId(q.id);
    setEditDraft({
      text: q.text,
      type: q.type,
      options: q.options ? q.options.join(", ") : "",
    });
  }

  function saveEdit(q: ScreeningQuestion) {
    if (!editDraft) return;
    const patch: Partial<Pick<ScreeningQuestion, "text" | "type" | "options">> = {
      text: editDraft.text,
      type: editDraft.type,
    };
    if (editDraft.type === "single-choice") {
      patch.options = editDraft.options
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);
    } else {
      patch.options = undefined;
    }
    onUpdate(q.id, patch);
    setExpandedId(null);
    setEditDraft(null);
  }

  function move(index: number, dir: -1 | 1) {
    const ids = questions.map((q) => q.id);
    const target = index + dir;
    if (target < 0 || target >= ids.length) return;
    const next = [...ids];
    [next[index], next[target]] = [next[target], next[index]];
    onReorder(next);
  }

  function submitAdd() {
    if (!addDraft.text.trim()) return;
    const q: { text: string; type: ScreeningQuestion["type"]; options?: string[] } = {
      text: addDraft.text.trim(),
      type: addDraft.type,
    };
    if (addDraft.type === "single-choice") {
      q.options = addDraft.options
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);
    }
    onAdd(q);
    setAddDraft({ text: "", type: "short-text", options: "" });
    setShowAdd(false);
  }

  return (
    <div className="max-w-2xl space-y-3">
      {questions.length === 0 && !showAdd && (
        <EmptyState title="No questions yet" description="Add screening questions to qualify candidates." />
      )}

      {questions.map((q, i) => (
        <div key={q.id} className="bg-surface border border-border rounded-lg overflow-hidden">
          {/* Row */}
          <div
            className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-2 transition-colors"
            onClick={() => {
              if (expandedId === q.id) {
                setExpandedId(null);
                setEditDraft(null);
              } else {
                openEdit(q);
              }
            }}
          >
            <span className="text-micro text-muted w-5 text-center shrink-0">{i + 1}</span>
            <p className="flex-1 text-body-sm text-text line-clamp-1">{q.text}</p>
            <span className="text-micro px-2 h-5 rounded-full bg-accent-soft text-accent-fg inline-flex items-center shrink-0">
              {QUESTION_TYPE_LABELS[q.type]}
            </span>
            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              <IconButton
                title="Move up"
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                ↑
              </IconButton>
              <IconButton
                title="Move down"
                disabled={i === questions.length - 1}
                onClick={() => move(i, 1)}
              >
                ↓
              </IconButton>
              <IconButton
                title="Remove"
                onClick={() => {
                  if (expandedId === q.id) {
                    setExpandedId(null);
                    setEditDraft(null);
                  }
                  onRemove(q.id);
                }}
                danger
              >
                ×
              </IconButton>
            </div>
          </div>

          {/* Inline edit */}
          {expandedId === q.id && editDraft && (
            <div
              className="px-4 pb-4 border-t border-border space-y-3 pt-3 bg-surface-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <label className={LABEL_CLS}>Question text</label>
                <input
                  className={INPUT_CLS}
                  value={editDraft.text}
                  onChange={(e) => setEditDraft((d) => d && { ...d, text: e.target.value })}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Type</label>
                <select
                  className={SELECT_CLS}
                  value={editDraft.type}
                  onChange={(e) =>
                    setEditDraft((d) =>
                      d && { ...d, type: e.target.value as ScreeningQuestion["type"] }
                    )
                  }
                >
                  {QUESTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {QUESTION_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              {editDraft.type === "single-choice" && (
                <div>
                  <label className={LABEL_CLS}>Options (comma-separated)</label>
                  <input
                    className={INPUT_CLS}
                    placeholder="Option A, Option B, Option C"
                    value={editDraft.options}
                    onChange={(e) => setEditDraft((d) => d && { ...d, options: e.target.value })}
                  />
                </div>
              )}
              <div className="flex gap-2">
                <button
                  className="h-8 px-4 rounded-lg bg-primary text-primary-fg text-body-sm font-semibold hover:bg-primary-hover transition-colors"
                  onClick={() => saveEdit(q)}
                >
                  Save
                </button>
                <button
                  className="h-8 px-4 rounded-lg border border-border text-body-sm text-muted hover:text-text transition-colors"
                  onClick={() => {
                    setExpandedId(null);
                    setEditDraft(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Add question form */}
      {showAdd ? (
        <div className="bg-surface border border-border rounded-lg px-4 py-4 space-y-3">
          <div>
            <label className={LABEL_CLS}>Question text</label>
            <input
              className={INPUT_CLS}
              placeholder="e.g. How many years of experience do you have?"
              value={addDraft.text}
              onChange={(e) => setAddDraft((d) => ({ ...d, text: e.target.value }))}
              autoFocus
            />
          </div>
          <div>
            <label className={LABEL_CLS}>Type</label>
            <select
              className={SELECT_CLS}
              value={addDraft.type}
              onChange={(e) =>
                setAddDraft((d) => ({ ...d, type: e.target.value as ScreeningQuestion["type"] }))
              }
            >
              {QUESTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {QUESTION_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          {addDraft.type === "single-choice" && (
            <div>
              <label className={LABEL_CLS}>Options (comma-separated)</label>
              <input
                className={INPUT_CLS}
                placeholder="Option A, Option B, Option C"
                value={addDraft.options}
                onChange={(e) => setAddDraft((d) => ({ ...d, options: e.target.value }))}
              />
            </div>
          )}
          <div className="flex gap-2">
            <button
              className="h-8 px-4 rounded-lg bg-primary text-primary-fg text-body-sm font-semibold hover:bg-primary-hover transition-colors"
              onClick={submitAdd}
            >
              Add question
            </button>
            <button
              className="h-8 px-4 rounded-lg border border-border text-body-sm text-muted hover:text-text transition-colors"
              onClick={() => {
                setShowAdd(false);
                setAddDraft({ text: "", type: "short-text", options: "" });
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          className="h-9 px-4 rounded-lg border border-dashed border-border text-body-sm text-muted hover:border-primary hover:text-primary transition-colors w-full"
          onClick={() => setShowAdd(true)}
        >
          + Add question
        </button>
      )}
    </div>
  );
}

// ── Stages Tab ───────────────────────────────────────────────────────────────

function StagesTab({
  stages,
  vacancyId,
  onAdd,
  onUpdate,
  onRemove,
  onReorder,
}: {
  stages: VacancyStage[];
  vacancyId: string;
  onAdd: (s: { name: string; color: string; isFinal: boolean; isRejected: boolean }) => void;
  onUpdate: (id: string, patch: Partial<Pick<VacancyStage, "name" | "color" | "isFinal" | "isRejected" | "isReserve">>) => void;
  onRemove: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [addDraft, setAddDraft] = useState({ name: "", color: "new" });

  function move(index: number, dir: -1 | 1) {
    const ids = stages.map((s) => s.id);
    const target = index + dir;
    if (target < 0 || target >= ids.length) return;
    const next = [...ids];
    [next[index], next[target]] = [next[target], next[index]];
    onReorder(next);
  }

  function submitAdd() {
    if (!addDraft.name.trim()) return;
    onAdd({
      name: addDraft.name.trim(),
      color: addDraft.color,
      isFinal: false,
      isRejected: false,
    });
    setAddDraft({ name: "", color: "new" });
    setShowAdd(false);
  }

  return (
    <div className="max-w-2xl space-y-3">
      {stages.length === 0 && !showAdd && (
        <EmptyState title="No stages yet" description="Add pipeline stages to track candidate progress." />
      )}

      {stages.map((stage, i) => (
        <div
          key={stage.id}
          className="flex items-center gap-3 px-4 py-3 bg-surface border border-border rounded-lg"
        >
          <span
            className={`size-3 rounded-full shrink-0 ${STAGE_COLOR_MAP[stage.color] ?? "bg-gray-400"}`}
          />
          <p className="flex-1 text-body-sm text-text">{stage.name}</p>
          {stage.isFinal && (
            <span className="text-micro px-2 h-5 rounded-full bg-success-soft text-success inline-flex items-center shrink-0">
              Final
            </span>
          )}
          {stage.isRejected && (
            <span className="text-micro px-2 h-5 rounded-full bg-danger-soft text-danger inline-flex items-center shrink-0">
              Rejected
            </span>
          )}
          <div className="flex items-center gap-1 shrink-0">
            <IconButton title="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
              ↑
            </IconButton>
            <IconButton
              title="Move down"
              disabled={i === stages.length - 1}
              onClick={() => move(i, 1)}
            >
              ↓
            </IconButton>
            <IconButton
              title="Remove"
              disabled={stages.length <= 1}
              onClick={() => onRemove(stage.id)}
              danger
            >
              ×
            </IconButton>
          </div>
        </div>
      ))}

      {/* Add stage form */}
      {showAdd ? (
        <div className="bg-surface border border-border rounded-lg px-4 py-4 space-y-3">
          <div>
            <label className={LABEL_CLS}>Stage name</label>
            <input
              className={INPUT_CLS}
              placeholder="e.g. Technical Interview"
              value={addDraft.name}
              onChange={(e) => setAddDraft((d) => ({ ...d, name: e.target.value }))}
              autoFocus
            />
          </div>
          <div>
            <label className={LABEL_CLS}>Color</label>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {STAGE_COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  title={opt.key}
                  onClick={() => setAddDraft((d) => ({ ...d, color: opt.key }))}
                  className={`size-7 rounded-full transition-all ${opt.bg} ${
                    addDraft.color === opt.key
                      ? "ring-2 ring-offset-2 ring-primary"
                      : "opacity-70 hover:opacity-100"
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              className="h-8 px-4 rounded-lg bg-primary text-primary-fg text-body-sm font-semibold hover:bg-primary-hover transition-colors"
              onClick={submitAdd}
            >
              Add stage
            </button>
            <button
              className="h-8 px-4 rounded-lg border border-border text-body-sm text-muted hover:text-text transition-colors"
              onClick={() => {
                setShowAdd(false);
                setAddDraft({ name: "", color: "new" });
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          className="h-9 px-4 rounded-lg border border-dashed border-border text-body-sm text-muted hover:border-primary hover:text-primary transition-colors w-full"
          onClick={() => setShowAdd(true)}
        >
          + Add stage
        </button>
      )}
    </div>
  );
}

// ── Sources Tab ──────────────────────────────────────────────────────────────

function SourcesTab({
  sources,
  onAdd,
  onRemove,
}: {
  sources: Source[];
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrModalSource, setQrModalSource] = useState<Source | null>(null);

  function copyLink(id: string, link: string) {
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }

  function submitAdd() {
    if (!name.trim()) return;
    onAdd(name.trim());
    setName("");
    setShowAdd(false);
  }

  return (
    <div className="max-w-2xl space-y-3">
      {/* QR Code Modal */}
      {qrModalSource && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setQrModalSource(null)}
        >
          <div
            className="bg-bg border border-border rounded-2xl p-6 flex flex-col items-center gap-4 shadow-xl max-w-xs w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-body-sm font-semibold text-text">{qrModalSource.name}</p>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrModalSource.botLink)}`}
              alt="QR code"
              width={200}
              height={200}
              className="rounded-lg"
            />
            <p className="text-micro text-subtle font-mono text-center break-all">{qrModalSource.botLink}</p>
            <button
              onClick={() => setQrModalSource(null)}
              className="h-9 px-6 rounded-lg bg-surface-2 text-muted text-body-sm hover:text-text transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {sources.length === 0 && !showAdd && (
        <EmptyState title="No sources yet" description="Add sources to track where candidates come from." />
      )}

      {sources.map((src) => (
        <div
          key={src.id}
          className="flex items-center gap-3 px-4 py-3 bg-surface border border-border rounded-lg"
        >
          <p className="text-body-sm text-text font-medium w-36 shrink-0 truncate">{src.name}</p>
          <p className="flex-1 text-body-sm text-subtle font-mono truncate" title={src.botLink}>
            {src.botLink}
          </p>
          <button
            title="Show QR code"
            onClick={() => setQrModalSource(src)}
            className="text-body-sm text-muted hover:text-primary transition-colors shrink-0 px-2"
          >
            QR Code
          </button>
          <button
            title="Copy bot link"
            onClick={() => copyLink(src.id, src.botLink)}
            className="text-body-sm text-muted hover:text-primary transition-colors shrink-0 px-2"
          >
            {copiedId === src.id ? "Copied!" : "Copy"}
          </button>
          <IconButton title="Remove" onClick={() => onRemove(src.id)} danger>
            ×
          </IconButton>
        </div>
      ))}

      {/* Add source form */}
      {showAdd ? (
        <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-4 py-3">
          <input
            className={INPUT_CLS}
            placeholder="Source name (e.g. LinkedIn, OLX)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitAdd();
              if (e.key === "Escape") {
                setShowAdd(false);
                setName("");
              }
            }}
            autoFocus
          />
          <button
            className="h-9 px-4 rounded-lg bg-primary text-primary-fg text-body-sm font-semibold hover:bg-primary-hover transition-colors shrink-0"
            onClick={submitAdd}
          >
            Add
          </button>
          <button
            className="h-9 px-3 rounded-lg border border-border text-body-sm text-muted hover:text-text transition-colors shrink-0"
            onClick={() => {
              setShowAdd(false);
              setName("");
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          className="h-9 px-4 rounded-lg border border-dashed border-border text-body-sm text-muted hover:border-primary hover:text-primary transition-colors w-full"
          onClick={() => setShowAdd(true)}
        >
          + Add source
        </button>
      )}
    </div>
  );
}

// ── Shared ────────────────────────────────────────────────────────────────────

function IconButton({
  children,
  onClick,
  title,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`size-7 rounded flex items-center justify-center text-body-sm transition-colors ${
        disabled
          ? "text-disabled cursor-not-allowed"
          : danger
          ? "text-muted hover:text-danger hover:bg-danger-soft"
          : "text-muted hover:text-text hover:bg-surface-2"
      }`}
    >
      {children}
    </button>
  );
}
