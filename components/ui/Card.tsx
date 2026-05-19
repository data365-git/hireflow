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
      className={cn("bg-surface border border-border rounded-xl shadow-xs", PADDING[padding], className)}
    >
      {children}
    </div>
  );
}
