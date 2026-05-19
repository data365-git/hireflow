import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: string;          // emoji or single char
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon = "◎", title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="size-12 rounded-full bg-surface-2 flex items-center justify-center text-2xl mb-4 text-subtle">
        {icon}
      </div>
      <p className="text-body font-semibold text-text">{title}</p>
      {description && (
        <p className="text-body-sm text-muted mt-1 max-w-xs leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
