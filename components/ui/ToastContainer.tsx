"use client";
import { useToastStore } from "@/lib/hooks/useToast";

const TYPE_STYLES = {
  success: "bg-success text-white",
  error:   "bg-danger text-white",
  info:    "bg-primary text-primary-fg",
  warning: "bg-warning text-white",
};

export function ToastContainer() {
  const { toasts, remove } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map((t) => {
        const style = TYPE_STYLES[t.type ?? "info"];
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 h-10 rounded-xl shadow-lg text-body-sm font-medium max-w-sm ${style}`}
          >
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <button
                onClick={() => { t.action!.onClick(); remove(t.id); }}
                className="text-white/80 hover:text-white underline text-body-sm font-medium shrink-0"
              >
                {t.action.label}
              </button>
            )}
            <button onClick={() => remove(t.id)} className="text-white/60 hover:text-white shrink-0">✕</button>
          </div>
        );
      })}
    </div>
  );
}
