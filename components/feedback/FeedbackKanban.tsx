"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  ExternalLink,
  GripVertical,
  LinkIcon,
  MessageCircleReply,
  Send,
} from "lucide-react";
import {
  saveFeedbackReply,
  updateFeedbackStatus,
  type FeedbackItem,
  type FeedbackStatus,
} from "@/app/actions/feedback";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: "New",
  in_review: "In Review",
  responded: "Responded",
  resolved: "Resolved",
};

const FEEDBACK_STATUSES: FeedbackStatus[] = ["new", "in_review", "responded", "resolved"];

const STATUS_TONE: Record<FeedbackStatus, string> = {
  new: "border-sky-200 bg-sky-50 text-sky-800",
  in_review: "border-amber-200 bg-amber-50 text-amber-800",
  responded: "border-emerald-200 bg-emerald-50 text-emerald-800",
  resolved: "border-zinc-200 bg-zinc-50 text-zinc-700",
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function kindLabel(kind: string) {
  return kind === "complaint" ? "Complaint" : "Suggestion";
}

function sourceLabel(source: string) {
  return source === "hr" ? "HR" : "Candidate";
}

function StatusMoveForm({ id, status, label }: { id: string; status: FeedbackStatus; label: string }) {
  return (
    <form action={updateFeedbackStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">
        {label}
      </Button>
    </form>
  );
}

function FeedbackCard({ item }: { item: FeedbackItem }) {
  return (
    <article
      className="rounded-lg border border-border bg-surface p-3 shadow-sm"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", item.id);
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "inline-flex h-5 items-center rounded-full border px-2 text-micro font-semibold",
                item.kind === "complaint"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-indigo-200 bg-indigo-50 text-indigo-700",
              )}
            >
              {kindLabel(item.kind)}
            </span>
            <span className="inline-flex h-5 items-center rounded-full bg-surface-2 px-2 text-micro text-muted">
              {sourceLabel(item.source)}
            </span>
          </div>
          {item.applicationId ? (
            <Link
              href={`/candidates/${item.applicationId}`}
              className="mt-2 block truncate text-body-sm font-semibold text-text hover:text-primary"
            >
              {item.candidateName}
            </Link>
          ) : (
            <p className="mt-2 truncate text-body-sm font-semibold text-text">{item.candidateName}</p>
          )}
        </div>
        <GripVertical className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden="true" />
      </div>

      {item.comment && (
        <p className="mt-3 line-clamp-6 whitespace-pre-wrap text-body-sm leading-relaxed text-muted">
          {item.comment}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-micro text-subtle">
        <span>{formatDate(item.submittedAt)}</span>
        {item.applicationStageName && <span>{item.applicationStageName}</span>}
        {item.rating && <span>{item.rating}/5</span>}
      </div>

      {item.vacancyId && item.vacancyTitle && (
        <Link
          href={`/vacancies/${item.vacancyId}`}
          className="mt-2 inline-flex max-w-full items-center gap-1 text-micro text-subtle hover:text-muted"
        >
          <ExternalLink className="size-3" aria-hidden="true" />
          <span className="truncate">{item.vacancyTitle}</span>
        </Link>
      )}

      <form action={saveFeedbackReply} className="mt-3 space-y-2 border-t border-border pt-3">
        <input type="hidden" name="id" value={item.id} />
        <label htmlFor={`reply-${item.id}`} className="flex items-center gap-1.5 text-micro font-semibold text-text">
          <MessageCircleReply className="size-3.5" aria-hidden="true" />
          Reply
        </label>
        <textarea
          id={`reply-${item.id}`}
          name="replyText"
          required
          rows={3}
          defaultValue={item.replyText ?? ""}
          placeholder="Response sent to the candidate or owner."
          className="w-full resize-y rounded-md border border-border bg-surface px-2.5 py-2 text-body-sm text-text outline-none transition-all placeholder:text-subtle focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
        <label htmlFor={`reply-link-${item.id}`} className="sr-only">
          Reply link
        </label>
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <LinkIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
            <input
              id={`reply-link-${item.id}`}
              name="replyLink"
              defaultValue={item.replyLink ?? ""}
              placeholder="Reply link"
              className="h-8 w-full rounded-md border border-border bg-surface pl-8 pr-2 text-micro text-text outline-none transition-all placeholder:text-subtle focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm" aria-label="Save reply">
            <Send className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </form>

      <div className="mt-2 grid grid-cols-2 gap-1">
        {FEEDBACK_STATUSES.filter((status) => status !== item.status).map((status) => (
          <StatusMoveForm key={status} id={item.id} status={status} label={STATUS_LABELS[status]} />
        ))}
      </div>
    </article>
  );
}

function FeedbackColumn({ status, items }: { status: FeedbackStatus; items: FeedbackItem[] }) {
  const [isOver, setIsOver] = useState(false);
  const [, startTransition] = useTransition();

  return (
    <section className="flex min-w-[290px] max-w-[320px] flex-1 flex-col">
      <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
        <span
          className={cn(
            "inline-flex h-7 items-center rounded-full border px-3 text-body-sm font-semibold",
            STATUS_TONE[status],
          )}
        >
          {STATUS_LABELS[status]}
        </span>
        <span className="rounded-full bg-surface-2 px-2 text-micro font-semibold text-subtle">
          {items.length}
        </span>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsOver(true);
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsOver(false);
          const id = event.dataTransfer.getData("text/plain");
          if (!id) return;
          const formData = new FormData();
          formData.set("id", id);
          formData.set("status", status);
          startTransition(() => {
            void updateFeedbackStatus(formData);
          });
        }}
        className={cn(
          "flex min-h-[380px] flex-1 flex-col gap-2 rounded-lg border border-dashed border-border bg-surface-2/45 p-2 transition-colors",
          isOver && "border-primary bg-primary/5",
        )}
      >
        {items.length === 0 ? (
          <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-border text-micro text-subtle">
            Drop here
          </div>
        ) : (
          items.map((item) => <FeedbackCard key={item.id} item={item} />)
        )}
      </div>
    </section>
  );
}

export function FeedbackKanban({ items }: { items: FeedbackItem[] }) {
  const byStatus = useMemo(() => {
    const groups = new Map<FeedbackStatus, FeedbackItem[]>();
    for (const status of FEEDBACK_STATUSES) groups.set(status, []);
    for (const item of items) groups.get(item.status)?.push(item);
    return groups;
  }, [items]);

  if (items.length === 0) {
    return (
      <EmptyState
        icon="!"
        title="No complaints or suggestions yet"
        description="Candidate submissions and HR-entered items will appear here."
      />
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-3">
      {FEEDBACK_STATUSES.map((status) => (
        <FeedbackColumn key={status} status={status} items={byStatus.get(status) ?? []} />
      ))}
    </div>
  );
}
