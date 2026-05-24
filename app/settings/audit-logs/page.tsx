"use client";

import { useEffect, useState, useTransition } from "react";
import { listAuditLogs, type AuditLogRow, type AuditLogFilters } from "@/app/actions/audit-logs";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}

const ENTITY_TYPES = [
  "candidate",
  "application",
  "vacancy",
  "user",
  "role",
  "automation",
  "message_template",
  "bot_content",
];

export default function AuditLogsPage() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [, startTransition] = useTransition();

  function load(f: AuditLogFilters) {
    setLoading(true);
    startTransition(async () => {
      try {
        const data = await listAuditLogs(f);
        setRows(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load audit logs.");
      } finally {
        setLoading(false);
      }
    });
  }

  useEffect(() => {
    load({});
  }, []);

  function handleChange(key: keyof AuditLogFilters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
  }

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    load(filters);
  }

  return (
    <div className="px-8 py-8 max-w-[900px]">
      <div className="mb-6">
        <h1 className="text-h1 text-text">Audit Logs</h1>
        <p className="text-body-sm text-muted mt-1">
          Recent system activity — last 100 entries matching your filters.
        </p>
      </div>

      {/* Filters */}
      <form onSubmit={handleSearch} className="mb-6 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Actor email"
          value={filters.actorEmail ?? ""}
          onChange={(e) => handleChange("actorEmail", e.target.value)}
          className="h-9 w-48 rounded-lg border border-border bg-surface-2 px-3 text-body-sm text-text placeholder:text-subtle focus:outline-none focus:border-primary"
        />
        <input
          type="text"
          placeholder="Action (e.g. user.login)"
          value={filters.action ?? ""}
          onChange={(e) => handleChange("action", e.target.value)}
          className="h-9 w-52 rounded-lg border border-border bg-surface-2 px-3 text-body-sm text-text placeholder:text-subtle focus:outline-none focus:border-primary"
        />
        <select
          value={filters.entityType ?? ""}
          onChange={(e) => handleChange("entityType", e.target.value)}
          className="h-9 rounded-lg border border-border bg-surface-2 px-3 text-body-sm text-text focus:outline-none focus:border-primary"
        >
          <option value="">All entity types</option>
          {ENTITY_TYPES.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <input
          type="date"
          value={filters.from ?? ""}
          onChange={(e) => handleChange("from", e.target.value)}
          className="h-9 rounded-lg border border-border bg-surface-2 px-3 text-body-sm text-text focus:outline-none focus:border-primary"
        />
        <input
          type="date"
          value={filters.to ?? ""}
          onChange={(e) => handleChange("to", e.target.value)}
          className="h-9 rounded-lg border border-border bg-surface-2 px-3 text-body-sm text-text focus:outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={loading}
          className="h-9 px-4 rounded-lg bg-primary text-primary-fg text-body-sm font-semibold disabled:opacity-50 hover:bg-primary-hover transition-colors"
        >
          {loading ? "Loading…" : "Search"}
        </button>
      </form>

      {error && (
        <div className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-body-sm text-danger">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-body text-muted font-medium py-16 text-center">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-body-sm text-subtle py-16 text-center">No audit log entries found.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <AuditLogEntry key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

function AuditLogEntry({ row }: { row: AuditLogRow }) {
  const [expanded, setExpanded] = useState(false);
  const hasChanges = row.before != null || row.after != null;

  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
        <span className="inline-flex h-6 items-center rounded-full bg-surface-2 px-2.5 text-micro font-semibold text-text shrink-0">
          {row.action}
        </span>
        {row.entityType && (
          <span className="inline-flex h-6 items-center rounded-full border border-border px-2 text-micro text-muted shrink-0">
            {row.entityType}{row.entityId ? ` · ${row.entityId.slice(0, 8)}` : ""}
          </span>
        )}
        <span className="text-micro text-subtle ml-auto shrink-0">{formatDate(row.createdAt)}</span>
      </div>

      {(row.actorEmail || row.entityName) && (
        <p className="mt-1 text-body-sm text-muted">
          {row.actorEmail && <span>By <strong>{row.actorEmail}</strong></span>}
          {row.actorEmail && row.entityName && <span className="mx-1">·</span>}
          {row.entityName && <span>{row.entityName}</span>}
        </p>
      )}

      {row.description && (
        <p className="mt-1 text-body-sm text-muted">{row.description}</p>
      )}

      {hasChanges && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-micro text-primary hover:underline"
        >
          {expanded ? "Hide changes" : "Show changes"}
        </button>
      )}

      {expanded && hasChanges && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {row.before != null && (
            <div>
              <p className="text-micro font-semibold text-subtle mb-1 uppercase tracking-wider">Before</p>
              <pre className="rounded-md bg-surface-2 p-2 text-micro text-muted overflow-auto max-h-48">
                {JSON.stringify(row.before, null, 2)}
              </pre>
            </div>
          )}
          {row.after != null && (
            <div>
              <p className="text-micro font-semibold text-subtle mb-1 uppercase tracking-wider">After</p>
              <pre className="rounded-md bg-surface-2 p-2 text-micro text-muted overflow-auto max-h-48">
                {JSON.stringify(row.after, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
