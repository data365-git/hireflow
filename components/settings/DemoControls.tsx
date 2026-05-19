"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDataMode } from "@/context/DataModeContext";
import { useAuth } from "@/context/AuthContext";

export function DemoControls() {
  const router = useRouter();
  const { mode, toggle } = useDataMode();
  const { user, hasPermission } = useAuth();
  const canReset = user?.isSuperadmin || hasPermission("settings", "write");

  const [showConfirm, setShowConfirm] = useState(false);
  const [resetStatus, setResetStatus] = useState<"idle" | "pending" | "done" | "error">("idle");

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
    </div>
  );
}
