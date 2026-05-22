"use server";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { applications, automationRules, automationRuns, candidates, telegramMessages, vacancies, vacancyStages } from "@/lib/db/schema";
import { sendBotMessage } from "@/lib/bot/send";

const MAX_AUTOMATION_DEPTH = 5;
const vacancyNotDeleted = isNull(vacancies.deletedAt);

type TriggerType = "stage_entered" | "application_submitted";

export async function fireStageEnteredAutomations(applicationId: string, stageId: string, depth = 0): Promise<void> {
  await fireAutomations({ applicationId, triggerType: "stage_entered", stageId, depth });
}

export async function fireApplicationSubmittedAutomations(applicationId: string, depth = 0): Promise<void> {
  await fireAutomations({ applicationId, triggerType: "application_submitted", depth });
}

async function fireAutomations(args: {
  applicationId: string;
  triggerType: TriggerType;
  stageId?: string;
  depth: number;
}) {
  if (args.depth >= MAX_AUTOMATION_DEPTH) {
    console.warn("Automation cycle break: max depth reached", {
      applicationId: args.applicationId,
      triggerType: args.triggerType,
      stageId: args.stageId,
    });
    return;
  }

  const context = await getAutomationContext(args.applicationId);
  if (!context) return;

  // Telegram bot sessions are always Live. Demo vacancies should never fire bot automations.
  if (context.vac.isDemo) return;

  const rules = await getMatchingRules(context.app.vacancyId, args.triggerType, args.stageId);
  if (rules.length === 0) return;

  for (const rule of rules) {
    if (rule.actionType === "send_message") {
      try {
        const result = await fireSendMessageRule(rule, context, args.stageId);
        await recordAutomationRun(rule, context, args.stageId, result);
      } catch (err) {
        console.error("Automation send_message failed", { ruleId: rule.id, applicationId: args.applicationId, err });
        await recordAutomationRun(rule, context, args.stageId, {
          status: "failed",
          error: getErrorMessage(err),
        });
      }
      continue;
    }

    if (rule.actionType === "move_to_stage") {
      if (!rule.actionStageId) {
        await recordAutomationRun(rule, context, args.stageId, {
          status: "skipped",
          error: "Rule has no destination stage.",
        });
        continue;
      }

      if (rule.actionStageId === context.app.currentStageId) {
        await recordAutomationRun(rule, context, args.stageId, {
          status: "skipped",
          error: "Application is already in the destination stage.",
        });
        continue;
      }

      try {
        const { moveApplicationToStage } = await import("@/app/actions/applications");
        await moveApplicationToStage(args.applicationId, rule.actionStageId, undefined, args.depth + 1);
        const destinationStageName = await getStageName(rule.actionStageId).catch(() => null);
        await recordAutomationRun(rule, context, args.stageId, {
          status: "success",
          messageText: `Moved to ${destinationStageName ?? "selected stage"}`,
        });
      } catch (err) {
        console.error("Automation move_to_stage failed", { ruleId: rule.id, applicationId: args.applicationId, err });
        await recordAutomationRun(rule, context, args.stageId, {
          status: "failed",
          error: getErrorMessage(err),
        });
      }
    }
  }
}

async function getMatchingRules(vacancyId: string, triggerType: TriggerType, stageId?: string) {
  const base = and(
    eq(automationRules.vacancyId, vacancyId),
    eq(automationRules.isEnabled, true),
    eq(automationRules.triggerType, triggerType)
  );

  if (triggerType === "stage_entered") {
    if (!stageId) return [];
    return db
      .select()
      .from(automationRules)
      .where(and(base, eq(automationRules.triggerStageId, stageId)));
  }

  return db
    .select()
    .from(automationRules)
    .where(base);
}

async function getAutomationContext(applicationId: string) {
  const rows = await db
    .select({
      app: applications,
      cand: candidates,
      vac: vacancies,
      stage: vacancyStages,
    })
    .from(applications)
    .innerJoin(candidates, eq(applications.candidateId, candidates.id))
    .innerJoin(vacancies, and(eq(applications.vacancyId, vacancies.id), vacancyNotDeleted))
    .leftJoin(vacancyStages, eq(applications.currentStageId, vacancyStages.id))
    .where(eq(applications.id, applicationId));

  return rows[0] ?? null;
}

async function fireSendMessageRule(
  rule: typeof automationRules.$inferSelect,
  context: NonNullable<Awaited<ReturnType<typeof getAutomationContext>>>,
  triggerStageId?: string
) {
  if (!rule.actionMessageText?.trim()) {
    return { status: "skipped" as const, error: "Rule has no message text." };
  }
  if (!context.cand.telegramUserId) {
    return { status: "skipped" as const, error: "Candidate has no Telegram ID." };
  }

  const stageName = context.stage?.name ?? await getStageName(triggerStageId) ?? "";
  const nextStageName = rule.actionStageId ? await getStageName(rule.actionStageId) : stageName;
  const text = renderTemplate(rule.actionMessageText, {
    name: context.cand.fullName,
    firstName: getFirstName(context.cand.fullName),
    vacancy: context.vac.title,
    stage: stageName,
    nextStage: nextStageName ?? "",
  });

  await sendBotMessage(context.cand.telegramUserId, text);
  await db.insert(telegramMessages).values({
    id: crypto.randomUUID(),
    candidateId: context.cand.id,
    applicationId: context.app.id,
    direction: "outbound",
    senderType: "system",
    senderName: "Automation",
    text,
    sentAt: new Date(),
    readByUserIds: [],
  });

  return { status: "success" as const, messageText: text };
}

async function recordAutomationRun(
  rule: typeof automationRules.$inferSelect,
  context: NonNullable<Awaited<ReturnType<typeof getAutomationContext>>>,
  triggerStageId: string | undefined,
  result: {
    status: "success" | "skipped" | "failed";
    messageText?: string;
    error?: string;
  }
) {
  await logAutomationRun(rule, context, triggerStageId, result).catch((err) => {
    console.error("Automation run logging failed", { ruleId: rule.id, applicationId: context.app.id, err });
  });
}

async function logAutomationRun(
  rule: typeof automationRules.$inferSelect,
  context: NonNullable<Awaited<ReturnType<typeof getAutomationContext>>>,
  triggerStageId: string | undefined,
  result: {
    status: "success" | "skipped" | "failed";
    messageText?: string;
    error?: string;
  }
) {
  await db.insert(automationRuns).values({
    id: crypto.randomUUID(),
    ruleId: rule.id,
    vacancyId: context.vac.id,
    applicationId: context.app.id,
    candidateId: context.cand.id,
    ruleName: rule.name,
    vacancyTitle: context.vac.title,
    candidateName: context.cand.fullName,
    triggerType: rule.triggerType,
    triggerStageId: rule.triggerStageId ?? triggerStageId ?? null,
    actionType: rule.actionType,
    status: result.status,
    messageText: result.messageText ?? null,
    error: result.error ?? null,
    createdAt: new Date(),
  });
}

async function getStageName(stageId?: string | null) {
  if (!stageId) return null;
  const rows = await db
    .select({ name: vacancyStages.name })
    .from(vacancyStages)
    .where(eq(vacancyStages.id, stageId));
  return rows[0]?.name ?? null;
}

function renderTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);
}

function getFirstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? "";
}

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : "Automation failed.";
}
