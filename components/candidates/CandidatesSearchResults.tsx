import { Avatar } from "@/components/Avatar";
import Link from "next/link";
import type { CandidateSearchRow } from "@/app/actions/candidate-actions";

type Props = {
  rows: CandidateSearchRow[];
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const LEVEL_LABELS: Record<string, string> = {
  none: "None",
  a1_a2: "A1–A2",
  b1_b2: "B1–B2",
  c1_c2: "C1–C2",
  native: "Native",
};

export function CandidatesSearchResults({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-16 text-muted text-body-sm">
        No matches — try clearing some filters.
      </div>
    );
  }

  return (
    <>
      <p className="text-micro text-subtle mb-3">
        {rows.length === 200 ? "200+ candidates match" : `${rows.length} candidate${rows.length === 1 ? "" : "s"} match`}
      </p>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.7fr)] gap-4 px-4 py-3 border-b border-border bg-surface-2 text-micro text-subtle uppercase tracking-wider">
          <span>Candidate</span>
          <span>Vacancy</span>
          <span>Stage</span>
          <span>Languages</span>
        </div>

        <div className="divide-y divide-border">
          {rows.map((row) => (
            <div
              key={row.candidateId}
              className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.7fr)] gap-4 px-4 py-3 items-center hover:bg-surface-2/70 transition-colors"
            >
              {/* Candidate */}
              {row.applicationId ? (
                <Link href={`/candidates/${row.applicationId}`} className="min-w-0 flex items-center gap-3">
                  <CandidateCell row={row} />
                </Link>
              ) : (
                <div className="min-w-0 flex items-center gap-3">
                  <CandidateCell row={row} />
                </div>
              )}

              {/* Vacancy */}
              <div className="min-w-0">
                {row.vacancyId ? (
                  <Link href={`/vacancies/${row.vacancyId}`} className="min-w-0">
                    <p className="text-body-sm text-text truncate">{row.vacancyTitle}</p>
                    {row.appliedAt && (
                      <p className="text-micro text-subtle">Applied {formatDate(row.appliedAt)}</p>
                    )}
                  </Link>
                ) : (
                  <p className="text-body-sm text-subtle">No application</p>
                )}
              </div>

              {/* Stage */}
              <div className="min-w-0">
                {row.stageName ? (
                  <span className="text-micro px-2 h-5 rounded-full inline-flex items-center font-medium bg-surface-2 text-muted">
                    {row.stageName}
                  </span>
                ) : (
                  <span className="text-micro text-subtle">—</span>
                )}
              </div>

              {/* Languages */}
              <div className="min-w-0 flex flex-col gap-0.5">
                {row.englishLevel && row.englishLevel !== "none" && (
                  <span className="text-micro text-subtle">EN: {LEVEL_LABELS[row.englishLevel] ?? row.englishLevel}</span>
                )}
                {row.russianLevel && row.russianLevel !== "none" && (
                  <span className="text-micro text-subtle">RU: {LEVEL_LABELS[row.russianLevel] ?? row.russianLevel}</span>
                )}
                {(!row.englishLevel || row.englishLevel === "none") &&
                  (!row.russianLevel || row.russianLevel === "none") && (
                    <span className="text-micro text-subtle">—</span>
                  )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function CandidateCell({ row }: { row: CandidateSearchRow }) {
  return (
    <>
      <Avatar name={row.fullName} id={row.candidateId} size="sm" />
      <div className="min-w-0">
        <p className="text-body-sm font-semibold text-text truncate">{row.fullName}</p>
        <p className="text-micro text-subtle truncate">
          {row.telegramUsername ? `@${row.telegramUsername}` : row.phone ?? ""}
        </p>
      </div>
    </>
  );
}
