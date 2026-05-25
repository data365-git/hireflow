import {
  Inbox,
  LayoutDashboard,
  Briefcase,
  Activity,
  Archive,
  Trash2,
  Users,
  Eye,
  CheckCircle2,
  BookMarked,
  Network,
  Ban,
  MessageSquareText,
  BarChart2,
  TrendingUp,
} from "lucide-react";
import type { SidebarItem } from "@/components/sidebar-pro/types";

export function buildSidebarItems(unreadCount: number = 0): SidebarItem[] {
  return [
    {
      id: "/inbox",
      label: "Inbox",
      icon: Inbox,
      href: "/inbox",
      badge: unreadCount > 0 ? { count: unreadCount, tone: "primary" as const } : undefined,
      permission: { screen: "candidates", action: "read" as const },
    },
    // VACANCIES
    { id: "/applications",            label: "Applications",      icon: LayoutDashboard, group: "Vacancies",           href: "/applications",            permission: { screen: "candidates", action: "read" as const } },
    { id: "/vacancies",               label: "All Vacancies",     icon: Briefcase,       group: "Vacancies",           href: "/vacancies",               permission: { screen: "vacancies",  action: "read" as const } },
    { id: "/vacancies?status=active", label: "Active",            icon: Activity,        group: "Vacancies",           href: "/vacancies?status=active", permission: { screen: "vacancies",  action: "read" as const } },
    { id: "/vacancies?status=closed", label: "Closed",            icon: Archive,         group: "Vacancies",           href: "/vacancies?status=closed", permission: { screen: "vacancies",  action: "read" as const } },
    { id: "/vacancies/trash",         label: "Trash",             icon: Trash2,          group: "Vacancies",           href: "/vacancies/trash",         permission: { screen: "vacancies",  action: "delete" as const } },
    // TARGETED RECRUITMENT
    { id: "/candidates",              label: "Candidates",        icon: Users,           group: "Targeted Recruitment", href: "/candidates",              permission: { screen: "candidates", action: "read" as const } },
    { id: "/candidates/monitoring",   label: "Monitoring",        icon: Eye,             group: "Targeted Recruitment", href: "/candidates/monitoring",   permission: { screen: "candidates", action: "read" as const } },
    { id: "/candidates/accepted",     label: "Accepted",          icon: CheckCircle2,    group: "Targeted Recruitment", href: "/candidates/accepted",     permission: { screen: "candidates", action: "read" as const } },
    { id: "/candidates/reserve",      label: "Reserve",           icon: BookMarked,      group: "Targeted Recruitment", href: "/candidates/reserve",      permission: { screen: "candidates", action: "read" as const } },
    { id: "/candidates/related",      label: "Related",           icon: Network,         group: "Targeted Recruitment", href: "/candidates/related",      permission: { screen: "candidates", action: "read" as const } },
    { id: "/candidates/blacklist",    label: "Blacklist",         icon: Ban,             group: "Targeted Recruitment", href: "/candidates/blacklist",    permission: { screen: "candidates", action: "delete" as const } },
    // MASS RECRUITMENT
    { id: "/feedback",                label: "Feedback",          icon: MessageSquareText, group: "Mass Recruitment",  href: "/feedback",                permission: { screen: "feedback",   action: "read" as const } },
    { id: "/analytics",               label: "Reports",           icon: BarChart2,       group: "Mass Recruitment",    href: "/analytics",               permission: { screen: "analytics",  action: "read" as const } },
    { id: "/reports/sources",         label: "Source Performance", icon: TrendingUp,     group: "Mass Recruitment",    href: "/reports/sources",         permission: { screen: "analytics",  action: "read" as const } },
  ];
}

export const SIDEBAR_GROUP_ORDER = ["Vacancies", "Targeted Recruitment", "Mass Recruitment"];
export const DEFAULT_PINS = ["/inbox", "/applications"];
