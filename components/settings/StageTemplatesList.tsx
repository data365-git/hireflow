"use client";

import { useEffect, useState } from "react";
import { Lock, ChevronDown, ChevronRight, Pencil, Trash2, Copy } from "lucide-react";

const STAGE_COLORS: Record<string, string> = {
  new: "bg-gray-400",
  screening: "bg-blue-500",
  qualified: "bg-violet-500",
  test: "bg-amber-500",
  interview: "bg-orange-500",
  hired: "bg-green-500",
  rejected: "bg-red-500",
};

type TemplateStage = {
  id: string;
  name: string;
  color: string;
  isFinal: boolean;
  isRejected: boolean;
  orderIndex: number;
};

type Template = {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  stages: TemplateStage[];
};

export function StageTemplatesList() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/stage-templates", { credentials: "include" });
    if (res.ok) setTemplates(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(tpl: Template) {
    if (!window.confirm(`Delete "${tpl.name}"?`)) return;
    setDeletingId(tpl.id);
    const res = await fetch(`/api/stage-templates/${tpl.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    setDeletingId(null);
    if (res.ok) load();
  }

  async function handleDuplicate(tpl: Template) {
    setDuplicatingId(tpl.id);
    const res = await fetch("/api/stage-templates", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${tpl.name} (copy)`,
        description: tpl.description,
        stages: tpl.stages.map((s) => ({
          name: s.name,
          color: s.color,
          isFinal: s.isFinal,
          isRejected: s.isRejected,
          orderIndex: s.orderIndex,
        })),
      }),
    });
    setDuplicatingId(null);
    if (res.ok) load();
  }

  if (loading) {
    return <p className="text-sm text-muted py-4">Loading…</p>;
  }

  if (templates.length === 0) {
    return <p className="text-sm text-muted py-4">No templates yet.</p>;
  }

  return (
    <div className="space-y-2">
      {templates.map((tpl) => {
        const expanded = expandedId === tpl.id;
        return (
          <div key={tpl.id} className="bg-surface border border-border rounded-xl overflow-hidden">
            {/* Row header */}
            <div className="flex items-center gap-3 px-4 py-3">
              <button
                onClick={() => setExpandedId(expanded ? null : tpl.id)}
                className="text-muted hover:text-text transition-colors shrink-0"
              >
                {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text truncate">{tpl.name}</span>
                  {tpl.isSystem && (
                    <Lock className="w-3.5 h-3.5 text-muted shrink-0" />
                  )}
                </div>
                {tpl.description && (
                  <p className="text-xs text-muted mt-0.5 truncate">{tpl.description}</p>
                )}
              </div>

              <span className="text-xs text-subtle shrink-0">
                {tpl.stages.length} stage{tpl.stages.length !== 1 ? "s" : ""}
              </span>

              <div className="flex items-center gap-1 shrink-0">
                {tpl.isSystem ? (
                  <button
                    onClick={() => handleDuplicate(tpl)}
                    disabled={duplicatingId === tpl.id}
                    className="p-1.5 rounded text-muted hover:text-text hover:bg-surface-2 transition-colors disabled:opacity-40"
                    title="Duplicate to edit"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => handleDuplicate(tpl)}
                      disabled={duplicatingId === tpl.id}
                      className="p-1.5 rounded text-muted hover:text-text hover:bg-surface-2 transition-colors disabled:opacity-40"
                      title="Duplicate"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      className="p-1.5 rounded text-muted hover:text-text hover:bg-surface-2 transition-colors"
                      title="Edit (coming soon)"
                      onClick={() => alert("Edit coming soon")}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(tpl)}
                      disabled={deletingId === tpl.id}
                      className="p-1.5 rounded text-muted hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Expanded: stage list */}
            {expanded && (
              <div className="border-t border-border px-4 py-3 bg-surface-2">
                <div className="flex flex-wrap gap-2">
                  {tpl.stages.map((s) => (
                    <div key={s.id} className="flex items-center gap-1.5 text-xs text-text">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${STAGE_COLORS[s.color] ?? "bg-gray-400"}`} />
                      <span>{s.name}</span>
                      {s.isFinal && (
                        <span className="text-muted">({s.isRejected ? "reject" : "final"})</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
