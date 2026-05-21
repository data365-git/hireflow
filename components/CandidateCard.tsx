"use client";

import { useMemo } from "react";
import type { Application, Candidate, VacancyStage } from "@/lib/types";
import { useStore } from "@/lib/store";
import { Avatar } from "./Avatar";
import { timeInStage } from "@/lib/utils";

const CARD_ACCENT_COLOR: Record<string, string> = {
  new:        "var(--color-stage-new)",
  screening:  "var(--color-stage-screening)",
  qualified:  "var(--color-stage-qualified)",
  test:       "var(--color-stage-test)",
  interview:  "var(--color-stage-interview)",
  hired:      "var(--color-stage-hired)",
  rejected:   "var(--color-stage-rejected)",
};

const DIMMED_APPLICATION_STATUSES = new Set<Application["status"]>(["browsing", "in_progress"]);

const APPLICATION_STATUS_PILLS: Partial<Record<Application["status"], { label: string; className: string }>> = {
  browsing: {
    label: "Browsing",
    className: "bg-surface-2 text-muted border-border",
  },
  in_progress: {
    label: "In progress",
    className: "bg-warning-soft text-warning border-warning/30",
  },
  abandoned: {
    label: "Abandoned",
    className: "bg-surface-3 text-muted border-border",
  },
};

type Props = {
  application: Application;
  candidate: Candidate;
  stage: VacancyStage;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  selected?: boolean;
  onToggleSelect?: () => void;
  onDelete?: () => void;
  sourceName?: string | null;
  applicationRank?: number;
};

export function CandidateCard({ application, candidate, stage, onClick, onDragStart, selected, onToggleSelect, onDelete, sourceName, applicationRank }: Props) {
  const allMessages = useStore(s => s.messages);
  const currentUserId = useStore(s => s.currentUserId);
  const messages = useMemo(
    () => allMessages.filter(m => m.applicationId === application.id)
      .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()),
    [allMessages, application.id],
  );

  const isNew = (() => {
    const days = Math.floor((Date.now() - new Date(application.appliedAt).getTime()) / (1000 * 60 * 60 * 24));
    return days <= 1;
  })();

  const staleDays = Math.floor((Date.now() - new Date(application.lastActivityAt).getTime()) / 86400000);
  const staleColor =
    staleDays >= 7 ? "text-danger bg-danger-soft" :
    staleDays >= 3 ? "text-warning bg-warning-soft" :
    "text-subtle bg-surface-2";

  const accentColor = CARD_ACCENT_COLOR[stage.color];

  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : undefined;
  const unread = messages.filter(m => m.direction === "inbound" && !m.readByUserIds.includes(currentUserId)).length;
  const statusPill = APPLICATION_STATUS_PILLS[application.status];
  const isDimmedStatus = DIMMED_APPLICATION_STATUSES.has(application.status);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className={`relative bg-surface border border-border border-l-2 rounded-lg p-3 cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group select-none ${
        isDimmedStatus ? "opacity-[0.68]" : ""
      }`}
      style={{ borderLeftColor: accentColor }}
    >
      {onToggleSelect !== undefined && (
        <input
          type="checkbox"
          className="absolute top-2 right-2 size-4 cursor-pointer accent-primary"
          checked={selected ?? false}
          onChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      {onDelete && onToggleSelect === undefined && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Delete application"
            className="size-6 rounded flex items-center justify-center text-subtle hover:text-danger hover:bg-danger-soft transition-colors"
            aria-label="Delete application"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
      )}
      <div className="flex items-start gap-2.5">
        <Avatar name={candidate.fullName} id={candidate.id} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-body-sm font-semibold text-text truncate leading-tight">
              {candidate.fullName}
            </p>
            {isNew && (
              <span className="shrink-0 text-micro bg-primary text-primary-fg px-1.5 h-4 rounded-full inline-flex items-center">
                New
              </span>
            )}
            {applicationRank && applicationRank > 1 && (
              <span className="shrink-0 text-micro bg-surface-2 text-muted border border-border px-1.5 h-4 rounded-full inline-flex items-center">
                {applicationRank === 2 ? "2nd" : applicationRank === 3 ? "3rd" : `${applicationRank}th`} attempt
              </span>
            )}
          </div>
          <p className="text-micro text-subtle truncate mt-0.5">
            @{candidate.telegramUsername}
            {lastMsg && (
              <span className="ml-1 text-subtle/70">
                {lastMsg.direction === "outbound" ? "→ " : ""}{lastMsg.text}
              </span>
            )}
          </p>
          {sourceName && (
            <span className="mt-0.5 inline-flex items-center text-micro text-muted bg-surface-2 rounded-full px-2 py-0.5">
              {sourceName}
            </span>
          )}
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="text-micro text-subtle">{candidate.phone}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {statusPill && (
            <span className={`text-micro border px-1.5 h-5 rounded-full inline-flex items-center gap-1 ${statusPill.className}`}>
              {application.status === "in_progress" && (
                <span className="size-1.5 rounded-full bg-warning inline-block" />
              )}
              {statusPill.label}
            </span>
          )}
          {unread > 0 && (
            <span className="text-micro bg-primary text-primary-fg px-1.5 h-5 rounded-full inline-flex items-center gap-0.5">
              💬 {unread}
            </span>
          )}
          <span className={`text-micro px-2 h-5 rounded-full inline-flex items-center ${staleColor}`}>
            {timeInStage(application.lastActivityAt)}
          </span>
        </div>
      </div>
    </div>
  );
}
