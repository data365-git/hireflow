"use client";
import { useCallback } from "react";

// English-only stub. Replace with a real i18n hook when multiple locales are needed.
const STRINGS: Record<string, string> = {
  // Modal shell
  export: "Export",
  exportData: "Export data",
  items: "{n} items",
  cancel: "Cancel",
  // Date
  date: "Date",
  startDate: "Start date",
  endDate: "End date",
  today: "Today",
  // Sections
  section: "Section",
  all: "All",
  columns: "Columns",
  // Preview
  previewFirstRows: "Preview · first 5 rows",
  andMoreRows: "…and {n} more rows",
  noData: "No data matches the current filters.",
  // Weekdays (Mon-first)
  wdMo: "Mo", wdTu: "Tu", wdWe: "We", wdTh: "Th", wdFr: "Fr", wdSa: "Sa", wdSu: "Su",
  // Months
  mJan: "Jan", mFeb: "Feb", mMar: "Mar", mApr: "Apr", mMay: "May", mJun: "Jun",
  mJul: "Jul", mAug: "Aug", mSep: "Sep", mOct: "Oct", mNov: "Nov", mDec: "Dec",
  // Column headers — vacancy applications
  col_name: "Name",
  col_phone: "Phone",
  col_telegram: "Telegram",
  col_stage: "Stage",
  col_status: "Status",
  col_appliedAt: "Applied",
  col_lastActivityAt: "Last activity",
  col_vacancy: "Vacancy",
};

export function useT() {
  return useCallback((key: string, vars?: Record<string, string | number>) => {
    let s = STRINGS[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.replace(`{${k}}`, String(v));
      }
    }
    return s;
  }, []);
}
