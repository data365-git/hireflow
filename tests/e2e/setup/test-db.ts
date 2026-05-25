// Re-export db + pool for test files — avoids tests importing from lib/db/client directly
export { db, pool } from "@/lib/db/client";
