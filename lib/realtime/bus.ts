import { Client } from "pg";

type Channel = "role-permissions";
type Event =
  | { type: "role-updated"; role: string }
  | { type: "user-role-assigned"; userId: string };

let listener: Client | null = null;
const subs = new Set<(ev: Event) => void>();

async function ensureListener() {
  if (listener) return;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query('LISTEN "role-permissions"');
  client.on("notification", (n) => {
    try {
      const ev = JSON.parse(n.payload ?? "{}") as Event;
      subs.forEach((cb) => cb(ev));
    } catch {}
  });
  client.on("error", (e) => { console.error("LISTEN error", e); listener = null; });
  listener = client;
}

export async function publish(_ch: Channel, ev: Event) {
  await ensureListener();
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const safe = JSON.stringify(ev).replace(/'/g, "''");
  await pool.query(`NOTIFY "role-permissions", '${safe}'`);
  await pool.end();
}

export async function subscribe(_ch: Channel, cb: (ev: Event) => void): Promise<() => void> {
  await ensureListener();
  subs.add(cb);
  return () => { subs.delete(cb); };
}
