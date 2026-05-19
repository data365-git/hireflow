import { cookies } from "next/headers";

export async function getCurrentDataMode(): Promise<boolean> {
  // Returns true = isDemo, false = real (live)
  const cookieStore = await cookies();
  const mode = cookieStore.get("hireflow-data-mode")?.value;
  return mode === "demo";
}
