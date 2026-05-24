"use server";

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { automationRules, automationRuns, profiles, vacancies, vacancyStages } from "@/lib/db/schema";
import { getCurrentDataMode } from "@/lib/data-mode";
import { requirePermission } from "@/lib/auth/permissions";
import type { AutomationActionType, AutomationTriggerType } from "@/lib/types";

const vacancyNotDeleted = isNull(vacancies.deletedAt);

export type AutomationRuleView = {
  id: string;
  vacancyId: string;
  name: string;
  isEnabled: boolean;
  triggerType: AutomationTriggerType;
  triggerStageId?: string;
  actionType: AutomationActionType;
  actionStageId?: string;
  actionMessageText?: string;
  createdAt: string;
};

export type AutomationVacancyOption = {
  id: string;
  title: string;
};

export type AutomationStageOption = {
  id: string;
  vacancyId: string;
  name: string;
  orderIndex: number;
};

export type AutomationRunView = {
  id: string;
  ruleId?: string;
  vacancyId: string;
  applicationId?: string;
  candidateId?: string;
  candidateName?: string;
  ruleName: string;
  vacancyTitle: string;
  triggerType: AutomationTriggerType;
  triggerStageId?: string;
  actionType: AutomationActionType;
  status: "success" | "skipped" | "failed";
  messageText?: string;
  error?: string;
  createdAt: string;
};

export type AutomationPageData = {
  vacancies: AutomationVacancyOption[];
  stages: AutomationStageOption[];
  automations: AutomationRuleView[];
  runs: AutomationRunView[];
  canSendTestMessage: boolean;
  testMessageUnavailableReason?: string;
};

export type SaveAutomationInput = {
  name: string;
  triggerType: AutomationTriggerType;
  triggerStageId?: string;
  actionType: AutomationActionType;
  actionStageId?: string;
  actionMessageText?: string;
};

export type TestAutomationMessageInput = SaveAutomationInput & {
  vacancyId: string;
};

export async function getAutomationPageData(): Promise<AutomationPageData> {
  const session = await requirePermission("automations", "read");
  const isDemo = await getCurrentDataMode();

  const vacancyRows = await db
    .select({
      id: vacancies.id,
      title: vacancies.title,
    })
    .from(vacancies)
    .where(and(eq(vacancies.isDemo, isDemo), vacancyNotDeleted))
    .orderBy(asc(vacancies.createdAt));

  const vacancyIds = vacancyRows.map((vacancy) => vacancy.id);
  const profileRows = await db
    .select({ telegramChatId: profiles.telegramChatId })
    .from(profiles)
    .where(eq(profiles.id, session.sub));
  const testMessageUnavailableReason = getTestMessageUnavailableReason(profileRows[0]?.telegramChatId);

  if (vacancyIds.length === 0) {
    return {
      vacancies: [],
      stages: [],
      automations: [],
      runs: [],
      canSendTestMessage: !testMessageUnavailableReason,
      testMessageUnavailableReason,
    };
  }

  const [stageRows, ruleRows, runRows] = await Promise.all([
    db
      .select({
        id: vacancyStages.id,
        vacancyId: vacancyStages.vacancyId,
        name: vacancyStages.name,
        orderIndex: vacancyStages.orderIndex,
      })
      .from(vacancyStages)
      .where(inArray(vacancyStages.vacancyId, vacancyIds))
      .orderBy(asc(vacancyStages.orderIndex)),
    db
      .select()
      .from(automationRules)
      .where(inArray(automationRules.vacancyId, vacancyIds))
      .orderBy(asc(automationRules.createdAt)),
    db
      .select()
      .from(automationRuns)
      .where(inArray(automationRuns.vacancyId, vacancyIds))
      .orderBy(desc(automationRuns.createdAt))
      .limit(30),
  ]);

  return {
    vacancies: vacancyRows,
    stages: stageRows,
    automations: ruleRows.map(serializeRule),
    runs: runRows.map(serializeRun),
    canSendTestMessage: !testMessageUnavailableReason,
    testMessageUnavailableReason,
  };
}

export async function createAutomationRule(vacancyId: string, input: SaveAutomationInput): Promise<AutomationRuleView> {
  await requirePermission("automations", "create");
  await validateRuleInput(vacancyId, input);

  const row = {
    id: crypto.randomUUID(),
    vacancyId,
    name: input.name.trim(),
    isEnabled: true,
    triggerType: input.triggerType,
    triggerStageId: input.triggerType === "stage_entered" ? input.triggerStageId ?? null : null,
    actionType: input.actionType,
    actionStageId: input.actionType === "move_to_stage" ? input.actionStageId ?? null : null,
    actionMessageText: input.actionType === "send_message" ? input.actionMessageText?.trim() ?? null : null,
    createdAt: new Date(),
  };

  await assertNoDuplicateRule(vacancyId, input);
  await db.insert(automationRules).values(row);
  revalidateAutomationPaths();

  return serializeRule(row);
}

