import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SettingsSidebar } from "@/components/settings/SettingsSidebar";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="flex h-full">
        <SettingsSidebar />
        <div className="flex-1 overflow-y-auto p-8">{children}</div>
      </div>
    </ProtectedRoute>
  );
}
