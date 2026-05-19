import Link from "next/link";

export default function VacancyNotFound() {
  return (
    <div className="flex h-full items-center justify-center px-8 py-12">
      <div className="max-w-md text-center">
        <h2 className="text-h2 text-text">Vacancy not found</h2>
        <p className="mt-2 text-body-sm text-muted">
          This vacancy does not exist or was deleted.
        </p>
        <Link
          href="/vacancies"
          className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2 text-body-sm font-semibold text-primary-fg transition-opacity hover:opacity-90"
        >
          Back to vacancies
        </Link>
      </div>
    </div>
  );
}
