"use client";

import type { TimelineEvent, UUID, VacancyStage } from "@/lib/types";

type StageHistorySegment = {
  stageId: UUID;
  stageName: string;
  color: string;
  enteredAt: string;
  leftAt: string | null;
  durationMs: number;
  isCurrent: boolean;
};

type Props = {
  timeline: TimelineEvent[];
  stages: VacancyStage[];
  currentStageId: UUID;
  appliedAt: string;
};

const COLOR_DOT: Record<string, string> = {
  new: "bg-slate-400",
  screening: "bg-blue-500",
  qualified: "bg-violet-500",
  test: "bg-amber-500",
  interview: "bg-orange-500",
  hired: "bg-green-600",
  rejected: "bg-red-500",
};

export function StageHistory({ timeline, stages, currentStageId, appliedAt }: Props) {
  const stageById = new Map(stages.map((stage) => [stage.id, stage]));
  const now = new Date();
  const segments = buildStageHistory({
    timeline,
    stages,
    currentStageId,
    appliedAt,
    now,
  });
  const totalMs = segments.reduce((sum, segment) => sum + segment.durationMs, 0);

  if (segments.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface px-4 py-5">
        <p className="text-body-sm font-semibold text-text">Stage history</p>
        <p className="text-body-sm text-muted mt-1">No stage movement has been recorded yet.</p>
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-surface">
      <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-body-sm font-semibold text-text">Stage history</h2>
          <p className="text-micro text-subtle mt-0.5">Durations are calculated from timeline events.</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-micro text-subtle uppercase tracking-wide">Total time</p>
          <p className="text-body-sm font-semibold text-text">{formatDuration(totalMs)}</p>
        </div>
      </div>

      <ol className="divide-y divide-border">
        {segments.map((segment, index) => {
          const stage = stageById.get(segment.stageId);
          const dotClass = COLOR_DOT[segment.color] ?? "bg-primary";

          return (
            <li key={`${segment.stageId}-${segment.enteredAt}-${index}`} className="flex gap-3 px-4 py-3">
              <div className="pt-1">
                <span className={`block size-2.5 rounded-full ${dotClass}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-body-sm font-medium text-text truncate">{segment.stageName}</p>
                  {segment.isCurrent && (
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-micro font-medium text-primary">
                      Current
                    </span>
                  )}
                  {stage?.isRejected && (
                    <span className="shrink-0 rounded-full bg-danger/10 px-2 py-0.5 text-micro font-medium text-danger">
                      Rejected
                    </span>
                  )}
                </div>
                <p className="text-micro text-subtle mt-1">
                  {formatDateTime(segment.enteredAt)} to{" "}
                  {segment.leftAt ? formatDateTime(segment.leftAt) : "now"}
                </p>
              </div>
              <p className="shrink-0 text-body-sm font-semibold text-text">{formatDuration(segment.durationMs)}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function buildStageHistory({
  timeline,
  stages,
  currentStageId,
  appliedAt,
  now,
}: Props & { now: Date }): StageHistorySegment[] {
  const stageById = new Map(stages.map((stage) => [stage.id, stage]));
  const sortedTimeline = [...timeline].sort((a, b) => toTime(a.createdAt) - toTime(b.createdAt));
  const stageEvents = sortedTimeline.filter(
    (event) => event.type === "stage_changed" && (event.fromStageId || event.toStageId),
  );

  const firstTimelineTime = sortedTimeline[0]?.createdAt;
  let enteredAt = validDateString(firstTimelineTime) ?? validDateString(appliedAt) ?? now.toISOString();
  let activeStageId = stageEvents[0]?.fromStageId ?? currentStageId;

  if (!activeStageId) return [];

  const segments: StageHistorySegment[] = [];

  for (const event of stageEvents) {
    const eventAt = validDateString(event.createdAt);
    if (!eventAt) continue;

    if (!activeStageId && event.fromStageId) {
      activeStageId = event.fromStageId;
    }

    if (activeStageId) {
      segments.push(createSegment({
        stageId: activeStageId,
        stageById,
        enteredAt,
        leftAt: eventAt,
        now,
        isCurrent: false,
      }));
    }

    activeStageId = event.toStageId ?? activeStageId;
    enteredAt = eventAt;
  }

  if (activeStageId) {
    segments.push(createSegment({
      stageId: activeStageId,
      stageById,
      enteredAt,
      leftAt: null,
      now,
      isCurrent: activeStageId === currentStageId,
    }));
  }

  return segments.filter((segment) => segment.durationMs >= 0);
}

function createSegment({
  stageId,
  stageById,
  enteredAt,
  leftAt,
  now,
  isCurrent,
}: {
  stageId: UUID;
  stageById: Map<UUID, VacancyStage>;
  enteredAt: string;
  leftAt: string | null;
  now: Date;
  isCurrent: boolean;
}): StageHistorySegment {
  const stage = stageById.get(stageId);
  const endTime = leftAt ? toTime(leftAt) : now.getTime();
  const startTime = toTime(enteredAt);

  return {
    stageId,
    stageName: stage?.name ?? "Unknown stage",
    color: stage?.color ?? "new",
    enteredAt,
    leftAt,
    durationMs: Math.max(0, endTime - startTime),
    isCurrent,
  };
}

function validDateString(value?: string | null) {
  if (!value) return null;
  return Number.isNaN(new Date(value).getTime()) ? null : value;
}

function toTime(value: string) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms: number) {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}
