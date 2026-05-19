import { useEffect, useRef } from "react";

type Handler = (e: KeyboardEvent) => void;
type ShortcutMap = Record<string, Handler>;

function isEditing(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    (el as HTMLElement).isContentEditable
  );
}

export function useKeyboardShortcuts(shortcuts: ShortcutMap): void {
  const ref = useRef<ShortcutMap>(shortcuts);
  ref.current = shortcuts;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isEditing()) return;
      const parts: string[] = [];
      if (e.metaKey) parts.push("cmd");
      if (e.ctrlKey) parts.push("ctrl");
      if (e.altKey) parts.push("alt");
      if (e.shiftKey) parts.push("shift");
      parts.push(e.key.toLowerCase());
      const combo = parts.join("+");
      ref.current[combo]?.(e);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
