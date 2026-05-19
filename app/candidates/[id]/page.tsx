export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getApplicationFull } from "@/app/actions/applications";
import { getCandidateConversation } from "@/app/actions/leads";
import { CandidateProfileClient } from "@/components/CandidateProfileClient";
import type { ConversationMessage } from "@/components/CandidateProfileClient";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default async function CandidateProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: applicationId } = await params;

  const data = await getApplicationFull(applicationId);
  if (!data) notFound();

  // Fetch full TG conversation for the Conversation tab (candidateId from application)
  const candidateId = data.application?.candidateId ?? "";
  const initialConversation: ConversationMessage[] = candidateId
    ? ((await getCandidateConversation(candidateId)) as ConversationMessage[])
    : [];

  return (
    <ProtectedRoute>
      <CandidateProfileClient
        applicationId={applicationId}
        initialConversation={initialConversation}
      />
    </ProtectedRoute>
  );
}
