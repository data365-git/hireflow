"use client";
import { useEffect, useMemo, useState } from "react";
import {
  endOfDay, isWithinInterval, startOfDay, subDays, format,
} from "date-fns";
import {
  Check, ChevronDown, Download, Eye, EyeOff, ArrowUp, ArrowDown, X,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useT } from "@/lib/i18n/t";
import { DEFAULT_BADGE, SECTION_BADGE } from "@/lib/export/badges";
import type { ExportRow } from "@/lib/export/types";
import { ExportDateField } from "./ExportDateField";

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-built rows. Keys are column keys; headers are localized via columnLabels. */
  data: ExportRow[];
  /** The key on each row used for date filtering (must be ISO string or Date). */
  dateKey: string;
  /** Maps column key → i18n label key. Only keys present here appear in the column picker. */
  columnLabels: Record<string, string>;
  /** Optional categorical filter. If empty, section block is hidden. */
  categoryKey?: string;
  categoryOptions?: string[];
  /** Final filename without extension. */
  filename: string;
  sheetName?: string;
}

export function ExportModal(props: ExportModalProps) {
  const {
    isOpen, onClose, data, dateKey,
    columnLabels, categoryKey, categoryOptions, filename,
  } = props;
  const t = useT();
  const sheetName = props.sheetName ?? "Export";

  // ── State (resets on open) ──────────────────────────────────────────────────
  const [fromDate, setFromDate] = useState(() => subDays(new Date(), 7));
  const [toDate, setToDate]     = useState(() => new Date());
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [columnOrder, setColumnOrder]   = useState<string[]>([]);
  const [visibleCols, setVisibleCols]   = useState<Set<string>>(new Set());
  const [columnsReady, setColumnsReady] = useState(false);
  const [mobileColsOpen, setMobileColsOpen] = useState(false);

  // Columns exposed to the picker = only keys present in columnLabels
  const allowedKeys = useMemo(() => Object.keys(columnLabels), [columnLabels]);

  // Reset on open
  useEffect(() => {
    if (!isOpen) return;
    setFromDate(subDays(new Date(), 7));
    setToDate(new Date());
    setSelectedCats(new Set(categoryOptions ?? []));
    setColumnsReady(false);
    setMobileColsOpen(false);
  }, [isOpen, categoryOptions]);

  // Initialise column order once per open from allowedKeys
  useEffect(() => {
    if (!isOpen || columnsReady || allowedKeys.length === 0) return;
    setColumnOrder(allowedKeys);
    setVisibleCols(new Set(allowedKeys));
    setColumnsReady(true);
  }, [isOpen, allowedKeys, columnsReady]);

  // Clamp dates so range stays valid
  useEffect(() => { if (fromDate > toDate) setToDate(fromDate); }, [fromDate, toDate]);
  useEffect(() => { if (toDate < fromDate) setFromDate(toDate); }, [toDate, fromDate]);

  // Esc to close
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [isOpen, onClose]);

  // ── Pipeline ────────────────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    const start = startOfDay(fromDate);
    const end   = endOfDay(toDate);
    return data.filter((row) => {
      const raw = row[dateKey];
      if (!raw) return false;
      const d = new Date(String(raw));
      if (Number.isNaN(d.getTime())) return false;
      if (!isWithinInterval(d, { start, end })) return false;
      if (categoryKey && categoryOptions && categoryOptions.length > 0) {
        if (!selectedCats.has(String(row[categoryKey] ?? ""))) return false;
      }
      return true;
    });
  }, [data, fromDate, toDate, dateKey, categoryKey, categoryOptions, selectedCats]);

  const previewRows = useMemo(() => filteredRows.slice(0, 5), [filteredRows]);
  const orderedVisibleKeys = useMemo(
    () => columnOrder.filter((k) => visibleCols.has(k)),
    [columnOrder, visibleCols],
  );

  // ── Handlers ────────────────────────────────────────────────────────────────
  const toggleCat = (cat: string) => {
    setSelectedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const toggleAllCats = () => {
    if (!categoryOptions) return;
    setSelectedCats(
      selectedCats.size === categoryOptions.length ? new Set() : new Set(categoryOptions)
    );
  };

  const toggleColVisibility = (key: string) => {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const moveCol = (key: string, dir: -1 | 1) => {
    const i = columnOrder.indexOf(key);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= columnOrder.length) return;
    const next = [...columnOrder];
    [next[i], next[j]] = [next[j], next[i]];
    setColumnOrder(next);
  };

  const exportDisabled =
    filteredRows.length === 0 ||
    orderedVisibleKeys.length === 0 ||
    (!!categoryOptions?.length && selectedCats.size === 0);

  const handleExport = () => {
    const sheet = filteredRows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const key of orderedVisibleKeys) {
        out[t(columnLabels[key] ?? key)] = row[key] ?? "";
      }
      return out;
    });
    const ws = XLSX.utils.json_to_sheet(sheet);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${filename}.xlsx`);
    onClose();
  };

  if (!isOpen) return null;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-slate-900/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-4xl md:rounded-2xl bg-white shadow-2xl flex flex-col rounded-t-2xl max-h-[92dvh] md:max-h-[88dvh] overflow-hidden"
      >
        {/* Drag handle (mobile) */}
        <div className="md:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* HEADER */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0 bg-white">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{t("export")}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{t("items", { n: filteredRows.length })}</p>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </header>

        {/* BODY */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">
          {/* LEFT panel */}
          <aside className="md:w-72 shrink-0 bg-slate-50 md:border-r border-slate-100 overflow-y-auto px-4 py-4 space-y-5">
            {/* Date range */}
            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">{t("date")}</h3>
              <ExportDateField label="startDate" value={fromDate} onChange={setFromDate} />
              <ExportDateField label="endDate"   value={toDate}   onChange={setToDate} />
              <p className="text-[11px] text-slate-400">
                {format(fromDate, "dd.MM.yyyy")} – {format(toDate, "dd.MM.yyyy")}
              </p>
            </section>

            {/* Categories */}
            {categoryOptions && categoryOptions.length > 0 && (
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">{t("section")}</h3>
                  <button
                    onClick={toggleAllCats}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                  >
                    {t("all")} <Check className="size-3" />
                  </button>
                </div>
                <div className="space-y-1.5">
                  {categoryOptions.map((opt) => {
                    const selected = selectedCats.has(opt);
                    const badge = SECTION_BADGE[opt] ?? DEFAULT_BADGE;
                    return (
                      <button
                        key={opt}
                        onClick={() => toggleCat(opt)}
                        className={[
                          "w-full rounded-2xl px-4 py-3.5 flex items-center justify-between border transition-colors text-sm",
                          selected
                            ? `${badge.selectedBg} ${badge.selectedText} border-transparent ring-2 ${badge.selectedRing}`
                            : "bg-white text-slate-700 border-slate-200 hover:border-slate-300",
                        ].join(" ")}
                      >
                        <span className="font-medium">{badge.label || opt}</span>
                        <span className={[
                          "size-5 rounded-full flex items-center justify-center transition-colors shrink-0",
                          selected ? `${badge.checkBg} text-white` : "bg-white border border-slate-300",
                        ].join(" ")}>
                          {selected && <Check className="size-3" strokeWidth={3} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Column picker */}
            <section className="space-y-2">
              <button
                className="w-full flex items-center justify-between md:cursor-default md:pointer-events-none"
                onClick={() => setMobileColsOpen((o) => !o)}
              >
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">{t("columns")}</h3>
                <ChevronDown className={`md:hidden size-4 text-slate-400 transition-transform ${mobileColsOpen ? "rotate-180" : ""}`} />
              </button>
              <div className={`space-y-1.5 ${mobileColsOpen ? "block" : "hidden"} md:block`}>
                {columnOrder.map((key, idx) => {
                  const visible = visibleCols.has(key);
                  return (
                    <div
                      key={key}
                      className="bg-white border border-slate-200 rounded-xl px-3 py-2 flex items-center gap-2"
                    >
                      <button
                        onClick={() => toggleColVisibility(key)}
                        className="shrink-0"
                        aria-label="Toggle column visibility"
                      >
                        {visible
                          ? <Eye className="size-4 text-emerald-600" />
                          : <EyeOff className="size-4 text-slate-300" />}
                      </button>
                      <span className={`flex-1 text-sm truncate ${visible ? "text-slate-700" : "text-slate-300"}`}>
                        {t(columnLabels[key] ?? key)}
                      </span>
                      <button
                        onClick={() => moveCol(key, -1)}
                        disabled={idx === 0}
                        className="size-7 rounded-md hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                        aria-label="Move column up"
                      >
                        <ArrowUp className="size-3.5 text-slate-500" />
                      </button>
                      <button
                        onClick={() => moveCol(key, 1)}
                        disabled={idx === columnOrder.length - 1}
                        className="size-7 rounded-md hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                        aria-label="Move column down"
                      >
                        <ArrowDown className="size-3.5 text-slate-500" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          </aside>

          {/* RIGHT panel — preview */}
          <section className="flex-1 overflow-y-auto bg-white p-4 min-w-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              {t("previewFirstRows")}
            </h3>
            {filteredRows.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-slate-400">
                {t("noData")}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg border border-slate-100">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        {orderedVisibleKeys.map((k) => (
                          <th
                            key={k}
                            className="text-left text-xs font-semibold text-slate-500 px-3 py-2 whitespace-nowrap"
                          >
                            {t(columnLabels[k] ?? k)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewRows.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          {orderedVisibleKeys.map((k) => (
                            <td key={k} className="px-3 py-2 text-slate-700 whitespace-nowrap">
                              {String(row[k] ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filteredRows.length > 5 && (
                  <p className="text-xs text-slate-400 mt-2">
                    {t("andMoreRows", { n: filteredRows.length - 5 })}
                  </p>
                )}
              </>
            )}
          </section>
        </div>

        {/* FOOTER */}
        <footer className="flex items-center justify-between px-5 py-3 border-t border-slate-100 shrink-0 bg-white">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          >
            {t("cancel")}
          </button>
          <button
            onClick={handleExport}
            disabled={exportDisabled}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold flex items-center gap-2 shadow-md shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="size-4" />
            {t("exportData")}
          </button>
        </footer>
      </div>
    </div>
  );
}
