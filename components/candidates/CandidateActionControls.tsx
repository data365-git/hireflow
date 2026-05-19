"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, ShieldAlert, Star, Trash2, X } from "lucide-react";
import {
  addCandidateRelationship,
  addCandidateToBlacklist,
  getCandidateActionState,
  removeCandidateFromBlacklist,
  removeCandidateRelationship,
  unwatchApplication,
  watchApplication,
  type CandidateActionState,
  type CandidateOption,
  type CandidateRelationshipRow,
  type RelationshipType,
} from "@/app/actions/candidate-actions";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

type Props = {
  applicationId: string;
  candidateId: string;
  candidateName: string;
  initialIsWatched: boolean;
  initialIsBlacklisted: boolean;
  initialBlacklistReason?: string | null;
  compact?: boolean;
  showRelationships?: boolean;
};

const RELATIONSHIP_TYPES: Array<{ value: RelationshipType; label: string }> = [
  { value: "referral", label: "Referral" },
  { value: "family", label: "Family" },
  { value: "alumni", label: "Company alumni" },
  { value: "other", label: "Other" },
];

export function CandidateActionControls({
  applicationId,
  candidateId,
  candidateName,
  initialIsWatched,
  initialIsBlacklisted,
  initialBlacklistReason,
  compact = false,
  showRelationships = false,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [isWatched, setIsWatched] = useState(initialIsWatched);
  const [isBlacklisted, setIsBlacklisted] = useState(initialIsBlacklisted);
  const [blacklistReason, setBlacklistReason] = useState(initialBlacklistReason ?? "");
  const [blacklistDialogOpen, setBlacklistDialogOpen] = useState(false);
  const [draftReason, setDraftReason] = useState(initialBlacklistReason ?? "");
  const [error, setError] = useState<string | null>(null);
  const [relationships, setRelationships] = useState<CandidateRelationshipRow[]>([]);
  const [relationshipOptions, setRelationshipOptions] = useState<CandidateOption[]>([]);
  const [relatedCandidateId, setRelatedCandidateId] = useState("");
  const [relationshipType, setRelationshipType] = useState<RelationshipType>("referral");
  const [relationshipNote, setRelationshipNote] = useState("");

  useEffect(() => {
    setIsWatched(initialIsWatched);
    setIsBlacklisted(initialIsBlacklisted);
    setBlacklistReason(initialBlacklistReason ?? "");
    setDraftReason(initialBlacklistReason ?? "");
  }, [initialIsWatched, initialIsBlacklisted, initialBlacklistReason]);

  useEffect(() => {
    if (!showRelationships) return;
    let alive = true;
    getCandidateActionState(applicationId)
      .then((state: CandidateActionState) => {
        if (!alive) return;
        setIsWatched(state.isWatched);
        setIsBlacklisted(state.isBlacklisted);
        setBlacklistReason(state.blacklistReason ?? "");
        setRelationships(state.relationships);
        setRelationshipOptions(state.relationshipOptions);
        setRelatedCandidateId(state.relationshipOptions[0]?.id ?? "");
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : "Failed to load candidate actions");
      });
    return () => {
      alive = false;
    };
  }, [applicationId, showRelationships]);

  const canCreateRelationship = useMemo(
    () => Boolean(relatedCandidateId && relatedCandidateId !== candidateId),
    [candidateId, relatedCandidateId],
  );

  function run(action: () => Promise<void>, onSuccess?: () => void | Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        await onSuccess?.();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
      }
    });
  }

  function handleToggleWatch() {
    if (isWatched) {
      run(() => unwatchApplication(applicationId), () => setIsWatched(false));
      return;
    }
    run(() => watchApplication(applicationId), () => setIsWatched(true));
  }

  function handleBlacklistSave() {
    const reason = draftReason.trim();
    if (!reason) {
      setError("Blacklist reason is required");
      return;
    }
    run(
      () => addCandidateToBlacklist(candidateId, reason),
      () => {
        setIsBlacklisted(true);
        setBlacklistReason(reason);
        setBlacklistDialogOpen(false);
      },
    );
  }

  function handleRemoveBlacklist() {
    run(
      () => removeCandidateFromBlacklist(candidateId),
      () => {
        setIsBlacklisted(false);
        setBlacklistReason("");
        setDraftReason("");
      },
    );
  }

  function handleCreateRelationship() {
    if (!canCreateRelationship) return;
    run(
      () =>
        addCandidateRelationship({
          candidateAId: candidateId,
          candidateBId: relatedCandidateId,
          type: relationshipType,
          note: relationshipNote,
        }),
      async () => {
        const state = await getCandidateActionState(applicationId);
        setRelationships(state.relationships);
        setRelationshipOptions(state.relationshipOptions);
        setRelatedCandidateId(state.relationshipOptions[0]?.id ?? "");
        setRelationshipType("referral");
        setRelationshipNote("");
      },
    );
  }

  function handleRemoveRelationship(relationshipId: string) {
    run(
      () => removeCandidateRelationship(relationshipId),
      () => setRelationships((current) => current.filter((relationship) => relationship.id !== relationshipId)),
    );
  }

  const buttonClass = compact
    ? "h-7 px-2 rounded-md text-micro"
    : "w-full justify-start h-8 px-3 rounded-lg text-body-sm";

  return (
    <div className={compact ? "flex items-center gap-1.5" : "space-y-2"}>
      <button
        type="button"
        onClick={handleToggleWatch}
        disabled={pending}
        title={isWatched ? "Remove from Monitoring" : "Add to Monitoring"}
        className={`${buttonClass} inline-flex items-center gap-2 transition-colors disabled:opacity-50 ${
          isWatched
            ? "bg-primary/10 text-primary hover:bg-primary/15"
            : "text-muted hover:text-text hover:bg-surface-2"
        }`}
      >
        <Star className="size-4" fill={isWatched ? "currentColor" : "none"} />
        {!compact && <span>{isWatched ? "Monitoring" : "Monitor"}</span>}
      </button>

      {isBlacklisted ? (
        <button
          type="button"
          onClick={handleRemoveBlacklist}
          disabled={pending}
          title={blacklistReason ? `Blacklisted: ${blacklistReason}` : "Remove from blacklist"}
          className={`${buttonClass} inline-flex items-center gap-2 bg-danger-soft text-danger hover:bg-danger hover:text-white transition-colors disabled:opacity-50`}
        >
          <ShieldAlert className="size-4" />
          {!compact && <span>Remove blacklist</span>}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setBlacklistDialogOpen(true)}
          disabled={pending}
          title="Add to blacklist"
          className={`${buttonClass} inline-flex items-center gap-2 text-muted hover:text-danger hover:bg-danger-soft transition-colors disabled:opacity-50`}
        >
          <ShieldAlert className="size-4" />
          {!compact && <span>Blacklist</span>}
        </button>
      )}

      {!compact && error && <p className="text-micro text-danger">{error}</p>}

      {showRelationships && !compact && (
        <div className="pt-3 mt-3 border-t border-border">
          <p className="text-micro text-subtle uppercase tracking-wider mb-2">Related candidates</p>
          {relationships.length === 0 ? (
            <p className="text-body-sm text-subtle mb-3">No related candidates yet.</p>
          ) : (
            <div className="space-y-2 mb-3">
              {relationships.map((relationship) => (
                <div
                  key={relationship.id}
                  className="flex items-start gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2"
                >
                  <Link2 className="size-4 text-muted mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-body-sm text-text font-medium truncate">
                      {relationship.relatedCandidateName}
                    </p>
                    <p className="text-micro text-muted">
                      {RELATIONSHIP_TYPES.find((item) => item.value === relationship.type)?.label ?? relationship.type}
                      {relationship.note ? ` · ${relationship.note}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveRelationship(relationship.id)}
                    disabled={pending}
                    title="Remove relationship"
                    className="text-subtle hover:text-danger transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <select
              value={relatedCandidateId}
              onChange={(event) => setRelatedCandidateId(event.target.value)}
              className="w-full h-8 rounded-lg border border-border bg-surface text-body-sm text-text px-3 outline-none focus:border-primary"
            >
              {relationshipOptions.length === 0 ? (
                <option value="">No candidates available</option>
              ) : (
                relationshipOptions.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.fullName} (@{candidate.telegramUsername})
                  </option>
                ))
              )}
            </select>
            <select
              value={relationshipType}
              onChange={(event) => setRelationshipType(event.target.value as RelationshipType)}
              className="w-full h-8 rounded-lg border border-border bg-surface text-body-sm text-text px-3 outline-none focus:border-primary"
            >
              {RELATIONSHIP_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <input
              value={relationshipNote}
              onChange={(event) => setRelationshipNote(event.target.value)}
              placeholder="Optional note"
              className="w-full h-8 rounded-lg border border-border bg-surface text-body-sm text-text px-3 outline-none focus:border-primary"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending || !canCreateRelationship}
              onClick={handleCreateRelationship}
              className="w-full"
            >
              <Link2 className="size-3.5" />
              Link candidate
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={blacklistDialogOpen}
        onClose={() => setBlacklistDialogOpen(false)}
        title={`Blacklist ${candidateName}`}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-body-sm text-muted">
            Existing applications stay visible to HR with blacklist status. New bot applications will be blocked.
          </p>
          <textarea
            value={draftReason}
            onChange={(event) => setDraftReason(event.target.value)}
            autoFocus
            rows={4}
            placeholder="Reason visible to HR"
            className="w-full resize-none rounded-lg border border-border bg-surface text-body-sm text-text placeholder:text-subtle px-3 py-2 outline-none focus:border-primary"
          />
          {error && <p className="text-micro text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setBlacklistDialogOpen(false)}>
              <X className="size-4" />
              Cancel
            </Button>
            <Button type="button" variant="danger" disabled={pending || !draftReason.trim()} onClick={handleBlacklistSave}>
              <ShieldAlert className="size-4" />
              Blacklist
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
