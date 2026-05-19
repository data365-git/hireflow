import { db } from "@/lib/db/client";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return Response.json({ status: "ok", db: "connected", ts: new Date().toISOString() });
  } catch {
    return Response.json({ status: "error", db: "disconnected" }, { status: 503 });
  }
}
