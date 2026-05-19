"use server";
import { db } from "@/lib/db/client";
import { vacancies, vacancyStages, screeningQuestions, applications, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function getAllVacancies(isDemo?: boolean) {
  return db
    .select()
    .from(vacancies)
    .where(eq(vacancies.isDemo, isDemo ?? false))
    .orderBy(vacancies.createdAt);
}

export async function getVacanciesPageData(isDemo?: boolean) {
  const [vacancyRows, stageRows, appRows, userRows] = await Promise.all([
    db.select().from(vacancies).where(eq(vacancies.isDemo, isDemo ?? false)).orderBy(vacancies.createdAt),
    db.select().from(vacancyStages),
    db.select().from(applications),
    db.select().from(users),
  ]);
  return { vacancies: vacancyRows, stages: stageRows, applications: appRows, users: userRows };
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
