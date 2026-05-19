"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellIcon, ChevronDownIcon } from "lucide-react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/context/AuthContext";
import { useState, useEffect, useRef } from "react";

function useBreadcrumb(pathname: string): string {
  const vacancies = useStore((s) => s.vacancies);
  const applications = useStore((s) => s.applications);
  const candidates = useStore((s) => s.candidates);

  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return "My Pipeline";

  if (segments[0] === "vacancies") {
    if (segments.length === 1) return "Vacancies";
    if (segments[1] === "new") return "New Vacancy";
    const vacancy = vacancies.find((v) => v.id === segments[1]);
    const vacancyTitle = vacancy?.title ?? segments[1];
    if (segments[2] === "edit") return `${vacancyTitle} / Edit Vacancy`;
    return vacancyTitle;
  }

  if (segments[0] === "candidates" && segments[1]) {
    const app = applications.find((a) => a.id === segments[1]);
    if (app) {
      const candidate = candidates.find((c) => c.id === app.candidateId);
      if (candidate) return candidate.fullName;
    }
    return "Candidate";
  }

  if (segments[0] === "inbox") return "Inbox";
  if (segments[0] === "leads") return "Leads";
  if (segments[0] === "analytics") return "Analytics";
  if (segments[0] === "automations") return "Automations";
  if (segments[0] === "templates") return "Templates";

  if (segments[0] === "settings") {
    if (segments.length === 1) return "Settings";
    const sub = segments[1];
    if (sub === "profile") return "Settings / Profile";
    if (sub === "users") return "Settings / Users";
    if (sub === "roles") return "Settings / Roles";
    if (sub === "automations") return "Settings / Automations";
    if (sub === "demo") return "Settings / Demo";
    return "Settings";
  }

  return segments[segments.length - 1];
}

function formatUserChip(name: string | undefined): string {
  if (!name) return "User";
  const parts = name.split(" ");
  const first = parts[0] ?? "";
  const lastInitial = parts[1]?.[0] ?? "";
  return lastInitial ? `${first} ${lastInitial}.` : first;
}

export function TopBar() {
  const pathname = usePathname();
  const breadcrumb = useBreadcrumb(pathname);
  const { user, signOut } = useAuth();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  function handleCmdK() {
    window.dispatchEvent(new CustomEvent("cmd-k"));
  }

  const chipLabel = formatUserChip(user?.fullName ?? undefined);

  return (
    <header className="bg-surface border-b border-border h-11 px-6 flex items-center justify-between shrink-0">
      {/* Left: breadcrumb */}
      <span className="text-body font-semibold text-text truncate">{breadcrumb}</span>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        {/* ⌘K hint */}
        <button
          onClick={handleCmdK}
          className="flex items-center gap-1.5 px-2.5 h-7 rounded-full border border-border bg-surface-2 text-muted text-body-xs font-medium hover:bg-surface-3 transition-colors"
        >
          <span>⌘K</span>
        </button>

        {/* + New Vacancy */}
        <Link
          href="/vacancies/new"
          className="flex items-center justify-center px-2.5 h-7 rounded-full border border-border bg-surface-2 text-muted text-body-xs font-medium hover:bg-surface-3 transition-colors"
        >
          +
        </Link>

        {/* Notification bell */}
        <button className="relative flex items-center justify-center size-7 rounded-full hover:bg-surface-2 transition-colors text-muted">
          <BellIcon size={16} />
        </button>

        {/* User chip with dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className="text-sm font-medium text-gray-700 hover:text-gray-900 flex items-center gap-1 cursor-pointer"
          >
            {chipLabel}
            <ChevronDownIcon size={14} />
          </button>
          {dropdownOpen && (
            <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-100 py-1 min-w-[140px] z-50">
              <Link
                href="/settings/profile"
                onClick={() => setDropdownOpen(false)}
                className="block px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer text-gray-700"
              >
                Settings
              </Link>
              <button
                onClick={() => { setDropdownOpen(false); signOut(); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer text-gray-700"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
