import type { SectionBadge } from "./types";

export const SECTION_BADGE: Record<string, SectionBadge> = {
  new:       { label: "New",       selectedBg: "bg-slate-100",  selectedText: "text-slate-800",  selectedRing: "ring-slate-200",  checkBg: "bg-slate-500"  },
  screening: { label: "Screening", selectedBg: "bg-blue-50",    selectedText: "text-blue-800",   selectedRing: "ring-blue-200",   checkBg: "bg-blue-500"   },
  qualified: { label: "Qualified", selectedBg: "bg-violet-50",  selectedText: "text-violet-800", selectedRing: "ring-violet-200", checkBg: "bg-violet-500" },
  test:      { label: "Test",      selectedBg: "bg-amber-50",   selectedText: "text-amber-800",  selectedRing: "ring-amber-200",  checkBg: "bg-amber-500"  },
  interview: { label: "Interview", selectedBg: "bg-orange-50",  selectedText: "text-orange-800", selectedRing: "ring-orange-200", checkBg: "bg-orange-500" },
  hired:     { label: "Hired",     selectedBg: "bg-emerald-50", selectedText: "text-emerald-800",selectedRing: "ring-emerald-200",checkBg: "bg-emerald-500"},
  rejected:  { label: "Rejected",  selectedBg: "bg-red-50",     selectedText: "text-red-800",    selectedRing: "ring-red-200",    checkBg: "bg-red-500"    },
};

export const DEFAULT_BADGE: SectionBadge = {
  label: "",
  selectedBg: "bg-slate-100",
  selectedText: "text-slate-800",
  selectedRing: "ring-slate-200",
  checkBg: "bg-slate-500",
};
