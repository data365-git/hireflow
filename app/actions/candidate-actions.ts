"use server";

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, or, ilike, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  applicationWatches,
  applications,
  candidateBlacklist,
  candidateFilterViews,
  candidateRelationships,
  candidates,
  departments,
  type WorkExperienceEntry,
  users,
  vacancies,
  vacancyStages,
  sources,
} from "@/lib/db/schema";
import { getCurrentDataMode } from "@/lib/data-mode";
import { HttpError } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";

const vacancyNotDeleted = isNull(vacancies.deletedAt);

export type CandidateFilter =
  | "all"
  | "monitoring"
  | "accepted"
  | "reserve"
  | "related"
  | "blacklist";

export type RelationshipType = "referral" | "family" | "alumni" | "other";

export type CandidateListRow = {
  applicationId: string;
  candidateId: string;
  candidateName: string;
  phone: string;
  telegramUsername: string;
  city: string;
  vacancyId: string;
  vacancyTitle: string;
  stageId: string | null;
  stageName: string | null;
  stageColor: string | null;
  isReserveStage: boolean;
  isAcceptedStage: boolean;
  status: string;
  appliedAt: string;
  lastActivityAt: string;
  isWatched: boolean;
  watchNote: string | null;
  isBlacklisted: boolean;
  blacklistReason: string | null;
  relationshipCount: number;
};

export type CandidateOption = {
  id: string;
  fullName: string;
  telegramUsername: string;
};

export type CandidateRelationshipRow = {
  id: string;
  relatedCandidateId: string;
  relatedCandidateName: string;
  type: RelationshipType;
  note: string | null;
  createdAt: string;
};

export type CandidateActionState = {
  applicationId: string;
  candidateId: string;
  isWatched: boolean;
  watchNote: string | null;
  isBlacklisted: boolean;
  blacklistReason: string | null;
  relationships: CandidateRelationshipRow[];
  relationshipOptions: CandidateOption[];
};

export type CandidateAnketaInput = {
  fullName: string;
  phone: string;
  city: string;
  dateOfBirth?: string | null;
  address?: string | null;
  maritalStatus?: string | null;
  isStudent?: boolean | null;
  educationField?: string | null;
  englishLevel?: string | null;
  russianLevel?: string | null;
  workExperience?: WorkExperienceEntry[] | null;
  departmentId?: string | null;
  profileCompleted?: boolean;
  languagePref?: "uz" | "en" | "ru" | null;
};

const ALLOWED_LANGUAGES = new Set(["uz", "en", "ru"]);
const ALLOWED_MARITAL_STATUSES = new Set(["single", "married", "divorced", "other"]);
const ALLOWED_LANGUAGE_LEVELS = new Set(["none", "a1_a2", "b1_b2", "c1_c2", "native"]);

function cleanOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanRequiredString(value: unknown, fieldName: string) {
  const cleaned = cleanOptionalString(value);
  if (!cleaned) throw new HttpError(400, `${fieldName} is required`);
  return cleaned;
}