export async function updateAutomationRule(id: string, input: SaveAutomationInput): Promise<AutomationRuleView> {
  await requirePermission("automations", "edit");

  const existing = await getRuleInCurrentMode(id);
  if (!existing) throw new Error("Automation rule not found.");

  await validateRuleInput(existing.vacancyId, input);
  await assertNoDuplicateRule(existing.vacancyId, input, id);

  const patch = {
    name: input.name.trim(),
    triggerType: input.triggerType,
    triggerStageId: input.triggerType === "stage_entered" ? input.triggerStageId ?? null : null,
    actionType: input.actionType,
    actionStageId: input.actionType === "move_to_stage" ? input.actionStageId ?? null : null,
    actionMessageText: input.actionType === "send_message" ? input.actionMessageText?.trim() ?? null : null,
  };

  const rows = await db
    .update(automationRules)
    .set(patch)
    .where(eq(automationRules.id, id))
    .returning();

  revalidateAutomationPaths();
  return serializeRule(rows[0]);
}

export async function toggleAutomationRule(id: string): Promise<AutomationRuleView> {
  await requirePermission("automations", "edit");

  const existing = await getRuleInCurrentMode(id);
  if (!existing) throw new Error("Automation rule not found.");

  const rows = await db
    .update(automationRules)
    .set({ isEnabled: !existing.isEnabled })
    .where(eq(automationRules.id, id))
    .returning();

  revalidateAutomationPaths();
  return serializeRule(rows[0]);
}

export async function deleteAutomationRule(id: string): Promise<void> {
  await requirePermission("automations", "delete");

  const existing = await getRuleInCurrentMode(id);
  if (!existing) return;

  await db.delete(automationRules).where(eq(automationRules.id, id));
  revalidateAutomationPaths();
}

export async function sendAutomationTestMessage(input: TestAutomationMessageInput): Promise<{ sentAt: string }> {
  const session = await requirePermission("automations", "write");

  if (input.actionType !== "send_message") {
    throw new Error("Only message automations can be test-sent.");
  }

  await validateRuleInput(input.vacancyId, {
    name: input.name.trim() || "Test message",
    triggerType: input.triggerType,
    triggerStageId: input.triggerStageId,
    actionType: input.actionType,
    actionStageId: input.actionStageId,
    actionMessageText: input.actionMessageText,
  });

  const profileRows = await db
    .select({ telegramChatId: profiles.telegramChatId })
    .from(profiles)
    .where(eq(profiles.id, session.sub));
  const telegramChatId = profileRows[0]?.telegramChatId?.trim();
  if (!telegramChatId) {
    throw new Error("Add your HR Telegram chat ID in your profile before sending test messages.");
  }
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error("Configure TELEGRAM_BOT_TOKEN before sending test messages.");
  }

  const text = await renderPreviewMessage(input);
  const { sendBotMessage } = await import("@/lib/bot/send");
  await sendBotMessage(telegramChatId, text);

  return { sentAt: new Date().toISOString() };
}

function serializeRule(rule: typeof automationRules.$inferSelect): AutomationRuleView {
  return {
    id: rule.id,
    vacancyId: rule.vacancyId,
    name: rule.name,
    isEnabled: rule.isEnabled,
    triggerType: rule.triggerType as AutomationTriggerType,
    triggerStageId: rule.triggerStageId ?? undefined,
    actionType: rule.actionType as AutomationActionType,
    actionStageId: rule.actionStageId ?? undefined,
    actionMessageText: rule.actionMessageText ?? undefined,
    createdAt: rule.createdAt.toISOString(),
  };
}

function serializeRun(run: typeof automationRuns.$inferSelect): AutomationRunView {
  return {
    id: run.id,
    ruleId: run.ruleId ?? undefined,
    vacancyId: run.vacancyId,
    applicationId: run.applicationId ?? undefined,
    candidateId: run.candidateId ?? undefined,
    candidateName: run.candidateName ?? undefined,
    ruleName: run.ruleName,
    vacancyTitle: run.vacancyTitle,
    triggerType: run.triggerType as AutomationTriggerType,
    triggerStageId: run.triggerStageId ?? undefined,
    actionType: run.actionType as AutomationActionType,
    status: run.status as AutomationRunView["status"],
    messageText: run.messageText ?? undefined,
    error: run.error ?? undefined,
    createdAt: run.createdAt.toISOString(),
  };
}

