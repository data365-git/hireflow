"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { ChatBubble } from "@/components/ChatBubble";
import { KbdHint } from "@/components/ui/KbdHint";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import { useDataMode } from "@/context/DataModeContext";
import { getInboxConversations, type InboxConversation, type InboxMessage } from "@/app/actions/messages";
import { getMessagesForApplication, getMessagesByCandidateId, markMessagesRead, sendMessageToCandidate } from "@/app/actions/messages";
import { toast } from "@/lib/hooks/useToast";
import { formatRelativeTime } from "@/lib/utils";

type Filter = "all" | "unread" | "stale";
type DateFilter = "all" | "today" | "week" | "month";
type StatusFilter = "all" | "browsing" | "in_progress" | "submitted" | "abandoned";

const STATUS_LABELS: Record<Exclude<StatusFilter, "all">, string> = {
  browsing: "Browsing",
  in_progress: "In progress",
  submitted: "Submitted",
  abandoned: "Abandoned",
};

const STATUS_PILL_CLASSES: Record<Exclude<StatusFilter, "all">, string> = {
  browsing: "bg-surface-2 text-muted border-border",
  in_progress: "bg-warning-soft text-warning border-warning/30",
  submitted: "bg-primary/10 text-primary border-primary/20",
  abandoned: "bg-surface-3 text-muted border-border",
};

function applicationStatusLabel(status: string): string | null {
  return status in STATUS_LABELS ? STATUS_LABELS[status as Exclude<StatusFilter, "all">] : null;
}

