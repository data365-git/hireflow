"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const tabs = [
  { label: "Profile", icon: "👤", href: "/settings/profile", gated: false },
  { label: "Users", icon: "👥", href: "/settings/users", gated: true },
  { label: "Roles", icon: "🛡", href: "/settings/roles", gated: true },
  { label: "Automations", icon: "⚡", href: "/settings/automations", gated: true },
  { label: "Demo", icon: "🧪", href: "/settings/demo", gated: true },
];

export function SettingsSidebar() {
  const pathname = usePathname();
  const { hasPermission } = useAuth();

  const visibleTabs = tabs.filter(
    (t) => !t.gated || hasPermission("settings", "read"),
  );

  return (
    <aside className="w-52 border-r border-gray-100 py-6 px-3 shrink-0">
      <h2 className="px-3 mb-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Settings
      </h2>
      <nav className="flex flex-col gap-0.5">
        {visibleTabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
