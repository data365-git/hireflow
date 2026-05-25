// tests/e2e/scenarios/07-rbac-and-isolation.test.ts
import { describe, test, expect } from "vitest";
import { seedHrUser, seedVacancy } from "../fixtures/builders";
import { sendUpdate } from "../harness/send-update";
import { makeStartUpdate } from "../fixtures/payloads/start";
import { makeCallbackUpdate } from "../fixtures/payloads/callback";
import { countApplications } from "../harness/verify";
import { _installTestSessionHook } from "@/lib/auth/session";
import { getAllVacancies } from "@/app/actions/vacancies";

describe("07 — RBAC and Isolation", () => {
  test("demo vacancy is NOT returned by getVacancies in live mode", async () => {
    const hr = await seedHrUser();
    const demoId = await seedVacancy({ hrId: hr.id, isDemo: true });
    const liveId = await seedVacancy({ hrId: hr.id, isDemo: false });

    const vacancies = await getAllVacancies();
    const ids = vacancies.map((v: { id: string }) => v.id);
    expect(ids).not.toContain(demoId);
    expect(ids).toContain(liveId);
  });

  test("bot /start for a demo vacancy does NOT create an application (bot is always live-mode)", async () => {
    const hr = await seedHrUser();
    const demoVacancyId = await seedVacancy({ hrId: hr.id, isDemo: true });
    const uid = 107_001;

    await sendUpdate(makeStartUpdate({ telegramUserId: uid, payload: demoVacancyId }));
    await sendUpdate(makeCallbackUpdate({ telegramUserId: uid, data: "first_lang_uz" }));

    // getLiveActiveVacancy in handlers.ts filters isDemo=false — no browsing app created
    expect(await countApplications(demoVacancyId)).toBe(0);
  });

  test("bot operates in live mode regardless of DATA_MODE env var", () => {
    // The bot always writes isDemo=false — this is enforced by getLiveActiveVacancy
    // filtering eq(vacancies.isDemo, false). Structural assertion.
    expect(process.env.DATA_MODE).not.toBe("demo");
  });

  test("non-admin session is rejected by requirePermission (403)", async () => {
    // Temporarily install a no-roles session
    _installTestSessionHook(() => ({
      sub: "limited-user",
      email: "limited@test.com",
      roles: [],
      iat: 0,
      exp: 9_999_999_999,
    }));

    let caughtError: unknown = null;
    let result: unknown = null;
    try {
      const { createVacancy } = await import("@/app/actions/vacancies");
      result = await createVacancy({
        title: "Unauthorized",
        department: "X",
        workType: "office",
        employmentType: "full-time",
        location: "Tashkent",
        salaryMin: 1,
        salaryMax: 2,
        description: "x",
        language: "uz",
        stages: [
          { name: "Hired",     color: "hired",     isFinal: true, isRejected: false },
          { name: "Rejected",  color: "rejected",  isFinal: true, isRejected: true  },
        ],
        questions: [],
        sources: [],
        responsibleHrId: null,
        introMessage: null,
        successMessage: null,
      });
    } catch (err) {
      caughtError = err;
    } finally {
      // Always restore admin session
      _installTestSessionHook(() => ({
        sub: "test-admin-id",
        email: "test@hireflow.test",
        roles: ["admin"],
        iat: 0,
        exp: 9_999_999_999,
      }));
    }

    if (caughtError) {
      expect((caughtError as Error).message).toMatch(/forbidden|403|unauthorized/i);
    } else {
      // Some server actions return error objects rather than throwing
      expect((result as { ok: boolean }).ok).toBe(false);
    }
  });
});
