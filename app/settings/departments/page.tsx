export const dynamic = "force-dynamic";

import { listDepartmentsForSettings } from "@/app/actions/departments";
import { DepartmentsList } from "@/components/settings/DepartmentsList";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";

export default async function DepartmentsSettingsPage() {
  const departments = await listDepartmentsForSettings(true);

  return (
    <div>
      <SettingsPageHeader
        title="Departments"
        description="Manage the department options available when creating vacancies."
      />
      <DepartmentsList initial={departments} />
    </div>
  );
}
