export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getApplicationFull } from "@/app/actions/applications";
import { getCandidateConversation } from "@/app/actions/leads";
import { CandidateProfileClient } from "@/components/CandidateProfileClient";
import type { ConversationMessage } from "@/components/CandidateProfileClient";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import type { Application, TimelineEventType } from "@/lib/types";

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
        sourceName={data.sourceName}
        initialSourceId={data.application.sourceId ?? null}
        initialApplication={{
          id: data.application.id,
          candidateId: data.application.candidateId,
          vacancyId: data.application.vacancyId,
          currentStageId: data.application.currentStageId,
          status: data.application.status as Application["status"],
          appliedAt: data.application.appliedAt.toISOString(),
          lastActivityAt: data.application.lastActivityAt.toISOString(),
        }}
        initialCandidate={{
          id: data.candidate.id,
          fullName: data.candidate.fullName,
          phone: data.candidate.phone,
          telegramUsername: data.candidate.telegramUsername,
          telegramFirstName: data.candidate.telegramFirstName,
          language: data.candidate.language as "uz" | "en" | "ru",
          city: data.candidate.city,
          createdAt: data.candidate.createdAt.toISOString(),
          dateOfBirth: data.candidate.dateOfBirth?.toISOString() ?? null,
          address: data.candidate.address,
          maritalStatus: data.candidate.maritalStatus,
          isStudent: data.candidate.isStudent,
          educationField: data.candidate.educationField,
          englishLevel: data.candidate.englishLevel,
          russianLevel: data.candidate.russianLevel,
          workExperience: data.candidate.workExperience ?? [],
          departmentId: data.candidate.departmentId,
          profileCompleted: data.candidate.profileCompleted,
          isBlacklisted: data.candidate.isBlacklisted,
          languagePref: data.candidate.languagePref as "uz" | "en" | "ru" | null,
        }}
        initialTimeline={data.timeline.map((event) => ({
          ...event,
          type: event.type as TimelineEventType,
          fromStageId: event.fromStageId ?? undefined,
          toStageId: event.toStageId ?? undefined,
          createdAt: event.createdAt.toISOString(),
        }))}
      />
    </ProtectedRoute>
  );
}
