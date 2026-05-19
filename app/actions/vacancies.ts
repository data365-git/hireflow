"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { vacancies, vacancyStages, screeningQuestions, applications, users, sources, testTasks, testTaskAssignments, departments } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getCurrentDataMode } from "@/lib/data-mode";
import { requirePermission } from "@/lib/auth/permissions";
import type { Application, CreateVacancyInput, Source, TestTask, User, Vacancy, VacancyStage } from "@/lib/types";

type VacancyPatch = Partial<
  Pick<
    Vacancy,
    | "title"
    | "department"
    | "workType"
    | "employmentType"
    | "location"
    | "salaryMin"
    | "salaryMax"
    | "description"
    | "status"
    | "language"
    | "responsibleHrId"
    | "introMessage"
    | "successMessage"
  >
>;

type StagePatch = Partial<Pick<VacancyStage, "name" | "color" | "isFinal" | "isRejected" | "isReserve">>;

export type VacancyActionError = {
  code: string;
  field?: keyof CreateVacancyInput | "stages" | "sources";
  message: string;
};

export type CreateVacancyResult =
  | { ok: true; vacancyId: string }
  | { ok: false; error: VacancyActionError };

export type VacancyEditData = {
  vacancy: Vacancy;
  users: User[];
  stages: VacancyStage[];
  sources: Source[];
  testTasks: TestTask[];
  applications: Application[];
};

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function serializeVacancy(row: typeof vacancies.$inferSelect): Vacancy {
  return {
    id: row.id,
    title: row.title,
    department: row.department,
    workType: row.workType as Vacancy["workType"],
    employmentType: row.employmentType as Vacancy["employmentType"],
    location: row.location,
    salaryMin: row.salaryMin,
    salaryMax: row.salaryMax,
    description: row.description,
    status: row.status as Vacancy["status"],
    language: row.language as Vacancy["language"],
    responsibleHrId: row.responsibleHrId ?? "",
    stageIds: row.stageIds ?? [],
    createdAt: toIso(row.createdAt),
    introMessage: row.introMessage ?? undefined,
    successMessage: row.successMessage ?? undefined,
  };
}

function serializeStage(row: typeof vacancyStages.$inferSelect): VacancyStage {
  return {
    id: row.id,
    vacancyId: row.vacancyId,
    name: row.name,
    color: row.color,
    isFinal: row.isFinal,
    isRejected: row.isRejected,
    isReserve: row.isReserve,
    orderIndex: row.orderIndex,
  };
}

function serializeApplication(row: typeof applications.$inferSelect): Application {
  return {
    id: row.id,
    candidateId: row.candidateId,
    vacancyId: row.vacancyId,
    currentStageId: row.currentStageId,
    appliedAt: toIso(row.appliedAt),
    lastActivityAt: toIso(row.lastActivityAt),
    status: row.status as Application["status"],
  };
}

function serializeUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    name: row.name,
    avatarInitials: row.avatarInitials,
    role: row.role as User["role"],
  };
}

function serializeSource(row: typeof sources.$inferSelect): Source {
  return {
    id: row.id,
    vacancyId: row.vacancyId,
    name: row.name,
    botLink: row.botLink,
    isArchived: row.isArchived,
    createdAt: toIso(row.createdAt),
  };
}

function serializeTestTask(row: typeof testTasks.$inferSelect): TestTask {
  return {
    id: row.id,
    vacancyId: row.vacancyId,
    title: row.title,
    description: row.description,
    dueInDays: row.dueInDays,
  };
}

async function requireVacancyInCurrentMode(vacancyId: string) {
  const isDemo = await getCurrentDataMode();
  const [row] = await db
    .select()
    .from(vacancies)
    .where(and(eq(vacancies.id, vacancyId), eq(vacancies.isDemo, isDemo)));
  if (!row) throw new Error("Vacancy not found in the current data mode.");
  return row;
}

function revalidateVacancy(vacancyId: string) {
  revalidatePath("/vacancies");
  revalidatePath(`/vacancies/${vacancyId}`);
  revalidatePath(`/vacancies/${vacancyId}/edit`);
}

