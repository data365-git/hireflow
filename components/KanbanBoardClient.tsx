"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";

type Props = {
  vacancyId: string;
  selectedAppIds: Set<string>;
  onToggleSelect: (appId: string) => void;
  filteredAppIds?: Set<string>;
};

export function KanbanBoardClient({ vacancyId, selectedAppIds, onToggleSelect, filteredAppIds }: Props) {
  const router = useRouter();

  // Auto-refresh every 10 seconds to pick up new applications from the bot
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(id);
  }, [router]);

  return (
    <KanbanBoard
      vacancyId={vacancyId}
      selectedAppIds={selectedAppIds}
      onToggleSelect={onToggleSelect}
      filteredAppIds={filteredAppIds}
    />
  );
}
