import { CandidatesList } from "@/components/candidates/CandidatesList";

export const dynamic = "force-dynamic";

export default function BlacklistPage() {
  return (
    <div className="px-8 py-8 max-w-[900px]">
      <div className="mb-6">
        <h1 className="text-h1 text-text">Blacklist</h1>
        <p className="text-body-sm text-muted mt-1">
          Globally blocked candidates; existing applications remain visible to HR.
        </p>
      </div>
      <CandidatesList filter="blacklist" />
    </div>
  );
}
