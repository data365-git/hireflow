"use client";
import { useEffect, useState, useRef } from "react";
import { listBotTranslations, saveBotTranslation } from "@/app/actions/bot-translations";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import type { Lang } from "@/lib/bot/i18n";

type Row = { key: string; uz: string; ru: string; en: string };
type EditingCell = { key: string; lang: Lang } | null;


export default function TranslationsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<EditingCell>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    listBotTranslations()
      .then((r) => { setRows(r); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = search.trim()
    ? rows.filter((r) => r.key.toLowerCase().includes(search.toLowerCase()))
    : rows;

  function startEdit(key: string, lang: Lang, current: string) {
    setEditing({ key, lang });
    setDraft(current);
    setUnsaved(false);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  async function commitEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      await saveBotTranslation(editing.key, editing.lang, draft);
      setRows((prev) =>
        prev.map((r) =>
          r.key === editing.key ? { ...r, [editing.lang]: draft.trim() } : r
        )
      );
      setUnsaved(false);
    } catch {
      // keep editing open on error
    } finally {
      setSaving(false);
      setEditing(null);
    }
  }

  const LANGS: Lang[] = ["uz", "ru", "en"];
  const LANG_LABELS: Record<Lang, string> = { uz: "UZ", ru: "RU", en: "EN" };

  return (
    <div>
      <SettingsPageHeader
        title="Bot Translations"
        description="Override bot message strings stored in the database. Empty cells fall back to the code defaults."
      />

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by key…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm bg-surface-2 border border-border rounded-lg px-3 py-2 text-body-sm text-text outline-none focus:border-primary"
        />
      </div>

      {loading ? (
        <div className="text-muted text-sm py-8">Loading translations…</div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-body-sm">
            <thead>
              <tr className="bg-surface-2 border-b border-border">
                <th className="text-left px-4 py-2 font-medium text-muted w-56">Key</th>
                {LANGS.map((l) => (
                  <th key={l} className="text-left px-4 py-2 font-medium text-muted">
                    {LANG_LABELS[l]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((row) => (
                <tr key={row.key} className="hover:bg-surface-2/50 transition-colors">
                  <td className="px-4 py-2 font-mono text-xs text-muted align-top">{row.key}</td>
                  {LANGS.map((lang) => {
                    const isEditing = editing?.key === row.key && editing?.lang === lang;
                    const value = row[lang];
                    return (
                      <td key={lang} className="px-4 py-2 align-top">
                        {isEditing ? (
                          <div className="flex flex-col gap-1">
                            <textarea
                              ref={textareaRef}
                              rows={3}
                              value={draft}
                              onChange={(e) => { setDraft(e.target.value); setUnsaved(true); }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitEdit(); }
                                if (e.key === "Escape") { setEditing(null); setUnsaved(false); }
                              }}
                              className="w-full bg-surface border border-primary rounded-lg px-2 py-1 text-body-sm text-text outline-none resize-none"
                            />
                            <div className="flex items-center gap-2">
                              {unsaved && <span className="text-xs text-warning">Unsaved</span>}
                              <button
                                onClick={commitEdit}
                                disabled={saving}
                                className="text-xs bg-primary text-primary-fg px-2 py-0.5 rounded-md disabled:opacity-50"
                              >
                                {saving ? "Saving…" : "Save"}
                              </button>
                              <button
                                onClick={() => { setEditing(null); setUnsaved(false); }}
                                className="text-xs text-muted hover:text-text"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(row.key, lang, value)}
                            className="w-full text-left text-body-sm text-text whitespace-pre-wrap hover:bg-surface-2 rounded px-1 py-0.5 transition-colors min-h-[1.5rem]"
                          >
                            {value || <span className="text-muted italic">—</span>}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted text-sm">
                    No keys match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
