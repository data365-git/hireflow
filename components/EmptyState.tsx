type Props = {
  icon?: React.ReactNode;
  title: string;
  description?: string;
};

export function EmptyState({ icon, title, description }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
      {icon && <div className="text-disabled">{icon}</div>}
      <p className="text-body-sm font-semibold text-muted">{title}</p>
      {description && <p className="text-body-sm text-subtle max-w-xs">{description}</p>}
    </div>
  );
}