async function validateRuleInput(vacancyId: string, input: SaveAutomationInput) {
  const isDemo = await getCurrentDataMode();

  if (!input.name.trim()) throw new Error("Rule name is required.");
  if (input.triggerType !== "application_submitted" && input.triggerType !== "stage_entered") {
    throw new Error("Invalid trigger type.");
  }
  if (input.actionType !== "send_message" && input.actionType !== "move_to_stage") {
    throw new Error("Invalid action type.");
  }

  const vacancyRows = await db
    .select({ id: vacancies.id })
    .from(vacancies)
    .where(and(eq(vacancies.id, vacancyId), eq(vacancies.isDemo, isDemo), vacancyNotDeleted));
  if (!vacancyRows[0]) throw new Error("Vacancy not found in the current mode.");

  const stageIds = [input.triggerStageId, input.actionStageId].filter(Boolean) as string[];
  if (stageIds.length > 0) {
    const rows = await db
      .select({ id: vacancyStages.id })
      .from(vacancyStages)
      .where(and(inArray(vacancyStages.id, stageIds), eq(vacancyStages.vacancyId, vacancyId)));
    if (rows.length !== new Set(stageIds).size) {
      throw new Error("Selected stage does not belong to this vacancy.");
    }
  }

  if (input.triggerType === "stage_entered" && !input.triggerStageId) {
    throw new Error("Choose the trigger stage.");
  }
  if (input.actionType === "move_to_stage" && !input.actionStageId) {
    throw new Error("Choose the destination stage.");
  }
  if (input.actionType === "send_message" && !input.actionMessageText?.trim()) {
    throw new Error("Write the message to send.");
  }
}

async function renderPreviewMessage(input: TestAutomationMessageInput) {
  const [vacancyRows, stageRows] = await Promise.all([
    db
      .select({ title: vacancies.title })
      .from(vacancies)
      .where(and(eq(vacancies.id, input.vacancyId), vacancyNotDeleted)),
    db
      .select({ id: vacancyStages.id, name: vacancyStages.name, orderIndex: vacancyStages.orderIndex })
      .from(vacancyStages)
      .where(eq(vacancyStages.vacancyId, input.vacancyId))
      .orderBy(asc(vacancyStages.orderIndex)),
  ]);

  const stageName =
    input.triggerType === "stage_entered"
      ? stageRows.find((stage) => stage.id === input.triggerStageId)?.name ?? ""
      : stageRows[0]?.name ?? "";
  const nextStageName = input.actionStageId
    ? stageRows.find((stage) => stage.id === input.actionStageId)?.name ?? stageName
    : stageName;

  return renderTemplate(input.actionMessageText ?? "", {
    name: "Sample Candidate",
    firstName: "Sample",
    vacancy: vacancyRows[0]?.title ?? "",
    stage: stageName,
    nextStage: nextStageName,
  });
}

async function assertNoDuplicateRule(vacancyId: string, input: SaveAutomationInput, excludeId?: string) {
  const rows = await db
    .select()
    .from(automationRules)
    .where(eq(automationRules.vacancyId, vacancyId));

  const triggerStageId = input.triggerType === "stage_entered" ? input.triggerStageId ?? "" : "";
  const actionStageId = input.actionType === "move_to_stage" ? input.actionStageId ?? "" : "";
  const actionMessageText = input.actionType === "send_message" ? input.actionMessageText?.trim() ?? "" : "";

  const duplicate = rows.some((rule) => (
    rule.id !== excludeId &&
    rule.triggerType === input.triggerType &&
    (rule.triggerStageId ?? "") === triggerStageId &&
    rule.actionType === input.actionType &&
    (rule.actionStageId ?? "") === actionStageId &&
    (rule.actionMessageText?.trim() ?? "") === actionMessageText
  ));

  if (duplicate) throw new Error("An identical rule already exists.");
}

async function getRuleInCurrentMode(id: string) {
  const isDemo = await getCurrentDataMode();
  const rows = await db
    .select({ rule: automationRules })
    .from(automationRules)
    .innerJoin(vacancies, and(eq(automationRules.vacancyId, vacancies.id), eq(vacancies.isDemo, isDemo), vacancyNotDeleted))
    .where(eq(automationRules.id, id));

  return rows[0]?.rule ?? null;
}

export async function previewAutomationMessage(ruleId: string): Promise<string> {
  await requirePermission("automations", "read");
  const [rule] = await db.select().from(automationRules).where(eq(automationRules.id, ruleId));
  if (!rule) throw new Error("Rule not found");
  // substitute placeholder variables
  let text = rule.actionMessageText ?? "";
  const sampleVars = {
    name: "Sample Candidate",
    firstName: "Sample",
    vacancy: "Sample Vacancy",
    stage: "Sample Stage",
    nextStage: "Sample Stage",
  };
  for (const [k, v] of Object.entries(sampleVars)) {
    text = text.replaceAll(`{${k}}`, v);
  }
  return text;
}

function revalidateAutomationPaths() {
  revalidatePath("/automations");
  revalidatePath("/settings/automations");
}

function renderTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);
}

function getTestMessageUnavailableReason(telegramChatId?: string | null) {
  if (!telegramChatId?.trim()) return "Add your HR Telegram chat ID in your profile to enable tests.";
  if (!process.env.TELEGRAM_BOT_TOKEN) return "Configure TELEGRAM_BOT_TOKEN to enable test messages.";
  return undefined;
}
