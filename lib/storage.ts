import * as fs from "fs";
import * as path from "path";

// Railway volume is mounted at /data
// Configure in Railway dashboard: Settings → Volumes → Mount Path: /data
const STORAGE_ROOT = process.env.CV_STORAGE_PATH ?? "/data/cvs";

export function ensureStorageDir() {
  if (!fs.existsSync(STORAGE_ROOT)) {
    fs.mkdirSync(STORAGE_ROOT, { recursive: true });
  }
}

export function getCVPath(applicationId: string, filename: string): string {
  ensureStorageDir();
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(STORAGE_ROOT, `${applicationId}_${safe}`);
}

export function getCVStorageRoot(): string {
  return STORAGE_ROOT;
}
