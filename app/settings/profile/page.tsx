export const dynamic = "force-dynamic";

import { ProfileForm } from "@/components/settings/ProfileForm";

export default function ProfilePage() {
  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Profile</h1>
      <ProfileForm />
    </div>
  );
}
