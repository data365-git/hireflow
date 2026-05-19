"use server";

import { revalidatePath } from "next/cache";
import { and, inArray, lt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { applications } from "@/lib/db/schema";
import { requirePermission } from "@/lib/auth/permissions";

export async function flagAbandonedApplications() {
  await requirePermission("settings", "edit");
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);

  await db
    .update(applications)
    .set({
      status: "abandoned",
      lastActivityAt: new Date(),
    })
    .where(
      and(
        inArray(applications.status, ["browsing", "in_progress"]),
        lt(applications.lastActivityAt, sevenDaysAgo)
      )
    );

  revalidatePath("/applications");
  revalidatePath("/inbox");
  revalidatePath("/analytics");
}
