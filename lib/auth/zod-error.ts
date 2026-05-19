import type { ZodError } from "zod";

export function zodMessage(err: ZodError): string {
  const f = err.flatten();
  const fieldErrors = f.fieldErrors as Record<string, string[] | undefined>;
  const first = Object.entries(fieldErrors).find(([, msgs]) => msgs && msgs.length > 0);
  if (first) return `${first[0]}: ${first[1]![0]}`;
  const formErrors = f.formErrors as string[];
  return formErrors[0] ?? "Invalid input";
}
