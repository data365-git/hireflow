export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { listDeletedVacancies } from "@/app/actions/vacancies";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { TrashVacanciesList } from "@/components/vacancies/TrashVacanciesList";
import { HttpError } from "@/lib/auth/session";

export default async function VacancyTrashPage() {
  let rows: Awaited<ReturnType<typeof listDeletedVacancies>> = [];
  try {
    rows = await listDeletedVacancies();
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) redirect("/login");
    throw error;
  }

  return (
    <ProtectedRoute>
      <main className="px-8 py-8 max-w-[1000px]">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-h1 text-text">Vacancy Trash</h1>
            <p className="mt-1 text-body-sm text-muted">
              Restore soft-deleted vacancies or permanently remove expired test data.
            </p>
          </div>
          <Link
            href="/vacancies"
            className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-body-sm text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            Back to vacancies
          </Link>
        </div>
        <TrashVacanciesList initialRows={rows} />
      </main>
    </ProtectedRoute>
  );
}
