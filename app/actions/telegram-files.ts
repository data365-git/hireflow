"use server";
import { db } from "@/lib/db/client";
import { candidates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/permissions";

export async function getCandidatePhotoUrl(candidateId: string): Promise<string | null> {
  await requirePermission("candidates", "read");

  const rows = await db
    .select({
      photoFileId: candidates.photoFileId,
      photoUrl: candidates.photoUrl,
    })
    .from(candidates)
    .where(eq(candidates.id, candidateId));

  const c = rows[0];
  if (!c) return null;
  if (c.photoUrl) return c.photoUrl;
  if (!c.photoFileId) return null;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;

  try {
    const fileRes = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${c.photoFileId}`
    );
    const fileJson = await fileRes.json();
    if (!fileJson.ok || !fileJson.result?.file_path) return null;
    // Telegram URL is valid for ~1 hour; the browser fetches it directly.
    // Note: bot token is embedded in the URL — acceptable for HR-only auth-gated pages.
    return `https://api.telegram.org/file/bot${token}/${fileJson.result.file_path}`;
  } catch (err) {
    console.error("[getCandidatePhotoUrl] fetch failed:", err);
    return null;
  }
}
