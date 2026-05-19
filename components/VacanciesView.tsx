"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatSalary } from "@/lib/utils";
import { PipelineMiniBar } from "@/components/PipelineMiniBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDataMode } from "@/context/DataModeContext";
import { getVacanciesPageData } from "@/app/actions/vacancies";
import type { VacancyStage, Application, User } from "@/lib/types";

type DbVacancy = {
  id: string;
  title: string;
  department: string;
  workType: string;
  employmentType: string;
  location: string;
  salaryMin: number;
  salaryMax: number;
  description: string;
  status: string;
  language: string;
  responsibleHrId: string | null;
  stageIds: string[] | null;
  createdAt: Date;
  introMessage: string | null;
  successMessage: string | null;
};

type DbVacancyStage = {
  id: string;
  vacancyId: string;
  name: string;
  color: string;
  isFinal: boolean;
  isRejected: boolean;
  orderIndex: number;
};

type DbApplication = {
  id: string;
  candidateId: string;
  vacancyId: string;
  currentStageId: string;
  appliedAt: Date;
  lastActivityAt: Date;
};

type DbUser = {
  id: string;
  name: string;
  avatarInitials: string;
  role: string;
};

type Props = {
  vacancies: DbVacancy[];
  stages: DbVacancyStage[];
  applications: DbApplication[];
  users: DbUser[];
  statusFilter?: "active" | "closed";
};

const WORK_TYPE_LABELS: Record<string, string> = { office: "Office", remote: "Remote", hybrid: "Hybrid" };
const STATUS_STYLES: Record<string, string> = {
  active: "bg-success-soft text-success",
  paused: "bg-warning-soft text-warning",
  closed: "bg-surface-3 text-muted",
};

