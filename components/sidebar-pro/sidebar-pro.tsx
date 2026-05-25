"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronsLeft, ChevronsRight, Pin } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import type { DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";

import type { SidebarItem, LinkComponent, SidebarMessages } from "./types";
import { DEFAULT_MESSAGES } from "./types";
import { useSidebarPro } from "./use-sidebar-pro";
import { SidebarProPinRow } from "./sidebar-pro-pin-row";
import { SidebarProDivider } from "./sidebar-pro-divider";
import { SidebarProResizer } from "./sidebar-pro-resizer";

import "./sidebar-pro.css";

export type SidebarProProps = {
  items: SidebarItem[];

  /** id of the currently active item (drives selection highlight) */
  activeId?: string;
  /** id of a route in flight (drives the "loading" opacity) */
  pendingId?: string;

  onSelect?: (item: SidebarItem) => void;

  /**
   * Component used to wrap items that have an `href` — pass next/link,
   * react-router Link, etc. Without it, items render as `<button>`.
   */
  linkComponent?: LinkComponent;

  /** Expanded-state slot (full logo, app name, etc.) */
  header?: React.ReactNode;
  /** Collapsed-state slot — keep it ≤ 32px wide (small mark / initial). */
  headerCollapsed?: React.ReactNode;
  /** Bottom-of-sidebar slot (e.g. Settings link, user menu). */
  footer?: React.ReactNode;

  /** localStorage namespace for pins / width / collapsed / focus. */
  storageKey?: string;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  collapsedWidth?: number;
  defaultCollapsed?: boolean;
  defaultPins?: string[];

  messages?: Partial<SidebarMessages>;

  enablePins?: boolean;
  enableResize?: boolean;
  enableFocusMode?: boolean;
  enableCollapse?: boolean;
  enableKeyboardShortcut?: boolean;
  /** Defaults to ⌘\ / Ctrl+\ */
  collapseShortcut?: { key: string; meta?: boolean };

  /** Optional explicit group ordering. Otherwise groups render in insertion order. */
  groupOrder?: string[];

  className?: string;
};

/**
 * A pinnable, resizable, collapsible navigation rail. Items can be pinned to
 * the top, reordered by drag, and the rest hidden behind a focus toggle. The
 * sidebar persists pins / width / collapsed state per `storageKey`.
 */
