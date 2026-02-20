"use client";

import { useEffect, useRef, useState } from "react";
import { useAppContext } from "@/context/AppContext";

interface Notification {
  id: string;
  taskId: string;
  title: string;
  type: "overdue" | "reminder";
}

const LS_DISMISSED_OVERDUE = "bp_dismissed_overdue";
const LS_DISMISSED_REMINDERS = "bp_dismissed_reminders";

function loadSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* ignore */ }
  return new Set();
}

function saveSet(key: string, set: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch { /* ignore */ }
}

export default function TaskNotifier() {
  const { state, dispatch } = useAppContext();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  // Track overdue by "taskId:dueAt" so changing TM allows re-notification
  const notifiedOverdue = useRef<Set<string>>(new Set());
  // Track reminders by task ID (reminderAt is cleared after firing)
  const notifiedReminders = useRef<Set<string>>(new Set());
  // Persisted dismissed sets — loaded from localStorage on client mount
  const dismissedOverdue = useRef<Set<string>>(new Set());
  const dismissedReminders = useRef<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  // Load dismissed sets from localStorage on client mount
  useEffect(() => {
    dismissedOverdue.current = loadSet(LS_DISMISSED_OVERDUE);
    dismissedReminders.current = loadSet(LS_DISMISSED_REMINDERS);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    // Don't run until tasks have actually loaded from the API
    if (state.tasks.length === 0) return;

    function check() {
      const now = new Date();
      const newNotifs: Notification[] = [];

      // Clean up tracking for tasks that no longer exist
      const taskIds = new Set(state.tasks.map((t) => t.id));
      for (const key of notifiedOverdue.current) {
        const taskId = key.split(":")[0];
        if (!taskIds.has(taskId)) notifiedOverdue.current.delete(key);
      }
      for (const id of notifiedReminders.current) {
        if (!taskIds.has(id)) notifiedReminders.current.delete(id);
      }

      // Clean up dismissed sets — only remove entries for tasks
      // that no longer exist (not for tasks that simply aren't loaded yet)
      let dismissedChanged = false;
      for (const key of dismissedOverdue.current) {
        const taskId = key.split(":")[0];
        if (!taskIds.has(taskId)) {
          dismissedOverdue.current.delete(key);
          dismissedChanged = true;
        }
      }
      for (const id of dismissedReminders.current) {
        if (!taskIds.has(id)) {
          dismissedReminders.current.delete(id);
          dismissedChanged = true;
        }
      }
      if (dismissedChanged) {
        saveSet(LS_DISMISSED_OVERDUE, dismissedOverdue.current);
        saveSet(LS_DISMISSED_REMINDERS, dismissedReminders.current);
      }

      for (const task of state.tasks) {
        // Check overdue — keyed by taskId:dueAt so changing TM resets
        if (
          task.dueAt &&
          task.status !== "complete" &&
          new Date(task.dueAt) < now
        ) {
          const overdueKey = `${task.id}:${task.dueAt}`;
          if (
            !notifiedOverdue.current.has(overdueKey) &&
            !dismissedOverdue.current.has(overdueKey)
          ) {
            notifiedOverdue.current.add(overdueKey);
            newNotifs.push({
              id: `overdue-${task.id}`,
              taskId: task.id,
              title: task.title,
              type: "overdue",
            });
          }
        }

        // Check reminders
        if (
          task.reminderAt &&
          new Date(task.reminderAt) <= now &&
          !notifiedReminders.current.has(task.id) &&
          !dismissedReminders.current.has(task.id)
        ) {
          notifiedReminders.current.add(task.id);
          newNotifs.push({
            id: `reminder-${task.id}`,
            taskId: task.id,
            title: task.title,
            type: "reminder",
          });
          // Clear reminderAt so it's a one-time notification
          // MUST use null (not undefined) — undefined gets stripped by JSON.stringify
          // and the API would never clear reminder_at in the DB
          dispatch({
            type: "UPDATE_TASK",
            payload: { id: task.id, reminderAt: null },
          });
        }
      }

      if (newNotifs.length > 0) {
        setNotifications((prev) => [...prev, ...newNotifs]);
      }

      // Remove notifications for tasks that were completed or deleted
      setNotifications((prev) =>
        prev.filter((n) => {
          const task = state.tasks.find((t) => t.id === n.taskId);
          if (!task) return false;
          if (n.type === "overdue" && task.status === "complete") return false;
          return true;
        })
      );
    }

    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [state.tasks, dispatch, hydrated]);

  function dismiss(id: string, n: Notification) {
    // Track dismissal and persist to localStorage
    if (n.type === "overdue") {
      const task = state.tasks.find((t) => t.id === n.taskId);
      if (task?.dueAt) {
        dismissedOverdue.current.add(`${n.taskId}:${task.dueAt}`);
        saveSet(LS_DISMISSED_OVERDUE, dismissedOverdue.current);
      }
    } else {
      dismissedReminders.current.add(n.taskId);
      saveSet(LS_DISMISSED_REMINDERS, dismissedReminders.current);
    }
    setNotifications((prev) => prev.filter((x) => x.id !== id));
  }

  if (notifications.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/40">
      <div className="flex flex-col gap-3 max-w-md w-full mx-4">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`flex items-start gap-3 p-4 rounded-lg shadow-2xl animate-slide-up ${
              n.type === "overdue"
                ? "bg-red-50 dark:bg-red-950 border border-red-300 dark:border-red-800"
                : "bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-800"
            }`}
          >
            {n.type === "overdue" ? (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-red-500 shrink-0 mt-0.5"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-amber-500 shrink-0 mt-0.5"
              >
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
            )}
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold ${
                n.type === "overdue"
                  ? "text-red-700 dark:text-red-300"
                  : "text-amber-700 dark:text-amber-300"
              }`}>
                {n.type === "overdue" ? "Target Overdue" : "Reminder"}
              </p>
              <p className="text-sm text-stone-700 dark:text-stone-300 mt-0.5">
                {n.title}
              </p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(n.id, n)}
              className={`shrink-0 px-3 py-1 rounded text-xs font-medium transition-colors ${
                n.type === "overdue"
                  ? "bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 hover:bg-red-300 dark:hover:bg-red-700"
                  : "bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 hover:bg-amber-300 dark:hover:bg-amber-700"
              }`}
            >
              Dismiss
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
