export const dynamic = "force-dynamic";

import { DemoControls } from "@/components/settings/DemoControls";

export default function DemoPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold mb-2">Demo data</h1>
      <p className="text-sm text-gray-500 mb-6">
        Toggle between demo and live data. The Telegram bot always writes to Live.
      </p>
      <DemoControls />
    </div>
  );
}
