type Props = { keys: string | string[] };

export function KbdHint({ keys }: Props) {
  const items = Array.isArray(keys) ? keys : [keys];
  return (
    <span className="inline-flex items-center gap-0.5">
      {items.map((k, i) => (
        <kbd
          key={i}
          className="inline-flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded text-[9px] font-semibold bg-surface-2 text-subtle border border-border leading-none"
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}
