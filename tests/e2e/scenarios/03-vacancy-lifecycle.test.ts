import { describe, test, expect } from "vitest";
import { seedHrUser, makeCandidate } from "../fixtures/builders";
import { createVacancy } from "@/app/actions/vacancies";
import { getAuditEvents } from "../harness/verify";

// Helper: build a minimal valid CreateVacancyInput
function buildVacancyInput(overrides: Partial<Parameters<typeof createVacancy>[0]> = {}) {
  return {
    title: "Test Vacancy",
    department: "Engineering",
    workType: "office" as const,
    employmentType: "full-time" as const,
    location: "Tashkent",
    salaryMin: 5_000_000,
    salaryMax: 10_000_000,
    description: "A test vacancy",
    language: "uz" as const,
    stages: [
      { name: "Screening", color: "screening", isFinal: false, isRejected: false },
      { name: "Hired",     color: "hired",     isFinal: true,  isRejected: false },
      { name: "Rejected",  color: "rejected",  isFinal: true,  isRejected: true },
    ],
    questions: [],
    sources: [{ name: "Instagram" }],
    responsibleHrId: null,
    introMessage: null,
    successMessage: null,
    ...overrides,
  };
}

describe("03 — Vacancy Lifecycle", () => {
  test("createVacancy with no hire stage (no isFinal+!isRejected) is rejected", async () => {
    const result = await createVacancy(buildVacancyInput({
      stages: [
        { name: "Screening", color: "screening", isFinal: false, isRejected: false },
        { name: "Rejected",  color: "rejected",  isFinal: true,  isRejected: true },
        // No isFinal+!isRejected stage — should fail T0.12 validation
      ],
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION");
    }
  });

  test("createVacancy seeds user-supplied sources inside the transaction", async () => {
    const { db } = await import("@/lib/db/client");
    const { sources } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    const result = await createVacancy(buildVacancyInput({
      sources: [{ name: "Instagram" }, { name: "Telegram" }],
    }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const srcRows = await db
      .select({ name: sources.name })
      .from(sources)
      .where(eq(sources.vacancyId, result.vacancyId));

    const names = srcRows.map((r) => r.name);
    expect(names).toContain("Direct");    // auto-created
    expect(names).toContain("Instagram"); // from input.sources
    expect(names).toContain("Telegram");  // from input.sources
  });

  test("createVacancy writes VACANCY_CREATE audit log row", async () => {
    const result = await createVacancy(buildVacancyInput({ title: "Audited Vacancy" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const audits = await getAuditEvents(result.vacancyId, "VACANCY_CREATE");
    expect(audits).toHaveLength(1);
    expect(audits[0].entityName).toBe("Audited Vacancy");
  });
});
