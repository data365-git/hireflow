import { listBotTestUsers } from "@/app/actions/bot-test-users";
import { TestUsersList } from "@/components/settings/TestUsersList";

export const dynamic = "force-dynamic";

export default async function TestUsersPage() {
  const users = await listBotTestUsers();
  return (
    <div className="px-8 py-8 max-w-[900px]">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text">Bot Test Users</h1>
        <p className="text-sm text-muted mt-1">
          Telegram users listed here bypass the bot&apos;s duplicate-application check and can use{" "}
          <code className="bg-surface-2 px-1 rounded text-xs">/reset</code> for testing. Remove
          them when testing is done.
        </p>
      </div>
      <TestUsersList initial={users} />
    </div>
  );
}
