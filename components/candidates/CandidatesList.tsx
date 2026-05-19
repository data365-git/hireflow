import { EmptyState } from "@/components/ui/EmptyState";
import { Avatar } from "@/components/Avatar";
import { CandidateActionControls } from "@/components/candidates/CandidateActionControls";
import {
  getCandidateList,
  type CandidateFilter,
  type CandidateListRow,
} from "@/app/actions/candidate-actions";
import Link from "next/link";

type Props = {
  filter: CandidateFilter;
};

const emptyCopy: Record<CandidateFilter, { title: string; description: string }> = {
  all: {
    title: "No candidates yet",
    description:
      "Candidates will appear here as applications arrive from the Telegram bot.",
  },
  monitoring: {
    title: "No candidates are being monitored",
    description: "Star a candidate from any pipeline to add them here.",
  },
  accepted: {
    title: "No candidates have been hired yet",
    description: "Accepted candidates will appear here after they reach a hired stage.",
  },
  reserve: {
    title: "Talent pool is empty",
    description:
      "Move strong candidates here from any pipeline to keep them warm.",
  },
  related: {
    title: "No candidate relationships yet",
    description: "Link two candidates from any profile to see relationships here.",
  },
  blacklist: {
    title: "No blacklisted candidates",
    description: "Existing applications stay visible when a candidate is blacklisted.",
  },
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(row: CandidateListRow) {
  if (row.isBlacklisted) return "Blacklisted";
  if (row.isWatched) return "Monitoring";
  if (row.isReserveStage) return "Reserve";
  if (row.isAcceptedStage) return "Accepted";
  return row.stageName ?? row.status;
}

function statusClass(row: CandidateListRow) {
  if (row.isBlacklisted) return "bg-danger-soft text-danger";
  if (row.isWatched) return "bg-primary/10 text-primary";
  if (row.isReserveStage) return "bg-primary/10 text-primary";
  if (row.isAcceptedStage) return "bg-success-soft text-success";
  return "bg-surface-2 text-muted";
}

export async function CandidatesList({ filter }: Props) {
  const rows = await getCandidateList(filter);

  if (rows.length === 0) {
    return <EmptyState {...emptyCopy[filter]} />;
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_auto] gap-4 px-4 py-3 border-b border-border bg-surface-2 text-micro text-subtle uppercase tracking-wider">
        <span>Candidate</span>
        <span>Vacancy</span>
        <span>Status</span>
        <span className="text-right">Actions</span>
      </div>
      <div className="divide-y divide-border">
        {rows.map((row) => (
          <div
            key={row.applicationId}
            className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_auto] gap-4 px-4 py-3 items-center hover:bg-surface-2/70 transition-colors"
          >
            <Link href={`/candidates/${row.applicationId}`} className="min-w-0 flex items-center gap-3">
              <Avatar name={row.candidateName} id={row.candidateId} size="sm" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-body-sm font-semibold text-text truncate">{row.candidateName}</p>
                  {row.relationshipCount > 0 && (
                    <span className="text-micro text-muted bg-surface-3 px-1.5 h-5 rounded-full inline-flex items-center">
                      {row.relationshipCount} related
                    </span>
                  )}
                </div>
                <p className="text-micro text-subtle truncate">
                  @{row.telegramUsername} · {row.phone} · {row.city}
                </p>
              </div>
            </Link>

            <Link href={`/vacancies/${row.vacancyId}`} className="min-w-0">
              <p className="text-body-sm text-text truncate">{row.vacancyTitle}</p>
              <p className="text-micro text-subtle">Applied {formatDate(row.appliedAt)}</p>
            </Link>

            <div className="min-w-0">
              <span
                className={`text-micro px-2 h-5 rounded-full inline-flex items-center font-medium ${statusClass(row)}`}
              >
                {statusLabel(row)}
              </span>
              {row.blacklistReason && (
                <p className="text-micro text-danger mt-1 truncate" title={row.blacklistReason}>
                  {row.blacklistReason}
                </p>
              )}
            </div>

            <CandidateActionControls
              applicationId={row.applicationId}
              candidateId={row.candidateId}
              candidateName={row.candidateName}
              initialIsWatched={row.isWatched}
              initialIsBlacklisted={row.isBlacklisted}
              initialBlacklistReason={row.blacklistReason}
              compact
            />
          </div>
        ))}
      </div>
    </div>
  );
}
