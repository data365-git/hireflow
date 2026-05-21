"use server";
import { db } from "@/lib/db/client";
import { candidates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/permissions";

// In-memory cache: Telegram file URLs are valid ~1 hour; we cache for 55 minutes.
// Keyed by photoFileId (not candidateId) so repeated views skip the API roundtrip.
const PHOTO_URL_CACHE = new Map<string, { url: string; expiresAt: number }>();

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

  // Cache lookup
  const cached = PHOTO_URL_CACHE.get(c.photoFileId);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;

  try {
    const fileRes = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${c.photoFileId}`
    );
    const fileJson = await fileRes.json();
    if (!fileJson.ok || !fileJson.result?.file_path) return null;
    const url = `https://api.telegram.org/file/bot${token}/${fileJson.result.file_path}`;
    PHOTO_URL_CACHE.set(c.photoFileId, { url, expiresAt: Date.now() + 55 * 60 * 1000 });
    return url;
  } catch (err) {
    console.error("[getCandidatePhotoUrl] fetch failed:", err);
    return null;
  }
}
