import { RolesList } from "@/components/settings/RolesList";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";

export default function RolesAdminPage() {
  return (
    <ProtectedRoute screen="settings" permission="read">
      <div className="p-8">
        <SettingsPageHeader
          title="Roles"
          description="Define roles and configure permissions for each."
        />
        <RolesList />
      </div>
    </ProtectedRoute>
  );
}
