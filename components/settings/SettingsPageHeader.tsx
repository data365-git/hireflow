interface Props {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function SettingsPageHeader({ title, description, actions }: Props) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-semibold text-text">{title}</h1>
        {description && <p className="text-sm text-muted mt-0.5">{description}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}
