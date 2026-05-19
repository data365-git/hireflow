export const dynamic = "force-dynamic";

import { listLeads } from "@/app/actions/leads";
import { LeadsView } from "@/components/LeadsView";

export default async function LeadsPage() {
  const leads = await listLeads();
  return <LeadsView initialLeads={leads} />;
}
