"use client";

import { useState, useEffect } from "react";
import { useAppContext, useAccentColor } from "@/context/AppContext";
import { archiveApi, tasksApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/dateUtils";
import type { DateFormatType, Priority } from "@/lib/types";

interface ArchivedTask {
  id: string;
  title: string;
  description: string;
  status: string;
  category: string | null;
  priority: string;
  label: string;
  weeklyBpId?: string;
  weeklyBpTitle?: string;
  archivedAt: string;
  createdAt: string;
}

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-green-500",
  low: "bg-blue-500",
};

interface ArchiveModalProps {
  onClose: () => void;
}

export default function ArchiveModal({ onClose }: ArchiveModalProps) {
  const { state, dispatch } = useAppContext();
  const accent = useAccentColor();
  const [tasks, setTasks] = useState<ArchivedTask[]>([]);
  const [loading, setLoading] = useState(true);

  const dateFormat = (state.dateFormat || "dd-MMM-yy") as DateFormatType;

  useEffect(() => {
    loadArchive();
  }, []);

  async function loadArchive() {
    try {
      const data = await archiveApi.getAll();
      setTasks(data || []);
    } catch (err) {
      console.error("Failed to load archive:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore(task: ArchivedTask) {
    try {
      await archiveApi.restore(task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      // Refresh tasks in main state
      const allTasks = await tasksApi.getAll();
      dispatch({ type: "SET_TASKS", payload: allTasks });
    } catch (err) {
      console.error("Failed to restore:", err);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-16"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-stone-900 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[70vh] flex flex-col animate-slide-up border border-stone-200 dark:border-stone-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 dark:border-stone-800">
          <div className="flex items-center gap-2.5">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-stone-400"
            >
              <polyline points="21 8 21 21 3 21 3 8" />
              <rect x="1" y="3" width="22" height="5" />
              <line x1="10" y1="12" x2="14" y2="12" />
            </svg>
            <h2 className="text-base font-semibold text-stone-800 dark:text-stone-100">
              Completed Archive
            </h2>
            {tasks.length > 0 && (
              <span className="text-xs font-medium text-stone-400 dark:text-stone-500 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-full">
                {tasks.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <p className="text-sm text-stone-400 text-center py-8">Loading...</p>
          ) : tasks.length === 0 ? (
            <div className="text-center py-8">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-stone-300 dark:text-stone-600 mx-auto mb-3"
              >
                <polyline points="21 8 21 21 3 21 3 8" />
                <rect x="1" y="3" width="22" height="5" />
                <line x1="10" y1="12" x2="14" y2="12" />
              </svg>
              <p className="text-sm text-stone-400 dark:text-stone-500">No archived tasks</p>
              <p className="text-xs text-stone-400 dark:text-stone-600 mt-1">
                Completed tasks are archived when a new week begins
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-stone-50 dark:bg-stone-800/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {task.priority && task.priority !== "none" && (
                        <span className={cn("w-2 h-2 rounded-full shrink-0", PRIORITY_DOT[task.priority])} />
                      )}
                      <span className="text-sm font-medium text-stone-700 dark:text-stone-300 truncate">
                        {task.title}
                      </span>
                      {task.category && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-700 text-stone-500 dark:text-stone-400 shrink-0">
                          {task.category}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {task.weeklyBpTitle && (
                        <span className="text-xs text-stone-400 dark:text-stone-500">
                          {task.weeklyBpTitle}
                        </span>
                      )}
                      <span className="text-xs text-stone-400 dark:text-stone-500">
                        Archived {formatDate(new Date(task.archivedAt), dateFormat)}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <button
                      onClick={() => handleRestore(task)}
                      className={cn(
                        "px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors",
                        accent.text, accent.bgSubtle, accent.bgHover
                      )}
                      title="Restore to main board"
                    >
                      Restore
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-stone-200 dark:border-stone-800">
          <p className="text-xs text-stone-400 dark:text-stone-500 text-center">
            Completed tasks are automatically archived when a new week begins
          </p>
        </div>
      </div>
    </div>
  );
}
