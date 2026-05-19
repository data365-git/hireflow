"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";
import {
  LayoutDashboard,
  Inbox,
  Briefcase,
  BarChart2,
  Settings,
  Zap,
  Users,
} from "lucide-react";

function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/vacancies") return pathname.startsWith("/vacancies") || pathname.startsWith("/candidates");
  return pathname.startsWith(href);
}

type NavItem = {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  badge?: number;
};

function NavLink({ href, label, Icon, badge }: NavItem) {
  const pathname = usePathname();
  const active = isActive(href, pathname);

  return (
    <Link
      href={href}
      className={`relative flex items-center gap-2.5 h-8 px-3 rounded-lg text-body-sm font-medium transition-all ${
        active
          ? "bg-primary/10 text-primary"
          : "text-muted hover:text-text hover:bg-surface-2"
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-primary rounded-r" />
      )}
      <Icon className="size-4 shrink-0" strokeWidth={active ? 2.5 : 2} />
      <span className="flex-1">{label}</span>
      {badge != null && (
        <span
          className={`text-micro rounded-full px-1.5 min-w-[18px] h-[18px] inline-flex items-center justify-center font-semibold ${
            active ? "bg-primary text-primary-fg" : "bg-surface-3 text-muted"
          }`}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

export function Sidebar() {
  const users = useStore((s) => s.users);
  const currentUserId = useStore((s) => s.currentUserId);
  const simulateIncomingApplication = useStore((s) => s.simulateIncomingApplication);
  const getUnreadCount = useStore((s) => s.getUnreadCount);

  const unreadCount = getUnreadCount();
  const currentUser = users.find((u) => u.id === currentUserId);

  return (
    <aside className="w-60 shrink-0 bg-bg border-r border-border flex flex-col h-screen sticky top-0 z-40">
      {/* Logo — 56px */}
      <div className="h-14 px-5 flex items-center gap-3 border-b border-border shrink-0">
        <div className="size-8 bg-primary text-primary-fg rounded-lg flex items-center justify-center font-extrabold text-body">
          H
        </div>
        <div>
          <span className="font-bold text-body text-text">HireFlow</span>
          <p className="text-micro text-subtle leading-none mt-0.5">HR Pipeline</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {/* MY WORK */}
        <p className="text-micro text-subtle uppercase tracking-widest px-3 mb-1 mt-1">My Work</p>
        <NavLink href="/" label="My Pipeline" Icon={LayoutDashboard} />
        <NavLink href="/leads" label="Leads" Icon={Users} />
        <NavLink href="/inbox" label="Inbox" Icon={Inbox} badge={unreadCount > 0 ? unreadCount : undefined} />

        {/* MANAGE */}
        <p className="text-micro text-subtle uppercase tracking-widest px-3 mb-1 mt-3">Manage</p>
        <NavLink href="/vacancies" label="Vacancies" Icon={Briefcase} />
        <NavLink href="/analytics" label="Analytics" Icon={BarChart2} />
      </nav>

      {/* Demo section */}
      <div className="px-3 pb-2 border-t border-border pt-3 shrink-0">
        <p className="text-micro text-subtle uppercase tracking-widest px-3 mb-1">Demo</p>
        <button
          onClick={() => simulateIncomingApplication("v1")}
          className="w-full flex items-center gap-2.5 h-8 px-3 rounded-lg text-body-sm text-primary hover:bg-primary/10 transition-colors font-medium"
        >
          <Zap className="size-4 shrink-0" strokeWidth={2} />
          Simulate application
        </button>
      </div>

      {/* Settings */}
      <div className="px-3 pb-2 shrink-0">
        <NavLink href="/automations" label="Automations" Icon={Settings} />
      </div>

      {/* User profile */}
      <div className="px-3 py-3 border-t border-border shrink-0">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-surface-2 transition-colors cursor-pointer">
          <div
            className="size-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ backgroundColor: "#7C3AED" }}
          >
            {currentUser?.avatarInitials ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-body-sm font-semibold text-text truncate">{currentUser?.name ?? "HR Manager"}</p>
            <p className="text-micro text-subtle capitalize truncate">{currentUser?.role ?? "hr"}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
