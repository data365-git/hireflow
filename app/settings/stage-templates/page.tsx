export const dynamic = "force-dynamic";

import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { StageTemplatesList } from "@/components/settings/StageTemplatesList";

export default function StageTemplatesPage() {
  return (
    <div>
      <SettingsPageHeader
        title="Stage Templates"
        description="Reusable pipeline templates you can apply when creating a new vacancy."
      />
      <StageTemplatesList />
    </div>
  );
}
