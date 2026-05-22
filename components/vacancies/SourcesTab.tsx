"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "@/lib/hooks/useToast";
import {
  listSourcesForVacancy,
  renameSource,
  archiveSource,
  unarchiveSource,
  getSourceStatsForVacancy,
  createBulkSources,
  type SourceStatRow,
} from "@/app/actions/sources";
import { addVacancySource } from "@/app/actions/vacancies";
import type { Source } from "@/lib/types";

const QUICK_ADD_CHIPS = [
  "Instagram",
  "Telegram Channel",
  "YouTube",
  "OLX",
  "Referral",
  "LinkedIn",
];

type Props = {
  vacancyId: string;
};

export function SourcesTab({ vacancyId }: Props) {
  const [sources, setSources] = useState<Source[]>([]);
  const [stats, setStats] = useState<Map<string, SourceStatRow>>(new Map());
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);

  // Add source form
  const [addName, setAddName] = useState("");
  const [adding, setAdding] = useState(false);

  // Bulk generation form
  const [bulkPrefix, setBulkPrefix] = useState("Channel");
  const [bulkCount, setBulkCount] = useState(10);
  const [bulkGenerating, setBulkGenerating] = useState(false);

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  // Copy state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // QR modal
  const [qrSource, setQrSource] = useState<Source | null>(null);

  const load = useCallback(async () => {
    try {
      const [srcList, statList] = await Promise.all([
        listSourcesForVacancy(vacancyId, true),
        getSourceStatsForVacancy(vacancyId),
      ]);
      setSources(srcList);
      const statMap = new Map<string, SourceStatRow>();
      for (const s of statList) statMap.set(s.sourceId, s);
      setStats(statMap);
    } catch {
      toast.error("Could not load sources");
    } finally {
      setLoading(false);
    }
  }, [vacancyId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd() {
    const name = addName.trim();
    if (!name) return;
    setAdding(true);
    try {
      const src = await addVacancySource(vacancyId, name);
      setSources((prev) => [...prev, src]);
      setStats((prev) => {
        const next = new Map(prev);
        next.set(src.id, { sourceId: src.id, views: 0, submitted: 0, hired: 0 });
        return next;
      });
      setAddName("");
      toast.success("Source added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add source");
    } finally {
      setAdding(false);
    }
  }

  async function handleBulkGenerate() {
    const namePrefix = bulkPrefix.trim();
    if (!namePrefix || bulkCount < 1) return;
    setBulkGenerating(true);
    try {
      const created = await createBulkSources({ vacancyId, namePrefix, count: bulkCount });
      setSources((prev) => [...prev, ...created]);
      setStats((prev) => {
        const next = new Map(prev);
        for (const src of created) {
          next.set(src.id, { sourceId: src.id, views: 0, submitted: 0, hired: 0 });
        }
        return next;
      });
      toast.success(`Generated ${created.length} sources`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate sources");
    } finally {
      setBulkGenerating(false);
    }
  }

  async function handleRename(id: string) {
    const name = renameDraft.trim();
    if (!name) return;
    try {
      await renameSource({ id, name });
      setSources((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
      setRenamingId(null);
      toast.success("Renamed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not rename source");
    }
  }

  async function handleArchive(id: string) {
    try {
      await archiveSource(id);
      setSources((prev) => prev.map((s) => (s.id === id ? { ...s, isArchived: true } : s)));
      toast.success("Source archived");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not archive source");
    }
  }

  async function handleUnarchive(id: string) {
    try {
      await unarchiveSource(id);
      setSources((prev) => prev.map((s) => (s.id === id ? { ...s, isArchived: false } : s)));
      toast.success("Source restored");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not restore source");
    }
  }

  function handleCopy(id: string, link: string) {
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(id);
      toast.success("Copied!");
      setTimeout(() => setCopiedId(null), 1500);
    });
  }

  const visible = sources.filter((s) => showArchived || !s.isArchived);

  if (loading) {
    return (
      <div className="px-8 py-8 text-body-sm text-muted">Loading sources…</div>
    );
  }

  const activeCount = sources.filter((s) => !s.isArchived).length;
  const archivedCount = sources.filter((s) => s.isArchived).length;

  return (
    <div className="overflow-y-auto flex-1">
      <div className="px-8 py-6 max-w-[720px]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-body-sm font-semibold text-text">Sources</h2>
        </div>

        {/* Add source inline form */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {QUICK_ADD_CHIPS.map((chip) => (
              <button
                key={chip}
                onClick={() => setAddName(chip)}
                className="text-micro px-2.5 h-6 rounded-full border border-border text-muted hover:border-primary hover:text-primary transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Source name (e.g. LinkedIn, OLX)…"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") setAddName("");
              }}
              className="flex-1 bg-surface border border-border rounded-lg px-3 h-9 text-body-sm text-text outline-none focus:border-primary"
            />
            <button
              onClick={handleAdd}
              disabled={!addName.trim() || adding}
              className="h-9 px-4 bg-primary text-primary-fg text-body-sm font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {adding ? "Adding…" : "+ Add source"}
            </button>
          </div>
        </div>

        {/* Bulk source generator */}
        <div className="mb-6 rounded-xl border border-border bg-surface px-4 py-4">
          <div className="mb-3">
            <p className="text-body-sm font-semibold text-text">Bulk add sources</p>
            <p className="text-micro text-muted">Generate numbered links for channels, promoters, or campaigns.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_96px_auto]">
            <label className="min-w-0">
              <span className="mb-1 block text-micro font-medium text-muted">Name prefix</span>
              <input
                type="text"
                value={bulkPrefix}
                onChange={(e) => setBulkPrefix(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-bg px-3 text-body-sm text-text outline-none focus:border-primary"
              />
            </label>
            <label>
              <span className="mb-1 block text-micro font-medium text-muted">Count</span>
              <input
                type="number"
                min={1}
                max={100}
                value={bulkCount}
                onChange={(e) => setBulkCount(Number(e.target.value))}
                className="h-9 w-full rounded-lg border border-border bg-bg px-3 text-body-sm text-text outline-none focus:border-primary"
              />
            </label>
            <button
              onClick={handleBulkGenerate}
              disabled={!bulkPrefix.trim() || bulkCount < 1 || bulkGenerating}
              className="h-9 self-end rounded-lg bg-surface-2 px-4 text-body-sm font-semibold text-text transition-colors hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {bulkGenerating ? "Generating…" : `Generate ${bulkCount || 0}`}
            </button>
          </div>
        </div>

        {/* Empty state */}
        {activeCount === 0 && !showArchived && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-muted" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <p className="text-body-sm font-semibold text-text mb-1">Track where candidates come from</p>
            <p className="text-body-sm text-muted max-w-xs">
              Add a source above to get a unique deep link. Share it on Instagram, Telegram, or any channel to see where your applicants come from.
            </p>
          </div>
        )}

        {/* Source rows */}
        {visible.length > 0 && (
          <div className="flex flex-col gap-3">
            {visible.map((src) => {
              const stat = stats.get(src.id);
              const submissionRate =
                stat && stat.views > 0
                  ? Math.round((stat.submitted / stat.views) * 100)
                  : 0;
              const hireRate =
                stat && stat.submitted > 0
                  ? Math.round((stat.hired / stat.submitted) * 100)
                  : 0;

              return (
                <div
                  key={src.id}
                  className={`bg-surface border border-border rounded-xl px-4 py-4 ${src.isArchived ? "opacity-50" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      {renamingId === src.id ? (
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            autoFocus
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRename(src.id);
                              if (e.key === "Escape") setRenamingId(null);
                            }}
                            className="flex-1 bg-surface-2 border border-primary rounded-lg px-3 h-8 text-body-sm text-text outline-none"
                          />
                          <button
                            onClick={() => handleRename(src.id)}
                            className="text-body-sm text-primary hover:opacity-80 transition-opacity font-medium shrink-0"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setRenamingId(null)}
                            className="text-body-sm text-muted hover:text-text transition-colors shrink-0"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setRenamingId(src.id);
                            setRenameDraft(src.name);
                          }}
                          className="text-body-sm font-semibold text-text hover:text-primary transition-colors text-left mb-1"
                          title="Click to rename"
                        >
                          {src.name}
                          {src.isArchived && (
                            <span className="ml-2 text-micro px-1.5 h-4 rounded-full bg-surface-3 text-muted inline-flex items-center">
                              Archived
                            </span>
                          )}
                        </button>
                      )}

                      {/* Deep link */}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-micro text-subtle font-mono truncate flex-1" title={src.botLink}>
                          {src.botLink}
                        </span>
                        <button
                          onClick={() => handleCopy(src.id, src.botLink)}
                          className="text-micro text-muted hover:text-primary transition-colors shrink-0 px-1.5 py-0.5 rounded hover:bg-surface-2"
                          title="Copy link"
                        >
                          {copiedId === src.id ? "Copied!" : "Copy"}
                        </button>
                        <button
                          onClick={() => setQrSource(src)}
                          className="text-micro text-muted hover:text-primary transition-colors shrink-0 px-1.5 py-0.5 rounded hover:bg-surface-2"
                          title="Show QR code"
                        >
                          QR
                        </button>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-3 mt-2 text-micro text-muted flex-wrap">
                        <span>Views: <span className="text-text">{stat?.views ?? 0}</span></span>
                        <span className="text-subtle">·</span>
                        <span>Submitted: <span className="text-text">{stat?.submitted ?? 0}</span></span>
                        <span className="text-subtle">·</span>
                        <span>Hired: <span className="text-text">{stat?.hired ?? 0}</span></span>
                        <span className="text-subtle">·</span>
                        <span>Submission rate: <span className="text-text">{submissionRate}%</span></span>
                        <span className="text-subtle">·</span>
                        <span>Hire rate: <span className="text-text">{hireRate}%</span></span>
                      </div>
                    </div>

                    {/* Archive / Unarchive button */}
                    {src.isArchived ? (
                      <button
                        onClick={() => handleUnarchive(src.id)}
                        className="shrink-0 text-micro text-muted hover:text-primary transition-colors px-2 py-1 rounded hover:bg-surface-2"
                        title="Restore source"
                      >
                        Unarchive
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          if (confirm(`Archive "${src.name}"? It will be hidden from the list.`)) {
                            handleArchive(src.id);
                          }
                        }}
                        className="shrink-0 text-micro text-muted hover:text-danger transition-colors p-1.5 rounded hover:bg-danger-soft"
                        title="Archive source"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Show archived toggle */}
        {archivedCount > 0 && (
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="mt-4 text-body-sm text-muted hover:text-text transition-colors"
          >
            {showArchived
              ? `Hide archived (${archivedCount})`
              : `Show archived (${archivedCount})`}
          </button>
        )}
      </div>

      {/* QR Modal */}
      {qrSource && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setQrSource(null)}
        >
          <div
            className="bg-bg border border-border rounded-2xl p-6 flex flex-col items-center gap-4 shadow-xl max-w-xs w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-body-sm font-semibold text-text">{qrSource.name}</p>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrSource.botLink)}`}
              alt="QR code"
              width={240}
              height={240}
              className="rounded-lg"
            />
            <p className="text-micro text-subtle font-mono text-center break-all">{qrSource.botLink}</p>
            <div className="flex gap-2 w-full">
              <a
                href={`https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(qrSource.botLink)}&format=png`}
                download={`qr-${qrSource.name}.png`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 h-9 inline-flex items-center justify-center rounded-lg bg-primary text-primary-fg text-body-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Download
              </a>
              <button
                onClick={() => setQrSource(null)}
                className="flex-1 h-9 rounded-lg bg-surface-2 text-muted text-body-sm hover:text-text transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