export function SidebarPro({
  items,
  activeId,
  pendingId,
  onSelect,
  linkComponent,
  header,
  headerCollapsed,
  footer,
  storageKey = "sidebar-pro",
  defaultWidth = 256,
  minWidth = 180,
  maxWidth = 400,
  collapsedWidth = 64,
  defaultCollapsed = false,
  defaultPins = [],
  messages: messagesOverride,
  enablePins = true,
  enableResize = true,
  enableFocusMode = true,
  enableCollapse = true,
  enableKeyboardShortcut = true,
  collapseShortcut = { key: "\\", meta: true },
  groupOrder,
  className,
}: SidebarProProps) {
  const messages = { ...DEFAULT_MESSAGES, ...messagesOverride };
  const {
    pins, setPins, togglePin,
    focusMode, toggleFocusMode,
    width, setWidth,
    collapsed, setCollapsed, toggleCollapsed,
  } = useSidebarPro({ storageKey, defaultWidth, defaultCollapsed, defaultPins });

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (!enableKeyboardShortcut || !enableCollapse) return;
    function onKey(e: KeyboardEvent) {
      const metaOk = collapseShortcut.meta ? (e.metaKey || e.ctrlKey) : true;
      if (metaOk && e.key === collapseShortcut.key) {
        e.preventDefault();
        toggleCollapsed();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enableKeyboardShortcut, enableCollapse, collapseShortcut, toggleCollapsed]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function onDragStart(e: DragStartEvent) { setActiveDragId(String(e.active.id)); }
  function onDragEnd(e: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = e;
    if (over && active.id !== over.id) {
      setPins((prev) =>
        arrayMove(prev, prev.indexOf(String(active.id)), prev.indexOf(String(over.id)))
      );
    }
  }

  function onWidthChange(w: number) {
    if (!isResizing) setIsResizing(true);
    setWidth(w);
  }

  const itemMap = useMemo(() => {
    const m = new Map<string, SidebarItem>();
    items.forEach((it) => m.set(it.id, it));
    return m;
  }, [items]);

  const pinnedItems = useMemo(
    () => pins.map((id) => itemMap.get(id)).filter(Boolean) as SidebarItem[],
    [pins, itemMap]
  );

  const sections = useMemo(() => {
    const unpinned = items.filter((it) => !pins.includes(it.id));
    const groups = new Map<string, SidebarItem[]>();
    unpinned.forEach((it) => {
      const g = it.group ?? "";
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(it);
    });
    let entries = Array.from(groups.entries());
    if (groupOrder) {
      entries = entries.sort(([a], [b]) => {
        const ai = groupOrder.indexOf(a);
        const bi = groupOrder.indexOf(b);
        return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
      });
    }
    return entries.map(([label, list]) => ({ label, items: list }));
  }, [items, pins, groupOrder]);

  const activeDragItem = activeDragId ? itemMap.get(activeDragId) : undefined;
  const Link = linkComponent;

  return (
    <aside
      className={[
        "bg-card border-r border-border flex flex-col shrink-0 relative overflow-hidden",
        isResizing ? "" : "transition-[width] duration-200",
        className ?? "",
      ].filter(Boolean).join(" ")}
      style={{
        width: collapsed ? collapsedWidth : width,
        willChange: "width",
        transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {(header || headerCollapsed || enableCollapse) && (
        <div className="h-16 flex items-center border-b border-border px-3 gap-2 shrink-0">
          {headerCollapsed && (
            <div
              className={`w-8 h-8 flex items-center justify-center shrink-0 ${
                collapsed ? "" : "opacity-0 pointer-events-none"
              }`}
            >
              {headerCollapsed}
            </div>
          )}
          {header && (
            <div
              className={`min-w-0 overflow-hidden whitespace-nowrap ${
                collapsed ? "opacity-0 max-w-0" : "max-w-[260px]"
              }`}
            >
              {header}
            </div>
          )}
          {enableCollapse && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className={`ml-auto h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                collapsed ? "opacity-0 pointer-events-none" : ""
              }`}
              aria-label={messages.collapse}
              title={messages.collapse}
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {enableCollapse && collapsed && (
        <div className="flex border-b border-border">
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="flex w-full justify-center py-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={messages.expand}
            title={messages.expand}
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      )}

      <nav className="sidebar-pro-scroll flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {enablePins && pinnedItems.length > 0 && (
          <div>
            {!collapsed && (
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 flex items-center gap-1 mb-1">
                <Pin className="w-3 h-3 fill-current" />
                {messages.pinned}
              </div>
            )}
            {collapsed && <div className="h-px bg-border mx-3 mb-2" />}

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            >
              <SortableContext items={pins} strategy={verticalListSortingStrategy}>
                <div className="space-y-0.5">
                  {pinnedItems.map((item) => (
                    <SidebarProPinRow
                      key={item.id}
                      item={item}
                      active={item.id === activeId}
                      pending={item.id === pendingId}
                      collapsed={collapsed}
                      onSelect={onSelect}
                      onUnpin={togglePin}
                      linkComponent={linkComponent}
                      unpinLabel={messages.unpin}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay>
                {activeDragItem ? (
                  <div className="flex items-center gap-3 pl-7 pr-8 py-2 rounded-md text-sm font-medium bg-card border border-border shadow-lg scale-[1.02] text-foreground">
                    {activeDragItem.icon && <activeDragItem.icon className="w-4 h-4 shrink-0" />}
                    <span className="whitespace-nowrap">{activeDragItem.label}</span>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        )}

        {enableFocusMode && enablePins && pinnedItems.length > 0 && !collapsed && (
          <div className="pb-3">
            <SidebarProDivider
              focusMode={focusMode}
              onToggle={toggleFocusMode}
              labelShowOnly={messages.showPinnedOnly}
              labelShowAll={messages.showAll}
            />
          </div>
        )}

        {focusMode && pinnedItems.length === 0 && pins.length > 0 && !collapsed && (
          <div className="px-3 py-4 text-xs text-muted-foreground text-center space-y-2">
            <p>{messages.noVisiblePinned}</p>
            <button
              type="button"
              onClick={toggleFocusMode}
              className="text-primary hover:underline"
            >
              {messages.showEverything}
            </button>
          </div>
        )}

        {!focusMode && sections.map((section) => {
          if (section.items.length === 0) return null;
          return (
            <div key={section.label || "_default"}>
              {!collapsed && section.label && (
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-1">
                  {section.label}
                </div>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = item.id === activeId;
                  const isPending = item.id === pendingId;
                  const Icon = item.icon;
                  const cls = `flex flex-1 items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    !collapsed ? "pr-8" : ""
                  } ${
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  } ${isPending ? "opacity-50" : ""}`;

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
                    <div key={item.id} className="group relative flex items-center">
                      {Link && item.href ? (
                        <Link
                          href={item.href}
                          onClick={() => onSelect?.(item)}
                          title={collapsed ? item.label : undefined}
                          aria-label={collapsed ? item.label : undefined}
                          className={cls}
                        >
                          {inner}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSelect?.(item)}
                          title={collapsed ? item.label : undefined}
                          aria-label={collapsed ? item.label : undefined}
                          className={cls}
                        >
                          {inner}
                        </button>
                      )}

                      {enablePins && (
                        <button
                          type="button"
                          onClick={() => togglePin(item.id)}
                          title={messages.pin}
                          tabIndex={collapsed ? -1 : 0}
                          className={`absolute right-1.5 p-1 rounded text-muted-foreground hover:text-foreground ${
                            collapsed
                              ? "opacity-0 pointer-events-none"
                              : "opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                          }`}
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {footer && (
        <div className={`shrink-0 ${collapsed ? "px-2 py-3" : "p-4"}`}>
          {footer}
        </div>
      )}

      {enableResize && !collapsed && (
        <SidebarProResizer
          onWidthChange={onWidthChange}
          onResizeEnd={() => setIsResizing(false)}
          onReset={() => { setWidth(defaultWidth); setIsResizing(false); }}
          minWidth={minWidth}
          maxWidth={maxWidth}
        />
      )}
    </aside>
  );
}
