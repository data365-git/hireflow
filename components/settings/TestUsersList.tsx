"use client";
import { useState } from "react";
import {
  addBotTestUser,
  toggleBotTestUser,
  removeBotTestUser,
  type BotTestUser,
} from "@/app/actions/bot-test-users";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export function TestUsersList({ initial }: { initial: BotTestUser[] }) {
  const [rows, setRows] = useState(initial);
  const [showAdd, setShowAdd] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [label, setLabel] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<number | "never">(30);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<BotTestUser | null>(null);

  async function handleAdd() {
    if (!identifier.trim()) {
      setAddError("Enter username or ID");
      return;
    }
    setAdding(true);
    setAddError(null);
    const r = await addBotTestUser({
      identifier,
      label: label.trim() || undefined,
      expiresInDays: expiresInDays === "never" ? null : expiresInDays,
    });
    setAdding(false);
    if (!r.ok) {
      setAddError(r.error);
      return;
    }
    setIdentifier("");
    setLabel("");
    setShowAdd(false);
    window.location.reload();
  }

  async function handleToggle(row: BotTestUser) {
    await toggleBotTestUser(row.id, !row.isActive);
    setRows((rs) => rs.map((x) => (x.id === row.id ? { ...x, isActive: !x.isActive } : x)));
  }

  async function handleRemove(row: BotTestUser) {
    const r = await removeBotTestUser(row.id);
    if (!r.ok) return;
    setRows((rs) => rs.filter((x) => x.id !== row.id));
    setConfirmRemove(null);
  }

  const activeCount = rows.filter((r) => r.isActive).length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">
          {activeCount} active · {rows.length} total
        </p>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition"
        >
          + Add test user
        </button>
      </div>

      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-border bg-surface-2">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide">
                Identifier
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide">
                Label
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide">
                Status
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide">
                Expires
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted">
                  No test users yet. Add a Telegram username or numeric ID to start testing.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const isExpired = row.expiresAt != null && new Date(row.expiresAt) < new Date();
              return (
                <tr
                  key={row.id}
                  className="border-b border-border last:border-0 hover:bg-surface-2/40 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-sm text-text">
                    {row.telegramUsername ? `@${row.telegramUsername}` : row.telegramUserId}
                    {row.telegramUsername && row.telegramUserId && (
                      <span className="text-xs text-muted ml-2">({row.telegramUserId})</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted">{row.label ?? "—"}</td>
                  <td className="px-4 py-3">
                    {isExpired ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                        Expired
                      </span>
                    ) : row.isActive ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                        Active
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
                        Disabled
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted">
                    {row.expiresAt
                      ? new Date(row.expiresAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "Never"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-3 text-sm">
                      <button
                        onClick={() => handleToggle(row)}
                        className="text-primary hover:underline"
                      >
                        {row.isActive ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() => setConfirmRemove(row)}
                        className="text-red-500 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add modal */}
      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowAdd(false)}
        >
          <div
            className="bg-surface rounded-2xl shadow-2xl p-6 w-96"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-1">Add test user</h2>
            <p className="text-sm text-muted mb-4">
              Enter a username (e.g. <code>@bunyod_dev</code>) or numeric ID. Find your ID via{" "}
              <span className="text-primary font-medium">@userinfobot</span> on Telegram.
            </p>

            <label className="block text-sm font-medium mb-1">Telegram username or ID</label>
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="@username or 123456789"
              className="w-full border border-border rounded-lg px-3 py-2 mb-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              autoFocus
            />

            <label className="block text-sm font-medium mb-1">Label (optional)</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Bunyod (QA)"
              className="w-full border border-border rounded-lg px-3 py-2 mb-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />

            <label className="block text-sm font-medium mb-1">Expires in</label>
            <select
              value={String(expiresInDays)}
              onChange={(e) =>
                setExpiresInDays(
                  e.target.value === "never" ? "never" : Number(e.target.value),
                )
              }
              className="w-full border border-border rounded-lg px-3 py-2 mb-4 text-sm focus:outline-none"
            >
              <option value="7">7 days</option>
              <option value="30">30 days (default)</option>
              <option value="90">90 days</option>
              <option value="never">Never (manual disable)</option>
            </select>

            {addError && <p className="text-sm text-red-500 mb-3">{addError}</p>}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 text-sm text-muted hover:bg-surface-2 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={adding}
                className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
              >
                {adding ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmRemove && (
        <ConfirmDialog
          open
          title="Remove test user"
          message={`Remove ${
            confirmRemove.telegramUsername
              ? `@${confirmRemove.telegramUsername}`
              : confirmRemove.telegramUserId
          } from the test list? They'll be subject to normal rules immediately.`}
          confirmLabel="Remove"
          onConfirm={() => handleRemove(confirmRemove)}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
    </div>
  );
}