export function VacanciesView({ vacancies: initialVacancies, stages: initialStages, applications: initialApplications, users: initialUsers, statusFilter }: Props) {
  const [view, setView] = useState<"cards" | "table">("cards");
  const router = useRouter();
  const { mode } = useDataMode();

  const [vacancies, setVacancies] = useState(initialVacancies);
  const [stages, setStages] = useState(initialStages);
  const [applications, setApplications] = useState(initialApplications);
  const [users, setUsers] = useState(initialUsers);

  useEffect(() => {
    getVacanciesPageData().then((data) => {
      setVacancies(data.vacancies);
      setStages(data.stages);
      setApplications(data.applications);
      setUsers(data.users);
    });
  }, [mode]);

  function getTotalCandidates(vacancyId: string) {
    return applications.filter((a) => a.vacancyId === vacancyId).length;
  }

  function getNewCandidates(vacancyId: string) {
    const sorted = stages
      .filter((s) => s.vacancyId === vacancyId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const firstStage = sorted[0];
    if (!firstStage) return 0;
    return applications.filter(
      (a) => a.vacancyId === vacancyId && a.currentStageId === firstStage.id
    ).length;
  }

  function getStages(vacancyId: string): VacancyStage[] {
    return stages
      .filter((s) => s.vacancyId === vacancyId)
      .sort((a, b) => a.orderIndex - b.orderIndex) as VacancyStage[];
  }

  function getApps(vacancyId: string): Application[] {
    return applications
      .filter((a) => a.vacancyId === vacancyId)
      .map((a) => ({
        ...a,
        appliedAt: a.appliedAt instanceof Date ? a.appliedAt.toISOString() : String(a.appliedAt),
        lastActivityAt:
          a.lastActivityAt instanceof Date ? a.lastActivityAt.toISOString() : String(a.lastActivityAt),
      })) as Application[];
  }

  const visibleVacancies = statusFilter
    ? vacancies.filter((vacancy) => vacancy.status === statusFilter)
    : vacancies;

  const title = statusFilter
    ? `${statusFilter.charAt(0).toUpperCase()}${statusFilter.slice(1)} Vacancies`
    : "Vacancies";

  return (
    <div className="px-8 py-8 max-w-[900px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-h1 text-text">{title}</h1>
          <p className="text-body-sm text-muted mt-1">
            {vacancies.filter((v) => v.status === "active").length} active positions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setView("cards")}
              className={`h-8 px-3 text-body-sm transition-colors ${view === "cards" ? "bg-surface-2 text-text font-medium" : "text-muted hover:bg-surface-2"}`}
            >
              Cards
            </button>
            <button
              onClick={() => setView("table")}
              className={`h-8 px-3 text-body-sm border-l border-border transition-colors ${view === "table" ? "bg-surface-2 text-text font-medium" : "text-muted hover:bg-surface-2"}`}
            >
              Table
            </button>
          </div>
          <Link
            href="/vacancies/new"
            className="inline-flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary text-primary-fg text-body-sm font-semibold"
          >
            + New
          </Link>
        </div>
      </div>

      {visibleVacancies.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl">
          <EmptyState
            title={statusFilter ? `No ${statusFilter} vacancies` : "No vacancies yet"}
            description={statusFilter ? "Try another vacancy status or create a new vacancy." : "Create the first vacancy to start collecting candidates."}
            action={
              <Link
                href="/vacancies/new"
                className="inline-flex items-center h-8 px-4 rounded-lg bg-primary text-primary-fg text-body-sm font-semibold"
              >
                Create vacancy
              </Link>
            }
          />
        </div>
      ) : (
        <>
          {/* Cards view */}
          {view === "cards" && (
            <div className="space-y-3">
              {visibleVacancies.map((vacancy) => {
                const hr = users.find((u) => u.id === vacancy.responsibleHrId);
                const total = getTotalCandidates(vacancy.id);
                const newCount = getNewCandidates(vacancy.id);

                return (
                  <div
                    key={vacancy.id}
                    onClick={() => router.push(`/vacancies/${vacancy.id}`)}
                    role="link"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") router.push(`/vacancies/${vacancy.id}`);
                    }}
                    className="block bg-surface border border-border rounded-xl p-5 hover:border-primary/40 hover:shadow-md transition-all group cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-h3 text-text group-hover:text-primary transition-colors">
                            {vacancy.title}
                          </h2>
                          <span
                            className={`text-micro px-2 h-5 rounded-full inline-flex items-center font-semibold ${STATUS_STYLES[vacancy.status] ?? "bg-surface-3 text-muted"}`}
                          >
                            {vacancy.status.charAt(0).toUpperCase() + vacancy.status.slice(1)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <span className="text-body-sm text-muted">{vacancy.department}</span>
                          <span className="text-subtle">·</span>
                          <span className="text-body-sm text-muted">
                            {WORK_TYPE_LABELS[vacancy.workType] ?? vacancy.workType}
                          </span>
                          <span className="text-subtle">·</span>
                          <span className="text-body-sm text-muted">{vacancy.location}</span>
                          <span className="text-subtle">·</span>
                          <span className="text-body-sm text-muted">
                            {formatSalary(vacancy.salaryMin, vacancy.salaryMax)}
                          </span>
                        </div>
                        <p className="text-body-sm text-subtle mt-2 line-clamp-1">{vacancy.description}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-h2 text-text font-bold">{total}</div>
                        <div className="text-micro text-muted">candidates</div>
                        {newCount > 0 && (
                          <div className="text-micro text-primary font-semibold mt-1">{newCount} new</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                      <div className="flex items-center gap-2">
                        <div
                          className="size-6 rounded-full flex items-center justify-center text-xs font-semibold text-white"
                          style={{ backgroundColor: "#7C3AED" }}
                        >
                          {hr?.avatarInitials ?? "?"}
                        </div>
                        <span className="text-body-sm text-muted">{hr?.name ?? "Unassigned"}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/vacancies/${vacancy.id}/edit`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-body-sm text-muted hover:text-text"
                        >
                          Edit
                        </Link>
                        <span className="text-body-sm text-primary font-medium group-hover:underline">
                          Open pipeline →
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Table view */}
          {view === "table" && (
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <table className="w-full text-body-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2">
                    <th className="text-left px-4 py-2.5 font-semibold text-muted">Vacancy</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-muted">Pipeline</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-muted w-20">Total</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-muted w-16">New</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-muted w-28">HR</th>
                    <th className="px-4 py-2.5 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleVacancies.map((vacancy) => {
                    const hr = users.find((u) => u.id === vacancy.responsibleHrId);
                    const total = getTotalCandidates(vacancy.id);
                    const newCount = getNewCandidates(vacancy.id);
                    const vacStages = getStages(vacancy.id);
                    const vacApps = getApps(vacancy.id);
                    const statusDot =
                      vacancy.status === "active"
                        ? "bg-success"
                        : vacancy.status === "paused"
                        ? "bg-warning"
                        : "bg-subtle";

                    return (
                      <tr
                        key={vacancy.id}
                        className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors cursor-pointer"
                        onClick={() => router.push(`/vacancies/${vacancy.id}`)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`size-2 rounded-full shrink-0 ${statusDot}`} />
                            <span className="font-medium text-text truncate max-w-[240px]">
                              {vacancy.title}
                            </span>
                            <span className="text-micro text-muted bg-surface-3 px-1.5 h-4 rounded-full inline-flex items-center shrink-0">
                              {vacancy.department}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 w-40">
                          <PipelineMiniBar
                            stages={vacStages}
                            applications={vacApps}
                            className="w-32"
                          />
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-text">{total}</td>
                        <td className="px-4 py-3 text-right">
                          {newCount > 0 ? (
                            <span className="text-primary font-semibold text-body-sm">{newCount}</span>
                          ) : (
                            <span className="text-subtle">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="size-6 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
                              style={{ backgroundColor: "#7C3AED" }}
                            >
                              {hr?.avatarInitials ?? "?"}
                            </div>
                            <span className="text-body-sm text-muted truncate">{hr?.name ?? "—"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/vacancies/${vacancy.id}/edit`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-body-sm text-muted hover:text-text transition-colors"
                          >
                            Edit
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
