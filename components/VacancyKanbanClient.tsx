"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { KanbanBoardClient } from "@/components/KanbanBoardClient";
import { ApplicationSearch } from "@/components/ApplicationSearch";
import { formatSalary } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";
import { ExportModal } from "@/components/export/ExportModal";
import { SourcesTab } from "@/components/vacancies/SourcesTab";
import { getSourcePerformance, type SourcePerformanceRow } from "@/app/actions/sources";
import type { ExportRow } from "@/lib/export/types";
import type { TestTask } from "@/lib/types";

const WORK_TYPE_LABELS: Record<string, string> = { office: "Office", remote: "Remote", hybrid: "Hybrid" };
const EMP_TYPE_LABELS: Record<string, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  trial: "Trial",
  internship: "Internship",
};
const STATUS_STYLES: Record<string, string> = {
  active: "bg-success-soft text-success",
  paused: "bg-warning-soft text-warning",
  closed: "bg-surface-3 text-muted",
};
const STAGE_DOT: Record<string, string> = {
  new: "bg-gray-400",
  screening: "bg-blue-500",
  qualified: "bg-violet-500",
  test: "bg-amber-500",
  interview: "bg-orange-500",
  hired: "bg-green-500",
  rejected: "bg-red-500",
};
const TRIGGER_LABEL: Record<string, string> = {
  stage_entered: "Stage entered",
  application_submitted: "Application submitted",
};
const ACTION_LABEL: Record<string, string> = {
  send_message: "Send message",
  move_to_stage: "Move to stage",
};

type DbVacancy = {
  id: string;
  title: string;
  department: string;
  workType: string;
  employmentType: string;
  location: string;
  salaryMin: number;
  salaryMax: number;
  description: string;
  status: string;
  language: string;
  responsibleHrId: string | null;
  stageIds: string[] | null;
  createdAt: Date;
  introMessage: string | null;
  successMessage: string | null;
};

type DbStage = {
  id: string;
  vacancyId: string;
  name: string;
  color: string;
  isFinal: boolean;
  isRejected: boolean;
  orderIndex: number;
};

type DbAppRow = {
  application: {
    id: string;
    candidateId: string;
    vacancyId: string;
    currentStageId: string;
    status: string;
    appliedAt: Date;
    lastActivityAt: Date;
  };
  candidate: {
    id: string;
    fullName: string;
    phone: string;
    telegramUsername: string;
    telegramFirstName: string;
    telegramUserId: string | null;
    language: string;
    city: string;
    createdAt: Date;
  };
  sourceName?: string | null;
};

type Props = {
  vacancy: DbVacancy;
  stages: DbStage[];
  appRows: DbAppRow[];
};

