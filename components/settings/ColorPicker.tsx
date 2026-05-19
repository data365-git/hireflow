"use client";

const PALETTE = [
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#64748b",
];

interface Props {
  value: string;
  onChange: (hex: string) => void;
}

export function ColorPicker({ value, onChange }: Props) {
  return (
    <div className="flex gap-2 flex-wrap">
      {PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          title={color}
          className={`size-7 rounded-full transition-all ${
            value === color ? "ring-2 ring-offset-1 ring-current scale-110" : "hover:scale-105"
          }`}
          style={{ backgroundColor: color, color }}
        />
      ))}
    </div>
  );
}
