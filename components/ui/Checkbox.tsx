import { InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Checkbox({ label, id, ...props }: Props) {
  const inputId = id ?? (typeof label === "string" ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
  return (
    <label htmlFor={inputId} className="inline-flex items-center gap-2 cursor-pointer select-none">
      <input
        id={inputId}
        type="checkbox"
        className="rounded border-border accent-primary cursor-pointer"
        {...props}
      />
      {label && <span className="text-body-sm text-text">{label}</span>}
    </label>
  );
}
