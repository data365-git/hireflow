"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { formatRelativeTime } from "@/lib/utils";
import { useDataMode } from "@/context/DataModeContext";
import { listLeads } from "@/app/actions/leads";

type LeadRow = {
  candidate: {
    id: string;
    fullName: string;
    telegramUsername: string;
    telegramFirstName: string;
    telegramUserId: string | null;
    createdAt: Date;
  };
  lastMessageAt: Date | null;
  latestApplication: {
    app: {
      id: string;
      candidateId: string;
      vacancyId: string;
      currentStageId: string;
      appliedAt: Date;
      lastActivityAt: Date;
      status: string;
    };
    vacancy: {
      id: string;
      title: string;
      status: string;
    };
  } | null;
};

type Props = { initialLeads: LeadRow[] };

type StatusFilter = "all" | "browsing" | "in_progress" | "submitted" | "abandoned";
type DateFilter = "all" | "today" | "week" | "month";

function getStatusLabel(lead: LeadRow): string {
  const app = lead.latestApplication;
  if (!app) return "Browsing";
  if (app.app.status === "in_progress") return `Filling ${app.vacancy.title}`;
  if (app.app.status === "submitted") return `Submitted (${app.vacancy.title})`;
  if (app.app.status === "abandoned") return "Abandoned";
  return app.vacancy.title;
}

function getStatusKey(lead: LeadRow): StatusFilter {
  const app = lead.latestApplication;
  if (!app) return "browsing";
  if (app.app.status === "in_progress") return "in_progress";
  if (app.app.status === "submitted") return "submitted";
  if (app.app.status === "abandoned") return "abandoned";
  return "submitted";
}

function StatusBadge({ lead }: { lead: LeadRow }) {
  const key = getStatusKey(lead);
  const label = getStatusLabel(lead);
  const styles: Record<string, string> = {
    browsing: "bg-surface-3 text-muted",
    in_progress: "bg-warning-soft text-warning",
    submitted: "bg-success-soft text-success",
    abandoned: "bg-red-50 text-red-500",
  };
  return (
    <span
      className={`text-micro px-2 h-5 rounded-full inline-flex items-center font-medium whitespace-nowrap max-w-[160px] truncate ${styles[key] ?? styles.browsing}`}
      title={label}
    >
      {label}
    </span>
  );
}

