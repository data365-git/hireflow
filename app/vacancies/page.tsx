export const dynamic = "force-dynamic";

import { VacanciesView } from "@/components/VacanciesView";
import { getAllVacancies } from "@/app/actions/vacancies";
import { db } from "@/lib/db/client";
import { vacancyStages, applications, users } from "@/lib/db/schema";

export default async function VacanciesPage() {
  const [vacancyRows, stageRows, appRows, userRows] = await Promise.all([
    getAllVacancies(),
    db.select().from(vacancyStages),
    db.select().from(applications),
    db.select().from(users),
  ]);

  return (
    <VacanciesView
      vacancies={vacancyRows}
      stages={stageRows}
      applications={appRows}
      users={userRows}
    />
  );
}
