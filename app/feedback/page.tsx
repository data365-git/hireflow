import Link from "next/link";
import { MessageSquarePlus, Star } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { createHrFeedback, getFeedbackPageData, type FeedbackItem } from "@/app/actions/feedback";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sourceLabel(source: string) {
  return source === "hr" ? "HR note" : "Candidate survey";
}

function kindLabel(kind: string) {
  if (kind === "complaint") return "Complaint";
  if (kind === "suggestion") return "Suggestion";
  return "General";
}

function Rating({ value }: { value: number | null }) {
  if (!value) return <span className="text-micro text-subtle">No rating</span>;

  return (
    <span className="inline-flex items-center gap-1 text-micro font-medium text-warning">
      <Star className="size-3.5 fill-current" aria-hidden="true" />
      {value}/5
    </span>
  );
}

function FeedbackRow({ item }: { item: FeedbackItem }) {
  return (
    <article className="px-4 py-4 hover:bg-surface-2/70 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {item.applicationId ? (
              <Link
                href={`/candidates/${item.applicationId}`}
                className="text-body-sm font-semibold text-text hover:text-primary"
              >
                {item.candidateName}
              </Link>
            ) : (
              <span className="text-body-sm font-semibold text-text">{item.candidateName}</span>
            )}
            <span className="text-micro px-2 h-5 rounded-full bg-surface-2 text-muted inline-flex items-center">
              {sourceLabel(item.source)}
            </span>
            <span className="text-micro px-2 h-5 rounded-full bg-surface-2 text-muted inline-flex items-center">
              {kindLabel(item.kind)}
            </span>
            {item.stageName && (
              <span className="text-micro px-2 h-5 rounded-full bg-primary/10 text-primary inline-flex items-center">
                {item.stageName}
              </span>
            )}
          </div>
          {item.vacancyId && item.vacancyTitle ? (
            <Link
              href={`/vacancies/${item.vacancyId}`}
              className="mt-1 block text-micro text-subtle hover:text-muted truncate"
            >
              {item.vacancyTitle}
            </Link>
          ) : (
            <p className="mt-1 text-micro text-subtle">General bot feedback</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <Rating value={item.rating} />
          <p className="mt-1 text-micro text-subtle">{formatDate(item.submittedAt)}</p>
        </div>
      </div>
      {item.comment && (
        <p className="mt-3 text-body-sm text-muted leading-relaxed whitespace-pre-wrap">
          {item.comment}
        </p>
      )}
    </article>
  );
}

type FeedbackPageProps = {
  searchParams?: Promise<{ kind?: string | string[] }>;
};

export default async function FeedbackPage({ searchParams }: FeedbackPageProps) {
  const { targets, items } = await getFeedbackPageData();
  const params = await searchParams;
  const kindParam = Array.isArray(params?.kind) ? params?.kind[0] : params?.kind;
  const activeKind = kindParam === "complaint" || kindParam === "suggestion" || kindParam === "general"
    ? kindParam
    : "all";
  const visibleItems = activeKind === "all" ? items : items.filter((item) => item.kind === activeKind);
  const hasTargets = targets.length > 0;

  return (
    <div className="px-8 py-8 max-w-[980px]">
      <div className="mb-6">
        <h1 className="text-h1 text-text">Feedback</h1>
        <p className="text-body-sm text-muted mt-1">
          Candidate surveys and HR process notes tied to interviews and vacancies.
        </p>
      </div>

      <section className="bg-surface border border-border rounded-xl p-4 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquarePlus className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-body font-semibold text-text">Add HR feedback</h2>
        </div>

        <form action={createHrFeedback} className="grid gap-4">
          <div>
            <label htmlFor="applicationId" className="block text-body-sm font-medium text-text mb-1">
              Application
            </label>
            <select
              id="applicationId"
              name="applicationId"
              required
              disabled={!hasTargets}
              className="w-full rounded-lg border border-border px-3 py-2 text-body-sm bg-surface text-text outline-none transition-all focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:bg-surface-2 disabled:text-disabled"
              defaultValue=""
            >
              <option value="" disabled>
                {hasTargets ? "Select candidate and vacancy" : "No applications available"}
              </option>
              {targets.map((target) => (
                <option key={target.applicationId} value={target.applicationId}>
                  {target.candidateName} - {target.vacancyTitle}
                  {target.stageName ? ` (${target.stageName})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_160px] gap-4">
            <div>
              <label htmlFor="comment" className="block text-body-sm font-medium text-text mb-1">
                Note
              </label>
              <textarea
                id="comment"
                name="comment"
                required
                rows={4}
                placeholder="Summarize interview signal, concerns, or process feedback."
                className="w-full rounded-lg border border-border px-3 py-2 text-body-sm bg-surface text-text placeholder:text-subtle outline-none transition-all resize-y min-h-24 focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:bg-surface-2 disabled:text-disabled"
                disabled={!hasTargets}
              />
            </div>
            <div>
              <label htmlFor="rating" className="block text-body-sm font-medium text-text mb-1">
                Rating
              </label>
              <select
                id="rating"
                name="rating"
                disabled={!hasTargets}
                className="w-full rounded-lg border border-border px-3 py-2 text-body-sm bg-surface text-text outline-none transition-all focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:bg-surface-2 disabled:text-disabled"
                defaultValue=""
              >
                <option value="">None</option>
                <option value="5">5 - Strong</option>
                <option value="4">4 - Good</option>
                <option value="3">3 - Mixed</option>
                <option value="2">2 - Weak</option>
                <option value="1">1 - Poor</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" variant="primary" disabled={!hasTargets}>
              <MessageSquarePlus className="size-4" aria-hidden="true" />
              Add feedback
            </Button>
          </div>
        </form>
      </section>

      <section className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border bg-surface-2">
          <div>
            <h2 className="text-body font-semibold text-text">Collected feedback</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                ["all", "All"],
                ["complaint", "Complaints"],
                ["suggestion", "Suggestions"],
                ["general", "General"],
              ].map(([kind, label]) => (
                <Link
                  key={kind}
                  href={kind === "all" ? "/feedback" : `/feedback?kind=${kind}`}
                  className={`rounded-full px-2.5 py-1 text-micro font-medium transition-colors ${
                    activeKind === kind
                      ? "bg-primary text-primary-fg"
                      : "bg-surface text-muted hover:text-text"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <span className="text-micro text-subtle">{visibleItems.length} total</span>
        </div>

        {visibleItems.length === 0 ? (
          <EmptyState
            title="No feedback collected yet"
            description="Add an HR note after an interview or final-stage decision."
          />
        ) : (
          <div className="divide-y divide-border">
            {visibleItems.map((item) => (
              <FeedbackRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
