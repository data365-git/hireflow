import { cookies, headers } from "next/headers";
import { verifyAccessToken, type JwtPayload } from "./jwt";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// ── Test escape hatch ──────────────────────────────────────────────────────
// In NODE_ENV=test, bypass cookie/header reading so server actions can be
// called directly from vitest without a real HTTP request context.
// Install via _installTestSessionHook in tests/e2e/setup/global-setup.ts.
let _testSessionHook: (() => JwtPayload | null) | null = null;

export function _installTestSessionHook(fn: (() => JwtPayload | null) | null) {
  _testSessionHook = fn;
}
// ────────────────────────────────────────────────────────────────────────────

export async function getSession(): Promise<JwtPayload | null> {
  if (_testSessionHook) return _testSessionHook();
  const auth = (await headers()).get("authorization");
  if (auth?.startsWith("Bearer ")) {
    try { return await verifyAccessToken(auth.slice(7)); } catch { /* fall through */ }
  }
  const cookieToken = (await cookies()).get("access_token")?.value;
  if (cookieToken) {
    try { return await verifyAccessToken(cookieToken); } catch { /* fall through */ }
  }
  return null;
}

export async function requireSession(): Promise<JwtPayload> {
  const s = await getSession();
  if (!s) throw new HttpError(401, "Unauthorized");
  return s;
}

export function toResponse(err: unknown): Response {
  if (err instanceof HttpError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  return Response.json({ error: "Internal Server Error" }, { status: 500 });
}
