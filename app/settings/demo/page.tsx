export const dynamic = "force-dynamic";

import { DemoControls } from "@/components/settings/DemoControls";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";

export default function DemoPage() {
  return (
    <div>
      <SettingsPageHeader
        title="Demo data"
        description="Switch between demo and live data. The Telegram bot always writes to Live."
      />
      <DemoControls />
    </div>
  );
}
