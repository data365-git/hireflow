import type { VacancyStage } from "@/lib/types";

type Props = { stage: VacancyStage; size?: "sm" | "md" };

const STAGE_COLORS: Record<string, { fg: string; bg: string }> = {
  new:        { fg: "var(--color-stage-new-fg)",        bg: "var(--color-stage-new-bg)" },
  screening:  { fg: "var(--color-stage-screening-fg)",  bg: "var(--color-stage-screening-bg)" },
  qualified:  { fg: "var(--color-stage-qualified-fg)",  bg: "var(--color-stage-qualified-bg)" },
  test:       { fg: "var(--color-stage-test-fg)",       bg: "var(--color-stage-test-bg)" },
  interview:  { fg: "var(--color-stage-interview-fg)",  bg: "var(--color-stage-interview-bg)" },
  hired:      { fg: "var(--color-stage-hired-fg)",      bg: "var(--color-stage-hired-bg)" },
  rejected:   { fg: "var(--color-stage-rejected-fg)",   bg: "var(--color-stage-rejected-bg)" },
};

export function StagePill({ stage, size = "sm" }: Props) {
  const c = STAGE_COLORS[stage.color] ?? { fg: "#94A3B8", bg: "#F1F5F9" };
  const padding = size === "sm" ? "px-2 h-5" : "px-2.5 h-6";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full ${padding} text-micro font-semibold`}
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      <span
        className="size-1.5 rounded-full shrink-0"
        style={{ backgroundColor: c.fg }}
      />
      {stage.name}
    </span>
  );
}