function createVacancyError(
  code: string,
  field: VacancyActionError["field"],
  message: string
): CreateVacancyResult {
  return { ok: false, error: { code, field, message } };
}

function getDbErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const maybeError = error as { code?: unknown; cause?: { code?: unknown } };
  if (typeof maybeError.code === "string") return maybeError.code;
  if (typeof maybeError.cause?.code === "string") return maybeError.cause.code;
  return undefined;
}

function normalizeDepartmentName(value: string): string {
  return value.trim().toLowerCase();
}

function departmentIdForName(value: string): string {
  const slug = normalizeDepartmentName(value).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return `dept_${slug || "general"}`;
}

async function upsertDepartmentFromVacancyName(name: string) {
  const displayName = name.trim();
  if (!displayName) return;
  const normalizedName = normalizeDepartmentName(displayName);
  await db
    .insert(departments)
    .values({
      id: departmentIdForName(normalizedName),
      name: normalizedName,
      displayName,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: departments.name,
      set: {
        displayName,
        isActive: true,
      },
    });
}

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

export async function getVacancyEditData(id: string): Promise<VacancyEditData | null> {
  const isDemo = await getCurrentDataMode();
  const [vacancyRow] = await db
    .select()
    .from(vacancies)
    .where(and(eq(vacancies.id, id), eq(vacancies.isDemo, isDemo)));

  if (!vacancyRow) return null;

  const [userRows, stageRows, sourceRows, taskRows, applicationRows] = await Promise.all([
    db.select().from(users),
    db
      .select()
      .from(vacancyStages)
      .where(eq(vacancyStages.vacancyId, id))
      .orderBy(vacancyStages.orderIndex),
    db.select().from(sources).where(and(eq(sources.vacancyId, id), eq(sources.isArchived, false))),
    db.select().from(testTasks).where(eq(testTasks.vacancyId, id)),
    db.select().from(applications).where(eq(applications.vacancyId, id)),
  ]);

  return {
    vacancy: serializeVacancy(vacancyRow),
    users: userRows.map(serializeUser),
    stages: stageRows.map(serializeStage),
    sources: sourceRows.map(serializeSource),
    testTasks: taskRows.map(serializeTestTask),
    applications: applicationRows.map(serializeApplication),
  };
}

export async function getVacancyModeInfo(id: string) {
  const currentIsDemo = await getCurrentDataMode();
  const rows = await db
    .select({
      id: vacancies.id,
      title: vacancies.title,
      isDemo: vacancies.isDemo,
    })
    .from(vacancies)
    .where(eq(vacancies.id, id));

  const vacancy = rows[0];
  if (!vacancy) return { exists: false as const, currentIsDemo };

  return {
    exists: true as const,
    id: vacancy.id,
    title: vacancy.title,
    isDemo: vacancy.isDemo,
    currentIsDemo,
  };
}

