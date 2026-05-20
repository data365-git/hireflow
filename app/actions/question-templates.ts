"use server";
import { db } from "@/lib/db/client";
import { questionTemplates, questionTemplateItems } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import type { QuestionTemplate } from "@/lib/types";
import { revalidatePath } from "next/cache";

function serializeTemplate(
  tpl: typeof questionTemplates.$inferSelect,
  items: (typeof questionTemplateItems.$inferSelect)[]
): QuestionTemplate {
  return {
    id: tpl.id,
    name: tpl.name,
    description: tpl.description,
    isSystem: tpl.isSystem,
    createdAt: tpl.createdAt.toISOString(),
    questions: items
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((item) => ({
        id: item.id,
        text: item.text,
        type: item.type as QuestionTemplate["questions"][number]["type"],
        options: (item.options as string[] | null | undefined) ?? undefined,
        orderIndex: item.orderIndex,
      })),
  };
}

export async function listQuestionTemplates(): Promise<QuestionTemplate[]> {
  const tpls = await db
    .select()
    .from(questionTemplates)
    .orderBy(asc(questionTemplates.createdAt));

  if (tpls.length === 0) return [];

  const items = await db
    .select()
    .from(questionTemplateItems)
    .orderBy(asc(questionTemplateItems.orderIndex));

  return tpls.map((tpl) =>
    serializeTemplate(tpl, items.filter((i) => i.templateId === tpl.id))
  );
}

export async function createQuestionTemplate(input: {
  name: string;
  description?: string;
  questions: Array<{ text: string; type: string; options?: string[] }>;
}): Promise<QuestionTemplate> {
  const id = crypto.randomUUID();
  await db.insert(questionTemplates).values({
    id,
    name: input.name,
    description: input.description ?? null,
    isSystem: false,
  });

  for (let i = 0; i < input.questions.length; i++) {
    const q = input.questions[i];
    await db.insert(questionTemplateItems).values({
      id: crypto.randomUUID(),
      templateId: id,
      text: q.text,
      type: q.type,
      options: q.options && q.options.length > 0 ? q.options : null,
      orderIndex: i,
    });
  }

  revalidatePath("/settings/question-templates");
  const [tpl] = await db.select().from(questionTemplates).where(eq(questionTemplates.id, id));
  const items = await db.select().from(questionTemplateItems).where(eq(questionTemplateItems.templateId, id));
  return serializeTemplate(tpl, items);
}

export async function deleteQuestionTemplate(id: string): Promise<void> {
  const [tpl] = await db.select().from(questionTemplates).where(eq(questionTemplates.id, id));
  if (!tpl) return;
  if (tpl.isSystem) throw new Error("Cannot delete system templates");
  await db.delete(questionTemplates).where(eq(questionTemplates.id, id));
  revalidatePath("/settings/question-templates");
}
