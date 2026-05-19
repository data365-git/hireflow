"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { AutomationTriggerType, AutomationActionType } from "@/lib/types";

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
  const vacancies = useStore((s) => s.vacancies);
  const automations = useStore((s) => s.automations);
  const getStagesForVacancy = useStore((s) => s.getStagesForVacancy);
  const toggleAutomation = useStore((s) => s.toggleAutomation);
  const removeAutomation = useStore((s) => s.removeAutomation);
  const createAutomation = useStore((s) => s.createAutomation);
  const updateAutomation = useStore((s) => s.updateAutomation);

  const [filterVacancyId, setFilterVacancyId] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const validationErrors = getValidationErrors();
  const canSave = validationErrors.length === 0;

  // Filter automations by selected vacancy
  const filteredAutomations =
    filterVacancyId === "all"
      ? automations
      : automations.filter((r) => r.vacancyId === filterVacancyId);

  // Group by vacancyId
  const vacancyIds = Array.from(new Set(filteredAutomations.map((r) => r.vacancyId)));

  // Stages for form vacancy
  const formStages = form.vacancyId ? getStagesForVacancy(form.vacancyId) : [];

  function buildDescription(ruleId: string) {
    const rule = automations.find((r) => r.id === ruleId);
    if (!rule) return "";
    const stages = getStagesForVacancy(rule.vacancyId);
    const findStage = (id?: string) => stages.find((s) => s.id === id)?.name ?? "?";

    const trigger =
      rule.triggerType === "application_submitted"
        ? "When application submitted"
        : `When enters ${findStage(rule.triggerStageId)}`;

    const action =
      rule.actionType === "send_message"
        ? `→ Send message: "${(rule.actionMessageText ?? "").slice(0, 50)}${(rule.actionMessageText?.length ?? 0) > 50 ? "…" : ""}"`
        : `→ Move to ${findStage(rule.actionStageId)}`;

    return `${trigger}  ${action}`;
  }

  function handleSave() {
    if (!canSave) return;

    if (editingId) {
      updateAutomation(editingId, {
        name: form.name.trim(),
        triggerType: form.triggerType,
        triggerStageId: form.triggerType === "stage_entered" ? form.triggerStageId || undefined : undefined,
        actionType: form.actionType,
        actionStageId: form.actionType === "move_to_stage" ? form.actionStageId || undefined : undefined,
        actionMessageText: form.actionType === "send_message" ? form.actionMessageText || undefined : undefined,
      });
    } else {
      createAutomation(form.vacancyId, {
        name: form.name.trim(),
        isEnabled: true,
        triggerType: form.triggerType,
        triggerStageId: form.triggerType === "stage_entered" ? form.triggerStageId || undefined : undefined,
        actionType: form.actionType,
        actionStageId: form.actionType === "move_to_stage" ? form.actionStageId || undefined : undefined,
        actionMessageText: form.actionType === "send_message" ? form.actionMessageText || undefined : undefined,
      });
    }

    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(false);
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

  return (
    <div className="px-8 py-8 max-w-[760px]">
      <ConfirmDialog
        open={confirmRemoveId !== null}
        title="Delete automation rule?"
        message="This rule will be permanently removed and will no longer fire."
        confirmLabel="Delete"
        onConfirm={() => {
          if (confirmRemoveId) removeAutomation(confirmRemoveId);
          setConfirmRemoveId(null);
        }}
        onCancel={() => setConfirmRemoveId(null)}
      />
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-h1 text-text">Automations</h1>
        <p className="text-body-sm text-muted mt-1">
          Rules that fire automatically when candidates move through the pipeline.
        </p>
      </div>

      {/* Vacancy filter pills */}
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
        {vacancies.map((v) => (
          <button
            key={v.id}
            onClick={() => setFilterVacancyId(v.id)}
            className={`h-8 px-3 rounded-full text-body-sm font-medium border transition-colors ${
              filterVacancyId === v.id
                ? "bg-primary text-primary-fg border-primary"
                : "bg-surface border-border text-muted hover:border-border-strong"
            }`}
          >
            {v.title}
          </button>
        ))}
      </div>

      {/* Rule groups */}
      {filteredAutomations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-body text-muted font-medium">No automation rules yet</p>
          <p className="text-body-sm text-subtle mt-1">
            Add a rule to automatically send messages or move candidates.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {vacancyIds.map((vid) => {
            const vacancy = vacancies.find((v) => v.id === vid);
            const rules = filteredAutomations.filter((r) => r.vacancyId === vid);
            return (
              <section key={vid}>
                {/* Section header */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-body-sm font-semibold text-text">{vacancy?.title ?? "Unknown vacancy"}</span>
                  <span className="text-micro text-subtle bg-surface-2 px-2 py-0.5 rounded-full">
                    {rules.length} {rules.length === 1 ? "rule" : "rules"}
                  </span>
                </div>

                {/* Rule cards */}
                <div className="space-y-2">
                  {rules.map((rule) => (
                    <RuleCard
                      key={rule.id}
                      rule={rule}
                      description={buildDescription(rule.id)}
                      vacancyName={vacancy?.title ?? ""}
                      onToggle={() => toggleAutomation(rule.id)}
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
                      onRemove={() => setConfirmRemoveId(rule.id)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Add rule section */}
      <div className="mt-10">
        {!formOpen ? (
          <button
            onClick={() => setFormOpen(true)}
            className="flex items-center gap-1.5 text-body-sm font-semibold text-primary hover:text-primary-hover transition-colors"
          >
            <span className="text-lg leading-none">+</span> Add rule
          </button>
        ) : (
          <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
            <h2 className="text-h3 text-text">{editingId ? "Edit automation rule" : "New automation rule"}</h2>

            {/* Rule name */}
            <div className="space-y-1">
              <label className="text-body-sm font-medium text-text">Rule name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Welcome message on apply"
                className="w-full h-9 px-3 rounded-lg border border-border bg-surface-2 text-body-sm text-text placeholder:text-subtle focus:outline-none focus:border-primary"
              />
            </div>

            {/* Vacancy */}
            <div className="space-y-1">
              <label className="text-body-sm font-medium text-text">Vacancy</label>
              <select
                value={form.vacancyId}
                disabled={!!editingId}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    vacancyId: e.target.value,
                    triggerStageId: "",
                    actionStageId: "",
                  }))
                }
                className="w-full h-9 px-3 rounded-lg border border-border bg-surface-2 text-body-sm text-text focus:outline-none focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">Select vacancy…</option>
                {vacancies.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Trigger type */}
            <div className="space-y-1">
              <label className="text-body-sm font-medium text-text">Trigger</label>
              <select
                value={form.triggerType}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    triggerType: e.target.value as AutomationTriggerType,
                    triggerStageId: "",
                  }))
                }
                className="w-full h-9 px-3 rounded-lg border border-border bg-surface-2 text-body-sm text-text focus:outline-none focus:border-primary"
              >
                <option value="application_submitted">{TRIGGER_LABELS.application_submitted}</option>
                <option value="stage_entered">{TRIGGER_LABELS.stage_entered}</option>
              </select>
            </div>

            {/* Trigger stage — only when stage_entered */}
            {form.triggerType === "stage_entered" && (
              <div className="space-y-1">
                <label className="text-body-sm font-medium text-text">Stage</label>
                <select
                  value={form.triggerStageId}
                  onChange={(e) => setForm((f) => ({ ...f, triggerStageId: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-surface-2 text-body-sm text-text focus:outline-none focus:border-primary"
                >
                  <option value="">Select stage…</option>
                  {formStages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Action type */}
            <div className="space-y-1">
              <label className="text-body-sm font-medium text-text">Action</label>
              <select
                value={form.actionType}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    actionType: e.target.value as AutomationActionType,
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

            {/* Action stage — only when move_to_stage */}
            {form.actionType === "move_to_stage" && (
              <div className="space-y-1">
                <label className="text-body-sm font-medium text-text">Move to stage</label>
                <select
                  value={form.actionStageId}
                  onChange={(e) => setForm((f) => ({ ...f, actionStageId: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-surface-2 text-body-sm text-text focus:outline-none focus:border-primary"
                >
                  <option value="">Select stage…</option>
                  {formStages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Action message — only when send_message */}
            {form.actionType === "send_message" && (
              <div className="space-y-1">
                <label className="text-body-sm font-medium text-text">Message</label>
                <textarea
                  value={form.actionMessageText}
                  onChange={(e) => setForm((f) => ({ ...f, actionMessageText: e.target.value }))}
                  placeholder="Type the message to send…"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-surface-2 text-body-sm text-text placeholder:text-subtle focus:outline-none focus:border-primary resize-none"
                />
              </div>
            )}

            {/* Buttons */}
            {validationErrors.length > 0 && (
              <div className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2">
                <p className="text-body-sm font-medium text-warning">Finish the rule before saving.</p>
                <ul className="mt-1 space-y-0.5">
                  {validationErrors.map((error) => (
                    <li key={error} className="text-body-sm text-warning">
                      {error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={!canSave}
                className="h-9 px-4 rounded-lg bg-primary text-primary-fg text-body-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary-hover transition-colors"
              >
                {editingId ? "Save changes" : "Save rule"}
              </button>
              <button
                onClick={() => {
                  setEditingId(null);
                  setForm(EMPTY_FORM);
                  setFormOpen(false);
                }}
                className="h-9 px-4 rounded-lg border border-border text-body-sm font-medium text-muted hover:bg-surface-2 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── RuleCard ──────────────────────────────────────────────────────────────────

type RuleCardProps = {
  rule: {
    id: string;
    name: string;
    isEnabled: boolean;
    vacancyId: string;
    triggerType: string;
    triggerStageId?: string;
    actionType: string;
    actionStageId?: string;
    actionMessageText?: string;
  };
  description: string;
  vacancyName: string;
  onToggle: () => void;
  onEdit: () => void;
  onRemove: () => void;
};

function RuleCard({ rule, description, vacancyName, onToggle, onEdit, onRemove }: RuleCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="group flex items-start gap-4 bg-surface border border-border rounded-xl p-4"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Toggle switch */}
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

      {/* Middle: name + description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-body-sm font-semibold text-text">{rule.name}</span>
          <span className="text-micro text-subtle bg-accent-soft px-2 py-0.5 rounded-full">
            {vacancyName}
          </span>
        </div>
        <p className="text-body-sm text-subtle mt-0.5 truncate">{description}</p>
      </div>

      {/* Right: edit + remove buttons (visible on hover) */}
      <div className={`shrink-0 flex items-center gap-1 transition-all ${hovered ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <button
          onClick={onEdit}
          aria-label="Edit rule"
          className="w-7 h-7 flex items-center justify-center rounded-md text-subtle hover:text-primary hover:bg-accent-soft transition-colors"
        >
          ✎
        </button>
        <button
          onClick={onRemove}
          aria-label="Remove rule"
          className="w-7 h-7 flex items-center justify-center rounded-md text-subtle hover:text-danger hover:bg-danger-soft transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