export async function createVacancy(input: CreateVacancyInput): Promise<CreateVacancyResult> {
  try {
    await requirePermission("vacancies", "create");
  } catch {
    return createVacancyError("FORBIDDEN", undefined, "You do not have permission to create vacancies.");
  }

  const isDemo = await getCurrentDataMode();
  const vacancyId = `v-${crypto.randomUUID()}`;

  const stageRows = input.stages.map((stage, index) => ({
    id: `s-${crypto.randomUUID()}`,
    vacancyId,
    name: stage.name.trim(),
    color: stage.color,
    isFinal: stage.isFinal,
    isRejected: stage.isRejected,
    isReserve: stage.isReserve ?? false,
    orderIndex: index,
  }));

  if (!input.title.trim()) {
    return createVacancyError("VALIDATION", "title", "Job title is required.");
  }
  if (!input.department.trim()) {
    return createVacancyError("VALIDATION", "department", "Department is required.");
  }
  if (!input.location.trim()) {
    return createVacancyError("VALIDATION", "location", "Location is required.");
  }
  if (stageRows.length === 0 || stageRows.some((stage) => !stage.name)) {
    return createVacancyError("VALIDATION", "stages", "At least one named stage is required.");
  }
  if (!Number.isFinite(input.salaryMin) || !Number.isFinite(input.salaryMax)) {
    return createVacancyError("VALIDATION", "salaryMin", "Salary values must be valid numbers.");
  }
  if (input.salaryMin < 0 || input.salaryMax < 0) {
    return createVacancyError("VALIDATION", "salaryMin", "Salary values must be non-negative.");
  }
  if (input.salaryMin > input.salaryMax) {
    return createVacancyError("VALIDATION", "salaryMin", "Minimum salary cannot be greater than maximum salary.");
  }

  const sourceRows = input.sources
    .map((source) => ({ id: `src-${crypto.randomUUID()}`, name: source.name.trim() }))
    .filter((source) => source.name);

  if (input.sources.length > 0 && sourceRows.length !== input.sources.length) {
    return createVacancyError("VALIDATION", "sources", "Every source needs a name.");
  }

  let responsibleHrId = input.responsibleHrId || null;
  if (responsibleHrId) {
    const [responsibleHr] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, responsibleHrId));

    if (!responsibleHr) {
      return createVacancyError(
        "FK_FAIL",
        "responsibleHrId",
        "Responsible HR no longer exists. Pick a different user."
      );
    }
  }

  try {
    await upsertDepartmentFromVacancyName(input.department);

    await db.transaction(async (tx) => {
      await tx.insert(vacancies).values({
        id: vacancyId,
        title: input.title.trim(),
        department: input.department.trim(),
        workType: input.workType,
        employmentType: input.employmentType,
        location: input.location.trim(),
        salaryMin: input.salaryMin,
        salaryMax: input.salaryMax,
        description: input.description,
        status: "active",
        language: input.language,
        responsibleHrId,
        stageIds: stageRows.map((stage) => stage.id),
        createdAt: new Date(),
        introMessage: input.introMessage || null,
        successMessage: input.successMessage || null,
        isDemo,
      });

      await tx.insert(vacancyStages).values(stageRows);

      if (input.questions.length > 0) {
        await tx.insert(screeningQuestions).values(
          input.questions.map((question, index) => ({
            id: `q-${crypto.randomUUID()}`,
            vacancyId,
            text: question.text.trim(),
            type: question.type,
            options: question.options ?? null,
            orderIndex: index,
          }))
        );
      }

      if (sourceRows.length > 0) {
        await tx.insert(sources).values(
          sourceRows.map((source) => ({
            id: source.id,
            vacancyId,
            name: source.name,
            botLink: `https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "data365_HR_bot"}?start=${vacancyId}_${source.id}`,
          }))
        );
      }
    });
  } catch (error) {
    const code = getDbErrorCode(error);
    if (code === "23503") {
      return createVacancyError(
        "FK_FAIL",
        "responsibleHrId",
        "Responsible HR no longer exists. Pick a different user."
      );
    }
    if (code === "23502") {
      return createVacancyError("NULL_FAIL", undefined, "A required field is empty. Re-check the vacancy form.");
    }

    console.error("createVacancy unexpected failure", error);
    return createVacancyError("UNKNOWN", undefined, "Could not create vacancy. Try again.");
  }

  revalidatePath("/vacancies");
  revalidatePath(`/vacancies/${vacancyId}`);

  return { ok: true, vacancyId };
}

