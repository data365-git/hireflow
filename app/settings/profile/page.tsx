export const dynamic = "force-dynamic";

import { ProfileForm } from "@/components/settings/ProfileForm";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";

export default function ProfilePage() {
  return (
    <div>
      <SettingsPageHeader title="Profile" description="Your account information and password." />
      <ProfileForm />
    </div>
  );
}
