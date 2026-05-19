"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { ChatBubble } from "@/components/ChatBubble";
import { KbdHint } from "@/components/ui/KbdHint";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import { useDataMode } from "@/context/DataModeContext";
import { getInboxConversations, type InboxConversation } from "@/app/actions/messages";
import { getMessagesForApplication, markMessagesRead, sendMessageToCandidate } from "@/app/actions/messages";
import { formatRelativeTime } from "@/lib/utils";

type Filter = "all" | "unread" | "stale";
type DateFilter = "all" | "today" | "week" | "month";
type StatusFilter = "all" | "browsing" | "in_progress" | "submitted" | "abandoned";

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

type DbMessage = {
  id: string;
  candidateId: string;
  applicationId: string | null;
  direction: string;
  senderType: string;
  senderName: string | null;
  text: string;
  sentAt: Date | null;
  readByUserIds: string[] | null;
  attachmentFileId: string | null;
  attachmentType: string | null;
  attachmentFilename: string | null;
};

export default function InboxPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [vacancyFilter, setVacancyFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [threadMessages, setThreadMessages] = useState<Record<string, DbMessage[]>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { mode } = useDataMode();

  // Fetch conversations on mount and on mode change
  useEffect(() => {
    getInboxConversations().then(setConversations);
  }, [mode]);

  // Initialize selectedAppId to first conversation once loaded
  useEffect(() => {
    if (selectedAppId === null && conversations.length > 0) {
      setSelectedAppId(conversations[0].applicationId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations.length]);

  // Fetch messages when a thread is selected
  useEffect(() => {
    if (!selectedAppId) return;
    getMessagesForApplication(selectedAppId).then((msgs) => {
      setThreadMessages((prev) => ({ ...prev, [selectedAppId]: msgs }));
      markMessagesRead(selectedAppId);
    });
  }, [selectedAppId]);

  const totalUnread = conversations.reduce((sum, r) => sum + r.unreadCount, 0);
  const staleCount = conversations.filter(
    (r) => r.lastMessageAt && Date.now() - new Date(r.lastMessageAt).getTime() > 3 * 86400000
  ).length;

  const filtered = conversations.filter((r) => {
    if (filter === "unread" && r.unreadCount === 0) return false;
    if (filter === "stale" && r.lastMessageAt && Date.now() - new Date(r.lastMessageAt).getTime() <= 3 * 86400000) return false;
    if (vacancyFilter !== "all" && r.vacancyId !== vacancyFilter) return false;
    if (dateFilter === "today" && r.lastMessageAt && !isToday(r.lastMessageAt)) return false;
    if (dateFilter === "week" && r.lastMessageAt && !isThisWeek(r.lastMessageAt)) return false;
    if (dateFilter === "month" && r.lastMessageAt && !isThisMonth(r.lastMessageAt)) return false;
    if (statusFilter !== "all" && r.applicationStatus !== statusFilter) return false;
    return true;
  });

  useKeyboardShortcuts({
    j: () => {
      const idx = filtered.findIndex((r) => r.applicationId === selectedAppId);
      const next = filtered[idx + 1];
      if (next) { setSelectedAppId(next.applicationId); markMessagesRead(next.applicationId); }
    },
    k: () => {
      const idx = filtered.findIndex((r) => r.applicationId === selectedAppId);
      const prev = filtered[Math.max(0, idx - 1)];
      if (prev && prev.applicationId !== selectedAppId) { setSelectedAppId(prev.applicationId); markMessagesRead(prev.applicationId); }
    },
  });

  const selectedConv = conversations.find((r) => r.applicationId === selectedAppId);
  const currentThreadMessages = selectedAppId ? (threadMessages[selectedAppId] ?? []) : [];

  // Unique vacancies from conversations for the filter dropdown
  const uniqueVacancies = Array.from(
    new Map(conversations.map((c) => [c.vacancyId, c.vacancyTitle])).entries()
  ).filter(([id]) => id);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (selectedAppId) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentThreadMessages.length, selectedAppId]);

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
              const isSelected = selectedAppId === conv.applicationId;
              return (
                <button
                  key={conv.applicationId}
                  onClick={() => {
                    setSelectedAppId(conv.applicationId);
                    markMessagesRead(conv.applicationId);
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
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Pane 3: Thread detail (flex-1) */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedAppId ? (
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
              <Link
                href={`/candidates/${selectedAppId}?tab=chat`}
                className="text-body-sm text-primary hover:underline shrink-0"
              >
                Open profile →
              </Link>
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
                  sentAt: msg.sentAt?.toISOString() ?? new Date().toISOString(),
                  readByUserIds: (msg.readByUserIds as string[]) ?? [],
                  attachmentFileId: msg.attachmentFileId ?? undefined,
                  attachmentType: msg.attachmentType as "photo" | "document" | undefined,
                  attachmentFilename: msg.attachmentFilename ?? undefined,
                }} />
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Composer */}
            <div className="px-6 py-3 border-t border-border bg-bg shrink-0">
              <div className="flex items-end gap-2 bg-surface border border-border rounded-xl px-4 py-3 focus-within:border-primary transition-colors">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" && !e.shiftKey) || (e.key === "Enter" && e.metaKey)) {
                      e.preventDefault();
                      if (chatInput.trim() && selectedAppId) {
                        sendMessageToCandidate(selectedAppId, chatInput.trim());
                        setChatInput("");
                      }
                    }
                  }}
                  placeholder="Type a message… (Enter to send)"
                  rows={1}
                  className="flex-1 resize-none bg-transparent text-body-sm text-text placeholder:text-subtle outline-none leading-relaxed"
                  style={{ maxHeight: "96px" }}
                />
                <button
                  onClick={() => {
                    if (chatInput.trim() && selectedAppId) {
                      sendMessageToCandidate(selectedAppId, chatInput.trim());
                      setChatInput("");
                    }
                  }}
                  disabled={!chatInput.trim()}
                  className="shrink-0 h-8 w-8 rounded-lg bg-primary text-primary-fg flex items-center justify-center disabled:opacity-30 transition-opacity"
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
