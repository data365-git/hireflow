"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Clock3, Eye, Pencil, Send, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import {
  createAutomationRule,
  deleteAutomationRule,
  getAutomationPageData,
  previewAutomationMessage,
  sendAutomationTestMessage,
  toggleAutomationRule,
  updateAutomationRule,
  type AutomationRunView,
  type AutomationRuleView,
  type AutomationStageOption,
  type AutomationVacancyOption,
} from "@/app/actions/automations";
import type { AutomationActionType, AutomationTriggerType } from "@/lib/types";

const TRIGGER_LABELS: Record<AutomationTriggerType, string> = {
  application_submitted: "When application is submitted",
  stage_entered: "When candidate enters a stage",
};

const ACTION_LABELS: Record<AutomationActionType, string> = {
  send_message: "Send a message",
  move_to_stage: "Move to stage",
};

const EMPTY_FORM = {
  name: "",
  vacancyId: "",
  triggerType: "application_submitted" as AutomationTriggerType,
  triggerStageId: "",
  actionType: "send_message" as AutomationActionType,
  actionStageId: "",
  actionMessageText: "",
};

export default function AutomationsPage() {
  const [vacancies, setVacancies] = useState<AutomationVacancyOption[]>([]);
  const [stages, setStages] = useState<AutomationStageOption[]>([]);
  const [automations, setAutomations] = useState<AutomationRuleView[]>([]);
  const [runs, setRuns] = useState<AutomationRunView[]>([]);
  const [canSendTestMessage, setCanSendTestMessage] = useState(false);
  const [testMessageUnavailableReason, setTestMessageUnavailableReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [filterVacancyId, setFilterVacancyId] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewRuleName, setPreviewRuleName] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isTestPending, startTestTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getAutomationPageData()
      .then((data) => {
        if (cancelled) return;
        setVacancies(data.vacancies);
        setStages(data.stages);
        setAutomations(data.automations);
        setRuns(data.runs);
        setCanSendTestMessage(data.canSendTestMessage);
        setTestMessageUnavailableReason(data.testMessageUnavailableReason ?? null);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to load automations", err);
        setError(err instanceof Error ? err.message : "Failed to load automations.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setTestStatus(null);
  }, [form]);

  const stagesByVacancy = useMemo(() => {
    const grouped = new Map<string, AutomationStageOption[]>();
    for (const stage of stages) {
      const list = grouped.get(stage.vacancyId) ?? [];
      list.push(stage);
      grouped.set(stage.vacancyId, list);
    }
    return grouped;
  }, [stages]);

  const validationErrors = getValidationErrors();
  const canSave = validationErrors.length === 0;
  const busy = loading || isPending || isTestPending;
  const filteredAutomations =
    filterVacancyId === "all"
      ? automations
      : automations.filter((rule) => rule.vacancyId === filterVacancyId);
  const filteredRuns =
    filterVacancyId === "all"
      ? runs
      : runs.filter((run) => run.vacancyId === filterVacancyId);
  const vacancyIds = Array.from(new Set(filteredAutomations.map((rule) => rule.vacancyId)));
  const formStages = form.vacancyId ? stagesByVacancy.get(form.vacancyId) ?? [] : [];
  const previewMessage = useMemo(() => {
    if (form.actionType !== "send_message" || !form.actionMessageText.trim()) return "";

    const vacancyTitle = vacancies.find((vacancy) => vacancy.id === form.vacancyId)?.title ?? "Selected vacancy";
    const stageName =
      form.triggerType === "stage_entered"
        ? formStages.find((stage) => stage.id === form.triggerStageId)?.name ?? "Selected stage"
        : formStages[0]?.name ?? "Current stage";
    const nextStageName = form.actionStageId
      ? formStages.find((stage) => stage.id === form.actionStageId)?.name ?? stageName
      : stageName;

    return renderTemplate(form.actionMessageText, {
      name: "Sample Candidate",
      firstName: "Sample",
      vacancy: vacancyTitle,
      stage: stageName,
      nextStage: nextStageName,
    });
  }, [form, formStages, vacancies]);

  function buildDescription(rule: AutomationRuleView) {
    const vacancyStages = stagesByVacancy.get(rule.vacancyId) ?? [];
    const findStage = (id?: string) => vacancyStages.find((stage) => stage.id === id)?.name ?? "?";
    const trigger =
      rule.triggerType === "application_submitted"
        ? "When application submitted"
        : `When enters ${findStage(rule.triggerStageId)}`;
    const action =
      rule.actionType === "send_message"
        ? `-> Send message: "${(rule.actionMessageText ?? "").slice(0, 50)}${(rule.actionMessageText?.length ?? 0) > 50 ? "..." : ""}"`
        : `-> Move to ${findStage(rule.actionStageId)}`;

    return `${trigger}  ${action}`;
  }

  function handleSave() {
    if (!canSave || busy) return;

    const payload = buildRulePayload();

    startTransition(async () => {
      try {
        const saved = editingId
          ? await updateAutomationRule(editingId, payload)
          : await createAutomationRule(form.vacancyId, payload);

        setAutomations((current) => (
          editingId
            ? current.map((rule) => rule.id === saved.id ? saved : rule)
            : [...current, saved]
        ));
        setError(null);
        setTestStatus(null);
        setEditingId(null);
        setForm(EMPTY_FORM);
        setFormOpen(false);
      } catch (err) {
        console.error("Failed to save automation", err);
        setError(err instanceof Error ? err.message : "Failed to save automation rule.");
      }
    });
  }

  function handleTestSend() {
    if (!canSave || form.actionType !== "send_message" || !canSendTestMessage || busy) return;

    startTestTransition(async () => {
      try {
        await sendAutomationTestMessage({
          vacancyId: form.vacancyId,
          ...buildRulePayload(),
        });
        setTestStatus("Test sent to your Telegram chat.");
        setError(null);
      } catch (err) {
        console.error("Failed to send automation test message", err);
        setTestStatus(null);
        setError(err instanceof Error ? err.message : "Failed to send test message.");
      }
    });
  }

  function buildRulePayload() {
    return {
      name: form.name.trim(),
      triggerType: form.triggerType,
      triggerStageId: form.triggerType === "stage_entered" ? form.triggerStageId || undefined : undefined,
      actionType: form.actionType,
      actionStageId: form.actionType === "move_to_stage" ? form.actionStageId || undefined : undefined,
      actionMessageText: form.actionType === "send_message" ? form.actionMessageText || undefined : undefined,
    };
  }

  function handleToggle(id: string) {
    if (busy) return;
    startTransition(async () => {
      try {
        const updated = await toggleAutomationRule(id);
        setAutomations((current) => current.map((rule) => rule.id === id ? updated : rule));
        setError(null);
      } catch (err) {
        console.error("Failed to toggle automation", err);
        setError(err instanceof Error ? err.message : "Failed to toggle automation rule.");
      }
    });
  }

  function handleRemove(id: string) {
    if (busy) return;
    startTransition(async () => {
      try {
        await deleteAutomationRule(id);
        setAutomations((current) => current.filter((rule) => rule.id !== id));
        setConfirmRemoveId(null);
        setError(null);
      } catch (err) {
        console.error("Failed to delete automation", err);
        setError(err instanceof Error ? err.message : "Failed to delete automation rule.");
      }
    });
  }

  function handlePreview(rule: AutomationRuleView) {
    if (rule.actionType !== "send_message") return;
    startTransition(async () => {
      try {
        const text = await previewAutomationMessage(rule.id);
        setPreviewRuleName(rule.name);
        setPreviewText(text);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load preview.");
      }
    });
  }

  function getValidationErrors() {
    const errors: string[] = [];
    const actionMessageText = form.actionMessageText.trim();

    if (!form.name.trim()) errors.push("Name the rule.");
    if (!form.vacancyId) errors.push("Choose a vacancy.");
    if (form.triggerType === "stage_entered" && !form.triggerStageId) {
      errors.push("Choose the trigger stage.");
    }
    if (form.actionType === "move_to_stage" && !form.actionStageId) {
      errors.push("Choose the destination stage.");
    }
    if (form.actionType === "send_message" && !actionMessageText) {
      errors.push("Write the message to send.");
    }

    if (form.vacancyId) {
      const duplicate = automations.filter((rule) => rule.id !== editingId).some((rule) => (
        rule.vacancyId === form.vacancyId &&
        rule.triggerType === form.triggerType &&
        (rule.triggerStageId ?? "") === (form.triggerType === "stage_entered" ? form.triggerStageId : "") &&
        rule.actionType === form.actionType &&
        (rule.actionStageId ?? "") === (form.actionType === "move_to_stage" ? form.actionStageId : "") &&
        (rule.actionMessageText?.trim() ?? "") === (form.actionType === "send_message" ? actionMessageText : "")
      ));
      if (duplicate) errors.push("An identical rule already exists.");
    }

    return errors;
  }

  function closeForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setTestStatus(null);
    setFormOpen(false);
  }

  return (
    <div className="px-8 py-8 max-w-[760px]">
      <Dialog
        open={previewText !== null}
        onClose={() => setPreviewText(null)}
        title={`Preview: ${previewRuleName}`}
        size="sm"
      >
        <p className="whitespace-pre-wrap text-body-sm text-text">
          {previewText || "No message text."}
        </p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => setPreviewText(null)}
            className="h-8 px-3 rounded-lg border border-border text-body-sm text-muted hover:bg-surface-2"
          >
            Close
          </button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmRemoveId !== null}
        title="Delete automation rule?"
        message="This rule will be permanently removed and will no longer fire."
        confirmLabel="Delete"
        onConfirm={() => {
          if (confirmRemoveId) handleRemove(confirmRemoveId);
        }}
        onCancel={() => setConfirmRemoveId(null)}
      />

      <div className="mb-6">
        <h1 className="text-h1 text-text">Automations</h1>
        <p className="text-body-sm text-muted mt-1">
          Rules that fire automatically when candidates move through the pipeline.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-body-sm text-danger">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-body text-muted font-medium">Loading automation rules...</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-8">
            <button
              onClick={() => setFilterVacancyId("all")}
              className={`h-8 px-3 rounded-full text-body-sm font-medium border transition-colors ${
                filterVacancyId === "all"
                  ? "bg-primary text-primary-fg border-primary"
                  : "bg-surface border-border text-muted hover:border-border-strong"
              }`}
            >
              All
            </button>
            {vacancies.map((vacancy) => (
              <button
                key={vacancy.id}
                onClick={() => setFilterVacancyId(vacancy.id)}
                className={`h-8 px-3 rounded-full text-body-sm font-medium border transition-colors ${
                  filterVacancyId === vacancy.id
                    ? "bg-primary text-primary-fg border-primary"
                    : "bg-surface border-border text-muted hover:border-border-strong"
                }`}
              >
                {vacancy.title}
              </button>
            ))}
          </div>

          {filteredAutomations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-body text-muted font-medium">No automation rules yet</p>
              <p className="text-body-sm text-subtle mt-1">
                Add a rule to automatically send messages or move candidates.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {vacancyIds.map((vacancyId) => {
                const vacancy = vacancies.find((item) => item.id === vacancyId);
                const rules = filteredAutomations.filter((rule) => rule.vacancyId === vacancyId);
                return (
                  <section key={vacancyId}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-body-sm font-semibold text-text">{vacancy?.title ?? "Unknown vacancy"}</span>
                      <span className="text-micro text-subtle bg-surface-2 px-2 py-0.5 rounded-full">
                        {rules.length} {rules.length === 1 ? "rule" : "rules"}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {rules.map((rule) => (
                        <RuleCard
                          key={rule.id}
                          rule={rule}
                          description={buildDescription(rule)}
                          vacancyName={vacancy?.title ?? ""}
                          onToggle={() => handleToggle(rule.id)}
                          onEdit={() => {
                            setForm({
                              name: rule.name,
                              vacancyId: rule.vacancyId,
                              triggerType: rule.triggerType,
                              triggerStageId: rule.triggerStageId ?? "",
                              actionType: rule.actionType,
                              actionStageId: rule.actionStageId ?? "",
                              actionMessageText: rule.actionMessageText ?? "",
                            });
                            setEditingId(rule.id);
                            setFormOpen(true);
                          }}
                          onPreview={rule.actionType === "send_message" ? () => handlePreview(rule) : undefined}
                          onRemove={() => setConfirmRemoveId(rule.id)}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          <div className="mt-10">
            {!formOpen ? (
              <button
                onClick={() => setFormOpen(true)}
                disabled={busy}
                className="flex items-center gap-1.5 text-body-sm font-semibold text-primary hover:text-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-lg leading-none">+</span> Add rule
              </button>
            ) : (
              <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
                <h2 className="text-h3 text-text">{editingId ? "Edit automation rule" : "New automation rule"}</h2>

                <div className="space-y-1">
                  <label className="text-body-sm font-medium text-text">Rule name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="e.g. Welcome message on apply"
                    className="w-full h-9 px-3 rounded-lg border border-border bg-surface-2 text-body-sm text-text placeholder:text-subtle focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-body-sm font-medium text-text">Vacancy</label>
                  <select
                    value={form.vacancyId}
                    disabled={!!editingId}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        vacancyId: event.target.value,
                        triggerStageId: "",
                        actionStageId: "",
                      }))
                    }
                    className="w-full h-9 px-3 rounded-lg border border-border bg-surface-2 text-body-sm text-text focus:outline-none focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="">Select vacancy...</option>
                    {vacancies.map((vacancy) => (
                      <option key={vacancy.id} value={vacancy.id}>
                        {vacancy.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-body-sm font-medium text-text">Trigger</label>
                  <select
                    value={form.triggerType}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        triggerType: event.target.value as AutomationTriggerType,
                        triggerStageId: "",
                      }))
                    }
                    className="w-full h-9 px-3 rounded-lg border border-border bg-surface-2 text-body-sm text-text focus:outline-none focus:border-primary"
                  >
                    <option value="application_submitted">{TRIGGER_LABELS.application_submitted}</option>
                    <option value="stage_entered">{TRIGGER_LABELS.stage_entered}</option>
                  </select>
                </div>

                {form.triggerType === "stage_entered" && (
                  <div className="space-y-1">
                    <label className="text-body-sm font-medium text-text">Stage</label>
                    <select
                      value={form.triggerStageId}
                      onChange={(event) => setForm((current) => ({ ...current, triggerStageId: event.target.value }))}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-surface-2 text-body-sm text-text focus:outline-none focus:border-primary"
                    >
                      <option value="">Select stage...</option>
                      {formStages.map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-body-sm font-medium text-text">Action</label>
                  <select
                    value={form.actionType}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        actionType: event.target.value as AutomationActionType,
                        actionStageId: "",
                        actionMessageText: "",
                      }))
                    }
                    className="w-full h-9 px-3 rounded-lg border border-border bg-surface-2 text-body-sm text-text focus:outline-none focus:border-primary"
                  >
                    <option value="send_message">{ACTION_LABELS.send_message}</option>
                    <option value="move_to_stage">{ACTION_LABELS.move_to_stage}</option>
                  </select>
                </div>

                {form.actionType === "move_to_stage" && (
                  <div className="space-y-1">
                    <label className="text-body-sm font-medium text-text">Move to stage</label>
                    <select
                      value={form.actionStageId}
                      onChange={(event) => setForm((current) => ({ ...current, actionStageId: event.target.value }))}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-surface-2 text-body-sm text-text focus:outline-none focus:border-primary"
                    >
                      <option value="">Select stage...</option>
                      {formStages.map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {form.actionType === "send_message" && (
                  <div className="space-y-1">
                    <label className="text-body-sm font-medium text-text">Message</label>
                    <textarea
                      value={form.actionMessageText}
                      onChange={(event) => setForm((current) => ({ ...current, actionMessageText: event.target.value }))}
                      placeholder="Type the message to send..."
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-surface-2 text-body-sm text-text placeholder:text-subtle focus:outline-none focus:border-primary resize-none"
                    />
                    <p className="text-micro text-subtle">
                      Variables: {"{name}"}, {"{firstName}"}, {"{vacancy}"}, {"{stage}"}, {"{nextStage}"}
                    </p>
                    <div className="border-l-2 border-border pl-3 py-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-micro font-semibold uppercase text-subtle">Preview</span>
                        <span className="text-micro text-subtle">Sample Candidate</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-body-sm text-text">
                        {previewMessage || "Write a message to preview the rendered result."}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleTestSend}
                        disabled={!canSave || !canSendTestMessage || busy}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-body-sm font-medium text-muted transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <Send className="h-3.5 w-3.5" />
                        {isTestPending ? "Sending..." : "Send test"}
                      </button>
                      <span className={`text-micro ${canSendTestMessage ? "text-subtle" : "text-warning"}`}>
                        {canSendTestMessage
                          ? "Sends only to your HR Telegram chat."
                          : testMessageUnavailableReason}
                      </span>
                    </div>
                    {testStatus && (
                      <p className="text-micro font-medium text-success">{testStatus}</p>
                    )}
                  </div>
                )}

                {validationErrors.length > 0 && (
                  <div className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2">
                    <p className="text-body-sm font-medium text-warning">Finish the rule before saving.</p>
                    <ul className="mt-1 space-y-0.5">
                      {validationErrors.map((validationError) => (
                        <li key={validationError} className="text-body-sm text-warning">
                          {validationError}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleSave}
                    disabled={!canSave || busy}
                    className="h-9 px-4 rounded-lg bg-primary text-primary-fg text-body-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary-hover transition-colors"
                  >
                    {editingId ? "Save changes" : "Save rule"}
                  </button>
                  <button
                    onClick={closeForm}
                    disabled={busy}
                    className="h-9 px-4 rounded-lg border border-border text-body-sm font-medium text-muted hover:bg-surface-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <section className="mt-10 border-t border-border pt-6">
            <div className="mb-3 flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-subtle" />
              <h2 className="text-h3 text-text">Recent activity</h2>
            </div>

            {filteredRuns.length === 0 ? (
              <p className="text-body-sm text-subtle">
                Automation firings will appear here after rules run.
              </p>
            ) : (
              <div className="space-y-2">
                {filteredRuns.map((run) => (
                  <AutomationRunItem key={run.id} run={run} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

type RuleCardProps = {
  rule: AutomationRuleView;
  description: string;
  vacancyName: string;
  onToggle: () => void;
  onEdit: () => void;
  onPreview?: () => void;
  onRemove: () => void;
};

function RuleCard({ rule, description, vacancyName, onToggle, onEdit, onPreview, onRemove }: RuleCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="group flex items-start gap-4 bg-surface border border-border rounded-xl p-4"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        role="switch"
        aria-checked={rule.isEnabled}
        onClick={onToggle}
        className={`relative mt-0.5 shrink-0 w-10 h-6 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
          rule.isEnabled ? "bg-primary" : "bg-surface-3"
        }`}
      >
        <span
          className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            rule.isEnabled ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-body-sm font-semibold text-text">{rule.name}</span>
          <span className="text-micro text-subtle bg-accent-soft px-2 py-0.5 rounded-full">
            {vacancyName}
          </span>
        </div>
        <p className="text-body-sm text-subtle mt-0.5 truncate">{description}</p>
      </div>

      <div className={`shrink-0 flex items-center gap-1 transition-all ${hovered ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        {onPreview && (
          <button
            onClick={onPreview}
            aria-label="Preview message"
            className="w-7 h-7 flex items-center justify-center rounded-md text-subtle hover:text-primary hover:bg-accent-soft transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={onEdit}
          aria-label="Edit rule"
          className="w-7 h-7 flex items-center justify-center rounded-md text-subtle hover:text-primary hover:bg-accent-soft transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onRemove}
          aria-label="Remove rule"
          className="w-7 h-7 flex items-center justify-center rounded-md text-subtle hover:text-danger hover:bg-danger-soft transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function AutomationRunItem({ run }: { run: AutomationRunView }) {
  const statusClass = {
    success: "bg-success-soft text-success",
    skipped: "bg-warning-soft text-warning",
    failed: "bg-danger-soft text-danger",
  }[run.status];
  const detail = run.error ?? run.messageText ?? (run.actionType === "move_to_stage" ? "Move action completed." : "");

  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-micro font-semibold ${statusClass}`}>
          {run.status}
        </span>
        <span className="min-w-0 text-body-sm font-medium text-text">
          {run.ruleName}
        </span>
        <span className="text-micro text-subtle">
          {formatRunTime(run.createdAt)}
        </span>
      </div>
      <p className="mt-1 text-body-sm text-subtle">
        {run.candidateName ? `${run.candidateName} · ` : ""}
        {run.vacancyTitle}
      </p>
      {detail && (
        <p className="mt-1 truncate text-body-sm text-muted">
          {detail}
        </p>
      )}
    </div>
  );
}

function formatRunTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function renderTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);
}
