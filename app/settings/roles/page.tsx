import { RolesList } from "@/components/settings/RolesList";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function RolesAdminPage() {
  return (
    <ProtectedRoute screen="settings" permission="read">
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">Roles &amp; Permissions</h1>
        <RolesList />
      </div>
    </ProtectedRoute>
  );
}
