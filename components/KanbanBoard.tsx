"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveApplicationToStage as moveApplicationToStageAction } from "@/app/actions/applications";
import { useStore } from "@/lib/store";
import { KanbanColumn } from "./KanbanColumn";
import { toast } from "@/lib/hooks/useToast";
import type { VacancyStage } from "@/lib/types";

type Props = {
  vacancyId: string;
  selectedAppIds: Set<string>;
  onToggleSelect: (appId: string) => void;
  filteredAppIds?: Set<string>;
};

const STALE_MS = 7 * 86400000;

type PendingStageMove = {
  applicationId: string;
  fromStageId: string;
  toStageId: string;
  candidateName: string;
};

export function KanbanBoard({ vacancyId, selectedAppIds, onToggleSelect, filteredAppIds }: Props) {
  const router = useRouter();
  const allStages = useStore((s) => s.stages);
  const stages = useMemo(
    () => allStages.filter((s) => s.vacancyId === vacancyId).sort((a, b) => a.orderIndex - b.orderIndex),
    [allStages, vacancyId],
  );
  const getApplicationsForStage = useStore((s) => s.getApplicationsForStage);
  const getCandidateForApplication = useStore((s) => s.getCandidateForApplication);
  const moveApplicationToStage = useStore((s) => s.moveApplicationToStage);
  const messages = useStore((s) => s.messages);
  const currentUserId = useStore((s) => s.currentUserId);

  const draggingId = useRef<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterUnread, setFilterUnread] = useState(false);
  const [filterStale, setFilterStale] = useState(false);
  const [pendingMove, setPendingMove] = useState<PendingStageMove | null>(null);
  const [stageComment, setStageComment] = useState("");
  const [moveError, setMoveError] = useState<string | null>(null);
  const [movingAppId, setMovingAppId] = useState<string | null>(null);
  const [movePending, startMoveTransition] = useTransition();

  const now = Date.now();

  // Pre-compute per-stage app lists (unfiltered) for conversion rate denominator
  const stageApps = stages.map((stage) => getApplicationsForStage(vacancyId, stage.id));
  const selectedMoveStage = pendingMove
    ? stages.find((stage) => stage.id === pendingMove.toStageId)
    : null;

  function resetCommentPrompt() {
    setPendingMove(null);
    setStageComment("");
    setMoveError(null);
  }

  function executeStageMove(
    applicationId: string,
    toStage: VacancyStage,
    fromStageId: string,
    comment?: string,
    showUndo = true,
  ) {
    const trimmedComment = comment?.trim();
    if (toStage.isRejected && !trimmedComment) {
      setMoveError("Comment is required when rejecting a candidate.");
      return;
    }

    startMoveTransition(async () => {
      try {
        setMoveError(null);
        setMovingAppId(applicationId);
        await moveApplicationToStageAction(applicationId, toStage.id, trimmedComment || undefined);
        moveApplicationToStage(applicationId, toStage.id);
        resetCommentPrompt();
        router.refresh();

        if (showUndo && fromStageId !== toStage.id) {
          toast.show({
            message: `Moved to ${toStage.name}`,
            type: "info",
            duration: 4000,
            action: {
              label: "Undo",
              onClick: () => {
                const fromStage = stages.find((stage) => stage.id === fromStageId);
                if (fromStage) {
                  executeStageMove(applicationId, fromStage, toStage.id, undefined, false);
                }
              },
            },
          });
        }
      } catch (err) {
        setMoveError(err instanceof Error ? err.message : "Failed to move candidate.");
        toast.show({
          message: "Failed to move candidate.",
          type: "error",
          duration: 4000,
        });
      } finally {
        setMovingAppId(null);
      }
    });
  }

  function requestStageMove(stageId: string) {
    const appId = draggingId.current;
    draggingId.current = null;
    if (!appId || movingAppId === appId || movePending) return;

    const { applications, candidates } = useStore.getState();
    const app = applications.find((a) => a.id === appId);
    const toStage = stages.find((stage) => stage.id === stageId);
    if (!app || !toStage || app.currentStageId === stageId) return;

    if (toStage.isFinal || toStage.isRejected) {
      const candidate = candidates.find((c) => c.id === app.candidateId);
      setPendingMove({
        applicationId: appId,
        fromStageId: app.currentStageId,
        toStageId: stageId,
        candidateName: candidate?.fullName ?? "Candidate",
      });
      setStageComment("");
      setMoveError(null);
      return;
    }

    executeStageMove(appId, toStage, app.currentStageId);
  }

  function confirmCommentedMove() {
    if (!pendingMove || !selectedMoveStage) return;
    executeStageMove(
      pendingMove.applicationId,
      selectedMoveStage,
      pendingMove.fromStageId,
      stageComment,
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle text-body-sm">⌕</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search candidates…"
            className="h-8 pl-8 pr-3 bg-surface border border-border rounded-lg text-body-sm text-text placeholder:text-subtle outline-none focus:border-primary w-56"
          />
        </div>
        <button
          onClick={() => setFilterUnread(f => !f)}
          className={`h-7 px-2.5 rounded-md text-body-sm border transition-colors ${filterUnread ? "bg-primary text-primary-fg border-primary" : "bg-surface border-border text-muted hover:bg-surface-2"}`}
        >
          💬 Has unread
        </button>
        <button
          onClick={() => setFilterStale(f => !f)}
          className={`h-7 px-2.5 rounded-md text-body-sm border transition-colors ${filterStale ? "bg-warning-soft text-warning border-warning/30" : "bg-surface border-border text-muted hover:bg-surface-2"}`}
        >
          ⏱ Stale &gt;7d
        </button>
        {(filterUnread || filterStale || search) && (
          <button
            onClick={() => { setFilterUnread(false); setFilterStale(false); setSearch(""); }}
            className="h-7 px-2.5 text-micro text-muted hover:text-text"
          >
            ✕ Clear
          </button>
        )}
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4 pt-1 px-1">
        {stages.map((stage, i) => {
          let apps = stageApps[i];

          // Compute staleCount before filtering (represents all apps in the column)
          const staleCount = apps.filter(a => now - new Date(a.lastActivityAt).getTime() > STALE_MS).length;

          // Compute conversion rate: next stage count / this stage count * 100
          const nextApps = i + 1 < stageApps.length ? stageApps[i + 1] : undefined;
          const nextStageConversion = nextApps !== undefined
            ? (apps.length > 0 ? (nextApps.length / apps.length) * 100 : 0)
            : undefined;

          // Apply outer filter (from ApplicationSearch)
          if (filteredAppIds) {
            apps = apps.filter((a) => filteredAppIds.has(a.id));
          }

          // Apply filters
          if (filterUnread) {
            apps = apps.filter(a =>
              messages.some(m => m.applicationId === a.id && m.direction === "inbound" && !m.readByUserIds.includes(currentUserId))
            );
          }
          if (filterStale) {
            apps = apps.filter(a => now - new Date(a.lastActivityAt).getTime() > STALE_MS);
          }

          const allSelected = apps.length > 0 && apps.every((a) => selectedAppIds.has(a.id));

          return (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              applications={apps}
              getCandidateForApplication={getCandidateForApplication}
              selectedAppIds={selectedAppIds}
              onToggleSelect={onToggleSelect}
              allSelected={allSelected}
              onToggleSelectAll={() => {
                if (allSelected) {
                  apps.forEach((a) => { if (selectedAppIds.has(a.id)) onToggleSelect(a.id); });
                } else {
                  apps.forEach((a) => { if (!selectedAppIds.has(a.id)) onToggleSelect(a.id); });
                }
              }}
              onDragStart={(applicationId) => { draggingId.current = applicationId; }}
              onDrop={requestStageMove}
              search={search}
              filterUnread={filterUnread}
              filterStale={filterStale}
              nextStageConversion={nextStageConversion}
              staleCount={staleCount}
            />
          );
        })}
      </div>

      {pendingMove && selectedMoveStage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3 py-6">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-4 shadow-xl sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-h3 text-text">Move to {selectedMoveStage.name}</h3>
                <p className="mt-1 text-body-sm text-muted">
                  Add a short note for {pendingMove.candidateName}.
                  {selectedMoveStage.isRejected ? " Rejections require a reason." : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={resetCommentPrompt}
                disabled={movePending}
                className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text disabled:opacity-50"
                aria-label="Close"
              >
                x
              </button>
            </div>

            <textarea
              value={stageComment}
              onChange={(e) => {
                setStageComment(e.target.value);
                if (moveError) setMoveError(null);
              }}
              autoFocus
              rows={4}
              className={`mt-4 w-full resize-none rounded-lg border bg-bg px-3 py-2 text-body-sm text-text outline-none focus:border-primary ${
                moveError ? "border-danger" : "border-border"
              }`}
              placeholder="Write a short note..."
            />
            {moveError && <p className="mt-2 text-body-sm text-danger">{moveError}</p>}

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={resetCommentPrompt}
                disabled={movePending}
                className="h-9 rounded-lg border border-border px-4 text-body-sm text-muted hover:bg-surface-2 hover:text-text disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmCommentedMove}
                disabled={movePending}
                className="h-9 rounded-lg bg-primary px-4 text-body-sm font-medium text-primary-fg disabled:opacity-50"
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
