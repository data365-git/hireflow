"use client";

interface Props {
  role: string;
  color: string | null;
}

export function RoleBadge({ role, color }: Props) {
  if (color) {
    return (
      <span
        className="inline-flex items-center px-2 h-5 rounded-full text-micro font-semibold"
        style={{ background: `${color}33`, color }}
      >
        {role}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 h-5 rounded-full text-micro font-semibold bg-primary/10 text-primary">
      {role}
    </span>
  );
}
