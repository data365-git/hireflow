import bcrypt from "bcryptjs";
import { z } from "zod";

export const PASSWORD_SCHEMA = z
  .string()
  .min(8, "min 8 chars")
  .regex(/[A-Z]/, "1 uppercase")
  .regex(/[a-z]/, "1 lowercase")
  .regex(/[0-9]/, "1 digit");

export const EMAIL_SCHEMA = z.string().email().transform((s) => s.toLowerCase().trim());

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function generateTempPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const pick = (s: string, n: number) =>
    Array.from({ length: n }, () => s[Math.floor(Math.random() * s.length)]).join("");
  return (pick(upper, 4) + pick(lower, 4) + pick(digits, 4)).split("").sort(() => Math.random() - 0.5).join("");
}
