import "dotenv/config";
import { db } from "../lib/db/client";
import { vacancies, vacancyStages } from "../lib/db/schema";
import { eq, asc } from "drizzle-orm";

async function run() {
  const allVacancies = await db.select().from(vacancies);
  for (const v of allVacancies) {
    const existingStages = await db
      .select()
      .from(vacancyStages)
      .where(eq(vacancyStages.vacancyId, v.id))
      .orderBy(asc(vacancyStages.orderIndex));

    const hasPreScreening = existingStages.some((s) => s.name === "Pre-screening");
    if (hasPreScreening) {
      console.log(`Vacancy ${v.id} (${v.title}) already has Pre-screening, skipping.`);
      continue;
    }

    // Shift existing stages by +1
    for (const s of existingStages) {
      await db
        .update(vacancyStages)
        .set({ orderIndex: s.orderIndex + 1 })
        .where(eq(vacancyStages.id, s.id));
    }

    // Insert Pre-screening at orderIndex 0
    await db.insert(vacancyStages).values({
      id: crypto.randomUUID(),
      vacancyId: v.id,
      name: "Pre-screening",
      color: "new",
      isFinal: false,
      isRejected: false,
      orderIndex: 0,
    });
    console.log(`Added Pre-screening to vacancy ${v.id} (${v.title})`);
  }
  console.log("Done.");
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
