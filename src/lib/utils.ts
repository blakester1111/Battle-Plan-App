import type { AccentColor, CardLabel, Priority, PriorityShortcuts, User } from "./types";

export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Get display name for a user (firstName + lastName if available, otherwise username)
 */
export function getDisplayName(user: User | { username: string; firstName?: string; lastName?: string }): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  if (user.firstName) {
    return user.firstName;
  }
  return user.username;
}

export function reassignOrder<T extends { order: number }>(items: T[]): T[] {
  return items.map((item, index) => ({ ...item, order: index }));
}

export function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export const LABEL_COLORS: Record<CardLabel, string> = {
  none: "transparent",
  red: "#f87171",
  orange: "#fb923c",
  yellow: "#fbbf24",
  green: "#4ade80",
  blue: "#60a5fa",
  purple: "#c084fc",
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  none: "transparent",
  low: "#60a5fa",
  medium: "#4ade80",
  high: "#f87171",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  none: "None",
  low: "Low",
  medium: "Medium",
  high: "High",
};

/**
 * Parse priority shortcuts from text input.
 * Returns the detected priority and the cleaned text with the shortcut removed.
 */
export function parsePriorityFromText(
  text: string,
  shortcuts: PriorityShortcuts
): { priority: Priority; cleanedText: string } {
  const lowerText = text.toLowerCase();

  // Only check priority shortcuts (not bugged)
  const priorityKeys = ["high", "medium", "low"] as const;

  for (const priority of priorityKeys) {
    const shortcut = shortcuts[priority as keyof typeof shortcuts];
    if (!shortcut) continue;
    const lowerShortcut = shortcut.toLowerCase();
    if (lowerText.includes(lowerShortcut)) {
      // Remove the shortcut from the text (case insensitive)
      const regex = new RegExp(escapeRegex(shortcut), "gi");
      const cleanedText = text.replace(regex, "").trim();
      return { priority: priority as Priority, cleanedText };
    }
  }

  return { priority: "none", cleanedText: text };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Parse bug shortcut from text input.
 * Returns whether the text contains the bug marker and the cleaned text.
 */
export function parseBuggedFromText(
  text: string,
  shortcut: string = "-b"
): { bugged: boolean; cleanedText: string } {
  const trimmedShortcut = (shortcut || "-b").trim();
  if (!trimmedShortcut) return { bugged: false, cleanedText: text };

  const lowerText = text.toLowerCase();
  const lowerShortcut = trimmedShortcut.toLowerCase();

  if (lowerText.includes(lowerShortcut)) {
    const regex = new RegExp(escapeRegex(trimmedShortcut), "gi");
    const cleanedText = text.replace(regex, "").trim();
    return { bugged: true, cleanedText };
  }

  return { bugged: false, cleanedText: text };
}

// Accent color configuration
export interface AccentColorConfig {
  name: string;
  // Text colors
  text: string;           // Primary accent text
  textHover: string;      // Hover state text
  // Background colors
  bg: string;             // Primary accent background
  bgSubtle: string;       // Subtle/light background
  bgHover: string;        // Hover state background
  // Border & ring colors
  border: string;         // Border color
  ring: string;           // Focus ring
  // Preview swatch color (for settings UI)
  swatch: string;
}

export const ACCENT_COLORS: Record<AccentColor, AccentColorConfig> = {
  amber: {
    name: "Amber",
    text: "text-amber-600 dark:text-amber-400",
    textHover: "hover:text-amber-500 dark:hover:text-amber-400",
    bg: "bg-amber-500 dark:bg-amber-500",
    bgSubtle: "bg-amber-50 dark:bg-amber-900/20",
    bgHover: "hover:bg-amber-100 dark:hover:bg-amber-900/30",
    border: "border-amber-500 dark:border-amber-500",
    ring: "ring-amber-400/50 dark:ring-amber-400/50",
    swatch: "#f59e0b",
  },
  blue: {
    name: "Blue",
    text: "text-blue-600 dark:text-blue-400",
    textHover: "hover:text-blue-500 dark:hover:text-blue-400",
    bg: "bg-blue-500 dark:bg-blue-500",
    bgSubtle: "bg-blue-50 dark:bg-blue-900/20",
    bgHover: "hover:bg-blue-100 dark:hover:bg-blue-900/30",
    border: "border-blue-500 dark:border-blue-500",
    ring: "ring-blue-400/50 dark:ring-blue-400/50",
    swatch: "#3b82f6",
  },
  emerald: {
    name: "Emerald",
    text: "text-emerald-600 dark:text-emerald-400",
    textHover: "hover:text-emerald-500 dark:hover:text-emerald-400",
    bg: "bg-emerald-500 dark:bg-emerald-500",
    bgSubtle: "bg-emerald-50 dark:bg-emerald-900/20",
    bgHover: "hover:bg-emerald-100 dark:hover:bg-emerald-900/30",
    border: "border-emerald-500 dark:border-emerald-500",
    ring: "ring-emerald-400/50 dark:ring-emerald-400/50",
    swatch: "#10b981",
  },
  violet: {
    name: "Violet",
    text: "text-violet-600 dark:text-violet-400",
    textHover: "hover:text-violet-500 dark:hover:text-violet-400",
    bg: "bg-violet-500 dark:bg-violet-500",
    bgSubtle: "bg-violet-50 dark:bg-violet-900/20",
    bgHover: "hover:bg-violet-100 dark:hover:bg-violet-900/30",
    border: "border-violet-500 dark:border-violet-500",
    ring: "ring-violet-400/50 dark:ring-violet-400/50",
    swatch: "#8b5cf6",
  },
  rose: {
    name: "Rose",
    text: "text-rose-600 dark:text-rose-400",
    textHover: "hover:text-rose-500 dark:hover:text-rose-400",
    bg: "bg-rose-500 dark:bg-rose-500",
    bgSubtle: "bg-rose-50 dark:bg-rose-900/20",
    bgHover: "hover:bg-rose-100 dark:hover:bg-rose-900/30",
    border: "border-rose-500 dark:border-rose-500",
    ring: "ring-rose-400/50 dark:ring-rose-400/50",
    swatch: "#f43f5e",
  },
  cyan: {
    name: "Cyan",
    text: "text-cyan-600 dark:text-cyan-400",
    textHover: "hover:text-cyan-500 dark:hover:text-cyan-400",
    bg: "bg-cyan-500 dark:bg-cyan-500",
    bgSubtle: "bg-cyan-50 dark:bg-cyan-900/20",
    bgHover: "hover:bg-cyan-100 dark:hover:bg-cyan-900/30",
    border: "border-cyan-500 dark:border-cyan-500",
    ring: "ring-cyan-400/50 dark:ring-cyan-400/50",
    swatch: "#06b6d4",
  },
};

// Helper to get accent classes
export function getAccentClasses(accent: AccentColor): AccentColorConfig {
  return ACCENT_COLORS[accent] || ACCENT_COLORS.amber;
}
