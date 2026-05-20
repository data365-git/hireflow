// Cron: cleanup stale bot sessions older than 7 days
// Railway cron schedule: "0 4 * * *" (4am UTC daily)
// Command: curl -s -H "Authorization: Bearer ${CRON_SECRET}" https://hireflow-production-91a1.up.railway.app/api/cron/cleanup-sessions
//
// Required env var: CRON_SECRET — set this in Railway environment variables

import { db } from "@/lib/db/client";
import { botSessions } from "@/lib/db/schema";
import { lt } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
  const deleted = await db
    .delete(botSessions)
    .where(lt(botSessions.updatedAt, cutoff))
    .returning({ id: botSessions.telegramUserId });

  console.log(
    `[cleanup-sessions] deleted ${deleted.length} stale sessions older than ${cutoff.toISOString()}`
  );

  return Response.json({ deleted: deleted.length, cutoff: cutoff.toISOString() });
}
