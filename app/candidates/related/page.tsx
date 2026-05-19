import { CandidatesList } from "@/components/candidates/CandidatesList";

export const dynamic = "force-dynamic";

export default function RelatedPage() {
  return (
    <div className="px-8 py-8 max-w-[900px]">
      <div className="mb-6">
        <h1 className="text-h1 text-text">Related</h1>
        <p className="text-body-sm text-muted mt-1">
          Candidates linked by referral, family, alumni, or other HR-known relationships.
        </p>
      </div>
      <CandidatesList filter="related" />
    </div>
  );
}
