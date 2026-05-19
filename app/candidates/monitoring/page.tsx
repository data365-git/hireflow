import { CandidatesList } from "@/components/candidates/CandidatesList";

export const dynamic = "force-dynamic";

export default function MonitoringPage() {
  return (
    <div className="px-8 py-8 max-w-[900px]">
      <div className="mb-6">
        <h1 className="text-h1 text-text">Monitoring</h1>
        <p className="text-body-sm text-muted mt-1">
          Watched applications that HR wants to follow proactively.
        </p>
      </div>
      <CandidatesList filter="monitoring" />
    </div>
  );
}
