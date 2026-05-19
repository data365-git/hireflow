export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getVacancyById, getVacancyStages } from "@/app/actions/vacancies";
import { getApplicationsForVacancy } from "@/app/actions/applications";
import { VacancyKanbanClient } from "@/components/VacancyKanbanClient";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default async function VacancyKanbanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const vacancy = await getVacancyById(id);
  if (!vacancy) notFound();

  const [stages, appRows] = await Promise.all([
    getVacancyStages(id),
    getApplicationsForVacancy(id),
  ]);

  return (
    <ProtectedRoute>
      <VacancyKanbanClient
        vacancy={vacancy}
        stages={stages}
        appRows={appRows}
      />
    </ProtectedRoute>
  );
}
