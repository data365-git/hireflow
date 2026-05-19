import { SignJWT, jwtVerify } from "jose";

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (process.env.NODE_ENV === "production") {
  if (!JWT_SECRET || JWT_SECRET.length < 32) throw new Error("FATAL: JWT_SECRET missing or <32 chars");
  if (!JWT_REFRESH_SECRET || JWT_REFRESH_SECRET.length < 32) throw new Error("FATAL: JWT_REFRESH_SECRET missing or <32 chars");
}

const accessKey = new TextEncoder().encode(JWT_SECRET ?? "dev-secret-please-replace-32chars!");
const refreshKey = new TextEncoder().encode(JWT_REFRESH_SECRET ?? "dev-refresh-please-replace-32chars!");

export async function signAccessToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ email: payload.email, roles: payload.roles })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(accessKey);
}

export async function signRefreshToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(refreshKey);
}

export async function verifyAccessToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, accessKey);
  return { sub: payload.sub!, email: payload.email as string, roles: payload.roles as string[] };
}

export async function verifyRefreshToken(token: string): Promise<{ sub: string }> {
  const { payload } = await jwtVerify(token, refreshKey);
  return { sub: payload.sub! };
}
