export const dynamic = "force-dynamic";

import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import AutomationsPage from "@/app/automations/page";

export default function SettingsAutomationsPage() {
  return (
    <div>
      <SettingsPageHeader
        title="Automations"
        description="Set up automated rules per vacancy."
      />
      <AutomationsPage />
    </div>
  );
}
