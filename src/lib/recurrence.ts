import type { RecurrenceFrequency, RecurrenceRule } from "./types";

export function calculateNextRecurrence(frequency: RecurrenceFrequency, fromDate: Date): Date {
  const next = new Date(fromDate);

  switch (frequency) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    case "quarterly":
      next.setMonth(next.getMonth() + 3);
      break;
    case "yearly":
      next.setFullYear(next.getFullYear() + 1);
      break;
  }

  return next;
}

/**
 * Given a recurrence rule, compute the next due date from the rule's startDate.
 */
export function getNextRecurrenceDate(rule: RecurrenceRule): Date {
  return calculateNextRecurrence(rule.frequency, new Date(rule.startDate));
}

/**
 * Check if a recurrence is due (i.e., the next occurrence date has passed).
 * Walk forward from startDate by the frequency interval until we find the
 * latest due date that is <= now. If we've passed startDate + one interval,
 * it's due.
 */
export function isRecurrenceDue(rule: RecurrenceRule): boolean {
  const now = new Date();
  const nextDue = getNextRecurrenceDate(rule);
  return nextDue <= now;
}

/**
 * Walk forward from startDate to find the latest due date that is <= now.
 * This handles multiple missed intervals (e.g., if the app wasn't loaded
 * for several weeks, only create ONE instance at the latest due date).
 */
export function getLatestDueDate(rule: RecurrenceRule): Date {
  const now = new Date();
  let current = new Date(rule.startDate);
  let latest = current;

  // Walk forward until we pass now
  while (true) {
    const next = calculateNextRecurrence(rule.frequency, current);
    if (next > now) break;
    latest = next;
    current = next;
  }

  return latest;
}
