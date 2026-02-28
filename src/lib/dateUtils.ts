import type { WeekSettings, DateFormatType } from "./types";

export const DATE_FORMAT_OPTIONS: { id: DateFormatType; label: string; example: string }[] = [
  { id: "dd-MMM-yy", label: "13-Feb-26", example: "13-Feb-26" },
  { id: "MMM dd, yyyy", label: "Feb 13, 2026", example: "Feb 13, 2026" },
  { id: "dd/MM/yy", label: "13/02/26", example: "13/02/26" },
  { id: "yyyy-MM-dd", label: "2026-02-13", example: "2026-02-13" },
];

export const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export const HOURS_OF_DAY = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`,
}));

// Get browser's local timezone
export function getBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// Common timezone options (subset of IANA timezones for the dropdown)
export const COMMON_TIMEZONES = [
  { value: "", label: "Use browser default" },
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii (HST)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Central European (CET)" },
  { value: "Europe/Berlin", label: "Berlin (CET)" },
  { value: "Asia/Tokyo", label: "Japan (JST)" },
  { value: "Asia/Shanghai", label: "China (CST)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
  { value: "Australia/Perth", label: "Perth (AWST)" },
];

// Get effective timezone (user setting or browser default)
export function getEffectiveTimezone(settings: WeekSettings): string {
  return settings.timezone || getBrowserTimezone();
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(date: Date, format: DateFormatType): string {
  const d = date.getDate();
  const m = date.getMonth();
  const y = date.getFullYear();

  switch (format) {
    case "dd-MMM-yy":
      return `${d}-${MONTHS[m]}-${String(y).slice(-2)}`;
    case "MMM dd, yyyy":
      return `${MONTHS[m]} ${d}, ${y}`;
    case "dd/MM/yy":
      return `${String(d).padStart(2, "0")}/${String(m + 1).padStart(2, "0")}/${String(y).slice(-2)}`;
    case "yyyy-MM-dd":
      return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    default:
      return `${d}-${MONTHS[m]}-${String(y).slice(-2)}`;
  }
}

/**
 * Returns the start boundary of the current week as a Date.
 * Uses the same algorithm as WeeklyBPModal's getWeekStart() so that
 * BP weekStart values can be matched by exact timestamp comparison.
 */
export function getWeekStartDate(now: Date, settings: WeekSettings): Date {
  const { weekStartDay, weekStartHour } = settings;
  const startBoundary = new Date(now);
  startBoundary.setHours(weekStartHour, 0, 0, 0);
  const daysSinceStart = (now.getDay() - weekStartDay + 7) % 7;
  startBoundary.setDate(startBoundary.getDate() - daysSinceStart);
  if (now < startBoundary) {
    startBoundary.setDate(startBoundary.getDate() - 7);
  }
  return startBoundary;
}

export function getWeekEndDate(now: Date, settings: WeekSettings): Date {
  const { weekStartDay, weekStartHour, weekEndDay, weekEndHour } = settings;

  // 1. Find the most recent start boundary (on or before now)
  const startBoundary = new Date(now);
  startBoundary.setHours(weekStartHour, 0, 0, 0);

  // Roll back to the correct start day
  const daysSinceStart = (now.getDay() - weekStartDay + 7) % 7;
  startBoundary.setDate(startBoundary.getDate() - daysSinceStart);

  // If we haven't reached the start hour today, go back another week
  if (now < startBoundary) {
    startBoundary.setDate(startBoundary.getDate() - 7);
  }

  // 2. Calculate end boundary from that start
  const endBoundary = new Date(startBoundary);

  // CRITICAL: Handle same day/time edge case (e.g., Thursday 2pm to Thursday 2pm)
  if (weekStartDay === weekEndDay && weekStartHour === weekEndHour) {
    // Same day/time means exactly 7 days later
    endBoundary.setDate(endBoundary.getDate() + 7);
  } else {
    // Different day/time: find next occurrence of endDay/endHour after start
    endBoundary.setHours(weekEndHour, 0, 0, 0);
    const daysToEnd = (weekEndDay - weekStartDay + 7) % 7;
    endBoundary.setDate(endBoundary.getDate() + (daysToEnd === 0 ? 7 : daysToEnd));

    // Adjust if end hour is earlier than start hour on the same day
    if (weekEndDay === weekStartDay && weekEndHour <= weekStartHour) {
      endBoundary.setDate(endBoundary.getDate() + 7);
    }
  }

  return endBoundary;
}

export function generateWeeklyBPTitle(settings: WeekSettings, dateFormat: DateFormatType): string {
  const weekEnd = getWeekEndDate(new Date(), settings);
  return `W/E ${formatDate(weekEnd, dateFormat)}`;
}

// Given a date, find the next occurrence of weekEndDay on or after that date.
// Used to determine which week-ending date a given date belongs to.
// When boundaryHour is provided and today IS the end day, we check whether
// we've already passed the boundary hour — if so, the next week ending is 7 days out.
export function getWeekEndingDateForDate(date: Date, weekEndDay: number, boundaryHour?: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const currentDay = d.getDay();
  let daysUntilEnd = (weekEndDay - currentDay + 7) % 7;
  // If today is the end day and we've passed the boundary hour, move to next week
  if (daysUntilEnd === 0 && boundaryHour != null && date.getHours() >= boundaryHour) {
    daysUntilEnd = 7;
  }
  d.setDate(d.getDate() + daysUntilEnd);
  return d;
}

// Given a date, find the most recent occurrence of weekEndDay on or before that date.
// Used when generating week-ending date slots going backwards.
export function getMostRecentWeekEndingDate(date: Date, weekEndDay: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const currentDay = d.getDay();
  const daysSinceEnd = (currentDay - weekEndDay + 7) % 7;
  d.setDate(d.getDate() - daysSinceEnd);
  return d;
}

// --- Split-day helpers for daily stat entries on week boundary days ---

// Suffix appended to date strings for the second half of a split boundary day
export const SPLIT_HALF_SUFFIX = ".2";

// Returns true if the given day-of-week is a split boundary day
// (week starts and ends on the same day with a mid-day boundary hour)
export function isSplitBoundaryDay(dayOfWeek: number, settings: WeekSettings): boolean {
  return (
    settings.weekStartDay === settings.weekEndDay &&
    settings.weekStartHour > 0 &&
    dayOfWeek === settings.weekStartDay
  );
}

// Parse a date key that may have the .2 suffix
export function parseDateKey(dateKey: string): { baseDate: string; isSecondHalf: boolean } {
  if (dateKey.endsWith(SPLIT_HALF_SUFFIX)) {
    return { baseDate: dateKey.slice(0, -SPLIT_HALF_SUFFIX.length), isSecondHalf: true };
  }
  return { baseDate: dateKey, isSecondHalf: false };
}

// Format boundary hour for display (e.g. 14 -> "2pm", 9 -> "9am")
export function formatBoundaryHour(hour: number): string {
  if (hour === 0) return "12am";
  if (hour < 12) return `${hour}am`;
  if (hour === 12) return "12pm";
  return `${hour - 12}pm`;
}

// Default week settings
export const DEFAULT_WEEK_SETTINGS: WeekSettings = {
  weekStartDay: 4, // Thursday
  weekStartHour: 14, // 2pm
  weekEndDay: 4, // Thursday
  weekEndHour: 14, // 2pm
};