function isToday(d: Date | null): boolean {
  if (!d) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

function isThisWeek(d: Date | null): boolean {
  if (!d) return false;
  const now = Date.now();
  const startOfWeek = now - new Date().getDay() * 86400000;
  return d.getTime() >= startOfWeek;
}

function isThisMonth(d: Date | null): boolean {
  if (!d) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function LeadsView({ initialLeads }: Props) {
  const router = useRouter();
  const [vacancyFilter, setVacancyFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const { mode } = useDataMode();
  const [leads, setLeads] = useState(initialLeads);

  // Re-fetch when data mode changes
  useEffect(() => {
    listLeads(mode === "demo").then((data) => setLeads(data));
  }, [mode]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const id = setInterval(() => listLeads(mode === "demo").then((data) => setLeads(data)), 5_000);
    return () => clearInterval(id);
  }, [router, mode]);

  // Derive unique vacancies from leads
  const vacancyOptions = Array.from(
    new Map(
      leads
        .filter((l) => l.latestApplication)
        .map((l) => [l.latestApplication!.vacancy.id, l.latestApplication!.vacancy.title])
    ).entries()
  );

  const filtered = leads.filter((lead) => {
    const key = getStatusKey(lead);

    // Vacancy filter: "browsing" means no application
    if (vacancyFilter === "browsing") {
      if (lead.latestApplication !== null) return false;
    } else if (vacancyFilter !== "all") {
      if (lead.latestApplication?.vacancy.id !== vacancyFilter) return false;
    }

    // Date filter on lastMessageAt
    if (dateFilter === "today" && !isToday(lead.lastMessageAt)) return false;
    if (dateFilter === "week" && !isThisWeek(lead.lastMessageAt)) return false;
    if (dateFilter === "month" && !isThisMonth(lead.lastMessageAt)) return false;

    // Status filter
    if (statusFilter !== "all" && key !== statusFilter) return false;

    return true;
  });

  function handleRowClick(lead: LeadRow) {
    if (lead.latestApplication) {
      router.push(`/candidates/${lead.latestApplication.app.id}`);
    }
    // If no application, no navigation — they're just browsing (no profile to show)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 py-5 border-b border-border bg-bg">
        <h1 className="text-h2 text-text">Leads</h1>
        <p className="text-body-sm text-muted mt-0.5">
          All Telegram users who interacted with your bots
        </p>
      </div>

      {/* Filter bar */}
      <div className="px-8 py-3 border-b border-border bg-bg flex items-center gap-2 flex-wrap">
        <select
          value={vacancyFilter}
          onChange={(e) => setVacancyFilter(e.target.value)}
          className="bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-body-sm text-text outline-none focus:border-primary"
        >
          <option value="all">All vacancies</option>
          <option value="browsing">Browsing only</option>
          {vacancyOptions.map(([id, title]) => (
            <option key={id} value={id}>{title}</option>
          ))}
        </select>

        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value as DateFilter)}
          className="bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-body-sm text-text outline-none focus:border-primary"
        >
          <option value="all">All time</option>
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-body-sm text-text outline-none focus:border-primary"
        >
          <option value="all">All statuses</option>
          <option value="browsing">Browsing</option>
          <option value="in_progress">In progress</option>
          <option value="submitted">Submitted</option>
          <option value="abandoned">Abandoned</option>
        </select>

        <span className="text-body-sm text-muted ml-auto">
          {filtered.length} lead{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="px-8 py-16 text-center text-body-sm text-muted">
            No leads match the current filters.
          </div>
        ) : (
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="text-left text-micro text-subtle uppercase tracking-wider px-4 py-2 font-semibold">
                  Candidate
                </th>
                <th className="text-left text-micro text-subtle uppercase tracking-wider px-4 py-2 font-semibold">
                  Username
                </th>
                <th className="text-left text-micro text-subtle uppercase tracking-wider px-4 py-2 font-semibold">
                  Status
                </th>
                <th className="text-left text-micro text-subtle uppercase tracking-wider px-4 py-2 font-semibold">
                  Vacancy
                </th>
                <th className="text-left text-micro text-subtle uppercase tracking-wider px-4 py-2 font-semibold">
                  Last activity
                </th>
                <th className="text-left text-micro text-subtle uppercase tracking-wider px-4 py-2 font-semibold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => {
                const hasProfile = lead.latestApplication !== null;
                return (
                  <tr
                    key={lead.candidate.id}
                    onClick={() => handleRowClick(lead)}
                    className={`border-b border-border transition-colors ${
                      hasProfile
                        ? "cursor-pointer hover:bg-surface-2"
                        : "hover:bg-surface"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          name={lead.candidate.telegramFirstName || lead.candidate.fullName}
                          id={lead.candidate.id}
                          size="sm"
                        />
                        <span className="text-body-sm font-medium text-text truncate max-w-[140px]">
                          {lead.candidate.telegramFirstName || lead.candidate.fullName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-body-sm text-muted">
                        {lead.candidate.telegramUsername
                          ? `@${lead.candidate.telegramUsername}`
                          : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge lead={lead} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-body-sm text-muted truncate max-w-[120px]">
                        {lead.latestApplication?.vacancy.title ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-body-sm text-muted">
                        {lead.lastMessageAt
                          ? formatRelativeTime(lead.lastMessageAt.toISOString())
                          : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {hasProfile ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/candidates/${lead.latestApplication!.app.id}`);
                          }}
                          className="text-micro text-primary hover:underline font-medium"
                        >
                          View
                        </button>
                      ) : (
                        <span className="text-micro text-subtle">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
