"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { getInboxUnreadCount } from "@/app/actions/messages";
import {
  Archive,
  Ban,
  BarChart2,
  Briefcase,
  CheckCircle2,
  ClipboardList,
  Eye,
  Inbox,
  ListChecks,
  MessageSquareText,
  Network,
  Settings,
  Users,
} from "lucide-react";

type IconComponent = React.ComponentType<{
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

function NavLink({ href, label, Icon, badge, exact, activeWhen }: NavItem) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = isActive({ href, exact, activeWhen }, pathname, searchParams.get("status"));

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
      <span className="flex-1 truncate">{label}</span>
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

function GroupHeader({ group }: { group: NavGroup }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const active = group.items.some((item) => isActive(item, pathname, status));
  const GroupIcon = group.Icon;

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
        activeWhen: (pathname, status) => pathname.startsWith("/vacancies") && !status,
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
    ],
  },
];

function SidebarContent() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    getInboxUnreadCount().then(setUnreadCount).catch(() => setUnreadCount(0));
  }, []);

  return (
    <aside className="w-60 shrink-0 bg-bg border-r border-border flex flex-col h-screen sticky top-0 z-40">
      <div className="h-14 px-5 flex items-center gap-3 border-b border-border shrink-0">
        <div className="size-8 bg-primary text-primary-fg rounded-lg flex items-center justify-center font-extrabold text-body">
          H
        </div>
        <div>
          <span className="font-bold text-body text-text">HireFlow</span>
          <p className="text-micro text-subtle leading-none mt-0.5">HR Pipeline</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        <NavLink
          href="/inbox"
          label="Inbox"
          Icon={Inbox}
          badge={unreadCount > 0 ? unreadCount : undefined}
          exact
        />

        {groups.map((group) => (
          <div key={group.label}>
            <GroupHeader group={group} />
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 pb-3 shrink-0">
        <NavLink href="/settings" label="Settings" Icon={Settings} />
      </div>
    </aside>
  );
}

export function Sidebar() {
  return (
    <Suspense fallback={<div className="w-60 shrink-0 border-r border-border bg-bg" />}>
      <SidebarContent />
    </Suspense>
  );
}