function applicationStatusPillClass(status: string): string {
  return status in STATUS_PILL_CLASSES
    ? STATUS_PILL_CLASSES[status as Exclude<StatusFilter, "all">]
    : "bg-surface-2 text-muted border-border";
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

function isThisWeek(dateStr: string): boolean {
  const d = new Date(dateStr).getTime();
  const now = Date.now();
  const startOfWeek = now - (new Date().getDay() * 86400000);
  return d >= startOfWeek - (new Date(startOfWeek).getHours() * 3600000 +
    new Date(startOfWeek).getMinutes() * 60000 +
    new Date(startOfWeek).getSeconds() * 1000 +
    new Date(startOfWeek).getMilliseconds());
}

function isThisMonth(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export default function InboxPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [vacancyFilter, setVacancyFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  // Key is applicationId when present, else candidateId — always non-empty when something is selected
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [threadMessages, setThreadMessages] = useState<Record<string, InboxMessage[]>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { mode } = useDataMode();

  // Fetch conversations on mount and on mode change
  useEffect(() => {
    getInboxConversations().then(setConversations);
  }, [mode]);

  // Initialize selectedKey to first conversation once loaded
  useEffect(() => {
    if (selectedKey === null && conversations.length > 0) {
      const first = conversations[0];
      setSelectedKey(first.applicationId || first.candidateId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations.length]);

  // Fetch messages when a thread is selected
  useEffect(() => {
    if (!selectedKey) return;
    const conv = conversations.find(
      (c) => (c.applicationId || c.candidateId) === selectedKey
    );
    if (!conv) return;
    const fetchFn = conv.applicationId
      ? getMessagesForApplication(conv.applicationId)
      : getMessagesByCandidateId(conv.candidateId);
    fetchFn.then((msgs) => {
      setThreadMessages((prev) => ({ ...prev, [selectedKey]: msgs }));
      if (conv.applicationId) markMessagesRead(conv.applicationId);
    });
  }, [selectedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalUnread = conversations.reduce((sum, r) => sum + r.unreadCount, 0);
  const staleCount = conversations.filter(
    (r) => r.lastMessageAt && Date.now() - new Date(r.lastMessageAt).getTime() > 3 * 86400000
  ).length;

  const filtered = useMemo(() => conversations.filter((r) => {
    if (filter === "unread" && r.unreadCount === 0) return false;
    if (filter === "stale" && r.lastMessageAt && Date.now() - new Date(r.lastMessageAt).getTime() <= 3 * 86400000) return false;
    if (vacancyFilter !== "all" && r.vacancyId !== vacancyFilter) return false;
    if (dateFilter === "today" && r.lastMessageAt && !isToday(r.lastMessageAt)) return false;
    if (dateFilter === "week" && r.lastMessageAt && !isThisWeek(r.lastMessageAt)) return false;
    if (dateFilter === "month" && r.lastMessageAt && !isThisMonth(r.lastMessageAt)) return false;
    if (statusFilter !== "all" && r.applicationStatus !== statusFilter) return false;
    return true;
  }), [conversations, dateFilter, filter, statusFilter, vacancyFilter]);

  useEffect(() => {
    if (filtered.length === 0) {
      if (selectedKey !== null) setSelectedKey(null);
      return;
    }

    const selectedStillVisible = selectedKey
      ? filtered.some((r) => (r.applicationId || r.candidateId) === selectedKey)
      : false;

    if (!selectedStillVisible) {
      const first = filtered[0];
      setSelectedKey(first.applicationId || first.candidateId);
    }
  }, [filtered, selectedKey]);

  useKeyboardShortcuts({
    j: () => {
      const idx = filtered.findIndex((r) => (r.applicationId || r.candidateId) === selectedKey);
      const next = filtered[idx + 1];
      if (next) {
        const key = next.applicationId || next.candidateId;
        setSelectedKey(key);
        if (next.applicationId) markMessagesRead(next.applicationId);
      }
    },
    k: () => {
      const idx = filtered.findIndex((r) => (r.applicationId || r.candidateId) === selectedKey);
      const prev = filtered[Math.max(0, idx - 1)];
      if (prev && (prev.applicationId || prev.candidateId) !== selectedKey) {
        const key = prev.applicationId || prev.candidateId;
        setSelectedKey(key);
        if (prev.applicationId) markMessagesRead(prev.applicationId);
      }
    },
  });

  const selectedConv = conversations.find((r) => (r.applicationId || r.candidateId) === selectedKey);
  const currentThreadMessages = selectedKey ? (threadMessages[selectedKey] ?? []) : [];

  // Unique vacancies from conversations for the filter dropdown
  const uniqueVacancies = useMemo(() => Array.from(
    new Map(conversations.map((c) => [c.vacancyId, c.vacancyTitle])).entries()
  ).filter(([id]) => id), [conversations]);

  async function handleSendMessage() {
    if (!selectedKey || !selectedConv?.applicationId || isSending) return;

    const messageText = chatInput.trim();
    if (!messageText) return;

    const tempId = `tmp-${crypto.randomUUID()}`;
    const sentAt = new Date().toISOString();
    const optimisticMessage: InboxMessage = {
      id: tempId,
      candidateId: selectedConv.candidateId,
      applicationId: selectedConv.applicationId,
      direction: "outbound",
      senderType: "hr",
      senderName: null,
      text: messageText,
      sentAt,
      readByUserIds: [],
      attachmentFileId: null,
      attachmentType: null,
      attachmentFilename: null,
    };

    setSendError(null);
    setIsSending(true);
    setChatInput("");
    setThreadMessages((prev) => ({
      ...prev,
      [selectedKey]: [...(prev[selectedKey] ?? []), optimisticMessage],
    }));
    setConversations((prev) => prev
      .map((conv) => {
        const convKey = conv.applicationId || conv.candidateId;
        if (convKey !== selectedKey) return conv;
        return {
          ...conv,
          lastMessageText: messageText,
          lastMessageDirection: "outbound" as const,
          lastMessageAt: sentAt,
        };
      })
      .sort((a, b) => {
        const aT = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bT = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bT - aT;
      }));

    try {
      const savedMessage = await sendMessageToCandidate(selectedConv.applicationId, messageText);
      setThreadMessages((prev) => ({
        ...prev,
        [selectedKey]: (prev[selectedKey] ?? []).map((msg) => (
          msg.id === tempId ? savedMessage : msg
        )),
      }));
      setConversations((prev) => prev
        .map((conv) => {
          const convKey = conv.applicationId || conv.candidateId;
          if (convKey !== selectedKey) return conv;
          return {
            ...conv,
            lastMessageText: savedMessage.text,
            lastMessageDirection: "outbound" as const,
            lastMessageAt: savedMessage.sentAt,
          };
        })
        .sort((a, b) => {
          const aT = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const bT = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return bT - aT;
        }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send message";
      setThreadMessages((prev) => ({
        ...prev,
        [selectedKey]: (prev[selectedKey] ?? []).filter((msg) => msg.id !== tempId),
      }));
      setChatInput(messageText);
      setSendError(message);
      toast.error(message);
    } finally {
      setIsSending(false);
    }
  }

  // Scroll to bottom when messages change
  useEffect(() => {
    if (selectedKey) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentThreadMessages.length, selectedKey]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Pane 1: Filters (160px) */}
      <div className="w-40 shrink-0 border-r border-border flex flex-col bg-bg py-3 px-2">
        <p className="text-micro text-subtle uppercase tracking-wider px-2 mb-2">Inbox</p>
        {[
          { id: "all",    label: "All",       count: conversations.length },
          { id: "unread", label: "Unread",    count: totalUnread },
          { id: "stale",  label: "Stale >3d", count: staleCount },
        ].map(({ id, label, count }) => (
          <button
            key={id}
            onClick={() => setFilter(id as typeof filter)}
            className={`flex items-center justify-between h-8 px-2 rounded-lg text-body-sm transition-colors ${
              filter === id
                ? "bg-primary/10 text-primary font-semibold"
                : "text-muted hover:text-text hover:bg-surface-2"
            }`}
          >
            <span>{label}</span>
            {count > 0 && <span className="text-micro">{count}</span>}
          </button>
        ))}
        <div className="mt-auto px-2 pt-3 flex items-center gap-1.5">
          <KbdHint keys="J" />
          <KbdHint keys="K" />
          <span className="text-[10px] text-subtle">navigate</span>
        </div>
      </div>

      {/* Pane 2: Thread list (280px) */}
      <div className="w-72 shrink-0 border-r border-border flex flex-col">
        <div className="px-3 py-2 border-b border-border shrink-0 flex flex-col gap-2">
          <select
            value={vacancyFilter}
            onChange={(e) => setVacancyFilter(e.target.value)}
            className="w-full text-body-sm bg-surface border border-border rounded-lg px-2 py-1 text-text outline-none focus:border-primary"
          >
            <option value="all">All vacancies</option>
            {uniqueVacancies.map(([id, title]) => (
              <option key={id} value={id}>{title}</option>
            ))}
          </select>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as DateFilter)}
            className="w-full text-body-sm bg-surface border border-border rounded-lg px-2 py-1 text-text outline-none focus:border-primary"
          >
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="w-full text-body-sm bg-surface border border-border rounded-lg px-2 py-1 text-text outline-none focus:border-primary"
          >
            <option value="all">All statuses</option>
            <option value="browsing">Browsing</option>
            <option value="in_progress">In progress</option>
            <option value="submitted">Submitted</option>
            <option value="abandoned">Abandoned</option>
          </select>
        </div>
        <div className="h-11 px-4 flex items-center border-b border-border shrink-0">
          <span className="text-body-sm font-semibold text-text">
            {filtered.length} conversation{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-body-sm text-muted text-center">No conversations</div>
          ) : (
            filtered.map((conv) => {
              const convKey = conv.applicationId || conv.candidateId;
              const isSelected = selectedKey === convKey;
              const statusLabel = applicationStatusLabel(conv.applicationStatus);
              return (
                <button
                  key={convKey}
                  onClick={() => {
                    setSelectedKey(convKey);
                    if (conv.applicationId) markMessagesRead(conv.applicationId);
                  }}
                  className={`w-full flex items-start gap-3 px-4 py-3 border-b border-border text-left transition-colors ${
                    isSelected ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-surface-2"
                  }`}
                >
                  <div className="relative shrink-0 mt-0.5">
                    <Avatar name={conv.candidateName} id={conv.candidateId} size="sm" />
                    {conv.unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 size-3.5 bg-primary text-primary-fg text-[9px] font-bold rounded-full flex items-center justify-center">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-body-sm truncate ${
                          conv.unreadCount > 0 ? "font-semibold text-text" : "text-muted"
                        }`}
                      >
                        {conv.candidateName}
                      </span>
                      <span className="text-micro text-subtle shrink-0">
                        {conv.lastMessageAt ? formatRelativeTime(conv.lastMessageAt) : ""}
                      </span>
                    </div>
                    <p
                      className={`text-body-sm truncate mt-0.5 ${
                        conv.unreadCount > 0 ? "text-text" : "text-subtle"
                      }`}
                    >
                      {conv.lastMessageDirection === "outbound" && (
                        <span className="text-subtle">You: </span>
                      )}
                      {conv.lastMessageText}
                    </p>
                    {conv.vacancyTitle && (
                      <p className="text-micro text-subtle truncate mt-0.5">{conv.vacancyTitle}</p>
                    )}
                    {statusLabel && (
                      <span className={`mt-1 inline-flex h-5 items-center rounded-full border px-1.5 text-micro font-medium ${applicationStatusPillClass(conv.applicationStatus)}`}>
                        {statusLabel}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Pane 3: Thread detail (flex-1) */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedKey ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-body-sm text-subtle">Select a conversation</p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="h-11 px-6 flex items-center gap-3 border-b border-border shrink-0 bg-bg">
              <div className="flex-1 min-w-0">
                <span className="text-body-sm font-semibold text-text">
                  {selectedConv?.candidateName}
                </span>
                {selectedConv?.vacancyTitle && (
                  <span className="text-body-sm text-muted ml-2">
                    {selectedConv.vacancyTitle}
                  </span>
                )}
              </div>
              {selectedConv?.applicationId && (
                <Link
                  href={`/candidates/${selectedConv.applicationId}?tab=chat`}
                  className="text-body-sm text-primary hover:underline shrink-0"
                >
                  Open profile →
                </Link>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {currentThreadMessages.map((msg) => (
                <ChatBubble key={msg.id} message={{
                  id: msg.id,
                  candidateId: msg.candidateId,
                  applicationId: msg.applicationId ?? undefined,
                  direction: msg.direction as "inbound" | "outbound",
                  senderType: msg.senderType as "candidate" | "hr" | "system",
                  senderName: msg.senderName ?? undefined,
                  text: msg.text,
                  sentAt: msg.sentAt,
                  readByUserIds: msg.readByUserIds ?? [],
                  attachmentFileId: msg.attachmentFileId ?? undefined,
                  attachmentType: msg.attachmentType as "photo" | "document" | undefined,
                  attachmentFilename: msg.attachmentFilename ?? undefined,
                }} />
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Composer */}
            <div className="px-6 py-3 border-t border-border bg-bg shrink-0">
              {sendError && (
                <p className="mb-2 text-body-sm text-danger">{sendError}</p>
              )}
              <div className="flex items-end gap-2 bg-surface border border-border rounded-xl px-4 py-3 focus-within:border-primary transition-colors">
                <textarea
                  value={chatInput}
                  onChange={(e) => {
                    setChatInput(e.target.value);
                    if (sendError) setSendError(null);
                  }}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" && !e.shiftKey) || (e.key === "Enter" && e.metaKey)) {
                      e.preventDefault();
                      void handleSendMessage();
                    }
                  }}
                  placeholder="Type a message… (Enter to send)"
                  rows={1}
                  className="flex-1 resize-none bg-transparent text-body-sm text-text placeholder:text-subtle outline-none leading-relaxed"
                  style={{ maxHeight: "96px" }}
                />
                <button
                  onClick={() => void handleSendMessage()}
                  disabled={!chatInput.trim() || !selectedConv?.applicationId || isSending}
                  className="shrink-0 h-8 w-8 rounded-lg bg-primary text-primary-fg flex items-center justify-center disabled:opacity-30 transition-opacity"
                  aria-label={isSending ? "Sending message" : "Send message"}
                >
                  ↑
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
