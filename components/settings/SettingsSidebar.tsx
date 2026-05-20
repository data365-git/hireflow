"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Users, Shield, Zap, Layers, FlaskConical } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const tabs = [
  { label: "Profile", icon: User, href: "/settings/profile", gated: false },
  { label: "Users", icon: Users, href: "/settings/users", gated: true },
  { label: "Roles", icon: Shield, href: "/settings/roles", gated: true },
  { label: "Automations", icon: Zap, href: "/settings/automations", gated: true },
  { label: "Stage Templates", icon: Layers, href: "/settings/stage-templates", gated: true },
  { label: "Question Templates", icon: Layers, href: "/settings/question-templates", gated: true },
  { label: "Demo", icon: FlaskConical, href: "/settings/demo", gated: true },
];

export function SettingsSidebar() {
  const pathname = usePathname();
  const { hasPermission } = useAuth();

  const visibleTabs = tabs.filter(
    (t) => !t.gated || hasPermission("settings", "read"),
  );

  return (
    <aside className="w-52 border-r border-border py-6 px-3 shrink-0">
      <h2 className="px-3 mb-4 text-xs font-semibold text-subtle uppercase tracking-wider">
        Settings
      </h2>
      <nav className="flex flex-col gap-0.5">
        {visibleTabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-primary-soft text-primary font-medium before:absolute before:left-0 before:inset-y-1 before:w-0.5 before:rounded-full before:bg-primary"
                  : "text-muted hover:bg-surface-2"
              }`}
            >
              <tab.icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
