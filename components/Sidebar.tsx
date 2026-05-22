"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ComponentType } from "react";
import { Suspense, useEffect, useState } from "react";
import { getInboxUnreadCount } from "@/app/actions/messages";
import { useSidebarCollapsed } from "@/lib/hooks/useSidebarCollapsed";
import { Tooltip } from "@/components/ui/Tooltip";
import {
  Archive,
  Ban,
  BarChart2,
  Briefcase,
  CheckCircle2,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  Eye,
  Inbox,
  ListChecks,
  MessageSquareText,
  Network,
  Settings,
  TrendingUp,
  Trash2,
  Users,
} from "lucide-react";

type IconComponent = ComponentType<{
  className?: string;
  strokeWidth?: number;
}>;

type NavItem = {
  href: string;
  label: string;
  Icon: IconComponent;
  badge?: number;
  exact?: boolean;
  activeWhen?: (pathname: string, status: string | null) => boolean;
};

type NavGroup = {
  label: string;
  Icon: IconComponent;
  items: NavItem[];
};

function isActive(
  item: Pick<NavItem, "href" | "exact" | "activeWhen">,
  pathname: string,
  status: string | null
): boolean {
  if (item.activeWhen) return item.activeWhen(pathname, status);
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavLink({
  href,
  label,
  Icon,
  badge,
  exact,
  activeWhen,
  collapsed,
}: NavItem & { collapsed: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = isActive({ href, exact, activeWhen }, pathname, searchParams.get("status"));

  const link = (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative flex h-8 items-center rounded-lg text-body-sm font-medium transition-all ${
        collapsed ? "w-9 justify-center px-0" : "gap-2.5 px-3"
      } ${
        active
          ? "bg-primary/10 text-primary"
          : "text-muted hover:text-text hover:bg-surface-2"
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-primary rounded-r" />
      )}
      <Icon className="size-4 shrink-0" strokeWidth={active ? 2.5 : 2} />
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {badge != null && !collapsed && (
        <span
          className={`text-micro rounded-full px-1.5 min-w-[18px] h-[18px] inline-flex items-center justify-center font-semibold ${
            active ? "bg-primary text-primary-fg" : "bg-surface-3 text-muted"
          }`}
        >
          {badge}
        </span>
      )}
      {badge != null && collapsed && (
        <span className="absolute right-1 top-1 size-2 rounded-full bg-danger" />
      )}
    </Link>
  );

  return collapsed ? <Tooltip content={label}>{link}</Tooltip> : link;
}

function GroupHeader({ group, collapsed }: { group: NavGroup; collapsed: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const active = group.items.some((item) => isActive(item, pathname, status));
  const GroupIcon = group.Icon;

  if (collapsed) {
    return (
      <div className="py-2">
        <div className="mx-auto h-px w-7 bg-border" />
      </div>
    );
  }

  return (
    <div className="relative flex items-center gap-2 px-3 pt-3 pb-1">
      {active && <span className="absolute left-0 top-3 bottom-1 w-0.5 bg-primary rounded-r" />}
      <GroupIcon className="size-3.5 text-subtle" strokeWidth={2} />
      <p
        className={`text-micro uppercase tracking-widest ${
          active ? "text-primary font-semibold" : "text-subtle"
        }`}
      >
        {group.label}
      </p>
    </div>
  );
}

const groups: NavGroup[] = [
  {
    label: "Vacancies",
    Icon: Briefcase,
    items: [
      {
        href: "/applications",
        label: "Applications",
        Icon: ClipboardList,
        exact: true,
      },
      {
        href: "/vacancies",
        label: "All Vacancies",
        Icon: Briefcase,
        activeWhen: (pathname, status) =>
          !status && (pathname === "/vacancies" || (pathname.startsWith("/vacancies/") && !pathname.startsWith("/vacancies/trash"))),
      },
      {
        href: "/vacancies?status=active",
        label: "Active",
        Icon: ListChecks,
        activeWhen: (pathname, status) => pathname === "/vacancies" && status === "active",
      },
      {
        href: "/vacancies?status=closed",
        label: "Closed",
        Icon: Archive,
        activeWhen: (pathname, status) => pathname === "/vacancies" && status === "closed",
      },
      {
        href: "/vacancies/trash",
        label: "Trash",
        Icon: Trash2,
      },
    ],
  },
  {
    label: "Targeted Recruitment",
    Icon: Users,
    items: [
      { href: "/candidates", label: "Candidates", Icon: Users, exact: true },
      { href: "/candidates/monitoring", label: "Monitoring", Icon: Eye },
      { href: "/candidates/accepted", label: "Accepted", Icon: CheckCircle2 },
      { href: "/candidates/reserve", label: "Reserve", Icon: Archive },
      { href: "/candidates/related", label: "Related", Icon: Network },
      { href: "/candidates/blacklist", label: "Blacklist", Icon: Ban },
    ],
  },
  {
    label: "Mass Recruitment",
    Icon: MessageSquareText,
    items: [
      { href: "/feedback", label: "Feedback", Icon: MessageSquareText },
      { href: "/analytics", label: "Reports", Icon: BarChart2 },
      { href: "/reports/sources", label: "Source Performance", Icon: TrendingUp },
    ],
  },
];

function SidebarContent() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [collapsed, setCollapsed] = useSidebarCollapsed();

  useEffect(() => {
    getInboxUnreadCount().then(setUnreadCount).catch(() => setUnreadCount(0));
  }, []);

  return (
    <aside
      className={`hidden shrink-0 bg-bg border-r border-border lg:flex flex-col h-screen sticky top-0 z-40 transition-[width] duration-200 ${
        collapsed ? "w-16" : "w-60"
      }`}
      suppressHydrationWarning
    >
      <div
        className={`h-14 flex items-center border-b border-border shrink-0 ${
          collapsed ? "justify-center px-2" : "gap-3 px-5"
        }`}
      >
        <div className="size-8 bg-primary text-primary-fg rounded-lg flex shrink-0 items-center justify-center font-extrabold text-body">
          H
        </div>
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1">
              <span className="font-bold text-body text-text">HireFlow</span>
              <p className="text-micro text-subtle leading-none mt-0.5">HR Pipeline</p>
            </div>
            <button
              type="button"
              aria-expanded={!collapsed}
              aria-label="Collapse sidebar"
              className="size-7 shrink-0 rounded-md flex items-center justify-center text-muted transition-colors hover:bg-surface-2 hover:text-text"
              onClick={() => setCollapsed(true)}
            >
              <ChevronsLeft className="size-4" />
            </button>
          </>
        )}
      </div>

      <nav
        className={`flex-1 py-3 space-y-0.5 overflow-y-auto ${
          collapsed ? "px-1.5" : "px-3"
        }`}
      >
        <NavLink
          href="/inbox"
          label="Inbox"
          Icon={Inbox}
          badge={unreadCount > 0 ? unreadCount : undefined}
          exact
          collapsed={collapsed}
        />

        {groups.map((group) => (
          <div key={group.label}>
            <GroupHeader group={group} collapsed={collapsed} />
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink key={item.href} {...item} collapsed={collapsed} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className={`shrink-0 space-y-1 pb-3 ${collapsed ? "px-1.5" : "px-3"}`}>
        <NavLink href="/settings" label="Settings" Icon={Settings} collapsed={collapsed} />
        {collapsed && (
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-label="Expand sidebar"
            className="mx-auto flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text"
            onClick={() => setCollapsed(false)}
          >
            <ChevronsRight className="size-4" />
          </button>
        )}
      </div>
    </aside>
  );
}

export function Sidebar() {
  return (
    <Suspense fallback={<div className="hidden w-60 shrink-0 border-r border-border bg-bg lg:block" />}>
      <SidebarContent />
    </Suspense>
  );
}
