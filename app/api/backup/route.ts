// Daily backup endpoint.
// To schedule: Railway Dashboard → New Service → Cron →
//   Schedule: "0 2 * * *" (2am UTC daily)
//   Command: curl -s "https://hireflow-production-91a1.up.railway.app/api/backup?secret=YOUR_SECRET"

import { db } from "@/lib/db/client";
import { candidates, applications, vacancies, vacancyStages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.BACKUP_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

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

    await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: "POST",
      body: form,
    });
  }

  const date = new Date().toISOString().split("T")[0];
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="backup-${date}.csv"`,
    },
  });
}

function csvEsc(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}