export function VacancyKanbanClient({ vacancy, stages, appRows }: Props) {
  const id = vacancy.id;

  const users = useStore((s) => s.users);
  const sendBatchMessage = useStore((s) => s.sendBatchMessage);
  const getAutomationsForVacancy = useStore((s) => s.getAutomationsForVacancy);
  const getTestTasksForVacancy = useStore((s) => s.getTestTasksForVacancy);
  const toggleAutomation = useStore((s) => s.toggleAutomation);
  const removeAutomation = useStore((s) => s.removeAutomation);
  const createTestTask = useStore((s) => s.createTestTask);
  const removeTestTask = useStore((s) => s.removeTestTask);
  const storeApplications = useStore((s) => s.applications);
  const timeline = useStore((s) => s.timeline);
  const messages = useStore((s) => s.messages);

  const [activeTab, setActiveTab] = useState<"pipeline" | "tasks" | "automations" | "analytics" | "sources">("pipeline");
  const [filteredAppRows, setFilteredAppRows] = useState<typeof appRows>(appRows);
  const [selectedAppIds, setSelectedAppIds] = useState<Set<string>>(new Set());
  const [batchMsgText, setBatchMsgText] = useState("");
  const [sent, setSent] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskDays, setTaskDays] = useState<number>(7);
  const [sourceDays, setSourceDays] = useState<number>(30);
  const [sourcePerf, setSourcePerf] = useState<SourcePerformanceRow[]>([]);
  const [sourcePerfLoading, setSourcePerfLoading] = useState(false);

  const router = useRouter();

  // Build export rows from existing appRows prop (no extra server call needed)
  const exportRows: ExportRow[] = appRows.map(({ application: app, candidate: cand }) => {
    const stage = stages.find((s) => s.id === app.currentStageId);
    const appliedAt = app.appliedAt ? new Date(app.appliedAt) : null;
    const lastActivityAt = app.lastActivityAt ? new Date(app.lastActivityAt) : null;
    return {
      // dateKey used for filtering — keep as ISO so the modal can parse it
      _appliedAtIso: appliedAt?.toISOString() ?? "",
      name: cand.fullName,
      phone: cand.phone ?? "",
      telegram: cand.telegramUsername ? `@${cand.telegramUsername}` : "",
      stage: stage?.name ?? "",
      stageColor: stage?.color ?? "",
      status: app.status ?? "",
      appliedAt: appliedAt ? appliedAt.toLocaleDateString("en-GB") : "",
      lastActivityAt: lastActivityAt ? lastActivityAt.toLocaleDateString("en-GB") : "",
    };
  });

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const timerId = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(timerId);
  }, [router]);

  // Fetch source performance when analytics tab is active
  useEffect(() => {
    if (activeTab !== "analytics") return;
    setSourcePerfLoading(true);
    getSourcePerformance({ vacancyId: id, days: sourceDays })
      .then((rows) => { setSourcePerf(rows); setSourcePerfLoading(false); })
      .catch(() => setSourcePerfLoading(false));
  }, [activeTab, id, sourceDays]);

  const hr = users.find((u) => u.id === vacancy.responsibleHrId);
  const total = appRows.length;

  const automations = getAutomationsForVacancy(id);
  const testTasks = getTestTasksForVacancy(id);

  // Analytics: use DB-sourced appRows for counts
  const vacancyApplications = appRows.map((r) => ({
    ...r.application,
    appliedAt: r.application.appliedAt instanceof Date ? r.application.appliedAt.toISOString() : String(r.application.appliedAt),
    lastActivityAt: r.application.lastActivityAt instanceof Date ? r.application.lastActivityAt.toISOString() : String(r.application.lastActivityAt),
  }));

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const vacancyAppIds = new Set(vacancyApplications.map((a) => a.id));
  const recentApps = vacancyApplications.filter((a) => a.appliedAt >= sevenDaysAgo);
  const recentStageMoves = timeline.filter(
    (t) => vacancyAppIds.has(t.applicationId) && t.type === "stage_changed" && t.createdAt >= sevenDaysAgo
  );
  const recentMessages = messages.filter(
    (m) => m.applicationId != null && vacancyAppIds.has(m.applicationId) && m.sentAt >= sevenDaysAgo
  );
  const hiredStage = stages.find((s) => s.isFinal && !s.isRejected);
  const hiredCount = hiredStage
    ? vacancyApplications.filter((a) => a.currentStageId === hiredStage.id).length
    : 0;
  const conversionPct =
    vacancyApplications.length > 0 ? Math.round((hiredCount / vacancyApplications.length) * 100) : 0;
  const maxStageCount = Math.max(
    1,
    ...stages.map(
      (s) => vacancyApplications.filter((a) => a.currentStageId === s.id).length
    )
  );

  function handleSaveTask() {
    if (!taskTitle.trim()) return;
    createTestTask(id, {
      title: taskTitle.trim(),
      description: taskDesc.trim(),
      dueInDays: taskDays,
    });
    setTaskTitle("");
    setTaskDesc("");
    setTaskDays(7);
    setShowAddTask(false);
  }

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* Header */}
      <div className="px-8 py-5 border-b border-border bg-surface/95 backdrop-blur sticky top-0 z-10 shadow-xs">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Link href="/vacancies" className="text-body-sm text-muted hover:text-text transition-colors">
                ← Vacancies
              </Link>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-h1 text-text break-words">{vacancy.title}</h1>
              <span
                className={`text-micro px-2 h-5 rounded-full inline-flex items-center font-semibold ${STATUS_STYLES[vacancy.status] ?? "bg-surface-3 text-muted"}`}
              >
                {vacancy.status.charAt(0).toUpperCase() + vacancy.status.slice(1)}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-body-sm text-muted">{vacancy.department}</span>
              <span className="text-subtle">/</span>
              <span className="text-body-sm text-muted">{WORK_TYPE_LABELS[vacancy.workType] ?? vacancy.workType}</span>
              <span className="text-subtle">/</span>
              <span className="text-body-sm text-muted">{EMP_TYPE_LABELS[vacancy.employmentType] ?? vacancy.employmentType}</span>
              <span className="text-subtle">/</span>
              <span className="text-body-sm text-muted">{vacancy.location}</span>
              <span className="text-body-sm font-medium text-text bg-surface-2 rounded-full px-2.5 py-0.5">{formatSalary(vacancy.salaryMin, vacancy.salaryMax)}</span>
              <span className="text-body-sm text-muted">HR: {hr?.name ?? "–"}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
            <button
              onClick={() => setExportOpen(true)}
              className="flex items-center gap-1.5 border border-border bg-surface-elevated text-body-sm font-medium text-text px-3 py-1.5 rounded-lg shadow-xs hover:bg-surface-2 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
              Export
            </button>
            <div className="text-right rounded-xl bg-surface-2 px-3 py-2 min-w-20">
              <div className="text-h2 text-text font-bold">{total}</div>
              <div className="text-micro text-muted">candidates</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border px-8 bg-surface/95 overflow-x-auto">
        {(
          [
            { id: "pipeline", label: "Pipeline", badge: total },
            { id: "tasks", label: "Tasks", badge: testTasks.length || undefined },
            { id: "automations", label: "Automations", badge: automations.filter((a) => a.isEnabled).length || undefined },
            { id: "analytics", label: "Analytics", badge: undefined },
            { id: "sources", label: "Sources", badge: undefined },
          ] as Array<{ id: typeof activeTab; label: string; badge: number | undefined }>
        ).map(({ id: tabId, label, badge }) => (
          <button
            key={tabId}
            onClick={() => setActiveTab(tabId)}
            className={`h-11 px-4 text-body-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tabId
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-text"
            }`}
          >
            {label}
            {badge != null && (
              <span className="ml-1.5 text-micro px-1.5 h-4 rounded-full inline-flex items-center bg-surface-2 text-muted">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Pipeline tab */}
      {activeTab === "pipeline" && (
        <>
          <ApplicationSearch
            appRows={appRows}
            stages={stages}
            onFilter={setFilteredAppRows}
          />
          <div className="flex-1 overflow-x-auto px-8 py-6">
            <KanbanBoardClient
              vacancyId={id}
              filteredAppIds={new Set(filteredAppRows.map((r) => r.application.id))}
              selectedAppIds={selectedAppIds}
              onToggleSelect={(appId) => {
                setSelectedAppIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(appId)) next.delete(appId);
                  else next.add(appId);
                  return next;
                });
              }}
            />
          </div>
          {selectedAppIds.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-surface-elevated border border-border rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3 min-w-[480px] max-w-[calc(100vw-48px)]">
              <span className="text-body-sm font-semibold text-text whitespace-nowrap">
                {selectedAppIds.size} selected
              </span>
              <input
                type="text"
                placeholder="Type a message…"
                value={batchMsgText}
                onChange={(e) => setBatchMsgText(e.target.value)}
                className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2 text-body-sm text-text outline-none focus:border-primary"
              />
              <button
                onClick={() => {
                  if (!batchMsgText.trim()) return;
                  sendBatchMessage([...selectedAppIds], batchMsgText.trim());
                  setBatchMsgText("");
                  setSelectedAppIds(new Set());
                  setSent(true);
                  setTimeout(() => setSent(false), 2000);
                }}
                className="shrink-0 bg-primary text-primary-fg text-body-sm font-semibold px-3 py-2 rounded-lg hover:opacity-90 transition-opacity"
              >
                {sent ? "Sent!" : "Send to all"}
              </button>
              <button
                onClick={() => setSelectedAppIds(new Set())}
                className="shrink-0 text-body-sm text-muted hover:text-text transition-colors"
              >
                ✕ Clear
              </button>
            </div>
          )}
        </>
      )}

      {/* Tasks tab */}
      {activeTab === "tasks" && (
        <div className="overflow-y-auto flex-1">
          <div className="px-8 py-6 max-w-[720px]">
            {testTasks.length === 0 && !showAddTask && (
              <EmptyState
                title="No test tasks"
                description="Add test tasks that can be assigned to candidates during the hiring process."
              />
            )}
            {testTasks.length > 0 && (
              <div className="flex flex-col gap-3 mb-4">
                {testTasks.map((task: TestTask) => (
                  <div key={task.id} className="bg-surface-elevated border border-border rounded-xl px-4 py-4 flex items-start gap-4 shadow-xs">
                    <div className="flex-1 min-w-0">
                      <div className="text-body-sm font-semibold text-text">{task.title}</div>
                      {task.description && (
                        <div className="text-body-sm text-muted mt-1">{task.description}</div>
                      )}
                      <div className="mt-2">
                        <span className="text-micro px-2 h-5 rounded-full inline-flex items-center bg-surface-2 text-muted">
                          Due in {task.dueInDays} day{task.dueInDays !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeTestTask(task.id)}
                      className="shrink-0 text-micro text-muted hover:text-danger transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            {showAddTask ? (
              <div className="bg-surface-elevated border border-border rounded-xl px-4 py-4 flex flex-col gap-3 shadow-sm">
                <input
                  type="text"
                  placeholder="Task title"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-body-sm text-text outline-none focus:border-primary"
                />
                <textarea
                  placeholder="Description (optional)"
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  rows={3}
                  className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-body-sm text-text outline-none focus:border-primary resize-none"
                />
                <div className="flex items-center gap-2">
                  <label className="text-body-sm text-muted whitespace-nowrap">Due in</label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={taskDays}
                    onChange={(e) => setTaskDays(Math.max(1, Number(e.target.value)))}
                    className="w-20 bg-surface-2 border border-border rounded-lg px-3 py-2 text-body-sm text-text outline-none focus:border-primary"
                  />
                  <span className="text-body-sm text-muted">days</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveTask}
                    className="bg-primary text-primary-fg text-body-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setShowAddTask(false);
                      setTaskTitle("");
                      setTaskDesc("");
                      setTaskDays(7);
                    }}
                    className="text-body-sm text-muted hover:text-text transition-colors px-4 py-2"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddTask(true)}
                className="text-body-sm text-primary hover:opacity-80 transition-opacity font-medium"
              >
                + Add test task
              </button>
            )}
          </div>
        </div>
      )}

      {/* Automations tab */}
      {activeTab === "automations" && (
        <div className="overflow-y-auto flex-1">
          <div className="px-8 py-6 max-w-[720px]">
            {automations.length === 0 && (
              <EmptyState title="No automations" description="No automation rules are configured for this vacancy." />
            )}
            {automations.length > 0 && (
              <div className="flex flex-col gap-3 mb-6">
                {automations.map((rule) => (
                  <div key={rule.id} className="bg-surface-elevated border border-border rounded-xl px-4 py-4 flex items-center gap-4 shadow-xs">
                    <button
                      onClick={() => toggleAutomation(rule.id)}
                      className={`relative shrink-0 w-9 h-5 rounded-full transition-colors ${
                        rule.isEnabled ? "bg-primary" : "bg-surface-3"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                          rule.isEnabled ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-body-sm font-semibold text-text">{rule.name}</div>
                      <div className="text-body-sm text-muted mt-0.5">
                        {TRIGGER_LABEL[rule.triggerType]} → {ACTION_LABEL[rule.actionType]}
                      </div>
                    </div>
                    <button
                      onClick={() => removeAutomation(rule.id)}
                      className="shrink-0 text-micro text-muted hover:text-danger transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            <Link
              href="/automations"
              className="text-body-sm text-primary hover:opacity-80 transition-opacity font-medium"
            >
              Manage all automations →
            </Link>
          </div>
        </div>
      )}

      {/* Analytics tab */}
      {activeTab === "analytics" && (
        <div className="overflow-y-auto flex-1">
          <div className="px-8 py-6 max-w-[720px]">
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-surface-elevated border border-border rounded-xl px-4 py-4 shadow-xs">
                <div className="text-micro text-muted mb-1">Total Applied</div>
                <div className="text-h2 text-text font-bold">{vacancyApplications.length}</div>
              </div>
              <div className="bg-surface-elevated border border-border rounded-xl px-4 py-4 shadow-xs">
                <div className="text-micro text-muted mb-1">Hired</div>
                <div className="text-h2 text-text font-bold">{hiredCount}</div>
              </div>
              <div className="bg-surface-elevated border border-border rounded-xl px-4 py-4 shadow-xs">
                <div className="text-micro text-muted mb-1">Conversion</div>
                <div className="text-h2 text-text font-bold">{conversionPct}%</div>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-body-sm font-semibold text-text mb-3">Funnel by stage</h3>
              {stages.length === 0 ? (
                <p className="text-body-sm text-muted">No stages configured.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {stages.map((stage) => {
                    const count = vacancyApplications.filter((a) => a.currentStageId === stage.id).length;
                    const pct = maxStageCount > 0 ? Math.round((count / maxStageCount) * 100) : 0;
                    const dotClass = STAGE_DOT[stage.color] ?? "bg-gray-400";
                    return (
                      <div key={stage.id} className="flex items-center gap-3">
                        <span className={`shrink-0 w-2.5 h-2.5 rounded-full ${dotClass}`} />
                        <span className="text-body-sm text-muted w-28 truncate">{stage.name}</span>
                        <div className="flex-1 bg-surface-2 rounded-full h-2">
                          <div className={`h-2 rounded-full ${dotClass}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-body-sm text-muted w-6 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-body-sm font-semibold text-text mb-3">Last 7 days</h3>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-body-sm text-muted">New applications</span>
                  <span className="text-body-sm font-semibold text-text">{recentApps.length}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-body-sm text-muted">Stage moves</span>
                  <span className="text-body-sm font-semibold text-text">{recentStageMoves.length}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-body-sm text-muted">Messages sent</span>
                  <span className="text-body-sm font-semibold text-text">{recentMessages.length}</span>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-body-sm font-semibold text-text">Source Performance</h3>
                <div className="flex items-center gap-1 text-body-sm">
                  {([7, 30, 90, 0] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSourceDays(d)}
                      className={`px-2.5 py-1 rounded-md text-micro font-medium transition-colors ${
                        sourceDays === d
                          ? "bg-primary text-primary-fg"
                          : "text-muted hover:text-text hover:bg-surface-2"
                      }`}
                    >
                      {d === 0 ? "All" : `${d}d`}
                    </button>
                  ))}
                </div>
              </div>
              {sourcePerfLoading ? (
                <p className="text-body-sm text-muted">Loading…</p>
              ) : sourcePerf.length === 0 ? (
                <p className="text-body-sm text-muted">
                  No source data for this vacancy yet. Add sources in the Sources tab to start tracking.
                </p>
              ) : (
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-body-sm">
                    <thead>
                      <tr className="bg-surface-2 border-b border-border">
                        <th className="text-left px-3 py-2 font-medium text-muted">Source</th>
                        <th className="text-right px-3 py-2 font-medium text-muted">Views</th>
                        <th className="text-right px-3 py-2 font-medium text-muted">Submitted</th>
                        <th className="text-right px-3 py-2 font-medium text-muted">Sub %</th>
                        <th className="text-right px-3 py-2 font-medium text-muted">Hire %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sourcePerf.map((row, i) => {
                        const subRate = row.total > 0 ? (row.submitted / row.total * 100).toFixed(1) : "0.0";
                        return (
                          <tr
                            key={`${row.sourceId}-${row.vacancyId}`}
                            className={`border-b border-border last:border-0 ${i % 2 === 1 ? "bg-surface-2" : ""}`}
                          >
                            <td className="px-3 py-2 font-medium text-text">{row.sourceName}</td>
                            <td className="px-3 py-2 text-right text-muted">{row.total}</td>
                            <td className="px-3 py-2 text-right text-muted">{row.submitted}</td>
                            <td className="px-3 py-2 text-right text-muted">{subRate}%</td>
                            <td className="px-3 py-2 text-right text-muted">—</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sources tab */}
      {activeTab === "sources" && (
        <SourcesTab vacancyId={id} />
      )}

      <ExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        data={exportRows}
        dateKey="_appliedAtIso"
        columnLabels={{
          name: "col_name",
          phone: "col_phone",
          telegram: "col_telegram",
          stage: "col_stage",
          status: "col_status",
          appliedAt: "col_appliedAt",
          lastActivityAt: "col_lastActivityAt",
        }}
        categoryKey="stageColor"
        categoryOptions={["new","screening","qualified","test","interview","hired","rejected"]}
        filename={`${vacancy.title}-applications-${new Date().toISOString().slice(0, 10)}`}
        sheetName="Applications"
      />
    </div>
  );
}
