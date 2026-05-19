import { getSourcePerformance } from "@/app/actions/sources";

export default async function SourcesReportPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: daysParam } = await searchParams;
  const days = daysParam === "0" ? 0 : daysParam ? Number(daysParam) : 30;

  const rows = await getSourcePerformance({ days });

  const dayOptions = [
    { label: "Last 7 days", value: "7" },
    { label: "Last 30 days", value: "30" },
    { label: "Last 90 days", value: "90" },
    { label: "All time", value: "0" },
  ];

  const selectedValue = daysParam ?? "30";

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-heading font-semibold text-text">Source Performance</h1>

        <form method="GET">
          <select
            name="days"
            defaultValue={selectedValue}
            onChange={undefined}
            className="h-9 px-3 rounded-lg border border-border bg-surface text-body text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
            /* server component — submit via button below */
          >
            {dayOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="ml-2 h-9 px-4 rounded-lg bg-primary text-primary-fg text-body-sm font-medium hover:opacity-90 transition-opacity"
          >
            Apply
          </button>
        </form>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-body font-medium text-muted">No source data</p>
          <p className="text-body-sm text-subtle mt-1">
            Applications with a tracked source will appear here.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <table className="w-full text-body-sm">
            <thead>
              <tr className="border-b border-border bg-bg">
                <th className="text-left px-4 py-3 font-medium text-subtle">Source</th>
                <th className="text-left px-4 py-3 font-medium text-subtle">Vacancy</th>
                <th className="text-right px-4 py-3 font-medium text-subtle">Total</th>
                <th className="text-right px-4 py-3 font-medium text-subtle">Browsing</th>
                <th className="text-right px-4 py-3 font-medium text-subtle">In Progress</th>
                <th className="text-right px-4 py-3 font-medium text-subtle">Submitted</th>
                <th className="text-right px-4 py-3 font-medium text-subtle">Abandoned</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={`${row.sourceId}-${row.vacancyId}`}
                  className={`border-b border-border last:border-0 ${i % 2 === 1 ? "bg-bg/50" : ""}`}
                >
                  <td className="px-4 py-3 font-medium text-text">{row.sourceName}</td>
                  <td className="px-4 py-3 text-muted">{row.vacancyTitle}</td>
                  <td className="px-4 py-3 text-right font-semibold text-text">{row.total}</td>
                  <td className="px-4 py-3 text-right text-muted">{row.browsing}</td>
                  <td className="px-4 py-3 text-right text-muted">{row.in_progress}</td>
                  <td className="px-4 py-3 text-right text-muted">{row.submitted}</td>
                  <td className="px-4 py-3 text-right text-muted">{row.abandoned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
