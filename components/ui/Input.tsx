import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div>
        {label && (
          <label htmlFor={inputId} className="block text-body-sm font-medium text-text mb-1">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            "w-full rounded-lg border border-border px-3 py-2 text-body-sm bg-surface text-text placeholder:text-subtle outline-none transition-all",
            "focus:ring-2 focus:ring-primary/30 focus:border-primary",
            "disabled:bg-surface-2 disabled:text-disabled",
            className,
          )}
          {...props}
        />
        {error && <p className="text-micro text-danger mt-1">{error}</p>}
      </div>
    );
  },
);
Input.displayName = "Input";
