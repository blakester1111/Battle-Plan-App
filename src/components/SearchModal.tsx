"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useAppContext, useAccentColor } from "@/context/AppContext";
import type { KanbanTask } from "@/lib/types";
import { LABEL_COLORS, PRIORITY_COLORS, PRIORITY_LABELS } from "@/lib/utils";
import KanbanCardModal from "./kanban/KanbanCardModal";

const STATUS_LABELS: Record<string, string> = {
  todo: "To Do",
  "in-progress": "In Progress",
  complete: "Complete",
};

const STATUS_COLORS: Record<string, string> = {
  todo: "bg-stone-200 text-stone-600 dark:bg-stone-700 dark:text-stone-300",
  "in-progress": "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  complete: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
};

interface Props {
  onClose: () => void;
}

export default function SearchModal({ onClose }: Props) {
  const { state, dispatch } = useAppContext();
  const accent = useAccentColor();
  const [query, setQuery] = useState("");
  const [editingTask, setEditingTask] = useState<KanbanTask | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Filter tasks by query
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return state.tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
    );
  }, [query, state.tasks]);

  function handleMarkDone(task: KanbanTask) {
    const completeCount = state.tasks.filter((t) => t.status === "complete").length;
    dispatch({
      type: "MOVE_TASK",
      payload: { taskId: task.id, toStatus: "complete", toIndex: completeCount },
    });
  }

  // If editing a task, show the card modal instead
  if (editingTask) {
    return (
      <KanbanCardModal
        task={editingTask}
        onClose={() => {
          setEditingTask(null);
          onClose();
        }}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/30 dark:bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg mx-4 bg-white dark:bg-stone-900 rounded-xl shadow-2xl border border-stone-200 dark:border-stone-700 overflow-hidden animate-fade-in">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-200 dark:border-stone-700">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-stone-400 dark:text-stone-500 shrink-0"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search targets..."
            className="flex-1 bg-transparent text-sm text-stone-800 dark:text-stone-200 placeholder-stone-400 dark:placeholder-stone-500 outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {query.trim() === "" ? (
            <div className="px-4 py-8 text-center text-sm text-stone-400 dark:text-stone-500">
              Type to search targets...
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-stone-400 dark:text-stone-500">
              No targets found
            </div>
          ) : (
            <div className="py-1">
              {results.map((task) => {
                const hasLabel = task.label && task.label !== "none";
                const hasPriority = task.priority && task.priority !== "none";
                const isComplete = task.status === "complete";

                return (
                  <div
                    key={task.id}
                    className="px-4 py-2.5 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors"
                    style={{
                      borderLeftWidth: hasLabel ? "3px" : undefined,
                      borderLeftColor: hasLabel ? LABEL_COLORS[task.label!] : undefined,
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-medium leading-snug ${
                            isComplete
                              ? "text-stone-400 dark:text-stone-500 line-through"
                              : "text-stone-800 dark:text-stone-200"
                          }`}>
                            {task.title}
                          </p>
                          <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[task.status]}`}>
                            {STATUS_LABELS[task.status]}
                          </span>
                        </div>
                        {task.description && (
                          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 line-clamp-1">
                            {task.description}
                          </p>
                        )}
                        {hasPriority && (
                          <div className="flex items-center gap-1 mt-1">
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: PRIORITY_COLORS[task.priority!] }}
                            />
                            <span className="text-[10px] uppercase tracking-wider text-stone-400 dark:text-stone-500">
                              {PRIORITY_LABELS[task.priority!]}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditingTask(task)}
                          className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${accent.bgSubtle} ${accent.text} ${accent.bgHover}`}
                        >
                          Edit
                        </button>
                        {!isComplete && (
                          <button
                            type="button"
                            onClick={() => handleMarkDone(task)}
                            className="px-2.5 py-1 text-xs font-medium rounded transition-colors bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
                          >
                            Done
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer with result count */}
        {query.trim() !== "" && results.length > 0 && (
          <div className="px-4 py-2 border-t border-stone-200 dark:border-stone-700 text-xs text-stone-400 dark:text-stone-500">
            {results.length} result{results.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}
