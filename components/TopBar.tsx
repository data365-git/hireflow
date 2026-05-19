"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellIcon } from "lucide-react";
import { useStore } from "@/lib/store";
import { initials, hashColor } from "@/lib/utils";

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
  if (segments[0] === "analytics") return "Analytics";
  if (segments[0] === "automations") return "Automations";
  if (segments[0] === "templates") return "Templates";

  return segments[segments.length - 1];
}

export function TopBar() {
  const pathname = usePathname();
  const breadcrumb = useBreadcrumb(pathname);
  const getUnreadCount = useStore((s) => s.getUnreadCount);
  const users = useStore((s) => s.users);
  const currentUserId = useStore((s) => s.currentUserId);

  const unreadCount = getUnreadCount();
  const currentUser = users.find((u) => u.id === currentUserId);
  const userName = currentUser?.name ?? "HR";

  function handleCmdK() {
    window.dispatchEvent(new CustomEvent("cmd-k"));
  }

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
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 size-2 rounded-full bg-danger" />
          )}
        </button>

        {/* User avatar */}
        <div
          className="size-7 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
          style={{ backgroundColor: hashColor(currentUserId) }}
          title={userName}
        >
          {initials(userName)}
        </div>
      </div>
    </header>
  );
}
