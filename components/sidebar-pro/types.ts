import type { ComponentType, ReactNode } from "react";

/**
 * A single navigation entry. `id` is the stable key used in pin storage —
 * for routed apps, set it to the route path (e.g. "/dashboard").
 */
export type SidebarItem = {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  /** Section grouping. Items with the same group render under one header. */
  group?: string;
  /** Optional href — passed to `linkComponent` if provided. */
  href?: string;
  /** Free-form payload returned in `onSelect`. */
  data?: Record<string, unknown>;
  /** Optional badge shown on the right of the row */
  badge?: { count: number; tone?: "primary" | "danger" | "warning" };
  /** Permission required to see this item (filtered by caller before passing to SidebarPro) */
  permission?: { screen: string; action: "read" | "write" | "create" | "edit" | "delete" };
};

export type SidebarMessages = {
  pinned: string;
  pin: string;
  unpin: string;
  showPinnedOnly: string;
  showAll: string;
  collapse: string;
  expand: string;
  reorder: string;
  noVisiblePinned: string;
  showEverything: string;
};

export const DEFAULT_MESSAGES: SidebarMessages = {
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
};

/**
 * Props the consumer's link component must accept. Compatible with
 * `next/link`, `react-router` Link, Remix Link, plain anchors.
 */
export type LinkComponentProps = {
  href: string;
  onClick?: (e: React.MouseEvent) => void;
  children: ReactNode;
  className?: string;
  title?: string;
  "aria-label"?: string;
};

export type LinkComponent = ComponentType<LinkComponentProps>;
