import { CandidatesList } from "@/components/candidates/CandidatesList";

export const dynamic = "force-dynamic";

export default function CandidatesPage() {
  return (
    <div className="px-8 py-8 max-w-[900px]">
      <div className="mb-6">
        <h1 className="text-h1 text-text">Candidates</h1>
        <p className="text-body-sm text-muted mt-1">
          Cross-vacancy candidate view with application context.
        </p>
      </div>
      <CandidatesList filter="all" />
    </div>
  );
}
