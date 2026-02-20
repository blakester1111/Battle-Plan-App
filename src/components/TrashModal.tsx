"use client";

import { useState, useEffect } from "react";
import { useAppContext, useAccentColor } from "@/context/AppContext";
import { trashApi, tasksApi, weeklyBPApi } from "@/lib/api";
import ConfirmModal from "./ConfirmModal";
import { cn } from "@/lib/utils";

interface DeletedTask {
  id: string;
  type: "task";
  title: string;
  description: string;
  status: string;
  category: string | null;
  priority: string;
  deletedAt: string;
  createdAt: string;
}

interface DeletedBP {
  id: string;
  type: "bp";
  title: string;
  formulaName: string;
  formulaCode: string;
  deletedAt: string;
  createdAt: string;
}

type DeletedItem = DeletedTask | DeletedBP;

interface TrashModalProps {
  onClose: () => void;
}

export default function TrashModal({ onClose }: TrashModalProps) {
  const { dispatch } = useAppContext();
  const accent = useAccentColor();
  const [tasks, setTasks] = useState<DeletedTask[]>([]);
  const [bps, setBPs] = useState<DeletedBP[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<DeletedItem | null>(null);

  useEffect(() => {
    loadTrash();
  }, []);

  async function loadTrash() {
    try {
      const data = await trashApi.getAll();
      setTasks(data.tasks || []);
      setBPs(data.bps || []);
    } catch (err) {
      console.error("Failed to load trash:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore(item: DeletedItem) {
    try {
      await trashApi.restore(item.id, item.type);

      if (item.type === "task") {
        setTasks((prev) => prev.filter((t) => t.id !== item.id));
        // Refresh tasks in main state
        const allTasks = await tasksApi.getAll();
        dispatch({ type: "SET_TASKS", payload: allTasks });
      } else {
        setBPs((prev) => prev.filter((bp) => bp.id !== item.id));
        // Refresh BPs in main state
        const { weeklyBattlePlans } = await weeklyBPApi.getAll();
        dispatch({ type: "SET_WEEKLY_BPS", payload: weeklyBattlePlans });
      }
    } catch (err) {
      console.error("Failed to restore:", err);
    }
  }

  async function handlePermanentDelete(item: DeletedItem) {
    try {
      await trashApi.permanentDelete(item.id, item.type);
      if (item.type === "task") {
        setTasks((prev) => prev.filter((t) => t.id !== item.id));
      } else {
        setBPs((prev) => prev.filter((bp) => bp.id !== item.id));
      }
      setConfirmDelete(null);
    } catch (err) {
      console.error("Failed to permanently delete:", err);
    }
  }

  function daysUntilPurge(deletedAt: string): number {
    const deleted = new Date(deletedAt).getTime();
    const purgeAt = deleted + 30 * 24 * 60 * 60 * 1000;
    const remaining = purgeAt - Date.now();
    return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
  }

  const totalItems = tasks.length + bps.length;

  return (
    <>
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
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
              <h2 className="text-base font-semibold text-stone-800 dark:text-stone-100">
                Recently Deleted
              </h2>
              {totalItems > 0 && (
                <span className="text-xs font-medium text-stone-400 dark:text-stone-500 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-full">
                  {totalItems}
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
            ) : totalItems === 0 ? (
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
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
                <p className="text-sm text-stone-400 dark:text-stone-500">Trash is empty</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Battle Plans */}
                {bps.length > 0 && (
                  <>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500 mt-2 mb-1">
                      Battle Plans
                    </p>
                    {bps.map((bp) => (
                      <div
                        key={bp.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-stone-50 dark:bg-stone-800/50"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-medium text-stone-700 dark:text-stone-300 truncate">
                              {bp.title}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-700 text-stone-500 dark:text-stone-400 shrink-0">
                              {bp.formulaCode}
                            </span>
                          </div>
                          <p className="text-xs text-stone-400 dark:text-stone-500">
                            {daysUntilPurge(bp.deletedAt)} days until permanent deletion
                          </p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            onClick={() => handleRestore(bp)}
                            className={cn(
                              "px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors",
                              accent.text, accent.bgSubtle, accent.bgHover
                            )}
                            title="Restore"
                          >
                            Restore
                          </button>
                          <button
                            onClick={() => setConfirmDelete(bp)}
                            className="px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                            title="Delete permanently"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* Tasks */}
                {tasks.length > 0 && (
                  <>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500 mt-3 mb-1">
                      Tasks
                    </p>
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-stone-50 dark:bg-stone-800/50"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-medium text-stone-700 dark:text-stone-300 truncate">
                              {task.title}
                            </span>
                            {task.category && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-700 text-stone-500 dark:text-stone-400 shrink-0">
                                {task.category}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-stone-400 dark:text-stone-500">
                            {daysUntilPurge(task.deletedAt)} days until permanent deletion
                          </p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            onClick={() => handleRestore(task)}
                            className={cn(
                              "px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors",
                              accent.text, accent.bgSubtle, accent.bgHover
                            )}
                            title="Restore"
                          >
                            Restore
                          </button>
                          <button
                            onClick={() => setConfirmDelete(task)}
                            className="px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                            title="Delete permanently"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-stone-200 dark:border-stone-800">
            <p className="text-xs text-stone-400 dark:text-stone-500 text-center">
              Items are automatically deleted after 30 days
            </p>
          </div>
        </div>
      </div>

      {/* Permanent delete confirmation */}
      {confirmDelete && (
        <ConfirmModal
          title="Permanently Delete?"
          message={`"${confirmDelete.title}" will be gone forever. This cannot be undone.`}
          confirmLabel="Delete Forever"
          onConfirm={() => handlePermanentDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}
