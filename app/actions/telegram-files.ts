"use server";
import { LRUCache } from "lru-cache";
import { db } from "@/lib/db/client";
import { candidates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/permissions";

// LRU cache: max 5,000 entries, 55-minute TTL (Telegram URLs expire at ~60 min)
const PHOTO_URL_CACHE = new LRUCache<string, string>({
  max: 5000,
  ttl: 55 * 60 * 1000,
});

export async function getFileUrl(fileId: string): Promise<string | null> {
  const cached = PHOTO_URL_CACHE.get(fileId);
  if (cached) return cached;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;

  try {
    const fileRes = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`
    );
    const fileJson = await fileRes.json();
    if (!fileJson.ok || !fileJson.result?.file_path) return null;
    const url = `https://api.telegram.org/file/bot${token}/${fileJson.result.file_path}`;
    PHOTO_URL_CACHE.set(fileId, url);
    return url;
  } catch (err) {
    console.error("[getFileUrl] fetch failed:", err);
    return null;
  }
}

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
  if (c.photoUrl) return c.photoUrl; // external URL (e.g. from Telegram profile) — OK to expose
  if (!c.photoFileId) return null;

  // Return proxy URL — the bot token never reaches the client
  return `/api/telegram-file/${encodeURIComponent(c.photoFileId)}`;
}
