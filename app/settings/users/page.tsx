import { UsersTable } from "@/components/settings/UsersTable";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";

export default function UsersAdminPage() {
  return (
    <ProtectedRoute screen="settings" permission="read">
      <div className="p-8">
        <SettingsPageHeader
          title="Users"
          description="Manage who can sign in and what they can access."
        />
        <UsersTable />
      </div>
    </ProtectedRoute>
  );
}
