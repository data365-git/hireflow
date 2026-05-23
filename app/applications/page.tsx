"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { PipelineViewToggle } from "@/components/PipelineViewToggle";
import { PipelineFilters } from "@/components/PipelineFilters";
import { PipelineListView } from "@/components/PipelineListView";
import { formatRelativeTime } from "@/lib/utils";
import { useDataMode } from "@/context/DataModeContext";
import {
  getAllPipelineApplications,
  getStagesForActiveVacancies,
  moveApplicationToStage,
  listAllSourceNames,
  type UnifiedApplication,
  type PipelineStage,
} from "@/app/actions/applications";
import { getAllVacancies } from "@/app/actions/vacancies";

// ── Helpers ───────────────────────────────────────────────────────────────────

type SimpleVacancy = { id: string; title: string };

function getInitialView(): "kanban" | "list" {
  if (typeof window === "undefined") return "kanban";
  const param = new URLSearchParams(window.location.search).get("view");
  if (param === "kanban" || param === "list") return param;
  return (localStorage.getItem("pipelineView") as "kanban" | "list") ?? "kanban";
}

// ── Attention card ────────────────────────────────────────────────────────────

type AttentionCardProps = {
  title: string;
  icon: string;
  color: string;
  items: UnifiedApplication[];
  emptyText: string;
  vacancies: SimpleVacancy[];
};

