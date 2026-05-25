import { db } from "@/lib/db/client";
import { users, userRoles, vacancies, vacancyStages, sources } from "@/lib/db/schema";

// ─── Standard stage configs ────────────────────────────────────────────────

export const STANDARD_STAGES = [
  { name: "New",        color: "new",        isFinal: false, isRejected: false, isReserve: false },
  { name: "Screening",  color: "screening",  isFinal: false, isRejected: false, isReserve: false },
  { name: "Interview",  color: "interview",  isFinal: false, isRejected: false, isReserve: false },
  { name: "Hired",      color: "hired",      isFinal: true,  isRejected: false, isReserve: false },
  { name: "Rejected",   color: "rejected",   isFinal: true,  isRejected: true,  isReserve: false },
];

// ─── HR user seeding ───────────────────────────────────────────────────────

export async function seedHrUser(opts: {
  email?: string;
  role?: "admin" | "hr";
  fullName?: string;
} = {}): Promise<{ id: string; email: string; sub: string }> {
  const id = `user-${crypto.randomUUID()}`;
  const email = opts.email ?? `hr-${id}@test.com`;
  const role = opts.role ?? "admin";

  await db.insert(users).values({
    id,
    email,
    fullName: opts.fullName ?? "Test HR",
    passwordHash: "not-a-real-hash",
    isActive: true,
  });
  await db.insert(userRoles).values({
    id: `role-${crypto.randomUUID()}`,
    userId: id,
    role,
  });

  return { id, email, sub: id };
}

// ─── Vacancy seeding ───────────────────────────────────────────────────────

export async function seedVacancy(opts: {
  hrId: string;
  title?: string;
  stages?: typeof STANDARD_STAGES;
  isDemo?: boolean;
}): Promise<string> {
  const vacancyId = `v-${crypto.randomUUID()}`;
  const stageRows = (opts.stages ?? STANDARD_STAGES).map((s, i) => ({
    id: `s-${crypto.randomUUID()}`,
    vacancyId,
    name: s.name,
    color: s.color,
    isFinal: s.isFinal,
    isRejected: s.isRejected,
    isReserve: s.isReserve,
    orderIndex: i,
  }));

  await db.insert(vacancies).values({
    id: vacancyId,
    title: opts.title ?? "Test Vacancy",
    department: "Engineering",
    workType: "office",
    employmentType: "full-time",
    location: "Tashkent",
    salaryMin: 5_000_000,
    salaryMax: 10_000_000,
    description: "Test vacancy description",
    status: "active",
    language: "uz",
    responsibleHrId: opts.hrId,
    stageIds: stageRows.map((s) => s.id),
    createdAt: new Date(),
    lastActivatedAt: new Date(),
    isDemo: opts.isDemo ?? false,
  });
  await db.insert(vacancyStages).values(stageRows);

  return vacancyId;
}

// ─── Source seeding ────────────────────────────────────────────────────────

export async function seedSources(
  vacancyId: string,
  names: string[]
): Promise<Array<{ id: string; name: string; botLink: string }>> {
  const rows = names.map((name) => {
    const id = `src-${crypto.randomUUID()}`;
    return {
      id,
      vacancyId,
      name,
      botLink: `https://t.me/hireflow_test_bot?start=${vacancyId}_${id}`,
      isArchived: false,
    };
  });
  await db.insert(sources).values(rows);
  return rows.map(({ id, name, botLink }) => ({ id, name, botLink }));
}

// ─── Candidate profile factory ─────────────────────────────────────────────

export type CandidateProfile = {
  telegramUserId: number;
  firstName: string;
  username?: string;
  phone: string;
  email: string;
  city: string;
  fullName: string;
  motivation: string;
  portfolioLinks: string[];
  photoSizeBytes?: number;
  answers?: string[];
};

let _candidateCounter = 100_000;

export function makeCandidate(overrides: Partial<CandidateProfile> & { telegramUserId?: number } = {}): CandidateProfile {
  const id = overrides.telegramUserId ?? ++_candidateCounter;
  return {
    telegramUserId: id,
    firstName: overrides.firstName ?? `Candidate${id}`,
    username: overrides.username,
    phone: overrides.phone ?? "+998901234567",
    email: overrides.email ?? `candidate${id}@test.com`,
    city: overrides.city ?? "Tashkent",
    fullName: overrides.fullName ?? `Test Candidate ${id}`,
    motivation: overrides.motivation ?? "I want to work here because it is a great company.",
    portfolioLinks: overrides.portfolioLinks ?? ["https://portfolio.example.com"],
    photoSizeBytes: overrides.photoSizeBytes ?? 500_000,
    answers: overrides.answers ?? ["Yes", "3 years", "TeamWork", "English B2"],
  };
}
