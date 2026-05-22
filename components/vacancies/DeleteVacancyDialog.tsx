"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { toast } from "@/lib/hooks/useToast";
import { useAuth } from "@/context/AuthContext";
import * as vacancyActions from "@/app/actions/vacancies";

type VacancyDeleteTarget = {
  id: string;
  title: string;
  candidateCount?: number;
};

type DeletionCounts = {
  total?: number;
  active?: number;
  candidates?: number;
  applications?: number;
  activeCandidates?: number;
  notifiedCandidates?: number;
  stageCounts?: Array<{ stageId: string; stageName: string; count: number }>;
};

type VacancyDeletionActions = {
  softDeleteVacancy?: (
    vacancyId: string,
    options?: { notifyCandidates?: boolean },
  ) => Promise<unknown>;
  bulkSoftDeleteVacancies?: (
    vacancyIds: string[],
    options?: { notifyCandidates?: boolean },
  ) => Promise<unknown>;
  getVacancyDeletionCounts?: (vacancyId: string) => Promise<DeletionCounts>;
};

type Props = {
  open: boolean;
  vacancies: VacancyDeleteTarget[];
  onClose: () => void;
  onDeleted?: (vacancyIds: string[]) => void;
  redirectToVacancies?: boolean;
};

const actions = vacancyActions as typeof vacancyActions & VacancyDeletionActions;

function getCandidateCount(counts: DeletionCounts | null, fallback: number) {
  return counts?.total ?? counts?.candidates ?? counts?.applications ?? counts?.activeCandidates ?? fallback;
}

function getActionError(result: unknown) {
  if (!result || typeof result !== "object" || !("ok" in result) || result.ok !== false) return null;
  const error = (result as { error?: unknown }).error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Could not delete vacancy.";
}

function getFailedIds(result: unknown) {
  if (!result || typeof result !== "object" || !("failed" in result)) return [];
  const failed = (result as { failed?: unknown }).failed;
  if (!Array.isArray(failed)) return [];
  return failed
    .map((item) => (item && typeof item === "object" && "id" in item ? item.id : null))
    .filter((id): id is string => typeof id === "string");
}

export function DeleteVacancyDialog({
  open,
  vacancies,
  onClose,
  onDeleted,
  redirectToVacancies = false,
}: Props) {
  const router = useRouter();
  const [notifyCandidates, setNotifyCandidates] = useState(false);
  const [counts, setCounts] = useState<DeletionCounts | null>(null);
  const [countsLoading, setCountsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isBulk = vacancies.length > 1;
  const primaryVacancy = vacancies[0];
  const fallbackCandidateCount = useMemo(
    () => vacancies.reduce((sum, vacancy) => sum + (vacancy.candidateCount ?? 0), 0),
    [vacancies],
  );
  const candidateCount = getCandidateCount(counts, fallbackCandidateCount);

  useEffect(() => {
    if (!open) {
      setCounts(null);
      setCountsLoading(false);
      setError(null);
      setNotifyCandidates(false);
      return;
    }

    if (isBulk || !primaryVacancy || !actions.getVacancyDeletionCounts) return;

    setCountsLoading(true);
    actions
      .getVacancyDeletionCounts(primaryVacancy.id)
      .then(setCounts)
      .catch(() => setCounts(null))
      .finally(() => setCountsLoading(false));
  }, [isBulk, open, primaryVacancy]);

  function handleDelete() {
    if (vacancies.length === 0) return;

    startTransition(async () => {
      setError(null);
      try {
        const vacancyIds = vacancies.map((vacancy) => vacancy.id);
        let result: unknown;
        if (isBulk) {
          if (!actions.bulkSoftDeleteVacancies) throw new Error("Bulk delete action is not available yet.");
          result = await actions.bulkSoftDeleteVacancies(vacancyIds, { notifyCandidates });
        } else {
          if (!actions.softDeleteVacancy) throw new Error("Delete action is not available yet.");
          result = await actions.softDeleteVacancy(vacancyIds[0], { notifyCandidates });
        }

        const actionError = getActionError(result);
        if (actionError) throw new Error(actionError);

        const failedIds = getFailedIds(result);
        const deletedIds = failedIds.length > 0 ? vacancyIds.filter((id) => !failedIds.includes(id)) : vacancyIds;
        if (deletedIds.length === 0) throw new Error("Could not delete selected vacancies.");

        onDeleted?.(deletedIds);
        if (failedIds.length > 0) {
          toast.show({
            message: `${deletedIds.length} deleted, ${failedIds.length} failed`,
            type: "warning",
            duration: 4000,
          });
        } else {
          toast.success(isBulk ? "Vacancies deleted" : "Vacancy deleted");
        }
        onClose();

        if (redirectToVacancies) {
          router.push("/vacancies");
        } else {
          router.refresh();
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not delete vacancy.";
        setError(message);
        toast.error(message);
      }
    });
  }

  if (!primaryVacancy) return null;

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!isPending) onClose();
      }}
      title={isBulk ? "Delete vacancies" : "Delete vacancy"}
      size="sm"
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-3 text-body-sm text-danger">
          {isBulk ? (
            <span>
              Delete {vacancies.length} selected vacancies? They will be hidden from active vacancy lists.
            </span>
          ) : (
            <span>
              Delete "{primaryVacancy.title}"? It will be hidden from active vacancy lists.
            </span>
          )}
        </div>

        <div className="space-y-2 text-body-sm text-muted">
          <p>
            {countsLoading
              ? "Checking connected candidate counts..."
              : `${candidateCount} candidate${candidateCount === 1 ? "" : "s"} will stay in the system and remain tied to this vacancy history.`}
          </p>
          <Checkbox
            id={isBulk ? "notify-bulk-vacancy-candidates" : "notify-vacancy-candidates"}
            checked={notifyCandidates}
            onChange={(event) => setNotifyCandidates(event.currentTarget.checked)}
            label="Notify candidates about this vacancy closure"
            disabled={isPending}
          />
        </div>

        {error && <p className="text-body-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={handleDelete} disabled={isPending}>
            <Trash2 className="size-4" />
            {isPending ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export function DeleteVacancyButton({
  vacancy,
  candidateCount,
  className,
  redirectToVacancies = false,
  onDeleted,
}: {
  vacancy: { id: string; title: string };
  candidateCount?: number;
  className?: string;
  redirectToVacancies?: boolean;
  onDeleted?: (vacancyIds: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="danger"
        size="sm"
        className={className}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
        title="Delete vacancy"
      >
        <Trash2 className="size-3.5" />
        Delete
      </Button>
      <DeleteVacancyDialog
        open={open}
        vacancies={[{ ...vacancy, candidateCount }]}
        onClose={() => setOpen(false)}
        onDeleted={onDeleted}
        redirectToVacancies={redirectToVacancies}
      />
    </>
  );
}

export function PermissionedDeleteVacancyButton(
  props: Parameters<typeof DeleteVacancyButton>[0],
) {
  const { hasPermission, permissionsLoaded } = useAuth();

  if (!permissionsLoaded || !hasPermission("vacancies", "delete")) return null;

  return <DeleteVacancyButton {...props} />;
}
