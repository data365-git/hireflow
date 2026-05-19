"use client";
import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { signIn, user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already logged in (must be in effect, not render body)
  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  if (user) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-bg">
      <form
        onSubmit={handleSubmit}
        className="w-96 rounded-2xl bg-white p-8 shadow-lg border border-border"
      >
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="size-10 bg-primary text-primary-fg rounded-xl flex items-center justify-center font-extrabold text-lg">
            H
          </div>
          <span className="text-2xl font-bold">HireFlow</span>
        </div>
        <h1 className="text-xl font-bold text-center mb-2">Sign in</h1>
        <p className="text-sm text-muted text-center mb-6">
          Welcome back. Please sign in to continue.
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <label className="block text-sm font-medium mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-4 rounded-lg border border-border px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
          autoFocus
        />

        <label className="block text-sm font-medium mb-1">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-6 rounded-lg border border-border px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
        />

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-primary text-primary-fg font-semibold py-2.5 hover:opacity-90 disabled:opacity-50 transition"
        >
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
