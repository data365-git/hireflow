"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

export function ProfileForm() {
  const { user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setStatus("error");
      setErrorMessage("New passwords do not match.");
      return;
    }
    setSubmitting(true);
    setStatus("idle");
    try {
      const r = await fetch("/api/auth/change-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (r.ok) {
        setStatus("success");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const data = await r.json().catch(() => ({}));
        setStatus("error");
        setErrorMessage(typeof data.error === "string" ? data.error : "Failed to change password.");
      }
    } catch {
      setStatus("error");
      setErrorMessage("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md space-y-8">
      {/* Display info */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Account info</h2>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Full name</p>
            <p className="text-sm text-gray-800">{user?.fullName ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Email</p>
            <p className="text-sm text-gray-800">{user?.email ?? "—"}</p>
          </div>
          {user?.phone && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Phone</p>
              <p className="text-sm text-gray-800">{user.phone}</p>
            </div>
          )}
        </div>
      </div>

      {/* Change password */}
      <div className="border border-gray-100 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Change password</h2>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-primary"
            />
          </div>

          {status === "success" && (
            <p className="text-sm text-green-600">Password changed successfully.</p>
          )}
          {status === "error" && (
            <p className="text-sm text-red-500">{errorMessage}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
          >
            {submitting ? "Saving…" : "Change password"}
          </button>
        </form>
      </div>
    </div>
  );
}