function cleanDate(value: string | null | undefined) {
  const cleaned = cleanOptionalString(value);
  if (!cleaned) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) throw new HttpError(400, "Date of birth must use YYYY-MM-DD");

  const date = new Date(`${cleaned}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, "Date of birth is invalid");
  return date;
}

function cleanSetValue(value: string | null | undefined, allowed: Set<string>, fieldName: string) {
  const cleaned = cleanOptionalString(value);
  if (!cleaned) return null;
  if (!allowed.has(cleaned)) throw new HttpError(400, `${fieldName} is invalid`);
  return cleaned;
}

function cleanLanguagePref(value: CandidateAnketaInput["languagePref"]) {
  const cleaned = cleanOptionalString(value);
  if (!cleaned) return null;
  if (!ALLOWED_LANGUAGES.has(cleaned)) throw new HttpError(400, "Language preference is invalid");
  return cleaned as "uz" | "en" | "ru";
}

function cleanWorkExperience(entries: CandidateAnketaInput["workExperience"]) {
  if (!Array.isArray(entries)) return [];

  return entries
    .map((entry) => ({
      company: cleanOptionalString(entry.company) ?? undefined,
      position: cleanOptionalString(entry.position) ?? undefined,
      period: cleanOptionalString(entry.period) ?? undefined,
      leaveReason: cleanOptionalString(entry.leaveReason) ?? undefined,
    }))
    .filter((entry) => entry.company || entry.position || entry.period || entry.leaveReason);
}

function revalidateCandidateSurfaces(applicationId?: string) {
  revalidatePath("/applications");
  revalidatePath("/candidates");
  revalidatePath("/candidates/monitoring");
  revalidatePath("/candidates/accepted");
  revalidatePath("/candidates/reserve");
  revalidatePath("/candidates/related");
  revalidatePath("/candidates/blacklist");
  if (applicationId) revalidatePath(`/candidates/${applicationId}`);
}

async function getModeGuard() {
  return getCurrentDataMode();
}

async function assertApplicationInMode(applicationId: string) {
  const isDemo = await getModeGuard();
  const rows = await db
    .select({
      application: applications,
      candidate: candidates,
      vacancy: vacancies,
    })
    .from(applications)
    .innerJoin(candidates, and(eq(applications.candidateId, candidates.id), eq(candidates.isDemo, isDemo)))
    .innerJoin(vacancies, and(eq(applications.vacancyId, vacancies.id), eq(vacancies.isDemo, isDemo), vacancyNotDeleted))
    .where(eq(applications.id, applicationId));

  const row = rows[0];
  if (!row) throw new HttpError(404, "Application not found");
  return row;
}

async function assertCandidateInMode(candidateId: string) {
  const isDemo = await getModeGuard();
  const rows = await db
    .select()
    .from(candidates)
    .where(and(eq(candidates.id, candidateId), eq(candidates.isDemo, isDemo)));

  const candidate = rows[0];
  if (!candidate) throw new HttpError(404, "Candidate not found");
  return candidate;
}

export async function updateCandidateAnketa(candidateId: string, input: CandidateAnketaInput) {
  await requirePermission("candidates", "edit");
  const candidate = await assertCandidateInMode(candidateId);
  const departmentId = cleanOptionalString(input.departmentId);

  if (departmentId) {
    const [department] = await db
      .select({ id: departments.id })
      .from(departments)
      .where(and(eq(departments.id, departmentId), eq(departments.isActive, true)));
    if (!department) throw new HttpError(400, "Department is invalid");
  }

  await db
    .update(candidates)
    .set({
      fullName: cleanRequiredString(input.fullName, "Full name"),
      phone: cleanRequiredString(input.phone, "Phone"),
      city: cleanRequiredString(input.city, "City"),
      dateOfBirth: cleanDate(input.dateOfBirth),
      address: cleanOptionalString(input.address),
      maritalStatus: cleanSetValue(input.maritalStatus, ALLOWED_MARITAL_STATUSES, "Marital status"),
      isStudent: input.isStudent,
      educationField: cleanOptionalString(input.educationField),
      englishLevel: cleanSetValue(input.englishLevel, ALLOWED_LANGUAGE_LEVELS, "English level"),
      russianLevel: cleanSetValue(input.russianLevel, ALLOWED_LANGUAGE_LEVELS, "Russian level"),
      workExperience: cleanWorkExperience(input.workExperience),
      departmentId,
      profileCompleted: Boolean(input.profileCompleted),
      languagePref: cleanLanguagePref(input.languagePref),
    })
    .where(eq(candidates.id, candidateId));

  const applicationIds = await getApplicationIdsForCandidate(candidate.id);
  revalidateCandidateSurfaces();
  applicationIds.forEach((application) => revalidatePath(`/candidates/${application.id}`));
}

async function getApplicationIdsForCandidate(candidateId: string) {
  const isDemo = await getModeGuard();
  return db
    .select({ id: applications.id })
    .from(applications)
    .innerJoin(vacancies, and(eq(applications.vacancyId, vacancies.id), eq(vacancies.isDemo, isDemo), vacancyNotDeleted))
    .where(eq(applications.candidateId, candidateId));
}

export async function getCandidateList(filter: CandidateFilter): Promise<CandidateListRow[]> {
  const session = await requirePermission("candidates", "read");
  const isDemo = await getModeGuard();

  const baseRows = await db
    .select({
      applicationId: applications.id,
      candidateId: candidates.id,
      candidateName: candidates.fullName,
      phone: candidates.phone,
      telegramUsername: candidates.telegramUsername,
      city: candidates.city,
      vacancyId: vacancies.id,
      vacancyTitle: vacancies.title,
      stageId: vacancyStages.id,
      stageName: vacancyStages.name,
      stageColor: vacancyStages.color,
      isReserveStage: vacancyStages.isReserve,
      isFinalStage: vacancyStages.isFinal,
      isRejectedStage: vacancyStages.isRejected,
      status: applications.status,
      appliedAt: applications.appliedAt,
      lastActivityAt: applications.lastActivityAt,
    })
    .from(applications)
    .innerJoin(candidates, and(eq(applications.candidateId, candidates.id), eq(candidates.isDemo, isDemo)))
    .innerJoin(vacancies, and(eq(applications.vacancyId, vacancies.id), eq(vacancies.isDemo, isDemo), vacancyNotDeleted))
    .leftJoin(vacancyStages, eq(applications.currentStageId, vacancyStages.id))
    .orderBy(desc(applications.lastActivityAt));

  const watches = await db
    .select()
    .from(applicationWatches)
    .where(eq(applicationWatches.watcherId, session.sub));
  const watchedByApplication = new Map(watches.map((watch) => [watch.applicationId, watch]));

  const blacklist = await db.select().from(candidateBlacklist);
  const blacklistByCandidate = new Map(blacklist.map((entry) => [entry.candidateId, entry]));

  const relationships = await db.select().from(candidateRelationships);
  const relationshipCountByCandidate = new Map<string, number>();
  for (const relationship of relationships) {
    relationshipCountByCandidate.set(
      relationship.candidateAId,
      (relationshipCountByCandidate.get(relationship.candidateAId) ?? 0) + 1,
    );
    relationshipCountByCandidate.set(
      relationship.candidateBId,
      (relationshipCountByCandidate.get(relationship.candidateBId) ?? 0) + 1,
    );
  }

  const rows = baseRows.map((row) => {
    const watch = watchedByApplication.get(row.applicationId);
    const blacklistEntry = blacklistByCandidate.get(row.candidateId);
    return {
      applicationId: row.applicationId,
      candidateId: row.candidateId,
      candidateName: row.candidateName,
      phone: row.phone,
      telegramUsername: row.telegramUsername,
      city: row.city,
      vacancyId: row.vacancyId,
      vacancyTitle: row.vacancyTitle,
      stageId: row.stageId ?? null,
      stageName: row.stageName ?? null,
      stageColor: row.stageColor ?? null,
      isReserveStage: row.isReserveStage ?? false,
      isAcceptedStage: Boolean(row.isFinalStage && !row.isRejectedStage),
      status: row.status,
      appliedAt: row.appliedAt.toISOString(),
      lastActivityAt: row.lastActivityAt.toISOString(),
      isWatched: Boolean(watch),
      watchNote: watch?.note ?? null,
      isBlacklisted: Boolean(blacklistEntry),
      blacklistReason: blacklistEntry?.reason ?? null,
      relationshipCount: relationshipCountByCandidate.get(row.candidateId) ?? 0,
    };
  });

  switch (filter) {
    case "monitoring":
      return rows.filter((row) => row.isWatched);
    case "accepted":
      return rows.filter((row) => row.isAcceptedStage);
    case "reserve":
      return rows.filter((row) => row.isReserveStage);
    case "related":
      return rows.filter((row) => row.relationshipCount > 0);
    case "blacklist":
      return rows.filter((row) => row.isBlacklisted);
    case "all":
    default:
      return rows;
  }
}

export async function getCandidateActionState(applicationId: string): Promise<CandidateActionState> {
  const session = await requirePermission("candidates", "read");
  const row = await assertApplicationInMode(applicationId);
  const candidateId = row.candidate.id;
  const isDemo = await getModeGuard();

  const [watch] = await db
    .select()
    .from(applicationWatches)
    .where(and(eq(applicationWatches.applicationId, applicationId), eq(applicationWatches.watcherId, session.sub)));

  const [blacklistEntry] = await db
    .select()
    .from(candidateBlacklist)
    .where(eq(candidateBlacklist.candidateId, candidateId));

  const candidateRows = await db
    .select({
      id: candidates.id,
      fullName: candidates.fullName,
      telegramUsername: candidates.telegramUsername,
    })
    .from(candidates)
    .where(eq(candidates.isDemo, isDemo))
    .orderBy(asc(candidates.fullName));
  const candidateById = new Map(candidateRows.map((candidate) => [candidate.id, candidate]));

  const relationshipRows = await db
    .select()
    .from(candidateRelationships)
    .where(or(eq(candidateRelationships.candidateAId, candidateId), eq(candidateRelationships.candidateBId, candidateId)))
    .orderBy(desc(candidateRelationships.createdAt));

  const relationships = relationshipRows.map((relationship) => {
    const relatedCandidateId =
      relationship.candidateAId === candidateId ? relationship.candidateBId : relationship.candidateAId;
    return {
      id: relationship.id,
      relatedCandidateId,
      relatedCandidateName: candidateById.get(relatedCandidateId)?.fullName ?? "Unknown candidate",
      type: relationship.type as RelationshipType,
      note: relationship.note,
      createdAt: relationship.createdAt.toISOString(),
    };
  });

  return {
    applicationId,
    candidateId,
    isWatched: Boolean(watch),
    watchNote: watch?.note ?? null,
    isBlacklisted: Boolean(blacklistEntry),
    blacklistReason: blacklistEntry?.reason ?? null,
    relationships,
    relationshipOptions: candidateRows
      .filter((candidate) => candidate.id !== candidateId)
      .map((candidate) => ({
        id: candidate.id,
        fullName: candidate.fullName,
        telegramUsername: candidate.telegramUsername,
      })),
  };
}

export async function watchApplication(applicationId: string, note?: string) {
  const session = await requirePermission("candidates", "edit");
  await assertApplicationInMode(applicationId);

  await db
    .insert(applicationWatches)
    .values({
      id: crypto.randomUUID(),
      applicationId,
      watcherId: session.sub,
      note: note?.trim() || null,
      createdAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [applicationWatches.applicationId, applicationWatches.watcherId],
      set: {
        note: note?.trim() || null,
        createdAt: new Date(),
      },
    });

  revalidateCandidateSurfaces(applicationId);
}

export async function unwatchApplication(applicationId: string) {
  const session = await requirePermission("candidates", "edit");
  await assertApplicationInMode(applicationId);

  await db
    .delete(applicationWatches)
    .where(and(eq(applicationWatches.applicationId, applicationId), eq(applicationWatches.watcherId, session.sub)));

  revalidateCandidateSurfaces(applicationId);
}

export async function addCandidateToBlacklist(candidateId: string, reason: string) {
  const session = await requirePermission("candidates", "edit");
  const trimmedReason = reason.trim();
  if (!trimmedReason) throw new HttpError(400, "Blacklist reason is required");
  await assertCandidateInMode(candidateId);

  await db.transaction(async (tx) => {
    await tx
      .insert(candidateBlacklist)
      .values({
        candidateId,
        reason: trimmedReason,
        addedBy: session.sub,
        addedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: candidateBlacklist.candidateId,
        set: {
          reason: trimmedReason,
          addedBy: session.sub,
          addedAt: new Date(),
        },
      });

    await tx
      .update(candidates)
      .set({ isBlacklisted: true })
      .where(eq(candidates.id, candidateId));
  });

  const applicationIds = await getApplicationIdsForCandidate(candidateId);
  revalidateCandidateSurfaces();
  applicationIds.forEach((application) => revalidatePath(`/candidates/${application.id}`));
}

export async function removeCandidateFromBlacklist(candidateId: string) {
  await requirePermission("candidates", "edit");
  await assertCandidateInMode(candidateId);

  await db.transaction(async (tx) => {
    await tx.delete(candidateBlacklist).where(eq(candidateBlacklist.candidateId, candidateId));
    await tx
      .update(candidates)
      .set({ isBlacklisted: false })
      .where(eq(candidates.id, candidateId));
  });

  const applicationIds = await getApplicationIdsForCandidate(candidateId);
  revalidateCandidateSurfaces();
  applicationIds.forEach((application) => revalidatePath(`/candidates/${application.id}`));
}

export async function addCandidateRelationship(input: {
  candidateAId: string;
  candidateBId: string;
  type: RelationshipType;
  note?: string;
}) {
  const session = await requirePermission("candidates", "edit");
  const candidateAId = input.candidateAId.trim();
  const candidateBId = input.candidateBId.trim();
  if (!candidateAId || !candidateBId) throw new HttpError(400, "Both candidates are required");
  if (candidateAId === candidateBId) throw new HttpError(400, "Choose a different candidate");

  await assertCandidateInMode(candidateAId);
  await assertCandidateInMode(candidateBId);

  const existing = await db
    .select({ id: candidateRelationships.id })
    .from(candidateRelationships)
    .where(
      or(
        and(eq(candidateRelationships.candidateAId, candidateAId), eq(candidateRelationships.candidateBId, candidateBId)),
        and(eq(candidateRelationships.candidateAId, candidateBId), eq(candidateRelationships.candidateBId, candidateAId)),
      ),
    );
  if (existing[0]) throw new HttpError(409, "These candidates are already linked");

  await db.insert(candidateRelationships).values({
    id: crypto.randomUUID(),
    candidateAId,
    candidateBId,
    type: input.type,
    note: input.note?.trim() || null,
    createdBy: session.sub,
    createdAt: new Date(),
  });

  const applicationIds = await getApplicationIdsForCandidate(candidateAId);
  revalidateCandidateSurfaces();
  applicationIds.forEach((application) => revalidatePath(`/candidates/${application.id}`));
}

export async function removeCandidateRelationship(relationshipId: string) {
  await requirePermission("candidates", "edit");
  const [relationship] = await db
    .select()
    .from(candidateRelationships)
    .where(eq(candidateRelationships.id, relationshipId));
  if (!relationship) return;
  await assertCandidateInMode(relationship.candidateAId);

  await db.delete(candidateRelationships).where(eq(candidateRelationships.id, relationshipId));
  const applicationIds = await getApplicationIdsForCandidate(relationship.candidateAId);
  revalidateCandidateSurfaces();
  applicationIds.forEach((application) => revalidatePath(`/candidates/${application.id}`));
}

// ─── Search / filter types ────────────────────────────────────────────────────

export type LangLevel = "none" | "a1_a2" | "b1_b2" | "c1_c2" | "native";
export type MaritalStatus = "single" | "married" | "divorced" | "other";

export type CandidateSearchFilters = {
  q?: string;
  vacancyId?: string;
  stageId?: string;
  department?: string;
  englishMin?: LangLevel;
  russianMin?: LangLevel;
  maritalStatus?: MaritalStatus;
};

export type CandidateSearchRow = {
  candidateId: string;
  fullName: string;
  phone: string | null;
  telegramUsername: string | null;
  photoFileId: string | null;
  englishLevel: string | null;
  russianLevel: string | null;
  applicationId: string | null;
  vacancyId: string | null;
  vacancyTitle: string | null;
  stageName: string | null;
  appliedAt: string | null;
  sourceName: string | null;
};

const LEVEL_AT_LEAST: Record<LangLevel, LangLevel[]> = {
  none: ["none", "a1_a2", "b1_b2", "c1_c2", "native"],
  a1_a2: ["a1_a2", "b1_b2", "c1_c2", "native"],
  b1_b2: ["b1_b2", "c1_c2", "native"],
  c1_c2: ["c1_c2", "native"],
  native: ["native"],
};

export async function searchCandidates(
  filters: CandidateSearchFilters,
): Promise<CandidateSearchRow[]> {
  await requirePermission("candidates", "read");
  const isDemo = await getCurrentDataMode();

  const candidateConditions = [eq(candidates.isDemo, isDemo)];

  if (filters.q) {
    const like = `%${filters.q}%`;
    candidateConditions.push(
      or(
        ilike(candidates.fullName, like),
        ilike(candidates.phone, like),
        ilike(candidates.telegramUsername, like),
      )!,
    );
  }

  if (filters.englishMin) {
    candidateConditions.push(inArray(candidates.englishLevel, LEVEL_AT_LEAST[filters.englishMin]));
  }

  if (filters.russianMin) {
    candidateConditions.push(inArray(candidates.russianLevel, LEVEL_AT_LEAST[filters.russianMin]));
  }

  if (filters.maritalStatus) {
    candidateConditions.push(eq(candidates.maritalStatus, filters.maritalStatus));
  }

  const appConditions: Parameters<typeof and>[0][] = [];
  appConditions.push(or(isNull(applications.id), vacancyNotDeleted)!);
  if (filters.vacancyId) {
    appConditions.push(eq(applications.vacancyId, filters.vacancyId));
  }
  if (filters.stageId) {
    appConditions.push(eq(applications.currentStageId, filters.stageId));
  }
  if (filters.department) {
    appConditions.push(eq(vacancies.department, filters.department));
  }

  const rows = await db
    .select({
      candidateId: candidates.id,
      fullName: candidates.fullName,
      phone: candidates.phone,
      telegramUsername: candidates.telegramUsername,
      photoFileId: candidates.photoFileId,
      englishLevel: candidates.englishLevel,
      russianLevel: candidates.russianLevel,
      applicationId: applications.id,
      vacancyId: vacancies.id,
      vacancyTitle: vacancies.title,
      stageName: vacancyStages.name,
      appliedAt: applications.appliedAt,
      sourceName: sources.name,
    })
    .from(candidates)
    .leftJoin(applications, eq(applications.candidateId, candidates.id))
    .leftJoin(
      vacancies,
      and(eq(applications.vacancyId, vacancies.id), eq(vacancies.isDemo, isDemo)),
    )
    .leftJoin(vacancyStages, eq(applications.currentStageId, vacancyStages.id))
    .leftJoin(sources, eq(applications.sourceId, sources.id))
    .where(and(...candidateConditions, ...appConditions))
    .orderBy(desc(applications.appliedAt));

  // Dedupe: keep most-recent application per candidate (already ordered desc)
  const seen = new Set<string>();
  const deduped: CandidateSearchRow[] = [];
  for (const row of rows) {
    if (seen.has(row.candidateId)) continue;
    if (row.applicationId && !row.vacancyId) continue;
    seen.add(row.candidateId);
    deduped.push({
      candidateId: row.candidateId,
      fullName: row.fullName,
      phone: row.phone ?? null,
      telegramUsername: row.telegramUsername ?? null,
      photoFileId: row.photoFileId ?? null,
      englishLevel: row.englishLevel ?? null,
      russianLevel: row.russianLevel ?? null,
      applicationId: row.applicationId ?? null,
      vacancyId: row.vacancyId ?? null,
      vacancyTitle: row.vacancyTitle ?? null,
      stageName: row.stageName ?? null,
      appliedAt: row.appliedAt ? row.appliedAt.toISOString() : null,
      sourceName: row.sourceName ?? null,
    });
    if (deduped.length >= 200) break;
  }
  return deduped;
}

// ─── Filter option helpers ────────────────────────────────────────────────────

export async function listFilterableVacancies(): Promise<{ id: string; title: string }[]> {
  await requirePermission("candidates", "read");
  const isDemo = await getCurrentDataMode();
  return db
    .select({ id: vacancies.id, title: vacancies.title })
    .from(vacancies)
    .where(and(eq(vacancies.isDemo, isDemo), vacancyNotDeleted))
    .orderBy(asc(vacancies.title));
}

export async function listFilterableStages(): Promise<
  { id: string; name: string; vacancyTitle: string }[]
> {
  await requirePermission("candidates", "read");
  const isDemo = await getCurrentDataMode();
  return db
    .select({
      id: vacancyStages.id,
      name: vacancyStages.name,
      vacancyTitle: vacancies.title,
    })
    .from(vacancyStages)
    .innerJoin(
      vacancies,
      and(eq(vacancyStages.vacancyId, vacancies.id), eq(vacancies.isDemo, isDemo), vacancyNotDeleted),
    )
    .orderBy(asc(vacancies.title), asc(vacancyStages.orderIndex));
}

export async function listFilterableDepartments(): Promise<string[]> {
  await requirePermission("candidates", "read");
  const isDemo = await getCurrentDataMode();
  const rows = await db
    .selectDistinct({ department: vacancies.department })
    .from(vacancies)
    .where(and(eq(vacancies.isDemo, isDemo), vacancyNotDeleted))
    .orderBy(asc(vacancies.department));
  return rows.map((r) => r.department);
}

// ─── Saved filter views ───────────────────────────────────────────────────────

export async function listMyFilterViews(): Promise<Array<{ id: string; name: string; filters: Record<string, string> }>> {
  const session = await requirePermission("candidates", "read");
  const rows = await db
    .select({
      id: candidateFilterViews.id,
      name: candidateFilterViews.name,
      filters: candidateFilterViews.filters,
    })
    .from(candidateFilterViews)
    .where(eq(candidateFilterViews.userId, session.sub))
    .orderBy(asc(candidateFilterViews.name));
  return rows as Array<{ id: string; name: string; filters: Record<string, string> }>;
}

export async function saveFilterView(input: { name: string; filters: Record<string, string> }): Promise<{ id: string }> {
  const session = await requirePermission("candidates", "read");
  const trimmed = input.name.trim().slice(0, 80);
  if (!trimmed) throw new Error("Name is required");
  const id = crypto.randomUUID();
  await db.insert(candidateFilterViews).values({
    id,
    userId: session.sub,
    name: trimmed,
    filters: input.filters,
  });
  return { id };
}

export async function deleteFilterView(id: string): Promise<void> {
  const session = await requirePermission("candidates", "read");
  await db
    .delete(candidateFilterViews)
    .where(and(eq(candidateFilterViews.id, id), eq(candidateFilterViews.userId, session.sub)));
}

// ─── HR Test Cleanup ──────────────────────────────────────────────────────────

export async function deleteMyTestApplications(): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const session = await requirePermission("candidates", "delete");
  const [me] = await db
    .select({ telegramUserId: users.telegramUserId })
    .from(users)
    .where(eq(users.id, session.sub));
  if (!me?.telegramUserId) {
    return { ok: false, error: "Your profile has no Telegram ID set. Set it in your profile settings first." };
  }
  const [cand] = await db
    .select({ id: candidates.id })
    .from(candidates)
    .where(eq(candidates.telegramUserId, me.telegramUserId));
  if (!cand) return { ok: true, count: 0 };
  const deleted = await db
    .delete(applications)
    .where(eq(applications.candidateId, cand.id))
    .returning({ id: applications.id });
  return { ok: true, count: deleted.length };
}

export async function setMyTelegramUserId(telegramUserId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requirePermission("settings", "write");
  if (!telegramUserId.trim()) return { ok: false, error: "Telegram user ID cannot be empty" };
  if (!/^\d+$/.test(telegramUserId.trim())) return { ok: false, error: "Telegram user ID must be numeric (e.g. 123456789)" };
  await db.update(users).set({ telegramUserId: telegramUserId.trim() }).where(eq(users.id, session.sub));
  return { ok: true };
}

export async function getMyTelegramUserId(): Promise<string | null> {
  const session = await requirePermission("settings", "read");
  const [me] = await db.select({ telegramUserId: users.telegramUserId }).from(users).where(eq(users.id, session.sub));
  return me?.telegramUserId ?? null;
}
