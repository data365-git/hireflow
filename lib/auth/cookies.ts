import { cookies } from "next/headers";

const isProd = process.env.NODE_ENV === "production";
const ACCESS_MAX_AGE = 60 * 15;
const REFRESH_MAX_AGE = 60 * 60 * 24 * 7;

export async function setAuthCookies(accessToken: string, refreshToken: string) {
  const jar = await cookies();
  const base = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? ("none" as const) : ("lax" as const),
    path: "/",
  };
  jar.set("access_token", accessToken, { ...base, maxAge: ACCESS_MAX_AGE });
  jar.set("refresh_token", refreshToken, { ...base, maxAge: REFRESH_MAX_AGE });
}

export async function clearAuthCookies() {
  const jar = await cookies();
  jar.delete("access_token");
  jar.delete("refresh_token");
}

export async function readRefreshCookie(): Promise<string | null> {
  return (await cookies()).get("refresh_token")?.value ?? null;
}
