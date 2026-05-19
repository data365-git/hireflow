export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getApplicationFull } from "@/app/actions/applications";
import { CandidateProfileClient } from "@/components/CandidateProfileClient";

export default async function CandidateProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: applicationId } = await params;

  const data = await getApplicationFull(applicationId);
  if (!data) notFound();

  return <CandidateProfileClient applicationId={applicationId} />;
}
