import "dotenv/config";
import { db } from "../lib/db/client";
import { systemRoles, rolePermissions, users, userRoles, profiles } from "../lib/db/schema";
import { hashPassword } from "../lib/auth/password";

const SYSTEM_ROLES = [
  { name: "superadmin", displayName: "Superadmin", color: "#7c3aed", isSystem: true, isSuperadmin: true },
  { name: "admin",    displayName: "Admin",    color: "#ef4444", isSystem: true, isSuperadmin: false },
  { name: "manager",  displayName: "Manager",  color: "#3b82f6", isSystem: true, isSuperadmin: false },
  { name: "employee", displayName: "Employee", color: "#10b981", isSystem: true, isSuperadmin: false },
  { name: "hr",       displayName: "HR",       color: "#8b5cf6", isSystem: true, isSuperadmin: false },
];

const DEFAULT_PERMS: Record<string, Record<string, [boolean, boolean, boolean, boolean]>> = {
  manager:  {
    dashboard:  [true, true,  true,  false],
    vacancies:  [true, true,  true,  false],
    candidates: [true, true,  true,  false],
    analytics:  [true, false, false, false],
  },
  employee: {
    dashboard: [true, false, false, false],
    vacancies: [true, false, false, false],
  },
  hr: {
    dashboard:   [true, false, false, false],
    vacancies:   [true, true,  true,  true],
    candidates:  [true, true,  true,  true],
    inbox:       [true, true,  true,  false],
    templates:   [true, true,  true,  false],
    automations: [true, true,  true,  false],
    leads:       [true, false, false, false],
  },
};

async function seed() {
  // 1. System roles
  for (const r of SYSTEM_ROLES) {
    await db.insert(systemRoles).values({ id: crypto.randomUUID(), ...r }).onConflictDoNothing();
  }
  console.log("  system_roles done");

  // 2. Default permissions
  for (const [role, screens] of Object.entries(DEFAULT_PERMS)) {
    for (const [screen, [r, c, e, d]] of Object.entries(screens)) {
      await db.insert(rolePermissions).values({
        id: crypto.randomUUID(),
        role,
        screenName: screen,
        canRead: r,
        canCreate: c,
        canEdit: e,
        canDelete: d,
        canWrite: c || e,
      }).onConflictDoNothing();
    }
  }
  console.log("  role_permissions done");

  // 3. Admin user
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@hireflow.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!123";
  const id = "u-admin";

  await db.insert(users).values({
    id,
    name: "Admin",
    avatarInitials: "AD",
    role: "admin",
    email,
    passwordHash: await hashPassword(password),
    fullName: "Admin",
    isActive: true,
    hasAccess: true,
  }).onConflictDoNothing();
  console.log("  admin user done");

  // 4. Profile
  await db.insert(profiles).values({ id, fullName: "Admin" }).onConflictDoNothing();
  console.log("  profile done");

  // 5. User role assignments
  for (const role of ["admin", "superadmin"]) {
    await db.insert(userRoles).values({
      id: crypto.randomUUID(),
      userId: id,
      role,
      isActive: true,
    }).onConflictDoNothing();
  }
  console.log("  user_roles done");

  console.log(`\nSeeded. Admin login: ${email} / ${password}`);
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
