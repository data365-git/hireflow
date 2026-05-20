// Daily backup endpoint.
// To schedule: Railway Dashboard → New Service → Cron →
//   Schedule: "0 2 * * *" (2am UTC daily)
//   Command: curl -s "https://hireflow-production-91a1.up.railway.app/api/backup?secret=YOUR_SECRET"

import { db } from "@/lib/db/client";
import { candidates, applications, vacancies, vacancyStages, backupRuns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  console.log("[backup] start");
  const start = Date.now();

  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.BACKUP_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const runId = crypto.randomUUID();
  await db.insert(backupRuns).values({
    id: runId,
    kind: "csv",
    status: "running",
    startedAt: new Date(),
  });

  try {
    const rows = await db
      .select({
        candidate: candidates,
        app: applications,
        vacancy: vacancies,
        stage: vacancyStages,
      })
      .from(applications)
      .innerJoin(candidates, eq(applications.candidateId, candidates.id))
      .innerJoin(vacancies, eq(applications.vacancyId, vacancies.id))
      .leftJoin(vacancyStages, eq(applications.currentStageId, vacancyStages.id));

    const headers = ["Name", "Telegram", "Phone", "Vacancy", "Stage", "Applied At"];
    const lines = [headers.join(",")];
    for (const { candidate: c, app: a, vacancy: v, stage: s } of rows) {
      lines.push(
        [
          csvEsc(c.fullName),
          csvEsc(c.telegramUsername ? `@${c.telegramUsername}` : ""),
          csvEsc(c.phone ?? ""),
          csvEsc(v.title),
          csvEsc(s?.name ?? ""),
          csvEsc(a.appliedAt ? new Date(a.appliedAt).toISOString().split("T")[0] : ""),
        ].join(",")
      );
    }
    const csv = lines.join("\n");

    const chatId = process.env.HR_NOTIFICATION_CHAT_ID;
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (chatId && token) {
      const date = new Date().toISOString().split("T")[0];
      const form = new FormData();
      form.append("chat_id", chatId);
      form.append(
        "caption",
        `📊 HireFlow daily backup — ${date}\n${rows.length} applications`
      );
      form.append(
        "document",
        new Blob([csv], { type: "text/csv" }),
        `hireflow-backup-${date}.csv`
      );

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      try {
        await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
          method: "POST",
          body: form,
          signal: controller.signal,
        });
      } catch (err) {
        console.error("[backup] Telegram send failed (non-fatal):", err);
      } finally {
        clearTimeout(timeout);
      }
    }

    const durationMs = Date.now() - start;
    console.log(`[backup] done · rows=${rows.length} · ms=${durationMs}`);

    await db
      .update(backupRuns)
      .set({ status: "success", rowCount: rows.length, durationMs, finishedAt: new Date() })
      .where(eq(backupRuns.id, runId));

    const date = new Date().toISOString().split("T")[0];
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="backup-${date}.csv"`,
      },
    });
  } catch (err) {
    const durationMs = Date.now() - start;
    const errorMessage = err instanceof Error ? err.message : String(err);
    await db
      .update(backupRuns)
      .set({ status: "failed", durationMs, errorMessage, finishedAt: new Date() })
      .where(eq(backupRuns.id, runId));
    throw err;
  }
}

function csvEsc(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}
