import { getSourcePerformance, getSourcePerformanceByName } from "@/app/actions/sources";
import { SourcesReportClient } from "./SourcesReportClient";

export default async function SourcesReportPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; groupBy?: string }>;
}) {
  const { days: daysParam, groupBy: groupByParam } = await searchParams;
  const days = daysParam === "0" ? 0 : daysParam ? Number(daysParam) : 30;
  const groupBy = groupByParam === "vacancy" ? "vacancy" : "name";

  const [rowsByVacancy, rowsByName] = await Promise.all([
    getSourcePerformance({ days }),
    getSourcePerformanceByName({ days }),
  ]);

  return (
    <SourcesReportClient
      rowsByVacancy={rowsByVacancy}
      rowsByName={rowsByName}
      initialDays={String(daysParam ?? "30")}
      initialGroupBy={groupBy}
    />
  );
}