export async function updateVacancyDetails(vacancyId: string, patch: VacancyPatch): Promise<Vacancy> {
  const current = await requireVacancyInCurrentMode(vacancyId);

  const update: Partial<typeof vacancies.$inferInsert> = {};
  if (patch.title !== undefined) update.title = patch.title.trim();
  if (patch.department !== undefined) update.department = patch.department.trim();
  if (patch.workType !== undefined) update.workType = patch.workType;
  if (patch.employmentType !== undefined) update.employmentType = patch.employmentType;
  if (patch.location !== undefined) update.location = patch.location.trim();
  if (patch.salaryMin !== undefined) update.salaryMin = patch.salaryMin;
  if (patch.salaryMax !== undefined) update.salaryMax = patch.salaryMax;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.language !== undefined) update.language = patch.language;
  if (patch.responsibleHrId !== undefined) update.responsibleHrId = patch.responsibleHrId || null;
  if (patch.introMessage !== undefined) update.introMessage = patch.introMessage || null;
  if (patch.successMessage !== undefined) update.successMessage = patch.successMessage || null;

  if (update.title !== undefined && !update.title) throw new Error("Job title is required.");
  if (update.department !== undefined && !update.department) throw new Error("Department is required.");
  if (update.location !== undefined && !update.location) throw new Error("Location is required.");
  if (update.salaryMin !== undefined && (!Number.isFinite(update.salaryMin) || update.salaryMin < 0)) {
    throw new Error("Minimum salary must be a non-negative number.");
  }
  if (update.salaryMax !== undefined && (!Number.isFinite(update.salaryMax) || update.salaryMax < 0)) {
    throw new Error("Maximum salary must be a non-negative number.");
  }

  const salaryMin = update.salaryMin ?? current.salaryMin;
  const salaryMax = update.salaryMax ?? current.salaryMax;
  if (salaryMin > salaryMax) throw new Error("Minimum salary cannot be greater than maximum salary.");

  const [row] = await db
    .update(vacancies)
    .set(update)
    .where(eq(vacancies.id, vacancyId))
    .returning();

  if (update.department !== undefined) {
    await upsertDepartmentFromVacancyName(update.department);
  }

  revalidateVacancy(vacancyId);
  return serializeVacancy(row);
}

export async function addVacancyStage(
  vacancyId: string,
  stage: { name: string; color: string; isFinal: boolean; isRejected: boolean; isReserve?: boolean }
): Promise<VacancyStage> {
  const vacancy = await requireVacancyInCurrentMode(vacancyId);
  const name = stage.name.trim();
  if (!name) throw new Error("Stage name is required.");

  const existingStages = await db
    .select({ id: vacancyStages.id })
    .from(vacancyStages)
    .where(eq(vacancyStages.vacancyId, vacancyId))
    .orderBy(vacancyStages.orderIndex);
  const stageId = `st-${crypto.randomUUID()}`;

  const [row] = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(vacancyStages)
      .values({
        id: stageId,
        vacancyId,
        name,
        color: stage.color,
        isFinal: stage.isFinal,
        isRejected: stage.isRejected,
        isReserve: stage.isReserve ?? false,
        orderIndex: existingStages.length,
      })
      .returning();

    await tx
      .update(vacancies)
      .set({ stageIds: [...(vacancy.stageIds ?? []), inserted.id] })
      .where(eq(vacancies.id, vacancyId));

    return [inserted];
  });

  revalidateVacancy(vacancyId);
  return serializeStage(row);
}

export async function updateVacancyStage(stageId: string, patch: StagePatch): Promise<VacancyStage> {
  const [stage] = await db.select().from(vacancyStages).where(eq(vacancyStages.id, stageId));
  if (!stage) throw new Error("Stage not found.");
  await requireVacancyInCurrentMode(stage.vacancyId);

  const update: Partial<typeof vacancyStages.$inferInsert> = {};
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.color !== undefined) update.color = patch.color;
  if (patch.isFinal !== undefined) update.isFinal = patch.isFinal;
  if (patch.isRejected !== undefined) update.isRejected = patch.isRejected;
  if (patch.isReserve !== undefined) update.isReserve = patch.isReserve;
  if (update.name !== undefined && !update.name) throw new Error("Stage name is required.");

  const [row] = await db.update(vacancyStages).set(update).where(eq(vacancyStages.id, stageId)).returning();
  revalidateVacancy(row.vacancyId);
  return serializeStage(row);
}

