"use client";
import { useState } from "react";
import type { Application, Candidate, VacancyStage } from "@/lib/types";
import { CandidateCard } from "./CandidateCard";
import { EmptyState } from "./EmptyState";
import { StagePill } from "./StagePill";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";

type Props = {
  stage: VacancyStage;
  applications: Application[];
  getCandidateForApplication: (id: string) => Candidate | undefined;
  onDrop: (stageId: string) => void;
  onDragStart: (applicationId: string) => void;
  selectedAppIds: Set<string>;
  onToggleSelect: (appId: string) => void;
  allSelected: boolean;
  onToggleSelectAll: () => void;
  search: string;
  filterUnread: boolean;
  filterStale: boolean;
  nextStageConversion?: number;
  staleCount: number;
};

export function KanbanColumn({
  stage,
  applications,
  getCandidateForApplication,
  onDrop,
  onDragStart,
  selectedAppIds,
  onToggleSelect,
  allSelected,
  onToggleSelectAll,
  search,
  filterUnread,
  filterStale,
  nextStageConversion,
  staleCount,
}: Props) {
  const router = useRouter();
  const getCandidateForApplicationStore = useStore(s => s.getCandidateForApplication);
  const [isDragOver, setIsDragOver] = useState(false);

  const visibleApplications = search
    ? applications.filter(app => {
        const candidate = getCandidateForApplicationStore(app.id);
        return candidate?.fullName.toLowerCase().includes(search.toLowerCase());
      })
    : applications;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    onDrop(stage.id);
  };

  return (
    <div className="flex flex-col min-w-[280px] max-w-[280px]">
      {/* Column header */}
      <div className="mb-2 px-0.5">
        <div className="flex items-center justify-between">
          {stage.orderIndex === 0 ? (
            <div className="flex items-center gap-1.5">
              <span className="text-micro font-semibold text-warning bg-warning-soft px-2 h-5 rounded-full inline-flex items-center gap-1">
                📥 {stage.name}
              </span>
            </div>
          ) : (
            <StagePill stage={stage} size="sm" />
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-micro text-subtle font-semibold bg-surface-2 rounded-full px-1.5 h-5 flex items-center justify-center">
              {search && visibleApplications.length !== applications.length
                ? `${visibleApplications.length} of ${applications.length}`
                : applications.length}
            </span>
            {applications.length > 0 && (
              <input
                type="checkbox"
                className="size-4 cursor-pointer accent-primary"
                checked={allSelected}
                onChange={onToggleSelectAll}
                title="Select all in column"
              />
            )}
          </div>
        </div>
        {applications.length > 0 && (
          <div className="flex items-center gap-2 mt-1 px-0.5">
            {nextStageConversion !== undefined && (
              <span className="text-micro text-subtle">
                {Math.round(nextStageConversion)}% → next stage
              </span>
            )}
            {staleCount > 0 && (
              <span className="text-micro text-warning font-semibold">
                ⏱ {staleCount} stale
              </span>
            )}
          </div>
        )}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex-1 flex flex-col gap-2 min-h-[120px] rounded-xl transition-all p-1.5 ${
          isDragOver ? "bg-accent-soft ring-2 ring-primary ring-offset-1" : ""
        }`}
      >
        {applications.length === 0 ? (
          <div className="flex items-center justify-center h-20 rounded-lg border-2 border-dashed border-border text-micro text-subtle">
            Drop here
          </div>
        ) : (
          visibleApplications.map((app) => {
            const candidate = getCandidateForApplication(app.id);
            if (!candidate) return null;
            return (
              <CandidateCard
                key={app.id}
                application={app}
                candidate={candidate}
                stage={stage}
                onClick={() => router.push(`/candidates/${app.id}`)}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  onDragStart(app.id);
                }}
                selected={selectedAppIds.has(app.id)}
                onToggleSelect={() => onToggleSelect(app.id)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
