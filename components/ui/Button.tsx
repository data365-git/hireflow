import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANT: Record<Variant, string> = {
  primary:   "bg-primary text-primary-fg shadow-md shadow-primary/20 hover:bg-primary-hover hover:shadow-lg active:translate-y-px",
  secondary: "bg-surface text-text border border-border shadow-sm hover:bg-surface-2 hover:border-border-strong",
  ghost:     "text-muted hover:text-text hover:bg-surface-2",
  danger:    "bg-danger-soft text-danger border border-danger/20 shadow-sm hover:bg-danger hover:text-white hover:shadow-md active:translate-y-px",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-micro rounded-md gap-1.5",
  md: "h-10 px-4 text-body-sm rounded-lg gap-2",
  lg: "h-11 px-5 text-body rounded-lg gap-2",
};

export function Button({ variant = "secondary", size = "md", className, children, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center font-semibold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0 select-none",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
    >
      {children}
    </button>
  );
}
