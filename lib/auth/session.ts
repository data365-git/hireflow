import { cookies, headers } from "next/headers";
import { verifyAccessToken, type JwtPayload } from "./jwt";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function getSession(): Promise<JwtPayload | null> {
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
