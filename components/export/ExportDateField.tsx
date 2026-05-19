"use client";
import { useRef, useState, useEffect } from "react";
import {
  addMonths, endOfMonth, format, getDay,
  isSameDay, isToday, startOfMonth, subMonths,
} from "date-fns";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useT } from "@/lib/i18n/t";
import { useClickOutside } from "./useClickOutside";

interface Props {
  label: "startDate" | "endDate";
  value: Date;
  onChange: (d: Date) => void;
}

const MONTH_KEYS = ["mJan","mFeb","mMar","mApr","mMay","mJun","mJul","mAug","mSep","mOct","mNov","mDec"];
const WEEKDAY_KEYS = ["wdMo","wdTu","wdWe","wdTh","wdFr","wdSa","wdSu"];

export function ExportDateField({ label, value, onChange }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date>(value);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open) setViewMonth(value); }, [open, value]);
  useClickOutside(popRef, () => setOpen(false), open);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open]);

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const startOffset = (getDay(monthStart) + 6) % 7; // Mon-first
  const totalDays = monthEnd.getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) {
    cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full h-11 rounded-xl border border-slate-200 bg-white flex items-center justify-between px-3 hover:border-slate-300 transition-colors"
      >
        <span className="flex flex-col items-start leading-tight">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t(label)}</span>
          <span className="text-sm font-bold text-slate-800">{format(value, "dd.MM.yyyy")}</span>
        </span>
        <Calendar className="size-4 text-slate-400 shrink-0" />
      </button>

      {open && (
        <div
          ref={popRef}
          className="absolute z-50 mt-1 left-0 right-0 sm:left-auto sm:w-72 rounded-xl border border-slate-200 bg-white shadow-xl p-3"
        >
          {/* Month nav */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setViewMonth(subMonths(viewMonth, 1))}
              className="size-7 rounded-md hover:bg-slate-100 flex items-center justify-center"
            >
              <ChevronLeft className="size-4 text-slate-500" />
            </button>
            <span className="text-sm font-semibold text-slate-700">
              {t(MONTH_KEYS[viewMonth.getMonth()])} {viewMonth.getFullYear()}
            </span>
            <button
              type="button"
              onClick={() => setViewMonth(addMonths(viewMonth, 1))}
              className="size-7 rounded-md hover:bg-slate-100 flex items-center justify-center"
            >
              <ChevronRight className="size-4 text-slate-500" />
            </button>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {WEEKDAY_KEYS.map((wd) => (
              <div key={wd} className="text-[10px] font-semibold uppercase text-slate-400 text-center py-1">
                {t(wd)}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => {
              if (!d) return <div key={i} className="h-8" />;
              const selected = isSameDay(d, value);
              const todayDay = isToday(d);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => { onChange(d); setOpen(false); }}
                  className={[
                    "h-8 rounded-md text-xs font-medium transition-colors",
                    selected  ? "bg-emerald-500 text-white" :
                    todayDay  ? "text-emerald-600 hover:bg-slate-100" :
                                "text-slate-700 hover:bg-slate-100",
                  ].join(" ")}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => { onChange(new Date()); setOpen(false); }}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
            >
              {t("today")}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
