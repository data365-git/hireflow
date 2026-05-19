import type { VacancyStage, Application } from "@/lib/types";

type Props = {
  stages: VacancyStage[];
  applications: Application[];
  className?: string;
};

export function PipelineMiniBar({ stages, applications, className = "" }: Props) {
  const total = applications.length;
  if (total === 0 || stages.length === 0) {
    return <div className={`h-1.5 bg-surface-3 rounded-full ${className}`} />;
  }

  const sorted = [...stages].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className={`flex h-1.5 rounded-full overflow-hidden gap-px ${className}`}>
      {sorted.map((stage) => {
        const count = applications.filter((a) => a.currentStageId === stage.id).length;
        if (count === 0) return null;
        const pct = (count / total) * 100;
        return (
          <div
            key={stage.id}
            className="h-full rounded-sm"
            style={{
              width: `${pct}%`,
              backgroundColor: `var(--color-stage-${stage.color}-fg)`,
              opacity: 0.7,
            }}
            title={`${stage.name}: ${count}`}
          />
        );
      })}
    </div>
  );
}
