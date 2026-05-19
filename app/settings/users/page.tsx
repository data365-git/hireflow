import { UsersTable } from "@/components/settings/UsersTable";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function UsersAdminPage() {
  return (
    <ProtectedRoute screen="settings" permission="read">
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">Users</h1>
        <UsersTable />
      </div>
    </ProtectedRoute>
  );
}
