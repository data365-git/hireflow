"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { formatRelativeTime } from "@/lib/utils";
import { useDataMode } from "@/context/DataModeContext";
import { getPipelineApplications, type PipelineApplication } from "@/app/actions/applications";
import { getAllVacancies } from "@/app/actions/vacancies";

// ── Attention card ────────────────────────────────────────────────────────────

type SimpleVacancy = { id: string; title: string };

type AttentionCardProps = {
  title: string;
  icon: string;
  color: string;
  items: PipelineApplication[];
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

// ── Stage column order ────────────────────────────────────────────────────────

const STAGE_ORDER = ["new", "screening", "qualified", "test", "interview", "hired", "rejected"] as const;
const STAGE_LABELS: Record<string, string> = {
  new: "New",
  screening: "Screening",
  qualified: "Qualified",
  test: "Test",
  interview: "Interview",
  hired: "Hired",
  rejected: "Rejected",
};

// Inline style colors for column header accent dot per stage color key
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

export default function MyPipelinePage() {
  const { mode } = useDataMode();
  const [apps, setApps] = useState<PipelineApplication[]>([]);
  const [vacancies, setVacancies] = useState<SimpleVacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterVacancyId, setFilterVacancyId] = useState<string>("all");

  useEffect(() => {
    setLoading(true);
    Promise.all([getPipelineApplications(), getAllVacancies()]).then(([a, v]) => {
      setApps(a);
      setVacancies(v.map((vac) => ({ id: vac.id, title: vac.title })));
      setLoading(false);
    });
  }, [mode]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const activeVacancies = vacancies;

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
    .filter((a) => {
      // hasUnread is false for now — server action always returns false
      // Future: derive from real unread state
      return a.hasUnread && Date.now() - new Date(a.lastActivityAt).getTime() > oneDayMs;
    })
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

  const hasAttention =
    awaitingReply.length > 0 || stuckCandidates.length > 0 || newToday.length > 0;

  // ── Unified Kanban ─────────────────────────────────────────────────────────

  const visibleApps = apps.filter((a) => {
    if (filterVacancyId !== "all" && a.vacancyId !== filterVacancyId) return false;
    return true;
  });

  // Group apps by stageColor
  const appsByColor = new Map<string, PipelineApplication[]>();
  for (const colorKey of STAGE_ORDER) {
    appsByColor.set(colorKey, []);
  }
  for (const app of visibleApps) {
    if (appsByColor.has(app.stageColor)) {
      appsByColor.get(app.stageColor)!.push(app);
    }
  }

  // Only show "rejected" column if there are candidates there
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
      {/* ── Hero greeting ── */}
      <div className="px-8 pt-6 pb-4">
        <h1 className="text-h1 text-text">My Pipeline</h1>
        <p className="text-body-sm text-muted mt-0.5">
          {today} · {activeVacancies.length} active{" "}
          {activeVacancies.length === 1 ? "vacancy" : "vacancies"}
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

      {/* ── Active Pipeline Kanban ── */}
      <div className="px-8 mb-3 flex items-center justify-between">
        <h2 className="text-h3 text-text">Active Pipeline</h2>
        <select
          value={filterVacancyId}
          onChange={(e) => setFilterVacancyId(e.target.value)}
          className="h-7 px-2 rounded-md border border-border bg-surface text-body-sm text-text outline-none"
        >
          <option value="all">All vacancies</option>
          {activeVacancies.map((v) => (
            <option key={v.id} value={v.id}>
              {v.title}
            </option>
          ))}
        </select>
      </div>

      <div className="px-8 pb-8">
        <div className="flex gap-4 overflow-x-auto pb-6">
          {columnsToShow.map((colorKey) => {
            const colApps = appsByColor.get(colorKey) ?? [];
            return (
              <div key={colorKey} className="min-w-[220px] max-w-[220px] flex flex-col gap-2">
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

                {/* Cards */}
                {colApps.length === 0 ? (
                  <div className="text-micro text-subtle px-1">Empty</div>
                ) : (
                  colApps.map((app) => {
                    const vacancy = vacancies.find((v) => v.id === app.vacancyId);
                    return (
                      <Link
                        key={app.id}
                        href={`/candidates/${app.id}`}
                        className="block bg-surface border border-border rounded-lg p-3 hover:border-primary/40 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <Avatar
                            name={app.candidateName}
                            id={app.candidateId}
                            size="sm"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-body-sm font-semibold text-text truncate">
                              {app.candidateName}
                            </p>
                            <p className="text-micro text-subtle truncate">
                              {vacancy?.title ?? ""}
                            </p>
                          </div>
                        </div>
                        <p className="text-micro text-subtle mt-2">
                          {formatRelativeTime(app.lastActivityAt)}
                        </p>
                      </Link>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
