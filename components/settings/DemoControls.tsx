"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDataMode } from "@/context/DataModeContext";
import { useAuth } from "@/context/AuthContext";
import { deleteMyTestApplications, setMyTelegramUserId, getMyTelegramUserId } from "@/app/actions/candidate-actions";

export function DemoControls() {
  const router = useRouter();
  const { mode, toggle } = useDataMode();
  const { user, hasPermission } = useAuth();
  const canReset = user?.isSuperadmin || hasPermission("settings", "write");

  const [showConfirm, setShowConfirm] = useState(false);
  const [resetStatus, setResetStatus] = useState<"idle" | "pending" | "done" | "error">("idle");

  const [myTelegramId, setMyTelegramId] = useState("");
  const [telegramIdSaved, setTelegramIdSaved] = useState(false);
  const [cleanupPending, setCleanupPending] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);

  useEffect(() => {
    getMyTelegramUserId().then(id => { if (id) setMyTelegramId(id); });
  }, []);

  async function handleReset() {
    setShowConfirm(false);
    setResetStatus("pending");
    try {
      const r = await fetch("/api/admin/reset-demo", {
        method: "POST",
        credentials: "include",
      });
      if (r.ok) {
        setResetStatus("done");
        router.refresh();
      } else {
        setResetStatus("error");
      }
    } catch {
      setResetStatus("error");
    }
  }

  return (
    <div className="max-w-md space-y-6">
      {/* Toggle card */}
      <div className="border border-gray-100 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-gray-800">Data mode</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {mode === "demo" ? "Showing demo data" : "Showing live data"}
            </p>
          </div>
          <button
            role="switch"
            aria-checked={mode === "demo"}
            onClick={toggle}
            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
              mode === "demo" ? "bg-amber-400" : "bg-green-500"
            }`}
          >
            <span
              className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                mode === "demo" ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Current mode:{" "}
          <span
            className={`font-semibold ${mode === "demo" ? "text-amber-600" : "text-green-600"}`}
          >
            {mode === "demo" ? "Demo" : "Live"}
          </span>
        </p>
      </div>

      {/* Reset demo data — admin only */}
      {canReset && (
        <div className="border border-gray-100 rounded-xl p-5 space-y-3">
          <div>
            <p className="text-sm font-semibold text-gray-800">Reset demo data</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Deletes all demo rows and re-seeds. Live data is not affected.
            </p>
          </div>

          {resetStatus === "done" && (
            <p className="text-sm text-green-600">Demo data has been reset. Refresh to see the changes.</p>
          )}
          {resetStatus === "error" && (
            <p className="text-sm text-red-500">Reset failed. Please try again.</p>
          )}

          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={resetStatus === "pending"}
              className="h-9 px-4 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {resetStatus === "pending" ? "Resetting…" : "Reset demo data"}
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-700">
                This will delete all demo rows and re-seed. Live data will not be touched. Continue?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  className="h-9 px-4 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
                >
                  Yes, reset
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="h-9 px-4 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {/* HR Testing Cleanup */}
      <div className="border border-gray-100 rounded-xl p-5 space-y-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">HR Testing Cleanup</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Delete all applications you submitted via Telegram while testing. Your Anketa profile on the bot side is preserved.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={myTelegramId}
            onChange={e => { setMyTelegramId(e.target.value); setTelegramIdSaved(false); }}
            placeholder="Your Telegram user ID (numeric)"
            className="flex-1 h-8 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={async () => {
              const result = await setMyTelegramUserId(myTelegramId);
              if (result.ok) setTelegramIdSaved(true);
            }}
            className="h-8 px-3 rounded-lg bg-primary text-white text-sm font-medium"
          >
            Save
          </button>
        </div>
        {telegramIdSaved && <p className="text-xs text-green-600">Saved ✓</p>}
        <button
          type="button"
          disabled={cleanupPending || !myTelegramId}
          onClick={async () => {
            if (!confirm("Delete all your test applications? This cannot be undone.")) return;
            setCleanupPending(true);
            setCleanupResult(null);
            const result = await deleteMyTestApplications();
            setCleanupPending(false);
            setCleanupResult(result.ok ? `Deleted ${result.count} application(s).` : result.error);
          }}
          className="h-8 px-3 rounded-lg border border-red-300 text-red-600 text-sm hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          🧹 Delete all my test applications
        </button>
        {cleanupResult && <p className="text-sm text-gray-500 mt-1">{cleanupResult}</p>}
      </div>
    </div>
  );
}
