"use client";

type Props = {
  view: "kanban" | "list";
  onChange: (v: "kanban" | "list") => void;
};

export function PipelineViewToggle({ view, onChange }: Props) {
  return (
    <div className="bg-surface-2 rounded-lg p-0.5 flex items-center gap-0.5">
      <button
        onClick={() => onChange("kanban")}
        className={`flex items-center gap-1.5 h-7 px-3 rounded-md text-body-sm font-medium transition-all ${
          view === "kanban"
            ? "bg-primary text-primary-fg"
            : "text-muted hover:text-text"
        }`}
      >
        <span className="text-[13px]">⊞</span>
        Kanban
      </button>
      <button
        onClick={() => onChange("list")}
        className={`flex items-center gap-1.5 h-7 px-3 rounded-md text-body-sm font-medium transition-all ${
          view === "list"
            ? "bg-primary text-primary-fg"
            : "text-muted hover:text-text"
        }`}
      >
        <span className="text-[13px]">≡</span>
        List
      </button>
    </div>
  );
}
