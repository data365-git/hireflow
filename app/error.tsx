"use client";

import { useEffect } from "react";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center px-8 py-12">
      <div className="max-w-md text-center">
        <h2 className="text-h2 text-text">Something went wrong</h2>
        <p className="mt-2 text-body-sm text-muted">
          The page could not be loaded. Try again, or return to the dashboard.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <button
            onClick={() => unstable_retry()}
            className="rounded-lg bg-primary px-4 py-2 text-body-sm font-semibold text-primary-fg transition-opacity hover:opacity-90"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-lg border border-border px-4 py-2 text-body-sm font-semibold text-muted transition-colors hover:text-text"
          >
            Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
