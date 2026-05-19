import type { TimelineEvent } from "@/lib/types";
import { formatRelativeTime } from "@/lib/utils";

type Props = { event: TimelineEvent };

const TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  application_started:  { icon: "✦", color: "text-info" },
  application_completed:{ icon: "✓", color: "text-success" },
  answer_submitted:     { icon: "◎", color: "text-accent" },
  stage_changed:        { icon: "→", color: "text-primary" },
};

export function TimelineEntry({ event }: Props) {
  const cfg = TYPE_CONFIG[event.type] ?? { icon: "·", color: "text-subtle" };
  return (
    <div className="flex gap-3 py-3 border-b border-border last:border-0">
      <div className={`text-body-sm font-bold shrink-0 w-5 text-center ${cfg.color}`}>
        {cfg.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-body-sm text-text">{event.description}</p>
        <p className="text-micro text-subtle mt-1">{formatRelativeTime(event.createdAt)}</p>
      </div>
    </div>
  );
}
