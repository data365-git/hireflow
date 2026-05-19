"use server";
import { db } from "@/lib/db/client";
import { vacancies, vacancyStages, screeningQuestions, applications, users } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getCurrentDataMode } from "@/lib/data-mode";

export async function getAllVacancies() {
  const isDemo = await getCurrentDataMode();
  return db
    .select()
    .from(vacancies)
    .where(eq(vacancies.isDemo, isDemo))
    .orderBy(vacancies.createdAt);
}

export async function getVacanciesPageData() {
  const isDemo = await getCurrentDataMode();
  const [vacancyRows, stageRows, userRows] = await Promise.all([
    db.select().from(vacancies).where(eq(vacancies.isDemo, isDemo)).orderBy(vacancies.createdAt),
    db.select().from(vacancyStages),
    db.select().from(users),
  ]);
  const vacancyIds = vacancyRows.map((v) => v.id);
  const appRows =
    vacancyIds.length > 0
      ? await db.select().from(applications).where(inArray(applications.vacancyId, vacancyIds))
      : [];
  return { vacancies: vacancyRows, stages: stageRows, applications: appRows, users: userRows };
}

export async function getVacancyById(id: string) {
  const isDemo = await getCurrentDataMode();
  const rows = await db
    .select()
    .from(vacancies)
    .where(and(eq(vacancies.id, id), eq(vacancies.isDemo, isDemo)));
  return rows[0] ?? null;
}

export async function getVacancyStages(vacancyId: string) {
  return db
    .select()
    .from(vacancyStages)
    .where(eq(vacancyStages.vacancyId, vacancyId))
    .orderBy(vacancyStages.orderIndex);
}

export async function getScreeningQuestions(vacancyId: string) {
  return db
    .select()
    .from(screeningQuestions)
    .where(eq(screeningQuestions.vacancyId, vacancyId))
    .orderBy(screeningQuestions.orderIndex);
}

// --- Screening Questions mutations ---

export async function createScreeningQuestion(data: {
  vacancyId: string;
  text: string;
  type: string;
  options?: string[];
  orderIndex: number;
}): Promise<{ id: string }> {
  const [row] = await db.insert(screeningQuestions).values({
    id: `sq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    vacancyId: data.vacancyId,
    text: data.text,
    type: data.type,
    options: data.options ?? null,
    orderIndex: data.orderIndex,
  }).returning({ id: screeningQuestions.id });
  return row;
}

export async function updateScreeningQuestion(
  id: string,
  data: { text?: string; type?: string; options?: string[] | null; orderIndex?: number }
): Promise<void> {
  await db.update(screeningQuestions)
    .set({ ...data })
    .where(eq(screeningQuestions.id, id));
}

export async function deleteScreeningQuestion(id: string): Promise<void> {
  await db.delete(screeningQuestions).where(eq(screeningQuestions.id, id));
}

export async function reorderScreeningQuestions(
  vacancyId: string,
  orderedIds: string[]
): Promise<void> {
  await Promise.all(
    orderedIds.map((id, index) =>
      db.update(screeningQuestions)
        .set({ orderIndex: index })
        .where(and(eq(screeningQuestions.id, id), eq(screeningQuestions.vacancyId, vacancyId)))
    )
  );
}
