"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { Avatar } from "@/components/Avatar";
import { StagePill } from "@/components/StagePill";
import { ChatBubble } from "@/components/ChatBubble";
import { KbdHint } from "@/components/ui/KbdHint";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import type { Application, Candidate, VacancyStage, Vacancy, TelegramMessage } from "@/lib/types";
import { formatRelativeTime } from "@/lib/utils";

type Filter = "all" | "unread" | "stale";
type DateFilter = "all" | "today" | "week" | "month";

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

type InboxRow = {
  appId: string;
  app: Application;
  candidate: Candidate;
  lastMsg: TelegramMessage;
  unreadCount: number;
  vacancy: Vacancy | undefined;
  stage: VacancyStage | undefined;
};

export default function InboxPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [vacancyFilter, setVacancyFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const applications = useStore((s) => s.applications);
  const messages = useStore((s) => s.messages);
  const currentUserId = useStore((s) => s.currentUserId);
  const getCandidateForApplication = useStore((s) => s.getCandidateForApplication);
  const getMessagesForApplication = useStore((s) => s.getMessagesForApplication);
  const markConversationRead = useStore((s) => s.markConversationRead);
  const sendMessage = useStore((s) => s.sendMessage);
  const simulateIncomingMessage = useStore((s) => s.simulateIncomingMessage);
  const vacancies = useStore((s) => s.vacancies);
  const stages = useStore((s) => s.stages);

  // Build inbox rows — one per applicationId that has at least one message
  const appIdsWithMessages = [...new Set(
    messages.filter((m): m is typeof m & { applicationId: string } => m.applicationId != null).map((m) => m.applicationId)
  )];

  const rows: InboxRow[] = appIdsWithMessages
    .map((appId): InboxRow | null => {
      const app = applications.find((a) => a.id === appId);
      if (!app) return null;
      const candidate = getCandidateForApplication(appId);
      if (!candidate) return null;
      const msgs = getMessagesForApplication(appId);
      const lastMsg = msgs[msgs.length - 1];
      if (!lastMsg) return null;
      const unreadCount = msgs.filter(
        (m) => m.direction === "inbound" && !m.readByUserIds.includes(currentUserId)
      ).length;
      const vacancy = vacancies.find((v) => v.id === app.vacancyId);
      const stage = stages.find((s) => s.id === app.currentStageId);
      return { appId, app, candidate, lastMsg, unreadCount, vacancy, stage };
    })
    .filter((r): r is InboxRow => r !== null)
    .sort((a, b) => new Date(b.lastMsg.sentAt).getTime() - new Date(a.lastMsg.sentAt).getTime());

  const totalUnread = rows.reduce((sum: number, r: InboxRow) => sum + r.unreadCount, 0);
  const staleCount = rows.filter(
    (r) => Date.now() - new Date(r.lastMsg.sentAt).getTime() > 3 * 86400000
  ).length;

  const filtered: InboxRow[] = rows.filter((r) => {
    if (filter === "unread" && r.unreadCount === 0) return false;
    if (filter === "stale" && Date.now() - new Date(r.lastMsg.sentAt).getTime() <= 3 * 86400000) return false;
    if (vacancyFilter !== "all" && r.app.vacancyId !== vacancyFilter) return false;
    if (dateFilter === "today" && !isToday(r.lastMsg.sentAt)) return false;
    if (dateFilter === "week" && !isThisWeek(r.lastMsg.sentAt)) return false;
    if (dateFilter === "month" && !isThisMonth(r.lastMsg.sentAt)) return false;
    return true;
  });

  // Initialize selectedAppId to first row once rows are available
  useEffect(() => {
    if (selectedAppId === null && rows.length > 0) {
      setSelectedAppId(rows[0].appId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length]);

  useKeyboardShortcuts({
    j: () => {
      const idx = filtered.findIndex((r) => r.appId === selectedAppId);
      const next = filtered[idx + 1];
      if (next) { setSelectedAppId(next.appId); markConversationRead(next.appId); }
    },
    k: () => {
      const idx = filtered.findIndex((r) => r.appId === selectedAppId);
      const prev = filtered[Math.max(0, idx - 1)];
      if (prev && prev.appId !== selectedAppId) { setSelectedAppId(prev.appId); markConversationRead(prev.appId); }
    },
  });

  const selectedRow = rows.find((r) => r.appId === selectedAppId);
  const threadMessages = selectedAppId ? getMessagesForApplication(selectedAppId) : [];

  // Scroll to bottom when messages change
  useEffect(() => {
    if (selectedAppId) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [threadMessages.length, selectedAppId]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Pane 1: Filters (160px) */}
      <div className="w-40 shrink-0 border-r border-border flex flex-col bg-bg py-3 px-2">
        <p className="text-micro text-subtle uppercase tracking-wider px-2 mb-2">Inbox</p>
        {[
          { id: "all",    label: "All",       count: rows.length },
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
            {vacancies.filter((v) => v.status === "active").map((v) => (
              <option key={v.id} value={v.id}>{v.title}</option>
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
            filtered.map(({ appId, candidate, lastMsg, unreadCount, vacancy }) => {
              const isSelected = selectedAppId === appId;
              return (
                <button
                  key={appId}
                  onClick={() => {
                    setSelectedAppId(appId);
                    markConversationRead(appId);
                  }}
                  className={`w-full flex items-start gap-3 px-4 py-3 border-b border-border text-left transition-colors ${
                    isSelected ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-surface-2"
                  }`}
                >
                  <div className="relative shrink-0 mt-0.5">
                    <Avatar name={candidate.fullName} id={candidate.id} size="sm" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 size-3.5 bg-primary text-primary-fg text-[9px] font-bold rounded-full flex items-center justify-center">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-body-sm truncate ${
                          unreadCount > 0 ? "font-semibold text-text" : "text-muted"
                        }`}
                      >
                        {candidate.fullName}
                      </span>
                      <span className="text-micro text-subtle shrink-0">
                        {formatRelativeTime(lastMsg.sentAt)}
                      </span>
                    </div>
                    <p
                      className={`text-body-sm truncate mt-0.5 ${
                        unreadCount > 0 ? "text-text" : "text-subtle"
                      }`}
                    >
                      {lastMsg.direction === "outbound" && (
                        <span className="text-subtle">You: </span>
                      )}
                      {lastMsg.text}
                    </p>
                    {vacancy && (
                      <p className="text-micro text-subtle truncate mt-0.5">{vacancy.title}</p>
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
                  {selectedRow?.candidate.fullName}
                </span>
                {selectedRow?.vacancy && (
                  <span className="text-body-sm text-muted ml-2">
                    {selectedRow.vacancy.title}
                  </span>
                )}
              </div>
              {selectedRow?.stage && <StagePill stage={selectedRow.stage} size="sm" />}
              <Link
                href={`/candidates/${selectedAppId}?tab=chat`}
                className="text-body-sm text-primary hover:underline shrink-0"
              >
                Open profile →
              </Link>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {threadMessages.map((msg) => (
                <ChatBubble key={msg.id} message={msg} />
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Simulate strip */}
            <div className="px-6 py-1.5 border-t border-border flex items-center gap-2">
              <span className="text-micro text-subtle">Demo:</span>
              <button
                onClick={() => simulateIncomingMessage(selectedAppId)}
                className="text-micro text-primary hover:underline"
              >
                Simulate candidate reply
              </button>
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
                        sendMessage(selectedAppId, chatInput.trim());
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
                      sendMessage(selectedAppId, chatInput.trim());
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
