import { getApplicationFull } from "@/app/actions/applications";
import { getCandidatePhotoUrl } from "@/app/actions/telegram-files";
import { getVacancyById, getVacancyStages } from "@/app/actions/vacancies";
import { notFound } from "next/navigation";
import { CandidateCVPrintView } from "@/components/candidates/CandidateCVPrintView";

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getApplicationFull(id);
  if (!data) notFound();

  const [photoUrl, vacancy, stages] = await Promise.all([
    getCandidatePhotoUrl(data.candidate.id).catch(() => null),
    getVacancyById(data.application.vacancyId).catch(() => null),
    getVacancyStages(data.application.vacancyId).catch(() => []),
  ]);

  const currentStage = stages.find((s) => s.id === data.application.currentStageId) ?? null;

  return (
    <CandidateCVPrintView
      data={data}
      photoUrl={photoUrl ?? null}
      vacancyTitle={vacancy?.title ?? null}
      stageName={currentStage?.name ?? null}
    />
  );
}
