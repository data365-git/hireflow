"use server";
import { db } from "@/lib/db/client";
import {
  applications,
  candidates,
  vacancyStages,
  screeningQuestions,
  screeningAnswers,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function exportVacancyApplicationsCSV(vacancyId: string): Promise<string> {
  const rows = await db
    .select({
      app: applications,
      candidate: candidates,
      stage: vacancyStages,
    })
    .from(applications)
    .innerJoin(candidates, eq(applications.candidateId, candidates.id))
    .leftJoin(vacancyStages, eq(applications.currentStageId, vacancyStages.id))
    .where(eq(applications.vacancyId, vacancyId));

  const questions = await db
    .select()
    .from(screeningQuestions)
    .where(eq(screeningQuestions.vacancyId, vacancyId));

  const headers = [
    "Name",
    "Phone",
    "Telegram",
    "Stage",
    "Applied At",
    ...questions.map((q) => q.text),
  ];

  const lines: string[] = [headers.map(csvEscape).join(",")];

  for (const { app, candidate: cand, stage } of rows) {
    const answers = await db
      .select()
      .from(screeningAnswers)
      .where(eq(screeningAnswers.applicationId, app.id));
    const answerMap = Object.fromEntries(answers.map((a) => [a.questionId, a.answerText]));

    const row = [
      cand.fullName,
      cand.phone ?? "",
      cand.telegramUsername ? `@${cand.telegramUsername}` : "",
      stage?.name ?? "",
      app.appliedAt ? new Date(app.appliedAt).toISOString().split("T")[0] : "",
      ...questions.map((q) => answerMap[q.id] ?? ""),
    ];
    lines.push(row.map(csvEscape).join(","));
  }

  return lines.join("\n");
}

function csvEscape(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}
