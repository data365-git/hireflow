"use client";

import { useState } from "react";
import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DeleteVacancyDialog } from "@/components/vacancies/DeleteVacancyDialog";

type SelectedVacancy = {
  id: string;
  title: string;
  candidateCount?: number;
};

type Props = {
  vacancies: SelectedVacancy[];
  onClear: () => void;
  onDeleted: (vacancyIds: string[]) => void;
};

export function BulkActionToolbar({ vacancies, onClear, onDeleted }: Props) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (vacancies.length === 0) return null;

  return (
    <>
      <div className="fixed bottom-6 left-1/2 z-50 flex min-w-[360px] -translate-x-1/2 items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-lg">
        <span className="text-body-sm font-semibold text-text whitespace-nowrap">
          {vacancies.length} selected
        </span>
        <Button type="button" variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="size-3.5" />
          Delete
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          <X className="size-3.5" />
          Clear
        </Button>
      </div>
      <DeleteVacancyDialog
        open={deleteOpen}
        vacancies={vacancies}
        onClose={() => setDeleteOpen(false)}
        onDeleted={(vacancyIds) => {
          onDeleted(vacancyIds);
          onClear();
        }}
      />
    </>
  );
}
