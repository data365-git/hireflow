import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { stageTemplates, stageTemplateStages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/permissions";
import { toResponse } from "@/lib/auth/session";
import { zodMessage } from "@/lib/auth/zod-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requirePermission("settings", "read");
    const templates = await db.select().from(stageTemplates);
    const stages = await db.select().from(stageTemplateStages);

    const result = templates.map((tpl) => ({
      ...tpl,
      stages: stages
        .filter((s) => s.templateId === tpl.id)
        .sort((a, b) => a.orderIndex - b.orderIndex),
    }));

    return Response.json(result);
  } catch (err) {
    return toResponse(err);
  }
}

const StageBody = z.object({
  name: z.string().min(1),
  color: z.string().min(1),
  isFinal: z.boolean(),
  isRejected: z.boolean(),
  orderIndex: z.number().int(),
});

const CreateBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  stages: z.array(StageBody).min(1),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("settings", "write");

    const parsed = CreateBody.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: zodMessage(parsed.error) }, { status: 400 });
    const { name, description, stages } = parsed.data;

    const id = crypto.randomUUID();
    await db.insert(stageTemplates).values({
      id,
      name,
      description,
      isSystem: false,
      createdBy: session.sub,
    });

    for (const [i, stage] of stages.entries()) {
      await db.insert(stageTemplateStages).values({
        id: crypto.randomUUID(),
        templateId: id,
        name: stage.name,
        color: stage.color,
        isFinal: stage.isFinal,
        isRejected: stage.isRejected,
        orderIndex: stage.orderIndex ?? i,
      });
    }

    return Response.json({ id, name });
  } catch (err) {
    return toResponse(err);
  }
}
