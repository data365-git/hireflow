"use server";

import { and, asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { audit } from "@/lib/auth/audit";
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
  activeCount: number;
  closedCount: number;
  deletedCount: number;
};

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type DepartmentBlocker = {
  id: string;
  title: string;
};

export type DepartmentBlockers = {
  active: DepartmentBlocker[];
  closed: DepartmentBlocker[];
  softDeleted: DepartmentBlocker[];
};

export type DepartmentDeleteResult =
  | { ok: true; data: undefined }
  | {
      ok: false;
      error:
        | string
        | {
            code: "ACTIVE_VACANCIES_EXIST" | "CLOSED_VACANCIES_EXIST" | "NOT_FOUND";
            message: string;
            blockers?: DepartmentBlockers;
          };
    };

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
      activeCount: sql<number>`coalesce(sum(case when ${vacancies.status} = 'active' and ${vacancies.deletedAt} is null then 1 else 0 end)::int, 0)`,
      closedCount: sql<number>`coalesce(sum(case when ${vacancies.status} != 'active' and ${vacancies.deletedAt} is null then 1 else 0 end)::int, 0)`,
      deletedCount: sql<number>`coalesce(sum(case when ${vacancies.deletedAt} is not null then 1 else 0 end)::int, 0)`,
    })
    .from(departments)
    .leftJoin(
      vacancies,
      sql`lower(${vacancies.department}) = ${departments.name}`
    )
    .where(includeInactive ? undefined : eq(departments.isActive, true))
    .groupBy(departments.id, departments.name, departments.displayName, departments.isActive)
    .orderBy(asc(departments.displayName));

  return rows.map((row) => ({
    ...row,
    activeCount: Number(row.activeCount) || 0,
    closedCount: Number(row.closedCount) || 0,
    deletedCount: Number(row.deletedCount) || 0,
    vacancyCount: Number(row.activeCount) || 0,
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
    return { ok: true, data: { ...row, vacancyCount: 0, activeCount: 0, closedCount: 0, deletedCount: 0 } };
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

export async function getDepartmentBlockers(id: string): Promise<DepartmentBlockers> {
  await requirePermission("settings", "read");

  const [department] = await db
    .select({ id: departments.id, name: departments.name })
    .from(departments)
    .where(eq(departments.id, id));

  if (!department) return { active: [], closed: [], softDeleted: [] };

  const rows = await db
    .select({
      id: vacancies.id,
      title: vacancies.title,
      status: vacancies.status,
      deletedAt: vacancies.deletedAt,
    })
    .from(vacancies)
    .where(sql`lower(${vacancies.department}) = ${department.name}`);

  return {
    active: rows
      .filter((row) => row.status === "active" && !row.deletedAt)
      .map((row) => ({ id: row.id, title: row.title })),
    closed: rows
      .filter((row) => row.status !== "active" && !row.deletedAt)
      .map((row) => ({ id: row.id, title: row.title })),
    softDeleted: rows
      .filter((row) => Boolean(row.deletedAt))
      .map((row) => ({ id: row.id, title: row.title })),
  };
}

export async function deleteDepartment(id: string): Promise<DepartmentDeleteResult> {
  const session = await requirePermission("settings", "delete");

  const [department] = await db
    .select({ id: departments.id, name: departments.name, displayName: departments.displayName, isActive: departments.isActive })
    .from(departments)
    .where(eq(departments.id, id));

  if (!department) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Department not found." },
    };
  }

  const blockers = await getDepartmentBlockers(id);

  if (blockers.active.length > 0) {
    return {
      ok: false,
      error: {
        code: "ACTIVE_VACANCIES_EXIST",
        message: `${blockers.active.length} active vacancy${blockers.active.length === 1 ? "" : "ies"} still use this department.`,
        blockers,
      },
    };
  }

  if (blockers.closed.length > 0) {
    return {
      ok: false,
      error: {
        code: "CLOSED_VACANCIES_EXIST",
        message: `${blockers.closed.length} closed vacancy${blockers.closed.length === 1 ? "" : "ies"} reference this department.`,
        blockers,
      },
    };
  }

  await db.delete(departments).where(eq(departments.id, id));

  audit({
    action: "DEPARTMENT_DELETE",
    actorId: session.sub,
    actorEmail: session.email,
    entityType: "department",
    entityId: department.id,
    entityName: department.displayName,
    before: { department, blockers },
    after: { deleted: true },
  });

  revalidatePath("/settings/departments");
  revalidatePath("/vacancies/new");
  return { ok: true, data: undefined };
}

export async function forceDeleteDepartment(
  id: string,
  action: "orphan" | "reassign" | "cascade-delete-vacancies",
  reassignToId?: string
): Promise<ActionResult> {
  const session = await requirePermission("settings", "delete");

  const [department] = await db
    .select({ id: departments.id, name: departments.name, displayName: departments.displayName, isActive: departments.isActive })
    .from(departments)
    .where(eq(departments.id, id));
  if (!department) return { ok: false, error: "Department not found." };

  const blockers = await getDepartmentBlockers(id);
  const affectedVacancyIds = [...blockers.active, ...blockers.closed].map((vacancy) => vacancy.id);

  if (blockers.active.length > 0) {
    return { ok: false, error: "Active vacancies must be closed before this department can be force-deleted." };
  }

  if (action === "reassign" && !reassignToId) {
    return { ok: false, error: "Choose a department to reassign vacancies to." };
  }

  await db.transaction(async (tx) => {
    if (action === "orphan") {
      await tx
        .update(vacancies)
        .set({ department: "" })
        .where(sql`lower(${vacancies.department}) = ${department.name} and ${vacancies.deletedAt} is null`);
    } else if (action === "reassign") {
      const [target] = await tx
        .select({ id: departments.id, displayName: departments.displayName })
        .from(departments)
        .where(and(eq(departments.id, reassignToId!), eq(departments.isActive, true)));
      if (!target) throw new Error("Reassignment target not found.");

      await tx
        .update(vacancies)
        .set({ department: target.displayName })
        .where(sql`lower(${vacancies.department}) = ${department.name} and ${vacancies.deletedAt} is null`);
    } else {
      await tx
        .update(vacancies)
        .set({ deletedAt: new Date(), deletedBy: session.sub, status: "closed" })
        .where(sql`lower(${vacancies.department}) = ${department.name} and ${vacancies.deletedAt} is null`);
    }

    await tx.delete(departments).where(eq(departments.id, id));
  });

  audit({
    action: "DEPARTMENT_FORCE_DELETE",
    actorId: session.sub,
    actorEmail: session.email,
    entityType: "department",
    entityId: department.id,
    entityName: department.displayName,
    description: `action=${action}, affected vacancies=${affectedVacancyIds.length}`,
    before: { department, blockers },
    after: { action, reassignToId, affectedVacancyIds },
  });

  revalidatePath("/settings/departments");
  revalidatePath("/vacancies");
  revalidatePath("/vacancies/new");
  return { ok: true, data: undefined };
}
