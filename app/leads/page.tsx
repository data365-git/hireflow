export const dynamic = "force-dynamic";

import { listLeads } from "@/app/actions/leads";
import { LeadsView } from "@/components/LeadsView";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default async function LeadsPage() {
  const leads = await listLeads();
  return (
    <ProtectedRoute>
      <LeadsView initialLeads={leads} />
    </ProtectedRoute>
  );
}
