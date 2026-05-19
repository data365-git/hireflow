"use client";

interface Props {
  active: boolean;
}

export function StatusPill({ active }: Props) {
  if (active) {
    return (
      <span className="inline-flex items-center px-2 h-5 rounded-full text-micro font-semibold bg-success-soft text-success">
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 h-5 rounded-full text-micro font-semibold bg-surface-3 text-subtle">
      Inactive
    </span>
  );
}
