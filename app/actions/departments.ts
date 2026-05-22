"use server";

import { asc, eq } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db/client";
import { departments } from "@/lib/db/schema";

export type DepartmentOption = {
  id: string;
  name: string;
};

export async function listDepartments(): Promise<DepartmentOption[]> {
  await requirePermission("vacancies", "read");

  const rows = await db
    .select({
      id: departments.id,
      name: departments.displayName,
    })
    .from(departments)
    .where(eq(departments.isActive, true))
    .orderBy(asc(departments.displayName));

  return rows;
}