function AttentionCard({ title, icon, color, items, emptyText, vacancies }: AttentionCardProps) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span>{icon}</span>
        <span className={`text-body-sm font-semibold ${color}`}>{title}</span>
        {items.length > 0 && (
          <span className="ml-auto text-micro text-subtle">{items.length}</span>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-body-sm text-subtle">{emptyText}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((app) => {
            const vacancy = vacancies.find((v) => v.id === app.vacancyId);
            return (
              <Link
                key={app.id}
                href={`/candidates/${app.id}`}
                className="flex items-center gap-2 hover:bg-surface-2 rounded-lg p-1.5 -mx-1.5 transition-colors"
              >
                <Avatar name={app.candidateName} id={app.candidateId} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm font-semibold text-text truncate">
                    {app.candidateName}
                  </p>
                  <p className="text-micro text-subtle truncate">{vacancy?.title ?? ""}</p>
                </div>
                <span className="text-micro text-subtle shrink-0">
                  {formatRelativeTime(app.lastActivityAt)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Stage column config ───────────────────────────────────────────────────────

const STAGE_ORDER = [
  "new",
  "screening",
  "qualified",
  "test",
  "interview",
  "hired",
  "rejected",
] as const;

const STAGE_LABELS: Record<string, string> = {
  new: "New",
  screening: "Screening",
  qualified: "Qualified",
  test: "Test",
  interview: "Interview",
  hired: "Hired",
  rejected: "Rejected",
};

const STAGE_DOT_COLOR: Record<string, string> = {
  new: "var(--color-stage-new-fg)",
  screening: "var(--color-stage-screening-fg)",
  qualified: "var(--color-stage-qualified-fg)",
  test: "var(--color-stage-test-fg)",
  interview: "var(--color-stage-interview-fg)",
  hired: "var(--color-stage-hired-fg)",
  rejected: "var(--color-stage-rejected-fg)",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const { mode } = useDataMode();
  const router = useRouter();

  const [view, setView] = useState<"kanban" | "list">(getInitialView);
  const [apps, setApps] = useState<UnifiedApplication[]>([]);
  const [vacancies, setVacancies] = useState<SimpleVacancy[]>([]);
  const [sourceNames, setSourceNames] = useState<string[]>([]);
  const [allStages, setAllStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);

  // Drag state — ref for the ID being dragged (avoids re-renders mid-drag),
  // state for visual feedback (drop target highlight + dragged card dim).
  const draggedIdRef = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  // Auto-scroll while dragging near edges of the kanban scroll container.
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollRafRef = useRef<number | null>(null);
  const scrollDirRef = useRef<number>(0); // -1 = left, 0 = none, 1 = right

  const stopAutoScroll = useCallback(() => {
    if (scrollRafRef.current !== null) {
      cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = null;
    }
    scrollDirRef.current = 0;
  }, []);

  const startAutoScroll = useCallback(() => {
    if (scrollRafRef.current !== null) return;
    function tick() {
      const el = scrollContainerRef.current;
      if (el && scrollDirRef.current !== 0) {
        el.scrollLeft += scrollDirRef.current * 10;
        scrollRafRef.current = requestAnimationFrame(tick);
      } else {
        scrollRafRef.current = null;
      }
    }
    scrollRafRef.current = requestAnimationFrame(tick);
  }, []);

  // Filters
  const [filterVacancyId, setFilterVacancyId] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterSource, setFilterSource] = useState("all");

  function handleViewChange(v: "kanban" | "list") {
    setView(v);
    localStorage.setItem("pipelineView", v);
    router.replace(`/applications?view=${v}`);
  }

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getAllPipelineApplications(),
      getAllVacancies(),
      listAllSourceNames(),
      getStagesForActiveVacancies(),
    ]).then(([a, v, s, stages]) => {
      setApps(a);
      setVacancies(v.map((vac) => ({ id: vac.id, title: vac.title })));
      setSourceNames(s);
      setAllStages(stages);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [mode]);

  // ── Drag-and-drop handlers ────────────────────────────────────────────────

  const handleDrop = useCallback(
    async (targetColorKey: string) => {
      const appId = draggedIdRef.current;
      draggedIdRef.current = null;
      setDraggingId(null);
      setDropTarget(null);

      if (!appId) return;

      // Snapshot current state for rollback
      const prevApps = apps;
      const app = apps.find((a) => a.id === appId);
      if (!app || app.stageColor === targetColorKey) return;

      // Find the target stage for this vacancy by color
      const targetStage = allStages.find(
        (s) => s.vacancyId === app.vacancyId && s.color === targetColorKey
      );
      if (!targetStage) return; // vacancy doesn't have this stage color

      // Optimistic update
      setApps((prev) =>
        prev.map((a) =>
          a.id === appId
            ? { ...a, stageId: targetStage.id, stageColor: targetColorKey, stageName: targetStage.name }
            : a
        )
      );

      // Server call — rollback on error
      moveApplicationToStage(appId, targetStage.id).catch(() => {
        setApps(prevApps);
      });
    },
    [apps, allStages]
  );

  // ── Derived data ──────────────────────────────────────────────────────────

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const oneDayMs = 86_400_000;
  const sevenDaysMs = 7 * 86_400_000;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const awaitingReply = apps
    .filter((a) => a.hasUnread && Date.now() - new Date(a.lastActivityAt).getTime() > oneDayMs)
    .slice(0, 5);

  const stuckCandidates = apps
    .filter(
      (a) =>
        a.stageColor !== "hired" &&
        a.stageColor !== "rejected" &&
        Date.now() - new Date(a.lastActivityAt).getTime() > sevenDaysMs
    )
    .slice(0, 5);

  const newToday = apps
    .filter((a) => new Date(a.appliedAt).getTime() >= todayStart.getTime())
    .slice(0, 5);

  const hasAttention = awaitingReply.length > 0 || stuckCandidates.length > 0 || newToday.length > 0;

  // ── Filtered apps ─────────────────────────────────────────────────────────

  const filteredApps = apps.filter((a) => {
    if (filterVacancyId !== "all" && a.vacancyId !== filterVacancyId) return false;
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    if (filterSource !== "all" && a.sourceName !== filterSource) return false;
    if (filterSearch && !a.candidateName.toLowerCase().includes(filterSearch.toLowerCase()))
      return false;
    return true;
  });

  // ── Kanban grouping ───────────────────────────────────────────────────────

  const appsByColor = new Map<string, UnifiedApplication[]>();
  for (const colorKey of STAGE_ORDER) {
    appsByColor.set(colorKey, []);
  }
  for (const app of filteredApps) {
    const key = app.stageColor ?? "new";
    if (appsByColor.has(key)) {
      appsByColor.get(key)!.push(app);
    }
  }

  const columnsToShow = STAGE_ORDER.filter(
    (key) => key !== "rejected" || (appsByColor.get("rejected")?.length ?? 0) > 0
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-body-sm text-subtle">Loading pipeline…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* ── Hero header ── */}
      <div className="px-8 pt-6 pb-4">
        <h1 className="text-h1 text-text">Applications</h1>
        <p className="text-body-sm text-muted mt-0.5">
          {today} · {vacancies.length} active{" "}
          {vacancies.length === 1 ? "vacancy" : "vacancies"}
        </p>
      </div>

      {/* ── Attention strip ── */}
      {hasAttention && (
        <div className="px-8 mb-6">
          <div className="grid grid-cols-3 gap-3">
            <AttentionCard
              title="Awaiting reply"
              icon="💬"
              color="text-danger"
              items={awaitingReply}
              emptyText="All caught up!"
              vacancies={vacancies}
            />
            <AttentionCard
              title="Stuck >7 days"
              icon="⏱"
              color="text-warning"
              items={stuckCandidates}
              emptyText="Pipeline is moving"
              vacancies={vacancies}
            />
            <AttentionCard
              title="New today"
              icon="🟢"
              color="text-success"
              items={newToday}
              emptyText="None yet today"
              vacancies={vacancies}
            />
          </div>
        </div>
      )}

      {/* ── Filter row ── */}
      <div className="px-8 mb-4 flex items-center justify-between gap-3">
        <PipelineFilters
          vacancies={vacancies}
          vacancyId={filterVacancyId}
          onVacancyChange={setFilterVacancyId}
          status={filterStatus}
          onStatusChange={setFilterStatus}
          search={filterSearch}
          onSearchChange={setFilterSearch}
          sourceNames={sourceNames}
          source={filterSource}
          onSourceChange={setFilterSource}
        />
        <PipelineViewToggle view={view} onChange={handleViewChange} />
      </div>

      {/* ── View ── */}
      {view === "list" ? (
        <div className="px-8 pb-8">
          <PipelineListView apps={filteredApps} vacancies={vacancies} />
        </div>
      ) : (
        <div className="px-8 pb-8">
          <div
            ref={scrollContainerRef}
            className="flex gap-4 overflow-x-auto pb-6"
            onDragOver={(e) => {
              const el = scrollContainerRef.current;
              if (!el) return;
              const { left, width } = el.getBoundingClientRect();
              const x = e.clientX - left;
              const EDGE = 80;
              if (x < EDGE) {
                scrollDirRef.current = -1;
                startAutoScroll();
              } else if (x > width - EDGE) {
                scrollDirRef.current = 1;
                startAutoScroll();
              } else {
                stopAutoScroll();
              }
            }}
            onDragLeave={stopAutoScroll}
            onDrop={stopAutoScroll}
          >
            {columnsToShow.map((colorKey) => {
              const colApps = appsByColor.get(colorKey) ?? [];
              const isOver = dropTarget === colorKey;

              return (
                <div
                  key={colorKey}
                  className={`min-w-[220px] max-w-[220px] flex flex-col gap-2 rounded-xl p-1 -m-1 transition-all duration-200 ${
                    isOver
                      ? "bg-primary/5 ring-1 ring-primary/30 scale-[1.015]"
                      : draggingId
                      ? "opacity-80"
                      : ""
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dropTarget !== colorKey) setDropTarget(colorKey);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDropTarget(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDrop(colorKey);
                  }}
                >
                  {/* Column header */}
                  <div className="flex items-center gap-1.5 px-1">
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ backgroundColor: STAGE_DOT_COLOR[colorKey] ?? "var(--color-border)" }}
                    />
                    <span className="text-body-sm font-semibold text-text">
                      {STAGE_LABELS[colorKey]}
                    </span>
                    <span className="ml-auto text-micro text-subtle">{colApps.length}</span>
                  </div>

                  {/* Empty drop zone */}
                  {colApps.length === 0 && (
                    <div
                      className={`min-h-[60px] flex items-center justify-center rounded-lg border-2 border-dashed transition-all duration-200 ${
                        isOver
                          ? "border-primary/60 bg-primary/8 scale-[1.02] animate-pulse"
                          : "border-border"
                      }`}
                    >
                      <span className={`text-micro transition-colors duration-150 ${isOver ? "text-primary font-semibold" : "text-subtle"}`}>
                        {isOver ? "Drop here" : "Empty"}
                      </span>
                    </div>
                  )}

                  {/* Cards */}
                  {colApps.map((app) => {
                    const isBrowsing = app.status === "browsing";
                    const isInProgress = app.status === "in_progress";
                    const isAbandoned = app.status === "abandoned";
                    const isDragging = draggingId === app.id;

                    return (
                      <div
                        key={app.id}
                        draggable
                        onDragStart={(e) => {
                          draggedIdRef.current = app.id;
                          setDraggingId(app.id);
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", app.id);
                        }}
                        onDragEnd={() => {
                          draggedIdRef.current = null;
                          setDraggingId(null);
                          setDropTarget(null);
                          stopAutoScroll();
                        }}
                        className={`transition-all duration-150 cursor-grab active:cursor-grabbing ${
                          isDragging ? "opacity-20 scale-95 blur-[1px]" : "hover:-translate-y-0.5"
                        }`}
                      >
                        <Link
                          href={`/candidates/${app.id}`}
                          draggable={false}
                          className={`kanban-card-enter block bg-surface border border-border rounded-lg p-3 hover:border-primary/40 hover:shadow-md transition-all duration-150 select-none ${
                            isAbandoned ? "opacity-40" : isBrowsing || isInProgress ? "opacity-70" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Avatar name={app.candidateName} id={app.candidateId} size="sm" />
                            <div className="flex-1 min-w-0">
                              <p className="text-body-sm font-semibold text-text truncate">
                                {app.candidateName}
                              </p>
                              {isBrowsing && (
                                <p className="text-micro text-muted">Browsing</p>
                              )}
                              {isInProgress && (
                                <p className="text-micro text-warning">⏳ In progress</p>
                              )}
                              <p className="text-micro text-subtle truncate">
                                {app.vacancyTitle}
                              </p>
                            </div>
                          </div>
                          <p className="text-micro text-subtle mt-2">
                            {formatRelativeTime(app.lastActivityAt)}
                          </p>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
