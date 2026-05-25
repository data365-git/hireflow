"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getInboxUnreadCount } from "@/app/actions/messages";
import { SidebarPro } from "@/components/sidebar-pro/sidebar-pro";
import { buildSidebarItems, SIDEBAR_GROUP_ORDER, DEFAULT_PINS } from "@/lib/sidebar-items";
import type { LinkComponentProps } from "@/components/sidebar-pro/types";

function NextLink({ href, onClick, children, className, title, "aria-label": ariaLabel }: LinkComponentProps) {
  return (
    <Link href={href} onClick={onClick} className={className} title={title} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { hasPermission } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    getInboxUnreadCount().then(setUnreadCount).catch(() => setUnreadCount(0));
  }, []);

  const allItems = buildSidebarItems(unreadCount);
  const items = allItems.filter((item) => {
    if (!item.permission) return true;
    return hasPermission(item.permission.screen, item.permission.action);
  });

  const activeId = items.find((item) => {
    const path = item.href?.split("?")[0] ?? "";
    if (path === "/") return pathname === "/";
    return pathname === path || pathname.startsWith(path + "/");
  })?.id;

  return (
    <SidebarPro
      items={items}
      activeId={activeId}
      linkComponent={NextLink}
      storageKey="hireflow-sidebar"
      groupOrder={SIDEBAR_GROUP_ORDER}
      defaultPins={DEFAULT_PINS}
      header={
        <div className="flex items-center gap-3">
          <div className="size-8 bg-primary text-primary-foreground rounded-lg flex items-center justify-center font-extrabold text-base shrink-0">
            H
          </div>
          <div className="min-w-0">
            <div className="font-bold text-sm text-foreground">HireFlow</div>
            <div className="text-xs text-muted-foreground leading-none mt-0.5">HR Pipeline</div>
          </div>
        </div>
      }
      headerCollapsed={
        <div className="size-8 bg-primary text-primary-foreground rounded-lg flex items-center justify-center font-extrabold text-base">
          H
        </div>
      }
      footer={
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Settings className="size-4 shrink-0" />
          <span className="whitespace-nowrap overflow-hidden">Settings</span>
        </Link>
      }
      messages={{
        pinned: "Pinned",
        pin: "Pin",
        unpin: "Unpin",
        showPinnedOnly: "Show pinned only",
        showAll: "Show all",
        collapse: "Collapse sidebar",
        expand: "Expand sidebar",
        reorder: "Reorder",
        noVisiblePinned: "None of your pinned items are visible right now.",
        showEverything: "Show everything",
      }}
    />
  );
}
