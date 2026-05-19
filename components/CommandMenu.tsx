"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";

type ResultItem = {
  id: string;
  label: string;
  sublabel?: string;
  route: string;
  section: "Candidates" | "Vacancies" | "Navigate";
};

const NAV_ITEMS: ResultItem[] = [
  { id: "nav-pipeline", label: "My Pipeline", route: "/", section: "Navigate" },
  { id: "nav-inbox", label: "Inbox", route: "/inbox", section: "Navigate" },
  { id: "nav-vacancies", label: "Vacancies", route: "/vacancies", section: "Navigate" },
  { id: "nav-analytics", label: "Analytics", route: "/analytics", section: "Navigate" },
];

export function CommandMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const candidates = useStore((s) => s.candidates);
  const applications = useStore((s) => s.applications);
  const vacancies = useStore((s) => s.vacancies);
  const getCandidateForApplication = useStore((s) => s.getCandidateForApplication);

  const openMenu = useCallback(() => {
    setOpen(true);
    setQuery("");
    setHighlighted(0);
  }, []);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setQuery("");
    setHighlighted(0);
  }, []);

  // Keyboard shortcut + custom event listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => {
          if (prev) {
            closeMenu();
            return false;
          }
          openMenu();
          return true;
        });
      }
      if (e.key === "Escape") {
        closeMenu();
      }
    };

    const onCmdK = () => openMenu();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("cmd-k", onCmdK);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("cmd-k", onCmdK);
    };
  }, [openMenu, closeMenu]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      // rAF ensures the modal is rendered before focusing
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Build results
  const results: ResultItem[] = [];

  if (query.trim() === "") {
    results.push(...NAV_ITEMS);
  } else {
    const q = query.toLowerCase();

    // Candidates — find matching candidates, then resolve to an application id
    const matchedCandidates = candidates
      .filter((c) => c.fullName.toLowerCase().includes(q))
      .slice(0, 5);

    for (const candidate of matchedCandidates) {
      const app = applications.find((a) => a.candidateId === candidate.id);
      if (app) {
        results.push({
          id: `candidate-${candidate.id}`,
          label: candidate.fullName,
          sublabel: candidate.city || undefined,
          route: `/candidates/${app.id}`,
          section: "Candidates",
        });
      }
    }

    // Vacancies
    const matchedVacancies = vacancies
      .filter((v) => v.title.toLowerCase().includes(q))
      .slice(0, 3);

    for (const v of matchedVacancies) {
      results.push({
        id: `vacancy-${v.id}`,
        label: v.title,
        sublabel: v.department,
        route: `/vacancies/${v.id}`,
        section: "Vacancies",
      });
    }

    // Nav items
    const matchedNav = NAV_ITEMS.filter((n) => n.label.toLowerCase().includes(q));
    results.push(...matchedNav);
  }

  // Arrow key / enter navigation within the modal
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      const item = results[highlighted];
      if (item) {
        router.push(item.route);
        closeMenu();
      }
    }
  };

  const handleSelect = (item: ResultItem) => {
    router.push(item.route);
    closeMenu();
  };

  // Reset highlight when results change
  useEffect(() => {
    setHighlighted(0);
  }, [query]);

  if (!open) return null;

  // Group results into sections for rendering
  const sections: Array<{ label: string; items: ResultItem[] }> = [];

  const addSection = (label: ResultItem["section"]) => {
    const items = results.filter((r) => r.section === label);
    if (items.length > 0) {
      sections.push({ label, items });
    }
  };

  addSection("Navigate");
  addSection("Candidates");
  addSection("Vacancies");

  // Build a flat ordered list matching sections order for highlight indexing
  const flatOrdered = sections.flatMap((s) => s.items);

  return (
    <div
      className="fixed inset-0 z-[200] bg-overlay flex items-start justify-center pt-[20vh]"
      onMouseDown={(e) => {
        // Close when clicking the backdrop
        if (e.target === e.currentTarget) closeMenu();
      }}
    >
      <div
        className="bg-surface rounded-2xl shadow-overlay border border-border w-full max-w-[520px] overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search candidates, vacancies, pages…"
          className="w-full px-4 py-3 text-body bg-transparent border-b border-border outline-none text-text placeholder:text-subtle"
        />

        {/* Results */}
        {results.length > 0 ? (
          <div className="max-h-80 overflow-y-auto">
            {sections.map((section) => (
              <div key={section.label}>
                <div className="px-4 py-1.5 text-micro text-subtle uppercase tracking-wider bg-surface-3">
                  {section.label}
                </div>
                {section.items.map((item) => {
                  const flatIndex = flatOrdered.indexOf(item);
                  const isHighlighted = flatIndex === highlighted;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseDown={() => handleSelect(item)}
                      onMouseEnter={() => setHighlighted(flatIndex)}
                      className={`flex items-center gap-3 px-4 py-2.5 text-body-sm cursor-pointer w-full text-left ${
                        isHighlighted ? "bg-surface-2" : ""
                      }`}
                    >
                      <span className="text-text">{item.label}</span>
                      {item.sublabel && (
                        <span className="text-subtle text-micro ml-auto">{item.sublabel}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-6 text-body-sm text-subtle text-center">No results</div>
        )}
      </div>
    </div>
  );
}

export default CommandMenu;
