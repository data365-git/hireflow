"use server";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db/client";
import { departments, vacancies } from "@/lib/db/schema";

export type DepartmentOption = {
  id: string;
  name: string;
};

export type DepartmentRow = {
  id: string;
  name: string;
  displayName: string;
  isActive: boolean;
  vacancyCount: number;
};

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function normalizeDepartmentName(value: string): string {
  return value.trim().toLowerCase();
}

function departmentIdForName(value: string): string {
  const slug = normalizeDepartmentName(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `dept_${slug || "general"}`;
}

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

export async function listDepartmentsForSettings(
  includeInactive = true
): Promise<DepartmentRow[]> {
  await requirePermission("settings", "read");

  const rows = await db
    .select({
      id: departments.id,
      name: departments.name,
      displayName: departments.displayName,
      isActive: departments.isActive,
      vacancyCount: sql<number>`count(${vacancies.id})::int`,
    })
    .from(departments)
    .leftJoin(
      vacancies,
      sql`lower(${vacancies.department}) = ${departments.name} and ${vacancies.status} = 'active'`
    )
    .where(includeInactive ? undefined : eq(departments.isActive, true))
    .groupBy(departments.id, departments.name, departments.displayName, departments.isActive)
    .orderBy(asc(departments.displayName));

  return rows.map((row) => ({
    ...row,
    vacancyCount: Number(row.vacancyCount) || 0,
  }));
}

export async function createDepartment(input: {
  displayName: string;
}): Promise<ActionResult<DepartmentRow>> {
  await requirePermission("settings", "write");

  const displayName = input.displayName.trim();
  if (!displayName) return { ok: false, error: "Department name is required." };
  if (displayName.length > 50) {
    return { ok: false, error: "Department name must be 50 characters or fewer." };
  }

  const name = normalizeDepartmentName(displayName);
  const id = departmentIdForName(displayName);

  try {
    const [row] = await db
      .insert(departments)
      .values({ id, name, displayName, isActive: true })
      .returning({
        id: departments.id,
        name: departments.name,
        displayName: departments.displayName,
        isActive: departments.isActive,
      });

    revalidatePath("/settings/departments");
    revalidatePath("/vacancies/new");
    return { ok: true, data: { ...row, vacancyCount: 0 } };
  } catch {
    return { ok: false, error: "A department with this name already exists." };
  }
}

export async function renameDepartment(
  id: string,
  displayName: string
): Promise<ActionResult> {
  await requirePermission("settings", "write");

  const trimmed = displayName.trim();
  if (!trimmed) return { ok: false, error: "Department name is required." };
  if (trimmed.length > 50) {
    return { ok: false, error: "Department name must be 50 characters or fewer." };
  }

  const [existing] = await db
    .select({ id: departments.id })
    .from(departments)
    .where(eq(departments.id, id));
  if (!existing) return { ok: false, error: "Department not found." };

  await db
    .update(departments)
    .set({ displayName: trimmed })
    .where(eq(departments.id, id));

  revalidatePath("/settings/departments");
  revalidatePath("/vacancies/new");
  return { ok: true, data: undefined };
}

export async function setDepartmentActive(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  await requirePermission("settings", "write");

  const [row] = await db
    .update(departments)
    .set({ isActive })
    .where(eq(departments.id, id))
    .returning({ id: departments.id });

  if (!row) return { ok: false, error: "Department not found." };

  revalidatePath("/settings/departments");
  revalidatePath("/vacancies/new");
  return { ok: true, data: undefined };
}

export async function deleteDepartment(id: string): Promise<ActionResult> {
  await requirePermission("settings", "delete");

  const [department] = await db
    .select({ id: departments.id, name: departments.name })
    .from(departments)
    .where(eq(departments.id, id));

  if (!department) return { ok: false, error: "Department not found." };

  const [usage] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(vacancies)
    .where(sql`lower(${vacancies.department}) = ${department.name}`);

  const vacancyCount = Number(usage?.count) || 0;
  if (vacancyCount > 0) {
    return {
      ok: false,
      error: `This department is used by ${vacancyCount} vacancy${vacancyCount === 1 ? "" : "ies"}. Archive it instead.`,
    };
  }

  await db.delete(departments).where(eq(departments.id, id));

  revalidatePath("/settings/departments");
  revalidatePath("/vacancies/new");
  return { ok: true, data: undefined };
}
