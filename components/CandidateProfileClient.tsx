"use client";
import { type ReactNode, useState, useRef, useEffect, Suspense, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Pencil } from "lucide-react";
import { useStore } from "@/lib/store";
import { sendMessageToCandidate } from "@/app/actions/messages";
import { moveApplicationToStage as moveApplicationToStageAction } from "@/app/actions/applications";
import { updateCandidateAnketa, type CandidateAnketaInput } from "@/app/actions/candidate-actions";
import { listSourcesForVacancy, setApplicationSource } from "@/app/actions/sources";
import { addVacancySource } from "@/app/actions/vacancies";
import { Avatar } from "@/components/Avatar";
import { StagePill } from "@/components/StagePill";
import { ScreeningAnswerRow } from "@/components/ScreeningAnswerRow";
import { TimelineEntry } from "@/components/TimelineEntry";
import { ChatBubble } from "@/components/ChatBubble";
import { NoteCard } from "@/components/NoteCard";
import { EmptyState } from "@/components/EmptyState";
import { Dialog } from "@/components/ui/Dialog";
import { KbdHint } from "@/components/ui/KbdHint";
import { CandidateActionControls } from "@/components/candidates/CandidateActionControls";
import { AnketaTab } from "@/components/candidates/AnketaTab";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import { formatRelativeTime, daysAgo } from "@/lib/utils";
import type { Application, Candidate, TestTaskAssignment, TelegramMessage, InternalNote, User, TimelineEvent, Source } from "@/lib/types";

type Tab = "activity" | "anketa" | "chat" | "notes" | "tasks" | "screening" | "timeline" | "conversation";

export type ConversationMessage = {
  id: string;
  candidateId: string;
  applicationId?: string | null;
  direction: "inbound" | "outbound";
  senderType: "candidate" | "hr" | "system";
  senderName?: string | null;
  text: string;
  sentAt: Date | string;
  readByUserIds: string[] | null;
  attachmentFileId?: string | null;
  attachmentType?: "photo" | "document" | null;
  attachmentFilename?: string | null;
};

type ActivityItem =
  | { kind: "message"; ts: string; msg: TelegramMessage }
  | { kind: "timeline"; ts: string; event: TimelineEvent }
  | { kind: "note"; ts: string; note: InternalNote; author?: User };

type WorkExperienceFormRow = {
  company: string;
  position: string;
  period: string;
  leaveReason: string;
};

type AnketaFormState = {
  fullName: string;
  phone: string;
  city: string;
  dateOfBirth: string | null;
  address: string | null;
  maritalStatus: string | null;
  isStudent: boolean | null;
  educationField: string | null;
  englishLevel: string | null;
  russianLevel: string | null;
  workExperience: WorkExperienceFormRow[];
  departmentId: string | null;
  profileCompleted: boolean;
  languagePref: "" | "uz" | "en" | "ru" | null;
};

const MARITAL_STATUS_OPTIONS = [
  { value: "", label: "Not recorded" },
  { value: "single", label: "Single" },
  { value: "married", label: "Married" },
  { value: "divorced", label: "Divorced" },
  { value: "other", label: "Other" },
];

const LANGUAGE_LEVEL_OPTIONS = [
  { value: "", label: "Not recorded" },
  { value: "none", label: "None" },
  { value: "a1_a2", label: "A1-A2" },
  { value: "b1_b2", label: "B1-B2" },
  { value: "c1_c2", label: "C1-C2" },
  { value: "native", label: "Native" },
];

const LANGUAGE_OPTIONS = [
  { value: "", label: "Not recorded" },
  { value: "uz", label: "Uzbek" },
  { value: "en", label: "English" },
  { value: "ru", label: "Russian" },
];

