// tests/e2e/scenarios/03-vacancy-lifecycle.test.ts
import { describe, test, expect } from "vitest";
import { seedHrUser, seedVacancy } from "../fixtures/builders";
import { createVacancy } from "@/app/actions/vacancies";
import { db } from "@/lib/db/client";
import { sources } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getAuditEvents } from "../harness/verify";
import { sendUpdate } from "../harness/send-update";
import { makeStartUpdate } from "../fixtures/payloads/start";
import { makeCallbackUpdate } from "../fixtures/payloads/callback";
import { countApplications } from "../harness/verify";

// requirePermission is bypassed by the test session hook installed in global-setup.ts

function buildInput(overrides: Partial<Parameters<typeof createVacancy>[0]> = {}) {
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
      { name: "Rejected",  color: "rejected",  isFinal: true,  isRejected: true  },
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
  test("createVacancy with no hire stage (no isFinal+!isRejected) → VALIDATION error", async () => {
    const result = await createVacancy(buildInput({
      stages: [
        { name: "Screening", color: "screening", isFinal: false, isRejected: false },
        { name: "Rejected",  color: "rejected",  isFinal: true,  isRejected: true  },
      ],
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION");
  });

  test("createVacancy with isRejected+!isFinal stage → VALIDATION error", async () => {
    const result = await createVacancy(buildInput({
      stages: [
        { name: "Screening",   color: "screening", isFinal: false, isRejected: false },
        { name: "Hired",       color: "hired",     isFinal: true,  isRejected: false },
        { name: "BadRejected", color: "rejected",  isFinal: false, isRejected: true  },
      ],
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION");
  });

  test("createVacancy seeds Direct + user-supplied sources inside the transaction", async () => {
    const result = await createVacancy(buildInput({
      sources: [{ name: "Instagram" }, { name: "Telegram" }],
    }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const srcRows = await db
      .select({ name: sources.name })
      .from(sources)
      .where(eq(sources.vacancyId, result.vacancyId));

    const names = srcRows.map((r) => r.name);
    expect(names).toContain("Direct");
    expect(names).toContain("Instagram");
    expect(names).toContain("Telegram");
  });

  test("createVacancy writes VACANCY_CREATE audit log row", async () => {
    const result = await createVacancy(buildInput({ title: "Audited Vacancy" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const audits = await getAuditEvents(result.vacancyId, "VACANCY_CREATE");
    expect(audits).toHaveLength(1);
    expect(audits[0].entityName).toBe("Audited Vacancy");
  });

  test("bot /start for a soft-deleted vacancy does not create an application", async () => {
    const hr = await seedHrUser();
    const vacancyId = await seedVacancy({ hrId: hr.id });

    const { softDeleteVacancy } = await import("@/app/actions/vacancies");
    await softDeleteVacancy(vacancyId);

    const uid = 103_001;
    await sendUpdate(makeStartUpdate({ telegramUserId: uid, payload: vacancyId }));
    await sendUpdate(makeCallbackUpdate({ telegramUserId: uid, data: "first_lang_uz" }));

    // getLiveActiveVacancy in handlers.ts filters deletedAt IS NULL — no app created
    expect(await countApplications(vacancyId)).toBe(0);
  });
});
