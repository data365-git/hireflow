// Soft env validation — warn loudly in dev/prod, never throw at runtime.

const REQUIRED_PUBLIC = ["NEXT_PUBLIC_TELEGRAM_BOT_USERNAME"];
const REQUIRED_SERVER = ["DATABASE_URL", "TELEGRAM_BOT_TOKEN"];

let validated = false;
export function validateEnv() {
  if (validated) return;
  validated = true;

  const missing: string[] = [];
  if (typeof window === "undefined") {
    for (const k of [...REQUIRED_PUBLIC, ...REQUIRED_SERVER]) {
      if (!process.env[k]) missing.push(k);
    }
  } else {
    for (const k of REQUIRED_PUBLIC) {
      if (!(process.env as Record<string, string | undefined>)[k]) missing.push(k);
    }
  }

  if (missing.length) {
    console.warn(
      `[env] Missing required environment variables: ${missing.join(", ")}\n` +
      `Source tracking links and bot integration may not work correctly.`
    );
  }
}
