"use server";
import { db } from "@/lib/db/client";
import { vacancies, vacancyStages, screeningQuestions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function getAllVacancies() {
  return db.select().from(vacancies).orderBy(vacancies.createdAt);
}

export async function getVacancyById(id: string) {
  const rows = await db.select().from(vacancies).where(eq(vacancies.id, id));
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
