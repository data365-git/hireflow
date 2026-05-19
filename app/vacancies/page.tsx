export const dynamic = "force-dynamic";

import { VacanciesView } from "@/components/VacanciesView";
import { getAllVacancies } from "@/app/actions/vacancies";
import { db } from "@/lib/db/client";
import { vacancyStages, applications, users } from "@/lib/db/schema";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default async function VacanciesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const statusParam = (await searchParams).status;
  const statusFilter = Array.isArray(statusParam) ? statusParam[0] : statusParam;
  const [vacancyRows, stageRows, appRows, userRows] = await Promise.all([
    getAllVacancies(),
    db.select().from(vacancyStages),
    db.select().from(applications),
    db.select().from(users),
  ]);

  return (
    <ProtectedRoute>
      <VacanciesView
        vacancies={vacancyRows}
        stages={stageRows}
        applications={appRows}
        users={userRows}
        statusFilter={statusFilter === "active" || statusFilter === "closed" ? statusFilter : undefined}
      />
    </ProtectedRoute>
  );
}
