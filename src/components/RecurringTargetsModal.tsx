"use client";

import { useState, useRef, useMemo } from "react";
import { useAppContext, useAccentColor } from "@/context/AppContext";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/dateUtils";
import type { KanbanTask, RecurrenceFrequency } from "@/lib/types";
import Select from "@/components/ui/Select";

interface Props {
  onClose: () => void;
}

const FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

const FREQUENCY_OPTIONS: { value: RecurrenceFrequency | ""; label: string }[] = [
  { value: "", label: "None (stop)" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

export default function RecurringTargetsModal({ onClose }: Props) {
  const { state, dispatch } = useAppContext();
  const accent = useAccentColor();
  const backdropRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFrequency, setEditFrequency] = useState<RecurrenceFrequency | "">("");

  // Find all tasks that currently hold a recurrence_rule (active recurring templates)
  const activeRecurring = useMemo(() => {
    return state.tasks.filter((t) => t.recurrenceRule);
  }, [state.tasks]);

  // Find recently spawned instances grouped by recurrence_source_id
  const recentInstances = useMemo(() => {
    const map = new Map<string, KanbanTask[]>();
    for (const t of state.tasks) {
      if (t.recurrenceSourceId && !t.recurrenceRule) {
        const existing = map.get(t.recurrenceSourceId) || [];
        existing.push(t);
        map.set(t.recurrenceSourceId, existing);
      }
    }
    return map;
  }, [state.tasks]);

  function handleStopRecurrence(task: KanbanTask) {
    dispatch({
      type: "UPDATE_TASK",
      payload: { id: task.id, recurrenceRule: null },
    });
  }

  function handleStartEdit(task: KanbanTask) {
    setEditingId(task.id);
    setEditFrequency(task.recurrenceRule?.frequency || "");
  }

  function handleSaveEdit(task: KanbanTask) {
    if (!editFrequency) {
      // Stop recurrence
      handleStopRecurrence(task);
    } else {
      dispatch({
        type: "UPDATE_TASK",
        payload: {
          id: task.id,
          recurrenceRule: {
            frequency: editFrequency,
            startDate: task.recurrenceRule?.startDate || new Date().toISOString().split("T")[0],
          },
        },
      });
    }
    setEditingId(null);
  }

  // Get linked BP name for a task
  function getBPName(task: KanbanTask): string | null {
    if (!task.weeklyBpId) return null;
    const bp = state.weeklyBattlePlans.find((b) => b.id === task.weeklyBpId);
    return bp ? bp.title : null;
  }

  return (
    <div
      ref={backdropRef}
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Recurring Targets"
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-800 shadow-2xl dark:shadow-black/40 animate-slide-up flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <h2 className="text-sm font-medium text-stone-900 dark:text-stone-100">
            Recurring Targets
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-5 flex-1 min-h-0">
          {activeRecurring.length === 0 ? (
            <div className="text-center py-8">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 text-stone-300 dark:text-stone-600">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              </svg>
              <p className="text-sm text-stone-400 dark:text-stone-500">No active recurring targets</p>
              <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
                Set a recurrence frequency on any task to make it recurring
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeRecurring.map((task) => {
                const bpName = getBPName(task);
                const instances = recentInstances.get(task.recurrenceSourceId || task.id) || [];
                const isEditing = editingId === task.id;

                return (
                  <div
                    key={task.id}
                    className="rounded-lg border border-stone-200 dark:border-stone-700/50 bg-stone-50 dark:bg-stone-800/30 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-stone-800 dark:text-stone-200 truncate">
                          {task.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded font-medium",
                            accent.bgSubtle, accent.text
                          )}>
                            {task.recurrenceRule ? FREQUENCY_LABELS[task.recurrenceRule.frequency] : ""}
                          </span>
                          {task.recurrenceRule?.startDate && (
                            <span className="text-[10px] text-stone-400 dark:text-stone-500">
                              from {formatDate(new Date(task.recurrenceRule.startDate), state.dateFormat)}
                            </span>
                          )}
                          {bpName && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-700/50 text-stone-500 dark:text-stone-400">
                              {bpName}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {isEditing ? (
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(task)}
                            className="text-xs px-2 py-1 rounded bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 hover:bg-stone-700 dark:hover:bg-stone-300 transition-colors"
                          >
                            Save
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(task)}
                              className="text-xs px-2 py-1 rounded text-stone-500 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                              title="Edit frequency"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStopRecurrence(task)}
                              className="text-xs px-2 py-1 rounded text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              title="Stop recurring"
                            >
                              Stop
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {isEditing && (
                      <div className="mt-2">
                        <Select
                          value={editFrequency}
                          onChange={(val) => setEditFrequency(val as RecurrenceFrequency | "")}
                          options={FREQUENCY_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
                        />
                      </div>
                    )}

                    {/* Recent instances spawned from this recurring chain */}
                    {instances.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-stone-200/50 dark:border-stone-700/30">
                        <p className="text-[10px] uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-1">
                          Recent instances ({instances.length})
                        </p>
                        <div className="space-y-1">
                          {instances.slice(0, 3).map((inst) => (
                            <div key={inst.id} className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                              <span className={cn(
                                "w-1.5 h-1.5 rounded-full shrink-0",
                                inst.status === "complete" ? "bg-green-500" :
                                inst.status === "in-progress" ? "bg-amber-500" : "bg-stone-300 dark:bg-stone-600"
                              )} />
                              <span className="truncate">{inst.title}</span>
                              <span className="text-stone-400 dark:text-stone-500 shrink-0">
                                {inst.status === "complete" ? "done" : inst.status === "in-progress" ? "in progress" : "to do"}
                              </span>
                            </div>
                          ))}
                          {instances.length > 3 && (
                            <p className="text-[10px] text-stone-400 dark:text-stone-500">
                              +{instances.length - 3} more
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end px-5 py-3 border-t border-stone-100 dark:border-stone-800/60 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-sm text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