export async function removeVacancyStage(stageId: string): Promise<void> {
  const [stage] = await db.select().from(vacancyStages).where(eq(vacancyStages.id, stageId));
  if (!stage) throw new Error("Stage not found.");
  const vacancy = await requireVacancyInCurrentMode(stage.vacancyId);

  const [stageRows, applicationRows] = await Promise.all([
    db.select().from(vacancyStages).where(eq(vacancyStages.vacancyId, stage.vacancyId)),
    db.select({ id: applications.id }).from(applications).where(eq(applications.currentStageId, stageId)),
  ]);

  if (stageRows.length <= 1) throw new Error("A vacancy must have at least one stage.");
  if (applicationRows.length > 0) {
    throw new Error(`Move ${applicationRows.length} application${applicationRows.length === 1 ? "" : "s"} out of this stage first.`);
  }

  await db.transaction(async (tx) => {
    await tx.delete(vacancyStages).where(eq(vacancyStages.id, stageId));

    const remainingIds = (vacancy.stageIds ?? []).filter((id) => id !== stageId);
    await tx.update(vacancies).set({ stageIds: remainingIds }).where(eq(vacancies.id, stage.vacancyId));

    const remainingStages = stageRows
      .filter((row) => row.id !== stageId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    await Promise.all(
      remainingStages.map((row, index) =>
        tx.update(vacancyStages).set({ orderIndex: index }).where(eq(vacancyStages.id, row.id))
      )
    );
  });

  revalidateVacancy(stage.vacancyId);
}

export async function reorderVacancyStages(vacancyId: string, orderedIds: string[]): Promise<VacancyStage[]> {
  await requireVacancyInCurrentMode(vacancyId);
  const stageRows = await db
    .select()
    .from(vacancyStages)
    .where(eq(vacancyStages.vacancyId, vacancyId));
  const currentIds = new Set(stageRows.map((stage) => stage.id));

  if (orderedIds.length !== stageRows.length || orderedIds.some((id) => !currentIds.has(id))) {
    throw new Error("Stage order does not match this vacancy.");
  }

  await db.transaction(async (tx) => {
    await Promise.all(
      orderedIds.map((id, index) =>
        tx.update(vacancyStages).set({ orderIndex: index }).where(eq(vacancyStages.id, id))
      )
    );
    await tx.update(vacancies).set({ stageIds: orderedIds }).where(eq(vacancies.id, vacancyId));
  });

  revalidateVacancy(vacancyId);
  return orderedIds.map((id, index) => serializeStage({ ...stageRows.find((stage) => stage.id === id)!, orderIndex: index }));
}

export async function addVacancySource(vacancyId: string, name: string): Promise<Source> {
  await requireVacancyInCurrentMode(vacancyId);
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Source name is required.");

  const sourceId = `src-${crypto.randomUUID()}`;
  const [row] = await db
    .insert(sources)
    .values({
      id: sourceId,
      vacancyId,
      name: trimmed,
      botLink: `https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "data365_HR_bot"}?start=${vacancyId}_${sourceId}`,
    })
    .returning();

  revalidateVacancy(vacancyId);
  return serializeSource(row);
}

export async function removeVacancySource(sourceId: string): Promise<void> {
  const [source] = await db.select().from(sources).where(eq(sources.id, sourceId));
  if (!source) throw new Error("Source not found.");
  await requireVacancyInCurrentMode(source.vacancyId);

  await db.update(sources).set({ isArchived: true }).where(eq(sources.id, sourceId));
  revalidateVacancy(source.vacancyId);
}

export async function createVacancyTestTask(
  vacancyId: string,
  task: { title: string; description: string; dueInDays: number }
): Promise<TestTask> {
  await requireVacancyInCurrentMode(vacancyId);
  const title = task.title.trim();
  if (!title) throw new Error("Task title is required.");
  if (!Number.isFinite(task.dueInDays) || task.dueInDays < 1) {
    throw new Error("Due days must be at least 1.");
  }

  const [row] = await db
    .insert(testTasks)
    .values({
      id: `tt-${crypto.randomUUID()}`,
      vacancyId,
      title,
      description: task.description.trim(),
      dueInDays: Math.round(task.dueInDays),
    })
    .returning();

  revalidateVacancy(vacancyId);
  return serializeTestTask(row);
}

export async function removeVacancyTestTask(taskId: string): Promise<void> {
  const [task] = await db.select().from(testTasks).where(eq(testTasks.id, taskId));
  if (!task) throw new Error("Test task not found.");
  await requireVacancyInCurrentMode(task.vacancyId);

  const assignments = await db
    .select({ id: testTaskAssignments.id })
    .from(testTaskAssignments)
    .where(eq(testTaskAssignments.taskId, taskId));
  if (assignments.length > 0) throw new Error("This task is assigned to candidates and cannot be deleted.");

  await db.delete(testTasks).where(eq(testTasks.id, taskId));
  revalidateVacancy(task.vacancyId);
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
