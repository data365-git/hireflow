import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type PillVariant = "default" | "success" | "warning" | "danger" | "info" | "primary" | "muted";

interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: PillVariant;
  dot?: boolean;
}

const VARIANT: Record<PillVariant, string> = {
  default: "bg-surface-2 text-muted",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger:  "bg-danger-soft text-danger",
  info:    "bg-info-soft text-info",
  primary: "bg-primary-soft text-primary",
  muted:   "bg-surface-3 text-subtle",
};

const DOT: Record<PillVariant, string> = {
  default: "bg-muted",
  success: "bg-success",
  warning: "bg-warning",
  danger:  "bg-danger",
  info:    "bg-info",
  primary: "bg-primary",
  muted:   "bg-subtle",
};

export function Pill({ variant = "default", dot, className, children, ...props }: PillProps) {
  return (
    <span
      {...props}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 h-5 rounded-full text-micro font-semibold",
        VARIANT[variant],
        className,
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full shrink-0", DOT[variant])} />}
      {children}
    </span>
  );
}