function ProfileContent({
  applicationId,
  initialConversation,
  initialApplication,
  initialCandidate,
  initialTimeline,
  sourceName,
  initialSourceId,
}: {
  applicationId: string;
  initialConversation: ConversationMessage[];
  initialApplication?: Application;
  initialCandidate?: Candidate;
  initialTimeline?: TimelineEvent[];
  sourceName?: string | null;
  initialSourceId?: string | null;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = (searchParams.get("tab") as Tab) ?? "activity";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [chatInput, setChatInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [sendPending, startSendTransition] = useTransition();
  const [movePending, startMoveTransition] = useTransition();
  const [sendError, setSendError] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [commentStageId, setCommentStageId] = useState<string | null>(null);
  const [stageComment, setStageComment] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [isAnketaOpen, setIsAnketaOpen] = useState(false);
  const [anketaForm, setAnketaForm] = useState<AnketaFormState>(() => createEmptyAnketaForm());
  const [anketaError, setAnketaError] = useState<string | null>(null);
  const [candidateOverrides, setCandidateOverrides] = useState<Partial<Candidate> | null>(null);
  const [anketaPending, startAnketaTransition] = useTransition();
  // Source editing state
  const [isSourceOpen, setIsSourceOpen] = useState(false);
  const [currentSourceId, setCurrentSourceId] = useState<string | null>(initialSourceId ?? null);
  const [currentSourceName, setCurrentSourceName] = useState<string | null>(sourceName ?? null);
  const [sourcePending, startSourceTransition] = useTransition();
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [availableSources, setAvailableSources] = useState<Source[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string>("");
  const [newSourceName, setNewSourceName] = useState("");
  const [showNewSourceInput, setShowNewSourceInput] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const applications = useStore((s) => s.applications);
  const stages = useStore((s) => s.stages);
  const vacancies = useStore((s) => s.vacancies);
  const users = useStore((s) => s.users);
  const currentUserId = useStore((s) => s.currentUserId);
  const getCandidateForApplication = useStore((s) => s.getCandidateForApplication);
  const getAnswersForApplication = useStore((s) => s.getAnswersForApplication);
  const getTimelineForApplication = useStore((s) => s.getTimelineForApplication);
  const getMessagesForApplication = useStore((s) => s.getMessagesForApplication);
  const getNotesForApplication = useStore((s) => s.getNotesForApplication);
  const moveApplicationToStage = useStore((s) => s.moveApplicationToStage);
  const sendMessage = useStore((s) => s.sendMessage);
  const simulateIncomingMessage = useStore((s) => s.simulateIncomingMessage);
  const addNote = useStore((s) => s.addNote);
  const togglePinNote = useStore((s) => s.togglePinNote);
  const markConversationRead = useStore((s) => s.markConversationRead);
  const getTestTasksForVacancy = useStore((s) => s.getTestTasksForVacancy);
  const getTestTaskAssignmentsForApplication = useStore((s) => s.getTestTaskAssignmentsForApplication);
  const assignTestTask = useStore((s) => s.assignTestTask);
  const updateTestTaskAssignment = useStore((s) => s.updateTestTaskAssignment);

  const application = applications.find((a) => a.id === applicationId) ?? initialApplication;
  const storeCandidate = getCandidateForApplication(applicationId);
  const baseCandidate = storeCandidate ?? initialCandidate;
  const candidate = baseCandidate ? { ...baseCandidate, ...candidateOverrides } : undefined;
  const answers = getAnswersForApplication(applicationId);
  const timeline = getTimelineForApplication(applicationId).length > 0
    ? getTimelineForApplication(applicationId)
    : initialTimeline ?? [];
  const messages = getMessagesForApplication(applicationId);
  const notes = getNotesForApplication(applicationId);

  useEffect(() => {
    setCandidateOverrides(null);
    setIsAnketaOpen(false);
    setAnketaError(null);
  }, [applicationId, initialCandidate?.id]);

  const unreadCount = messages.filter(
    (m) => m.direction === "inbound" && !m.readByUserIds.includes(currentUserId)
  ).length;

  const vacancyStages = application
    ? stages.filter((s) => s.vacancyId === application.vacancyId).sort((a, b) => a.orderIndex - b.orderIndex)
    : [];

  useKeyboardShortcuts(
    Object.fromEntries(
      vacancyStages.slice(0, 9).map((stage, i) => [
        String(i + 1),
        () => requestStageMove(stage.id),
      ])
    )
  );

  useEffect(() => {
    if (activeTab === "chat") markConversationRead(applicationId);
  }, [activeTab, applicationId, markConversationRead]);

  useEffect(() => {
    if (activeTab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeTab]);

  if (!application || !candidate) {
    return (
      <div className="px-8 py-8">
        <EmptyState title="Candidate not found" description="This application does not exist." />
      </div>
    );
  }

  const vacancy = vacancies.find((v) => v.id === application.vacancyId);
  const availableTasks = vacancy ? getTestTasksForVacancy(vacancy.id) : [];
  const taskAssignments = getTestTaskAssignmentsForApplication(applicationId);
  const currentStage = stages.find((s) => s.id === application.currentStageId);

  const assignedTaskIds = new Set(taskAssignments.map((a) => a.task.id));
  const unassignedTasks = availableTasks.filter((t) => !assignedTaskIds.has(t.id));

  const LANG: Record<string, string> = { uz: "Uzbek", en: "English", ru: "Russian" };

  const handleSend = () => {
    const text = chatInput.trim();
    if (!text) return;
    setSendError(null);
    // Optimistic update via Zustand for immediate UI feedback
    sendMessage(applicationId, text);
    setChatInput("");
    // Fire real Telegram send in background
    startSendTransition(async () => {
      try {
        await sendMessageToCandidate(applicationId, text);
      } catch (err) {
        setSendError(err instanceof Error ? err.message : "Failed to send message");
      }
    });
  };

  const handleAddNote = () => {
    const text = noteInput.trim();
    if (!text) return;
    addNote(applicationId, text);
    setNoteInput("");
  };

  const selectedCommentStage = commentStageId
    ? vacancyStages.find((stage) => stage.id === commentStageId)
    : null;

  function requestStageMove(stageId: string) {
    if (!application) return;
    if (stageId === application.currentStageId || movePending) return;
    const target = vacancyStages.find((stage) => stage.id === stageId);
    if (!target) return;

    if (target.isFinal || target.isRejected) {
      setMoveError(null);
      setStageComment("");
      setCommentStageId(stageId);
      return;
    }

    executeStageMove(stageId);
  }

  function executeStageMove(stageId: string, comment?: string) {
    startMoveTransition(async () => {
      try {
        setMoveError(null);
        await moveApplicationToStageAction(applicationId, stageId, comment);
        moveApplicationToStage(applicationId, stageId);
        setCommentStageId(null);
        setStageComment("");
        router.refresh();
      } catch (err) {
        setMoveError(err instanceof Error ? err.message : "Failed to move candidate.");
      }
    });
  }

  function confirmCommentedMove() {
    if (!commentStageId) return;
    const target = vacancyStages.find((stage) => stage.id === commentStageId);
    const comment = stageComment.trim();
    if (target?.isRejected && !comment) {
      setMoveError("Comment is required when rejecting a candidate.");
      return;
    }
    executeStageMove(commentStageId, comment || undefined);
  }

  function openAnketaEditor() {
    if (!candidate) return;
    setAnketaForm(createAnketaForm(candidate));
    setAnketaError(null);
    setIsAnketaOpen(true);
  }

  function closeAnketaEditor() {
    if (anketaPending) return;
    setIsAnketaOpen(false);
    setAnketaError(null);
  }

  function openSourceModal() {
    if (!application) return;
    setSelectedSourceId(currentSourceId ?? "");
    setNewSourceName("");
    setShowNewSourceInput(false);
    setSourceError(null);
    listSourcesForVacancy(application.vacancyId).then(setAvailableSources).catch(() => {});
    setIsSourceOpen(true);
  }

  function closeSourceModal() {
    if (sourcePending) return;
    setIsSourceOpen(false);
    setSourceError(null);
  }

  function handleSaveSource() {
    if (!application) return;
    startSourceTransition(async () => {
      try {
        setSourceError(null);
        let resolvedSourceId: string | null = selectedSourceId || null;

        if (showNewSourceInput) {
          const trimmed = newSourceName.trim();
          if (!trimmed) {
            setSourceError("Source name is required.");
            return;
          }
          const created = await addVacancySource(application.vacancyId, trimmed);
          resolvedSourceId = created.id;
        }

        await setApplicationSource({ applicationId, sourceId: resolvedSourceId });

        if (resolvedSourceId) {
          const src = showNewSourceInput
            ? { id: resolvedSourceId, name: newSourceName.trim() }
            : availableSources.find((s) => s.id === resolvedSourceId);
          setCurrentSourceId(resolvedSourceId);
          setCurrentSourceName(src?.name ?? null);
        } else {
          setCurrentSourceId(null);
          setCurrentSourceName(null);
        }

        setIsSourceOpen(false);
        router.refresh();
      } catch (err) {
        setSourceError(err instanceof Error ? err.message : "Failed to save source.");
      }
    });
  }

  function updateAnketaField<K extends keyof AnketaFormState>(field: K, value: AnketaFormState[K]) {
    setAnketaForm((current) => ({ ...current, [field]: value }));
    if (anketaError) setAnketaError(null);
  }

  function updateWorkExperienceRow<K extends keyof WorkExperienceFormRow>(
    index: number,
    field: K,
    value: WorkExperienceFormRow[K],
  ) {
    setAnketaForm((current) => ({
      ...current,
      workExperience: current.workExperience.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row,
      ),
    }));
    if (anketaError) setAnketaError(null);
  }

  function addWorkExperienceRow() {
    setAnketaForm((current) => ({
      ...current,
      workExperience: [...current.workExperience, createEmptyWorkExperienceRow()],
    }));
  }

  function removeWorkExperienceRow(index: number) {
    setAnketaForm((current) => ({
      ...current,
      workExperience: current.workExperience.filter((_, rowIndex) => rowIndex !== index),
    }));
  }

  function handleSaveAnketa() {
    if (!candidate) return;
    const candidateId = candidate.id;
    const payload = normalizeAnketaForm(anketaForm);
    startAnketaTransition(async () => {
      try {
        setAnketaError(null);
        await updateCandidateAnketa(candidateId, payload);
        setCandidateOverrides({
          ...payload,
          dateOfBirth: payload.dateOfBirth,
          workExperience: payload.workExperience,
        });
        setIsAnketaOpen(false);
        router.refresh();
      } catch (err) {
        setAnketaError(err instanceof Error ? err.message : "Failed to save anketa.");
      }
    });
  }

  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: "activity", label: "Activity" },
    { id: "anketa", label: "Anketa", badge: candidate?.profileCompleted ? 1 : undefined },
    { id: "chat", label: "Chat", badge: unreadCount > 0 ? unreadCount : undefined },
    { id: "conversation", label: "Conversation", badge: initialConversation.length > 0 ? initialConversation.length : undefined },
    { id: "notes", label: "Notes", badge: notes.length > 0 ? notes.length : undefined },
    { id: "tasks", label: "Tasks", badge: taskAssignments.length > 0 ? taskAssignments.length : undefined },
    { id: "screening", label: "Screening", badge: answers.length > 0 ? answers.length : undefined },
    { id: "timeline", label: "Timeline", badge: timeline.length > 0 ? timeline.length : undefined },
  ];

  const activityFeed: ActivityItem[] = [
    ...messages.map((m) => ({ kind: "message" as const, ts: m.sentAt, msg: m })),
    ...timeline.map((e) => ({ kind: "timeline" as const, ts: e.createdAt, event: e })),
    ...notes.map((n) => ({
      kind: "note" as const,
      ts: n.createdAt,
      note: n,
      author: users.find((u) => u.id === n.userId),
    })),
  ].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Slim breadcrumb strip */}
      <div className="px-6 py-3 border-b border-border bg-bg shrink-0 flex items-center justify-between">
        <Link
          href={vacancy ? `/vacancies/${vacancy.id}` : "/vacancies"}
          className="text-body-sm text-muted hover:text-text transition-colors"
        >
          ← {vacancy?.title ?? "Back to pipeline"}
        </Link>
        <span className="text-body-sm text-muted">{candidate.fullName}</span>
      </div>

      {/* Two-column body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* LEFT RAIL */}
        <aside className="w-72 shrink-0 border-r border-border overflow-y-auto flex flex-col bg-bg">
          {/* Avatar + identity */}
          <div className="p-5 border-b border-border">
            <Avatar name={candidate.fullName} id={candidate.id} size="lg" />
            <h2 className="text-h2 text-text mt-3 leading-tight">{candidate.fullName}</h2>
            <p className="text-body-sm text-muted mt-0.5">@{candidate.telegramUsername}</p>
            {currentStage && (
              <div className="mt-3">
                <div className="relative inline-flex items-center gap-1 group cursor-pointer">
                  <StagePill stage={currentStage} size="md" />
                  <span className="text-micro text-muted group-hover:text-text transition-colors">▾</span>
                  <select
                    value={application.currentStageId}
                    onChange={(e) => requestStageMove(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  >
                    {vacancyStages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                {vacancyStages.length > 1 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {vacancyStages.slice(0, 9).map((s, i) => (
                      <button
                        key={s.id}
                        onClick={() => requestStageMove(s.id)}
                        title={s.name}
                        className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                          s.id === application.currentStageId
                            ? "bg-primary/10 border-primary/30 text-primary"
                            : "border-border text-subtle hover:text-text hover:border-border"
                        }`}
                      >
                        <KbdHint keys={String(i + 1)} />
                        <span className="max-w-[52px] truncate">{s.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Contact section */}
          <div className="px-5 py-4 border-b border-border">
            <p className="text-micro text-subtle uppercase tracking-wider mb-3">Contact</p>
            {[
              { label: "Phone", value: candidate.phone },
              { label: "Telegram", value: `@${candidate.telegramUsername}` },
              { label: "City", value: candidate.city },
              { label: "Language", value: LANG[candidate.language] ?? candidate.language },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start gap-2 mb-2 last:mb-0">
                <span className="text-body-sm text-muted w-20 shrink-0">{label}</span>
                <span className="text-body-sm text-text font-medium truncate">{value}</span>
              </div>
            ))}
          </div>

          {/* Application section */}
          <div className="px-5 py-4 border-b border-border">
            <p className="text-micro text-subtle uppercase tracking-wider mb-3">Application</p>
            {[
              { label: "Vacancy", value: vacancy?.title ?? "–" },
              { label: "Stage", value: currentStage?.name ?? "–" },
              {
                label: "Applied",
                value: new Date(application.appliedAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }),
              },
              { label: "Pipeline", value: `${daysAgo(application.appliedAt)}d` },
              { label: "Last seen", value: formatRelativeTime(application.lastActivityAt) },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start gap-2 mb-2 last:mb-0">
                <span className="text-body-sm text-muted w-20 shrink-0">{label}</span>
                <span className="text-body-sm text-text font-medium truncate">{value}</span>
              </div>
            ))}
            {/* Source row — always visible, editable */}
            <div className="flex items-start gap-2 mt-2">
              <span className="text-body-sm text-muted w-20 shrink-0">Source</span>
              <div className="flex items-center gap-1 min-w-0">
                {currentSourceName ? (
                  <>
                    <span className="text-body-sm text-text font-medium truncate">{currentSourceName}</span>
                    <button
                      type="button"
                      onClick={openSourceModal}
                      className="shrink-0 text-subtle hover:text-text transition-colors ml-1"
                      title="Edit source"
                    >
                      <Pencil size={13} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-body-sm text-muted">—</span>
                    <button
                      type="button"
                      onClick={openSourceModal}
                      className="text-body-sm text-primary hover:underline ml-1"
                    >
                      Set source
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="px-5 py-4 space-y-1.5">
            <p className="text-micro text-subtle uppercase tracking-wider mb-3">Actions</p>
            <button
              onClick={() => setActiveTab("chat")}
              className="w-full flex items-center gap-2.5 h-8 px-3 rounded-lg text-body-sm text-muted hover:text-text hover:bg-surface-2 transition-colors text-left"
            >
              ✉ Message
            </button>
            <button
              onClick={() => setActiveTab("notes")}
              className="w-full flex items-center gap-2.5 h-8 px-3 rounded-lg text-body-sm text-muted hover:text-text hover:bg-surface-2 transition-colors text-left"
            >
              📝 Add note
            </button>
            <button
              onClick={() => setActiveTab("tasks")}
              className="w-full flex items-center gap-2.5 h-8 px-3 rounded-lg text-body-sm text-muted hover:text-text hover:bg-surface-2 transition-colors text-left"
            >
              📋 Assign task
            </button>
            <CandidateActionControls
              applicationId={application.id}
              candidateId={candidate.id}
              candidateName={candidate.fullName}
              initialIsWatched={false}
              initialIsBlacklisted={Boolean((candidate as { isBlacklisted?: boolean }).isBlacklisted)}
              showRelationships
            />
          </div>
        </aside>

        {/* RIGHT PANE */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {/* Tabs bar */}
          <div className="flex gap-0 border-b border-border px-6 bg-bg shrink-0">
            {TABS.map(({ id, label, badge }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`h-10 px-4 text-body-sm font-medium border-b-2 transition-colors ${
                  activeTab === id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted hover:text-text"
                }`}
              >
                {label}
                {badge != null && (
                  <span
                    className={`ml-1.5 text-micro px-1.5 h-4 rounded-full inline-flex items-center ${
                      id === "chat" && unreadCount > 0
                        ? "bg-primary text-primary-fg"
                        : "bg-surface-2 text-muted"
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div
            className={`flex-1 min-h-0 overflow-y-auto ${activeTab === "chat" || activeTab === "activity" ? "" : "px-6 py-5 max-w-[640px]"}`}
          >
            {/* ── Activity ── */}
            {activeTab === "activity" && (
              <div className="flex flex-col px-6 py-4 gap-1">
                {activityFeed.length === 0 ? (
                  <EmptyState
                    title="No activity yet"
                    description="Messages, stage moves, and notes will appear here."
                  />
                ) : (
                  activityFeed.map((item) => {
                    if (item.kind === "message") {
                      return <ChatBubble key={item.msg.id} message={item.msg} />;
                    }
                    if (item.kind === "timeline") {
                      return <TimelineEntry key={item.event.id} event={item.event} />;
                    }
                    if (item.kind === "note") {
                      return (
                        <div
                          key={item.note.id}
                          className="my-1 bg-warning-soft/40 border border-warning/20 rounded-lg px-4 py-3"
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-micro text-warning font-semibold uppercase tracking-wide">
                              Internal note
                            </span>
                            <span className="text-micro text-subtle ml-auto">
                              {formatRelativeTime(item.note.createdAt)}
                            </span>
                          </div>
                          <p className="text-body-sm text-text leading-relaxed">{item.note.text}</p>
                          {item.author && (
                            <p className="text-micro text-subtle mt-1.5">{item.author.name}</p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })
                )}
              </div>
            )}

            {/* ── Anketa ── */}
            {activeTab === "anketa" && (
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-h3 text-text">Anketa</h2>
                    <p className="text-body-sm text-muted mt-0.5">
                      {candidate.profileCompleted ? "Completed profile" : "Profile not completed"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openAnketaEditor}
                    className="h-9 px-4 rounded-lg bg-primary text-primary-fg text-body-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Edit anketa
                  </button>
                </div>
                <AnketaTab data={{ candidate, application }} />
              </div>
            )}

            {/* ── Chat ── */}
            {activeTab === "chat" && (
              <div className="flex flex-col h-full max-w-[720px]">
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                  {messages.length === 0 ? (
                    <EmptyState
                      title="No messages yet"
                      description="Send the first message to start the conversation."
                    />
                  ) : (
                    messages.map((msg) => <ChatBubble key={msg.id} message={msg} />)
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="px-6 py-2 border-t border-border bg-bg flex items-center gap-2">
                  <span className="text-micro text-subtle">Demo:</span>
                  <button
                    onClick={() => simulateIncomingMessage(applicationId)}
                    className="text-micro text-primary hover:underline"
                  >
                    Simulate candidate reply
                  </button>
                </div>

                <div className="px-6 py-4 border-t border-border bg-bg">
                  {sendError && (
                    <p className="text-micro text-red-500 mb-2">{sendError}</p>
                  )}
                  <div className="flex items-end gap-2 bg-surface border border-border rounded-xl px-4 py-3 focus-within:border-primary transition-colors">
                    <textarea
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.key === "Enter" && !e.shiftKey) || (e.key === "Enter" && e.metaKey)) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Type a message… (Enter to send)"
                      rows={1}
                      className="flex-1 resize-none bg-transparent text-body-sm text-text placeholder:text-subtle outline-none leading-relaxed"
                      style={{ maxHeight: "120px" }}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!chatInput.trim() || sendPending}
                      className="shrink-0 h-8 w-8 rounded-lg bg-primary text-primary-fg flex items-center justify-center disabled:opacity-30 transition-opacity"
                    >
                      ↑
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Conversation (all TG history) ── */}
            {activeTab === "conversation" && (
              <div className="flex flex-col h-full max-w-[720px]">
                <div className="px-4 py-2 border-b border-border bg-surface-2 shrink-0">
                  <p className="text-micro text-muted">
                    Full Telegram history — all messages including pre-application ({initialConversation.length})
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                  {initialConversation.length === 0 ? (
                    <EmptyState
                      title="No conversation yet"
                      description="Telegram messages will appear here once the candidate interacts with the bot."
                    />
                  ) : (
                    initialConversation.map((msg) => {
                      const sentAtStr =
                        msg.sentAt instanceof Date
                          ? msg.sentAt.toISOString()
                          : String(msg.sentAt);
                      const asTelegramMessage: import("@/lib/types").TelegramMessage = {
                        id: msg.id,
                        candidateId: msg.candidateId,
                        applicationId: msg.applicationId ?? null,
                        direction: msg.direction,
                        senderType: msg.senderType,
                        senderName: msg.senderName ?? undefined,
                        text: msg.text,
                        sentAt: sentAtStr,
                        readByUserIds: msg.readByUserIds ?? [],
                        attachmentFileId: msg.attachmentFileId ?? null,
                        attachmentType: msg.attachmentType ?? null,
                        attachmentFilename: msg.attachmentFilename ?? null,
                      };
                      return <ChatBubble key={msg.id} message={asTelegramMessage} />;
                    })
                  )}
                </div>
              </div>
            )}

            {/* ── Notes ── */}
            {activeTab === "notes" && (
              <div className="space-y-4">
                <div className="bg-surface border border-border rounded-xl p-4">
                  <textarea
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Add an internal note… (only visible to HR team)"
                    rows={3}
                    className="w-full resize-none bg-transparent text-body-sm text-text placeholder:text-subtle outline-none leading-relaxed"
                  />
                  <div className="flex justify-end mt-3">
                    <button
                      onClick={handleAddNote}
                      disabled={!noteInput.trim()}
                      className="h-8 px-4 rounded-lg bg-primary text-primary-fg text-body-sm font-medium disabled:opacity-30 transition-opacity"
                    >
                      Save note
                    </button>
                  </div>
                </div>

                {notes.length === 0 ? (
                  <EmptyState
                    title="No notes yet"
                    description="Add internal notes visible only to your HR team."
                  />
                ) : (
                  notes.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      author={users.find((u) => u.id === note.userId)}
                      onTogglePin={() => togglePinNote(note.id)}
                    />
                  ))
                )}
              </div>
            )}

            {/* ── Tasks ── */}
            {activeTab === "tasks" && (
              <div className="space-y-4">
                {unassignedTasks.length > 0 && (
                  <div className="bg-surface border border-border rounded-xl p-4">
                    <h3 className="text-body-sm font-semibold text-text mb-3">Assign a test task</h3>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedTaskId || unassignedTasks[0]?.id}
                        onChange={(e) => setSelectedTaskId(e.target.value)}
                        className="flex-1 h-9 rounded-lg border border-border bg-surface text-body-sm text-text px-3 outline-none focus:border-primary"
                      >
                        {unassignedTasks.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          const taskId = selectedTaskId || unassignedTasks[0]?.id;
                          if (taskId) assignTestTask(applicationId, taskId);
                        }}
                        className="h-9 px-4 rounded-lg bg-primary text-primary-fg text-body-sm font-medium transition-opacity"
                      >
                        Assign
                      </button>
                    </div>
                  </div>
                )}

                {taskAssignments.length === 0 ? (
                  <EmptyState
                    title="No tasks assigned"
                    description="Assign a test task to this candidate to track their submission."
                  />
                ) : (
                  taskAssignments.map(({ task, assignment }) => {
                    const statusStyles: Record<TestTaskAssignment["status"], string> = {
                      pending: "bg-surface-2 text-muted",
                      submitted: "bg-primary/10 text-primary",
                      passed: "bg-success-soft text-success",
                      failed: "bg-red-50 text-red-600",
                    };
                    return (
                      <div key={assignment.id} className="bg-surface border border-border rounded-xl p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-body-sm font-semibold text-text">{task.title}</p>
                            <p className="text-body-sm text-muted mt-1">{task.description}</p>
                            <p className="text-micro text-subtle mt-2">
                              Assigned {formatRelativeTime(assignment.assignedAt)} · Due{" "}
                              {new Date(assignment.dueAt).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                              })}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <span
                              className={`text-micro px-2 h-5 rounded-full inline-flex items-center font-medium ${statusStyles[assignment.status]}`}
                            >
                              {assignment.status.charAt(0).toUpperCase() + assignment.status.slice(1)}
                            </span>
                            <select
                              value={assignment.status}
                              onChange={(e) =>
                                updateTestTaskAssignment(assignment.id, {
                                  status: e.target.value as TestTaskAssignment["status"],
                                })
                              }
                              className="text-micro border border-border rounded-md px-2 h-6 bg-surface text-text"
                            >
                              <option value="pending">Pending</option>
                              <option value="submitted">Submitted</option>
                              <option value="passed">Passed</option>
                              <option value="failed">Failed</option>
                            </select>
                          </div>
                        </div>
                        {assignment.submissionNote && (
                          <div className="mt-3 bg-surface-2 rounded-lg px-3 py-2">
                            <p className="text-micro text-muted">Submission note:</p>
                            <p className="text-body-sm text-text mt-0.5">{assignment.submissionNote}</p>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ── Screening Answers ── */}
            {activeTab === "screening" && (
              <div>
                {answers.length === 0 ? (
                  <EmptyState
                    title="No answers yet"
                    description="This candidate hasn't completed the screening questionnaire."
                  />
                ) : (
                  answers.map(({ question, answer }) => (
                    <ScreeningAnswerRow key={answer.id} question={question} answer={answer} />
                  ))
                )}
              </div>
            )}

            {/* ── Timeline ── */}
            {activeTab === "timeline" && (
              <div>
                {timeline.length === 0 ? (
                  <EmptyState
                    title="No events yet"
                    description="Timeline events will appear here as the application progresses."
                  />
                ) : (
                  timeline.map((event) => <TimelineEntry key={event.id} event={event} />)
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={isAnketaOpen} onClose={closeAnketaEditor} title="Edit anketa" size="lg">
        <div className="space-y-5">
          {anketaError && (
            <div className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-body-sm text-danger">
              {anketaError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Full name">
              <input
                value={anketaForm.fullName}
                onChange={(e) => updateAnketaField("fullName", e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-bg px-3 text-body-sm text-text outline-none focus:border-primary"
              />
            </FormField>
            <FormField label="Phone">
              <input
                value={anketaForm.phone}
                onChange={(e) => updateAnketaField("phone", e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-bg px-3 text-body-sm text-text outline-none focus:border-primary"
              />
            </FormField>
            <FormField label="City">
              <input
                value={anketaForm.city}
                onChange={(e) => updateAnketaField("city", e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-bg px-3 text-body-sm text-text outline-none focus:border-primary"
              />
            </FormField>
            <FormField label="Date of birth">
              <input
                type="date"
                value={anketaForm.dateOfBirth ?? ""}
                onChange={(e) => updateAnketaField("dateOfBirth", e.target.value || null)}
                className="h-9 w-full rounded-lg border border-border bg-bg px-3 text-body-sm text-text outline-none focus:border-primary"
              />
            </FormField>
            <FormField label="Address" className="sm:col-span-2">
              <input
                value={anketaForm.address ?? ""}
                onChange={(e) => updateAnketaField("address", e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-bg px-3 text-body-sm text-text outline-none focus:border-primary"
              />
            </FormField>
            <FormField label="Marital status">
              <select
                value={anketaForm.maritalStatus ?? ""}
                onChange={(e) => updateAnketaField("maritalStatus", e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-bg px-3 text-body-sm text-text outline-none focus:border-primary"
              >
                {MARITAL_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Student">
              <select
                value={anketaForm.isStudent == null ? "" : anketaForm.isStudent ? "yes" : "no"}
                onChange={(e) =>
                  updateAnketaField(
                    "isStudent",
                    e.target.value === "" ? null : e.target.value === "yes",
                  )
                }
                className="h-9 w-full rounded-lg border border-border bg-bg px-3 text-body-sm text-text outline-none focus:border-primary"
              >
                <option value="">Not recorded</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </FormField>
            <FormField label="Education">
              <input
                value={anketaForm.educationField ?? ""}
                onChange={(e) => updateAnketaField("educationField", e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-bg px-3 text-body-sm text-text outline-none focus:border-primary"
              />
            </FormField>
            <FormField label="Department ID">
              <input
                value={anketaForm.departmentId ?? ""}
                onChange={(e) => updateAnketaField("departmentId", e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-bg px-3 text-body-sm text-text outline-none focus:border-primary"
              />
            </FormField>
            <FormField label="English">
              <select
                value={anketaForm.englishLevel ?? ""}
                onChange={(e) => updateAnketaField("englishLevel", e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-bg px-3 text-body-sm text-text outline-none focus:border-primary"
              >
                {LANGUAGE_LEVEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Russian">
              <select
                value={anketaForm.russianLevel ?? ""}
                onChange={(e) => updateAnketaField("russianLevel", e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-bg px-3 text-body-sm text-text outline-none focus:border-primary"
              >
                {LANGUAGE_LEVEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Language">
              <select
                value={anketaForm.languagePref ?? ""}
                onChange={(e) => updateAnketaField("languagePref", e.target.value as AnketaFormState["languagePref"])}
                className="h-9 w-full rounded-lg border border-border bg-bg px-3 text-body-sm text-text outline-none focus:border-primary"
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
            <label className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 h-9 self-end">
              <input
                type="checkbox"
                checked={Boolean(anketaForm.profileCompleted)}
                onChange={(e) => updateAnketaField("profileCompleted", e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              <span className="text-body-sm text-text">Profile completed</span>
            </label>
          </div>

          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-body-sm font-semibold text-text">Work experience</h3>
              <button
                type="button"
                onClick={addWorkExperienceRow}
                className="h-8 px-3 rounded-lg border border-border text-body-sm text-muted hover:text-text hover:bg-surface-2"
              >
                Add row
              </button>
            </div>

            {anketaForm.workExperience.length === 0 ? (
              <div className="rounded-lg border border-border bg-bg px-3 py-4 text-body-sm text-muted">
                No work experience rows.
              </div>
            ) : (
              <div className="space-y-3">
                {anketaForm.workExperience.map((row, index) => (
                  <div key={index} className="rounded-lg border border-border bg-bg p-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormField label="Company">
                        <input
                          value={row.company}
                          onChange={(e) => updateWorkExperienceRow(index, "company", e.target.value)}
                          className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-body-sm text-text outline-none focus:border-primary"
                        />
                      </FormField>
                      <FormField label="Position">
                        <input
                          value={row.position}
                          onChange={(e) => updateWorkExperienceRow(index, "position", e.target.value)}
                          className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-body-sm text-text outline-none focus:border-primary"
                        />
                      </FormField>
                      <FormField label="Period">
                        <input
                          value={row.period}
                          onChange={(e) => updateWorkExperienceRow(index, "period", e.target.value)}
                          className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-body-sm text-text outline-none focus:border-primary"
                        />
                      </FormField>
                      <FormField label="Leave reason">
                        <input
                          value={row.leaveReason}
                          onChange={(e) => updateWorkExperienceRow(index, "leaveReason", e.target.value)}
                          className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-body-sm text-text outline-none focus:border-primary"
                        />
                      </FormField>
                    </div>
                    <div className="flex justify-end mt-3">
                      <button
                        type="button"
                        onClick={() => removeWorkExperienceRow(index)}
                        className="h-8 px-3 rounded-lg text-body-sm text-danger hover:bg-danger/10"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={closeAnketaEditor}
              disabled={anketaPending}
              className="h-9 px-4 rounded-lg border border-border text-body-sm text-muted hover:text-text hover:bg-surface-2 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAnketa}
              disabled={anketaPending}
              className="h-9 px-4 rounded-lg bg-primary text-primary-fg text-body-sm font-medium disabled:opacity-50"
            >
              {anketaPending ? "Saving..." : "Save anketa"}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Set source modal */}
      <Dialog open={isSourceOpen} onClose={closeSourceModal} title="Set source" size="sm">
        <div className="space-y-4">
          {sourceError && (
            <div className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-body-sm text-danger">
              {sourceError}
            </div>
          )}

          {!showNewSourceInput ? (
            <>
              <p className="text-body-sm text-muted">Choose where this candidate came from:</p>
              <select
                value={selectedSourceId}
                onChange={(e) => setSelectedSourceId(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-bg px-3 text-body-sm text-text outline-none focus:border-primary"
              >
                <option value="">— No source —</option>
                {availableSources.map((src) => (
                  <option key={src.id} value={src.id}>
                    {src.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNewSourceInput(true)}
                className="text-body-sm text-primary hover:underline"
              >
                Or create new
              </button>
            </>
          ) : (
            <>
              <p className="text-body-sm text-muted">Enter a new source name:</p>
              <input
                autoFocus
                value={newSourceName}
                onChange={(e) => setNewSourceName(e.target.value)}
                placeholder="e.g. Referral"
                className="h-9 w-full rounded-lg border border-border bg-bg px-3 text-body-sm text-text outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={() => { setShowNewSourceInput(false); setNewSourceName(""); }}
                className="text-body-sm text-muted hover:text-text"
              >
                ← Back to list
              </button>
            </>
          )}

          {!showNewSourceInput && (
            <button
              type="button"
              onClick={() => { setSelectedSourceId(""); }}
              className="block text-body-sm text-danger hover:underline"
            >
              Clear attribution
            </button>
          )}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={closeSourceModal}
              disabled={sourcePending}
              className="h-9 px-4 rounded-lg border border-border text-body-sm text-muted hover:text-text hover:bg-surface-2 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveSource}
              disabled={sourcePending}
              className="h-9 px-4 rounded-lg bg-primary text-primary-fg text-body-sm font-medium disabled:opacity-50"
            >
              {sourcePending ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </Dialog>

      {selectedCommentStage && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-surface border border-border rounded-xl shadow-xl p-5">
            <h3 className="text-h3 text-text">Move to {selectedCommentStage.name}</h3>
            <p className="text-body-sm text-muted mt-1">
              Add context for the candidate history. Rejected moves require a reason.
            </p>
            <textarea
              value={stageComment}
              onChange={(e) => {
                setStageComment(e.target.value);
                if (moveError) setMoveError(null);
              }}
              autoFocus
              rows={4}
              className={`mt-4 w-full rounded-lg border bg-bg px-3 py-2 text-body-sm text-text outline-none focus:border-primary ${
                moveError ? "border-danger" : "border-border"
              }`}
              placeholder="Write a short note..."
            />
            {moveError && <p className="mt-2 text-body-sm text-danger">{moveError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setCommentStageId(null);
                  setStageComment("");
                  setMoveError(null);
                }}
                disabled={movePending}
                className="h-9 px-4 rounded-lg border border-border text-body-sm text-muted hover:text-text hover:bg-surface-2 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmCommentedMove}
                disabled={movePending}
                className="h-9 px-4 rounded-lg bg-primary text-primary-fg text-body-sm font-medium disabled:opacity-50"
              >
                {movePending ? "Moving..." : "Confirm move"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function CandidateProfileClient({
  applicationId,
  initialConversation = [],
  initialApplication,
  initialCandidate,
  initialTimeline = [],
  sourceName,
  initialSourceId,
}: {
  applicationId: string;
  initialConversation?: ConversationMessage[];
  initialApplication?: Application;
  initialCandidate?: Candidate;
  initialTimeline?: TimelineEvent[];
  sourceName?: string | null;
  initialSourceId?: string | null;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full text-body-sm text-subtle">
          Loading…
        </div>
      }
    >
      <ProfileContent
        applicationId={applicationId}
        initialConversation={initialConversation}
        initialApplication={initialApplication}
        initialCandidate={initialCandidate}
        initialTimeline={initialTimeline}
        sourceName={sourceName}
        initialSourceId={initialSourceId}
      />
    </Suspense>
  );
}

function FormField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-micro text-subtle uppercase tracking-wide">{label}</span>
      <span className="block mt-1">{children}</span>
    </label>
  );
}

function ProfileRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-micro text-subtle uppercase tracking-wide">{label}</p>
      <p className="text-body-sm text-text font-medium mt-0.5">{value || "—"}</p>
    </div>
  );
}

function formatValue(value?: string | null) {
  return value ? value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : null;
}

function formatLanguageLevel(value?: string | null) {
  const labels: Record<string, string> = {
    none: "None",
    a1_a2: "A1-A2",
    b1_b2: "B1-B2",
    c1_c2: "C1-C2",
    native: "Native",
  };
  return value ? labels[value] ?? value : null;
}

function formatDateValue(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB");
}

function createEmptyWorkExperienceRow(): WorkExperienceFormRow {
  return {
    company: "",
    position: "",
    period: "",
    leaveReason: "",
  };
}

function createEmptyAnketaForm(): AnketaFormState {
  return {
    fullName: "",
    phone: "",
    city: "",
    dateOfBirth: null,
    address: null,
    maritalStatus: null,
    isStudent: null,
    educationField: null,
    englishLevel: null,
    russianLevel: null,
    workExperience: [],
    departmentId: null,
    profileCompleted: false,
    languagePref: null,
  };
}

function createAnketaForm(candidate: Candidate): AnketaFormState {
  return {
    fullName: candidate.fullName,
    phone: candidate.phone,
    city: candidate.city,
    dateOfBirth: formatDateInputValue(candidate.dateOfBirth),
    address: candidate.address ?? "",
    maritalStatus: candidate.maritalStatus ?? "",
    isStudent: candidate.isStudent ?? null,
    educationField: candidate.educationField ?? "",
    englishLevel: candidate.englishLevel ?? "",
    russianLevel: candidate.russianLevel ?? "",
    workExperience: candidate.workExperience?.length
      ? candidate.workExperience.map((entry) => ({
          company: entry.company ?? "",
          position: entry.position ?? "",
          period: entry.period ?? "",
          leaveReason: entry.leaveReason ?? "",
        }))
      : [],
    departmentId: candidate.departmentId ?? "",
    profileCompleted: Boolean(candidate.profileCompleted),
    languagePref: candidate.languagePref ?? "",
  };
}

function normalizeOptionalString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeAnketaForm(form: AnketaFormState): CandidateAnketaInput {
  return {
    fullName: form.fullName.trim(),
    phone: form.phone.trim(),
    city: form.city.trim(),
    dateOfBirth: normalizeOptionalString(form.dateOfBirth),
    address: normalizeOptionalString(form.address),
    maritalStatus: normalizeOptionalString(form.maritalStatus),
    isStudent: form.isStudent,
    educationField: normalizeOptionalString(form.educationField),
    englishLevel: normalizeOptionalString(form.englishLevel),
    russianLevel: normalizeOptionalString(form.russianLevel),
    workExperience: form.workExperience
      .map((entry) => ({
        company: normalizeOptionalString(entry.company) ?? undefined,
        position: normalizeOptionalString(entry.position) ?? undefined,
        period: normalizeOptionalString(entry.period) ?? undefined,
        leaveReason: normalizeOptionalString(entry.leaveReason) ?? undefined,
      }))
      .filter((entry) => entry.company || entry.position || entry.period || entry.leaveReason),
    departmentId: normalizeOptionalString(form.departmentId),
    profileCompleted: Boolean(form.profileCompleted),
    languagePref: normalizeOptionalString(form.languagePref) as CandidateAnketaInput["languagePref"],
  };
}

function formatDateInputValue(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toISOString().slice(0, 10);
}
