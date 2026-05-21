"use client";
import { Fragment } from "react";

type Stage = {
  id: string;
  name: string;
  color: string;
  orderIndex: number;
  isFinal?: boolean | null;
  isRejected?: boolean | null;
};

type Props = {
  stages: Stage[];
  currentStageId: string;
  onMoveToStage?: (stageId: string) => void;
  canMove?: boolean;
};

const COLOR_MAP: Record<string, { bg: string; text: string; ring: string }> = {
  new:        { bg: "bg-slate-400",   text: "text-white",    ring: "ring-slate-400/50" },
  screening:  { bg: "bg-blue-500",    text: "text-white",    ring: "ring-blue-500/50" },
  qualified:  { bg: "bg-violet-500",  text: "text-white",    ring: "ring-violet-500/50" },
  test:       { bg: "bg-amber-500",   text: "text-white",    ring: "ring-amber-500/50" },
  interview:  { bg: "bg-orange-500",  text: "text-white",    ring: "ring-orange-500/50" },
  hired:      { bg: "bg-green-600",   text: "text-white",    ring: "ring-green-500/50" },
  rejected:   { bg: "bg-red-500",     text: "text-white",    ring: "ring-red-500/50" },
};

function getColor(color: string) {
  return COLOR_MAP[color] ?? { bg: "bg-primary", text: "text-primary-fg", ring: "ring-primary/30" };
}

export function StageProgressionHeader({ stages, currentStageId, onMoveToStage, canMove = false }: Props) {
  const currentIdx = stages.findIndex(s => s.id === currentStageId);

  return (
    <div className="border-b border-border bg-bg px-6 py-2.5 overflow-x-auto shrink-0">
      <div className="flex items-center gap-0 min-w-max">
        {stages.map((stage, i) => {
          const isPast = i < currentIdx;
          const isCurrent = i === currentIdx;
          const isFuture = i > currentIdx;
          const colors = getColor(stage.color);
          const clickable = isFuture && canMove && onMoveToStage;

          return (
            <Fragment key={stage.id}>
              <button
                type="button"
                onClick={clickable ? () => onMoveToStage(stage.id) : undefined}
                disabled={!clickable}
                className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-lg transition-colors min-w-0 ${
                  clickable ? "cursor-pointer hover:bg-surface-2" : "cursor-default"
                } ${isCurrent ? "opacity-100" : isPast ? "opacity-90" : "opacity-50"}`}
              >
                <div className={`size-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all
                  ${isPast ? `${colors.bg} ${colors.text}` : ""}
                  ${isCurrent ? `ring-2 ${colors.ring} ${colors.bg} ${colors.text} animate-pulse` : ""}
                  ${isFuture ? "bg-surface-3 text-subtle ring-1 ring-border" : ""}
                `}>
                  {isPast ? "✓" : isCurrent ? "●" : "○"}
                </div>
                <span className="text-[10px] font-medium text-text whitespace-nowrap max-w-[64px] truncate">
                  {stage.name}
                </span>
                {isCurrent && (
                  <span className="text-[9px] text-primary font-semibold leading-none">NOW</span>
                )}
              </button>
              {i < stages.length - 1 && (
                <div className={`w-4 h-px shrink-0 mx-0.5 ${isPast ? colors.bg : "bg-border"}`} />
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
