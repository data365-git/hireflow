export function formatRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return "yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`;
  return `${Math.floor(diffDay / 30)}mo ago`;
}

export function timeInStage(lastActivityAt: string): string {
  const now = Date.now();
  const then = new Date(lastActivityAt).getTime();
  const diffDay = Math.floor((now - then) / (1000 * 60 * 60 * 24));
  if (diffDay === 0) return "today";
  if (diffDay === 1) return "1d in stage";
  return `${diffDay}d in stage`;
}

export function hashColor(id: string): string {
  const colors = [
    "#7C3AED", "#3525CD", "#2563EB", "#0D9488",
    "#059669", "#B45309", "#BE123C", "#505F76",
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function formatSalary(min: number, max: number): string {
  const fmt = (n: number) => (n >= 1000 ? `${n / 1000}k` : `${n}`);
  return `$${fmt(min)} – $${fmt(max)}`;
}

export function daysAgo(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24));
}

/** Coerce a question text value (possibly a legacy plain string) to an I18nText object. */
export function toI18nText(value: unknown): { uz: string; ru: string; en: string } {
  if (typeof value === "object" && value !== null && "uz" in value) {
    const v = value as Record<string, unknown>;
    return {
      uz: typeof v.uz === "string" ? v.uz : "",
      ru: typeof v.ru === "string" ? v.ru : "",
      en: typeof v.en === "string" ? v.en : "",
    };
  }
  // Legacy plain string — treat as Uzbek
  return { uz: typeof value === "string" ? value : "", ru: "", en: "" };
}

/** Return true if any language field is empty in an I18nText object. */
export function hasI18nGap(text: { uz: string; ru: string; en: string }): boolean {
  return !text.uz.trim() || !text.ru.trim() || !text.en.trim();
}
