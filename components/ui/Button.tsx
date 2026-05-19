import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANT: Record<Variant, string> = {
  primary:   "bg-primary text-primary-fg hover:bg-primary-hover shadow-xs",
  secondary: "bg-surface text-text border border-border hover:bg-surface-2 shadow-xs",
  ghost:     "text-muted hover:text-text hover:bg-surface-2",
  danger:    "bg-danger-soft text-danger hover:bg-danger hover:text-white border border-danger/20",
};

const SIZE: Record<Size, string> = {
  sm: "h-7 px-2.5 text-micro rounded-md gap-1.5",
  md: "h-8 px-3 text-body-sm rounded-lg gap-2",
  lg: "h-9 px-4 text-body-sm rounded-lg gap-2",
};

export function Button({ variant = "secondary", size = "md", className, children, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all duration-120 disabled:opacity-40 disabled:cursor-not-allowed select-none",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
    >
      {children}
    </button>
  );
}
