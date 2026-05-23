"use client";

import { useEffect, useState, useTransition } from "react";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { Button } from "@/components/ui/Button";
import type { BotContentRow } from "@/app/actions/bot-content";

type Language = "uz" | "ru" | "en";
type ContentKey = "about_us" | "contact_us";

const LANGUAGES: { value: Language; label: string }[] = [
  { value: "uz", label: "UZ" },
  { value: "ru", label: "RU" },
  { value: "en", label: "EN" },
];

const SECTIONS: { key: ContentKey; title: string }[] = [
  { key: "about_us", title: "About Data365" },
  { key: "contact_us", title: "Contact Us" },
];

type ContentMap = Record<ContentKey, Record<Language, string>>;

function makeEmptyMap(): ContentMap {
  return {
    about_us: { uz: "", ru: "", en: "" },
    contact_us: { uz: "", ru: "", en: "" },
  };
}

function SectionEditor({
  sectionKey,
  title,
  contentMap,
}: {
  sectionKey: ContentKey;
  title: string;
  contentMap: ContentMap;
}) {
  const [activeTab, setActiveTab] = useState<Language>("uz");
  const [drafts, setDrafts] = useState<Record<Language, string>>(() => ({
    uz: contentMap[sectionKey].uz,
    ru: contentMap[sectionKey].ru,
    en: contentMap[sectionKey].en,
  }));
  const [saving, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ lang: Language; ok: boolean; msg: string } | null>(null);

  // Sync drafts when parent contentMap updates
  useEffect(() => {
    setDrafts({
      uz: contentMap[sectionKey].uz,
      ru: contentMap[sectionKey].ru,
      en: contentMap[sectionKey].en,
    });
  }, [contentMap, sectionKey]);

  function handleSave(lang: Language) {
    setFeedback(null);
    startTransition(async () => {
      const { upsertBotContent } = await import("@/app/actions/bot-content");
      const result = await upsertBotContent(sectionKey, lang, drafts[lang]);
      if (result.ok) {
        setFeedback({ lang, ok: true, msg: "Saved" });
      } else {
        setFeedback({ lang, ok: false, msg: result.error });
      }
      setTimeout(() => setFeedback(null), 3000);
    });
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-text">{title}</h2>
      </div>

      {/* Tab strip */}
      <div className="flex border-b border-border px-4 gap-1 pt-2">
        {LANGUAGES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setActiveTab(value)}
            className={[
              "px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors",
              activeTab === value
                ? "text-primary border-b-2 border-primary bg-surface-2"
                : "text-muted hover:text-text hover:bg-surface-2",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Active language editor */}
      <div className="p-4 flex flex-col gap-3">
        <textarea
          value={drafts[activeTab]}
          onChange={(e) =>
            setDrafts((prev) => ({ ...prev, [activeTab]: e.target.value }))
          }
          rows={6}
          className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-subtle resize-y focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          placeholder={`Enter ${activeTab.toUpperCase()} text…`}
        />
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="sm"
            disabled={saving}
            onClick={() => handleSave(activeTab)}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
          {feedback && feedback.lang === activeTab && (
            <span
              className={`text-xs ${feedback.ok ? "text-green-600" : "text-red-500"}`}
            >
              {feedback.msg}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BotContentPage() {
  const [contentMap, setContentMap] = useState<ContentMap>(makeEmptyMap());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    import("@/app/actions/bot-content").then(({ getBotContentAll }) =>
      getBotContentAll()
        .then((rows) => {
          if (cancelled) return;
          const map = makeEmptyMap();
          for (const row of rows) {
            if (row.key in map && row.language in map[row.key as ContentKey]) {
              map[row.key as ContentKey][row.language as Language] = row.content;
            }
          }
          setContentMap(map);
          setLoading(false);
        })
        .catch(() => {
          if (!cancelled) setLoading(false);
        })
    ).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <SettingsPageHeader
        title="Bot Content"
        description="Edit the text shown in the Telegram bot for About Data365 and Contact Us messages."
      />

      {loading ? (
        <p className="text-sm text-muted py-4">Loading…</p>
      ) : (
        <div className="flex flex-col gap-6">
          {SECTIONS.map(({ key, title }) => (
            <SectionEditor
              key={key}
              sectionKey={key}
              title={title}
              contentMap={contentMap}
            />
          ))}
        </div>
      )}
    </div>
  );
}
