"use client";
import { useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { KanbanColumn } from "./KanbanColumn";
import { toast } from "@/lib/hooks/useToast";

type Props = {
  vacancyId: string;
  selectedAppIds: Set<string>;
  onToggleSelect: (appId: string) => void;
  filteredAppIds?: Set<string>;
};

const STALE_MS = 7 * 86400000;

export function KanbanBoard({ vacancyId, selectedAppIds, onToggleSelect, filteredAppIds }: Props) {
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

  const now = Date.now();

  // Pre-compute per-stage app lists (unfiltered) for conversion rate denominator
  const stageApps = stages.map((stage) => getApplicationsForStage(vacancyId, stage.id));

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
              onDrop={(stageId) => {
                const appId = draggingId.current;
                if (!appId) return;
                draggingId.current = null;

                const { applications } = useStore.getState();
                const app = applications.find((a) => a.id === appId);
                const prevStageId = app?.currentStageId;

                moveApplicationToStage(appId, stageId);

                if (prevStageId && prevStageId !== stageId) {
                  toast.show({
                    message: `Moved to ${stage.name}`,
                    type: "info",
                    duration: 4000,
                    action: {
                      label: "Undo",
                      onClick: () => moveApplicationToStage(appId, prevStageId),
                    },
                  });
                }
              }}
              search={search}
              filterUnread={filterUnread}
              filterStale={filterStale}
              nextStageConversion={nextStageConversion}
              staleCount={staleCount}
            />
          );
        })}
      </div>
    </div>
  );
}
