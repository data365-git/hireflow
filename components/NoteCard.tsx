import type { InternalNote, User } from "@/lib/types";
import { formatRelativeTime } from "@/lib/utils";

type Props = {
  note: InternalNote;
  author: User | undefined;
  onTogglePin: () => void;
};

export function NoteCard({ note, author, onTogglePin }: Props) {
  return (
    <div className={`bg-surface border rounded-xl p-4 ${note.isPinned ? "border-primary/40 bg-accent-soft/20" : "border-border"}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-body-sm text-text leading-relaxed flex-1">{note.text}</p>
        <button
          onClick={onTogglePin}
          title={note.isPinned ? "Unpin" : "Pin"}
          className={`shrink-0 text-base transition-colors ${note.isPinned ? "text-primary" : "text-disabled hover:text-muted"}`}
        >
          {note.isPinned ? "📌" : "📎"}
        </button>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <div
          className="size-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
          style={{ backgroundColor: "#7C3AED" }}
        >
          {author?.avatarInitials?.[0] ?? "?"}
        </div>
        <span className="text-micro text-muted">{author?.name ?? "Unknown"}</span>
        <span className="text-subtle">·</span>
        <span className="text-micro text-subtle">{formatRelativeTime(note.createdAt)}</span>
        {note.isPinned && (
          <span className="ml-auto text-micro text-primary font-semibold">Pinned</span>
        )}
      </div>
    </div>
  );
}
