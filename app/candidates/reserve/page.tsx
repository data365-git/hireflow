import { CandidatesList } from "@/components/candidates/CandidatesList";

export const dynamic = "force-dynamic";

export default function ReservePage() {
  return (
    <div className="px-8 py-8 max-w-[900px]">
      <div className="mb-6">
        <h1 className="text-h1 text-text">Reserve</h1>
        <p className="text-body-sm text-muted mt-1">
          Strong candidates kept warm for future openings.
        </p>
      </div>
      <CandidatesList filter="reserve" />
    </div>
  );
}
