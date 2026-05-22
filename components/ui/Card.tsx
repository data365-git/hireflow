import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
}

const PADDING = { none: "", sm: "p-3", md: "p-4", lg: "p-5" };

export function Card({ padding = "md", className, children, ...props }: CardProps) {
  return (
    <div
      {...props}
      className={cn(
        "bg-surface-elevated border border-border rounded-2xl shadow-sm transition-shadow hover:shadow-md",
        PADDING[padding],
        className
      )}
    >
      {children}
    </div>
  );
}
