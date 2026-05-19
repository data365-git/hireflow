"use server";

import { asc, and, eq, inArray, or } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db/client";
import { systemRoles, userRoles, users } from "@/lib/db/schema";

export type AssignableHrUser = {
  id: string;
  name: string;
  avatarInitials: string;
  role: string;
};

const ASSIGNABLE_HR_ROLES = ["hr", "admin", "superadmin"];

export async function getAssignableHrUsers(): Promise<AssignableHrUser[]> {
  await requirePermission("vacancies", "create");

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      avatarInitials: users.avatarInitials,
      role: userRoles.role,
    })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .leftJoin(systemRoles, eq(systemRoles.name, userRoles.role))
    .where(
      and(
        eq(users.isActive, true),
        eq(users.hasAccess, true),
        eq(userRoles.isActive, true),
        or(inArray(userRoles.role, ASSIGNABLE_HR_ROLES), eq(systemRoles.isSuperadmin, true))
      )
    )
    .orderBy(asc(users.name));

  const uniqueUsers = new Map<string, AssignableHrUser>();
  for (const row of rows) {
    if (!uniqueUsers.has(row.id)) {
      uniqueUsers.set(row.id, row);
    }
  }

  return Array.from(uniqueUsers.values());
}
