import Link from "next/link";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FeedbackKanban } from "@/components/feedback/FeedbackKanban";
import { createHrFeedback, getFeedbackPageData } from "@/app/actions/feedback";

export const dynamic = "force-dynamic";

type FeedbackPageProps = {
  searchParams?: Promise<{ kind?: string | string[] }>;
};

export default async function FeedbackPage({ searchParams }: FeedbackPageProps) {
  const { targets, items } = await getFeedbackPageData();
  const params = await searchParams;
  const kindParam = Array.isArray(params?.kind) ? params?.kind[0] : params?.kind;
  const activeKind = kindParam === "complaint" || kindParam === "suggestion"
    ? kindParam
    : "all";
  const visibleItems = activeKind === "all" ? items : items.filter((item) => item.kind === activeKind);
  const hasTargets = targets.length > 0;
  const complaintCount = items.filter((item) => item.kind === "complaint").length;
  const suggestionCount = items.filter((item) => item.kind === "suggestion").length;

  return (
    <div className="px-8 py-8">
      <div className="mb-6">
        <h1 className="text-h1 text-text">Complaints & Suggestions</h1>
        <p className="text-body-sm text-muted mt-1">
          Track candidate complaints and suggestions from first review through resolution.
        </p>
      </div>

      <section className="bg-surface border border-border rounded-lg p-4 mb-6 max-w-[980px]">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquarePlus className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-body font-semibold text-text">Add HR item</h2>
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

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_160px_160px]">
            <div>
              <label htmlFor="comment" className="block text-body-sm font-medium text-text mb-1">
                Details
              </label>
              <textarea
                id="comment"
                name="comment"
                required
                rows={4}
                placeholder="Summarize the complaint or suggestion."
                className="w-full rounded-lg border border-border px-3 py-2 text-body-sm bg-surface text-text placeholder:text-subtle outline-none transition-all resize-y min-h-24 focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:bg-surface-2 disabled:text-disabled"
                disabled={!hasTargets}
              />
            </div>
            <div>
              <label htmlFor="kind" className="block text-body-sm font-medium text-text mb-1">
                Type
              </label>
              <select
                id="kind"
                name="kind"
                required
                disabled={!hasTargets}
                className="w-full rounded-lg border border-border px-3 py-2 text-body-sm bg-surface text-text outline-none transition-all focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:bg-surface-2 disabled:text-disabled"
                defaultValue="complaint"
              >
                <option value="complaint">Complaint</option>
                <option value="suggestion">Suggestion</option>
              </select>
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
              Add item
            </Button>
          </div>
        </form>
      </section>

      <section className="bg-surface border border-border rounded-lg p-4">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-body font-semibold text-text">Kanban board</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                ["all", `All (${items.length})`],
                ["complaint", `Complaints (${complaintCount})`],
                ["suggestion", `Suggestions (${suggestionCount})`],
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

        <FeedbackKanban items={visibleItems} />
      </section>
    </div>
  );
}
