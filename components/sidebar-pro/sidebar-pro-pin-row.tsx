"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pin } from "lucide-react";
import type { SidebarItem, LinkComponent } from "./types";

export type SidebarProPinRowProps = {
  item: SidebarItem;
  active?: boolean;
  collapsed: boolean;
  pending?: boolean;
  onSelect?: (item: SidebarItem) => void;
  onUnpin: (id: string) => void;
  linkComponent?: LinkComponent;
  unpinLabel: string;
};

/**
 * A draggable pinned row. The entire row is the drag target; the grip dots
 * are a pure visual affordance (pointer-events-none). PointerSensor distance:5
 * means clicks navigate and only deliberate drags reorder.
 */
export function SidebarProPinRow({
  item,
  active = false,
  collapsed,
  pending = false,
  onSelect,
  onUnpin,
  linkComponent,
  unpinLabel,
}: SidebarProPinRowProps) {
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: collapsed,
  });

  const Icon = item.icon;
  const Link = linkComponent;

  const linkClassName = `flex flex-1 items-center gap-3 py-2 rounded-md text-sm font-medium transition-colors ${
    !collapsed ? "pl-7 pr-8" : "px-3"
  } ${
    active
      ? "bg-accent text-accent-foreground"
      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
  } ${pending ? "opacity-50" : ""}`;

  const inner = (
    <>
      {Icon && <Icon className="w-4 h-4 shrink-0" />}
      <span className={`whitespace-nowrap overflow-hidden ${collapsed ? "opacity-0" : ""}`}>
        {item.label}
      </span>
      {!collapsed && item.badge && item.badge.count > 0 && (
        <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${
          item.badge.tone === "danger" ? "bg-red-500 text-white" :
          item.badge.tone === "warning" ? "bg-amber-500 text-white" :
          "bg-primary text-primary-foreground"
        }`}>
          {item.badge.count}
        </span>
      )}
    </>
  );

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group relative flex items-center ${isDragging ? "opacity-40" : ""} ${
        !collapsed ? "cursor-grab active:cursor-grabbing" : ""
      }`}
      {...(!collapsed ? listeners : {})}
    >
      {!collapsed && (
        <GripVertical className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none" />
      )}

      {Link && item.href ? (
        <Link
          href={item.href}
          onClick={() => onSelect?.(item)}
          title={collapsed ? item.label : undefined}
          aria-label={collapsed ? item.label : undefined}
          className={linkClassName}
        >
          {inner}
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => onSelect?.(item)}
          title={collapsed ? item.label : undefined}
          aria-label={collapsed ? item.label : undefined}
          className={linkClassName}
        >
          {inner}
        </button>
      )}

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onUnpin(item.id); }}
        onPointerDown={(e) => e.stopPropagation()}
        title={unpinLabel}
        tabIndex={collapsed ? -1 : 0}
        className={`absolute right-1.5 p-1 rounded text-primary hover:text-foreground ${
          collapsed ? "opacity-0 pointer-events-none" : ""
        }`}
      >
        <Pin className="w-3.5 h-3.5 fill-current" />
      </button>
    </div>
  );
}
