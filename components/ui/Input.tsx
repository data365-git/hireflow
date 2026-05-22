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
            "w-full min-h-10 rounded-lg border border-border bg-surface px-3 py-2 text-body-sm text-text shadow-sm outline-none transition-all placeholder:text-subtle",
            "hover:border-border-strong focus:border-primary focus:ring-2 focus:ring-primary/12",
            "disabled:bg-surface-2 disabled:text-disabled disabled:shadow-none",
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
