"use client";

import { useState } from "react";
import { useMemo } from "react";
import { useAppContext, useAccentColor } from "@/context/AppContext";
import type { KanbanTask, ColumnStatus } from "@/lib/types";
import { DEFAULT_PRIORITY_SHORTCUTS } from "@/lib/types";
import { cn, PRIORITY_COLORS, parsePriorityFromText, parseBuggedFromText } from "@/lib/utils";
import { getWeekEndDate } from "@/lib/dateUtils";

import type { Priority } from "@/lib/types";

const STATUS_ORDER: Record<ColumnStatus, number> = {
  todo: 0,
  "in-progress": 1,
  complete: 2,
};

const PRIORITY_ORDER: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
  none: 3,
};

const STATUS_LABEL: Record<ColumnStatus, string> = {
  todo: "To do",
  "in-progress": "In progress",
  complete: "Done",
};

const RECENT_LIMIT = 10;

export default function TodoList() {
  const { state, dispatch } = useAppContext();
  const accent = useAccentColor();
  const [input, setInput] = useState("");
  const [showArchive, setShowArchive] = useState(false);

  // Find the BP for the current week (if any)
  const currentWeekBpId = useMemo(() => {
    if (state.weeklyBattlePlans.length === 0) return undefined;
    const now = new Date();
    const weekEnd = getWeekEndDate(now, state.weekSettings);
    const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
    return state.weeklyBattlePlans.find((bp) => {
      const bpStart = new Date(bp.weekStart);
      return bpStart >= weekStart && bpStart < weekEnd;
    })?.id;
  }, [state.weeklyBattlePlans, state.weekSettings]);

  // Apply filters
  let filteredTasks = state.tasks;

  // Apply category filter if active
  if (state.categoryFilter.length > 0) {
    filteredTasks = filteredTasks.filter(
      (t) => t.category && state.categoryFilter.includes(t.category)
    );
  }

  // Apply bugged filter if active
  if (state.buggedFilter) {
    filteredTasks = filteredTasks.filter((t) => t.bugged);
  }

  // Group by status, then prioritized cards first (sorted by priority), then non-prioritized (by order)
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    // First by status
    const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (statusDiff !== 0) return statusDiff;

    // Within same status: prioritized cards come first
    const aHasPriority = a.priority && a.priority !== "none";
    const bHasPriority = b.priority && b.priority !== "none";

    if (aHasPriority && !bHasPriority) return -1;
    if (!aHasPriority && bHasPriority) return 1;

    // Both have priority: sort by priority level
    if (aHasPriority && bHasPriority) {
      const priorityDiff =
        PRIORITY_ORDER[a.priority || "none"] - PRIORITY_ORDER[b.priority || "none"];
      if (priorityDiff !== 0) return priorityDiff;
    }

    // Same priority level or both none: sort by order
    return a.order - b.order;
  });

  const completedCount = sortedTasks.filter(
    (t) => t.status === "complete"
  ).length;

  // Split into recent and archived
  const recentTasks = sortedTasks.slice(0, RECENT_LIMIT);
  const archivedTasks = sortedTasks.slice(RECENT_LIMIT);
  const hasArchive = archivedTasks.length > 0;

  function handleAdd() {
    const text = input.trim();
    if (!text) return;

    // Parse priority shortcuts from the input
    const { priority, cleanedText: afterPriority } = parsePriorityFromText(
      text,
      state.priorityShortcuts || DEFAULT_PRIORITY_SHORTCUTS
    );

    // Parse bug shortcut from the input
    const shortcuts = { ...DEFAULT_PRIORITY_SHORTCUTS, ...state.priorityShortcuts };
    const bugShortcut = shortcuts.bugged || "-b";
    const { bugged, cleanedText: finalText } = parseBuggedFromText(afterPriority, bugShortcut);

    dispatch({
      type: "ADD_TASK",
      payload: {
        title: finalText || text,
        description: "",
        status: "todo",
        priority: priority !== "none" ? priority : undefined,
        bugged: bugged === true ? true : undefined,
        weeklyBpId: currentWeekBpId,
      },
    });
    setInput("");
  }

  function toggleComplete(task: KanbanTask) {
    const toStatus: ColumnStatus =
      task.status === "complete" ? "todo" : "complete";
    const destCount = state.tasks.filter((t) => t.status === toStatus).length;
    dispatch({
      type: "MOVE_TASK",
      payload: { taskId: task.id, toStatus, toIndex: destCount },
    });
  }

  const isCollapsed = state.tasksCollapsed;

  return (
    <div>
      <button
        onClick={() => dispatch({ type: "TOGGLE_TASKS_COLLAPSED" })}
        className="flex items-center justify-between w-full mb-3 group"
      >
        <div className="flex items-center gap-1.5">
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn(
              "text-stone-400 dark:text-stone-500 transition-transform duration-150",
              !isCollapsed && "rotate-90"
            )}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500 group-hover:text-stone-500 dark:group-hover:text-stone-400 transition-colors">
            Targets
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {completedCount > 0 && (
            <span className="text-[10px] font-medium tabular-nums text-stone-400 dark:text-stone-500">
              {completedCount} done
            </span>
          )}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-stone-400 dark:text-stone-500"
          >
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
          </svg>
        </div>
      </button>

      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          placeholder="Quick add target..."
          className={cn(
            "flex-1 rounded px-3 py-1.5 text-sm bg-white dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700/50 focus:outline-none focus:ring-2 placeholder:text-stone-400 transition-shadow",
            accent.ring
          )}
        />
        <button
          type="button"
          onClick={handleAdd}
          className="rounded px-2.5 py-1.5 text-sm font-medium border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-400 hover:border-stone-400 dark:hover:border-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
        >
          Add
        </button>
      </div>

      {!isCollapsed && (
        <div className="space-y-0">
        {/* Render task item */}
        {(showArchive ? sortedTasks : recentTasks).map((task) => {
          const isComplete = task.status === "complete";
          const hasPriority = task.priority && task.priority !== "none";
          return (
            <div
              key={task.id}
              className="flex items-center gap-2.5 group py-1.5 animate-fade-in"
            >
              <button
                onClick={() => toggleComplete(task)}
                className={cn(
                  "w-[18px] h-[18px] rounded-[5px] border-[1.5px] flex items-center justify-center shrink-0 transition-all",
                  isComplete
                    ? "bg-stone-500 border-stone-500 dark:bg-stone-500 dark:border-stone-500"
                    : "border-stone-300 dark:border-stone-600 hover:border-stone-400 dark:hover:border-stone-500"
                )}
                aria-label={
                  isComplete ? "Mark incomplete" : "Mark complete"
                }
              >
                {isComplete && (
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
              {hasPriority && (
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: PRIORITY_COLORS[task.priority!],
                  }}
                  title={`${task.priority} priority`}
                />
              )}
              {task.bugged && (
                <span title="Bugged" className="shrink-0 flex items-center">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#f87171"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3.003 3.003 0 116 0v1" />
                    <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 014-4h4a4 4 0 014 4v3c0 3.3-2.7 6-6 6" />
                    <path d="M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M20.97 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4" />
                  </svg>
                </span>
              )}
              <span
                className={cn(
                  "text-sm flex-1 min-w-0 truncate leading-snug",
                  isComplete
                    ? "line-through text-stone-400 dark:text-stone-500"
                    : "text-stone-700 dark:text-stone-300"
                )}
              >
                {task.title}
              </span>
              {!isComplete && (
                <span className="text-[9px] uppercase tracking-wider text-stone-400 dark:text-stone-600 shrink-0 hidden group-hover:inline">
                  {STATUS_LABEL[task.status]}
                </span>
              )}
              <button
                onClick={() =>
                  dispatch({
                    type: "DELETE_TASK",
                    payload: { id: task.id },
                  })
                }
                className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 p-1 text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 transition-all focus:opacity-100 shrink-0"
                aria-label="Delete task"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          );
        })}

        {/* Archive toggle */}
        {hasArchive && (
          <button
            onClick={() => setShowArchive(!showArchive)}
            className="w-full mt-2 py-1.5 text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-400 transition-colors flex items-center justify-center gap-1.5"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={cn("transition-transform", showArchive && "rotate-180")}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
            {showArchive ? "Hide" : "Show"} {archivedTasks.length} older targets
          </button>
        )}

        {sortedTasks.length === 0 && (
          <div className="py-6 text-center">
            <p className="text-xs text-stone-400 dark:text-stone-500">
              No targets yet
            </p>
          </div>
        )}
        </div>
      )}
    </div>
  );
}
