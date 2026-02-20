"use client";

import { useState, useMemo } from "react";
import { useAppContext, useAccentColor } from "@/context/AppContext";
import { weeklyBPApi, tasksApi } from "@/lib/api";
import { cn, generateId } from "@/lib/utils";
import { CONDITION_FORMULAS, type ConditionFormula } from "@/lib/conditionFormulas";
import { generateWeeklyBPTitle, getWeekEndDate, formatDate } from "@/lib/dateUtils";
import Select from "@/components/ui/Select";

interface WeeklyBPModalProps {
  onClose: () => void;
  editBpId?: string;
}

export default function WeeklyBPModal({ onClose, editBpId }: WeeklyBPModalProps) {
  const { state, dispatch, refreshWeeklyBPs, refreshTasks } = useAppContext();
  const accent = useAccentColor();

  // Get week start date based on user's week settings
  const getWeekStart = () => {
    const now = new Date();
    const { weekStartDay, weekStartHour } = state.weekSettings;

    // Find the most recent week start boundary
    const startBoundary = new Date(now);
    startBoundary.setHours(weekStartHour, 0, 0, 0);

    // Roll back to the correct start day
    const daysSinceStart = (now.getDay() - weekStartDay + 7) % 7;
    startBoundary.setDate(startBoundary.getDate() - daysSinceStart);

    // If we haven't reached the start hour today, go back another week
    if (now < startBoundary) {
      startBoundary.setDate(startBoundary.getDate() - 7);
    }

    return startBoundary.toISOString();
  };

  // Generate default title and compute week-ending date
  const defaultTitle = generateWeeklyBPTitle(state.weekSettings, state.dateFormat);
  const weekEndDate = getWeekEndDate(new Date(), state.weekSettings);
  const weekEndFormatted = formatDate(weekEndDate, state.dateFormat);

  // If editing, find the existing BP
  const existingBP = editBpId ? state.weeklyBattlePlans.find((bp) => bp.id === editBpId) : null;
  const existingTasks = editBpId ? state.tasks.filter((t) => t.weeklyBpId === editBpId) : [];

  const [title, setTitle] = useState(existingBP?.title || defaultTitle);
  const [selectedFormulaId, setSelectedFormulaId] = useState(existingBP?.formulaId || "");
  // Support multiple targets per step: Record<stepId, string[]>
  // In edit mode, this only holds NEW targets (existing tasks are handled separately)
  const [stepTargets, setStepTargets] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState(existingBP?.notes || "");
  const [stepWriteups, setStepWriteups] = useState<Record<string, string>>(
    existingBP?.stepWriteups || {}
  );
  const [submitting, setSubmitting] = useState(false);

  // Track deleted task IDs (for existing tasks)
  const [deletedTaskIds, setDeletedTaskIds] = useState<Set<string>>(new Set());

  // Track edited existing task titles (taskId -> new title)
  const [editedTaskTitles, setEditedTaskTitles] = useState<Record<string, string>>(() => {
    if (existingBP) {
      // Initialize with existing task titles
      const titles: Record<string, string> = {};
      existingTasks.forEach((task) => {
        titles[task.id] = task.title;
      });
      return titles;
    }
    return {};
  });

  // Additional targets (only for NEW targets, not tied to existing tasks)
  const [additionalTargets, setAdditionalTargets] = useState<string[]>([]);

  // Existing additional tasks (for editing mode) - filtered by not deleted
  const existingAdditionalTasks = editBpId
    ? existingTasks.filter((t) => !t.formulaStepId && !deletedTaskIds.has(t.id))
    : [];

  // Helper to delete an existing task
  function markTaskForDeletion(taskId: string) {
    setDeletedTaskIds((prev) => new Set([...prev, taskId]));
  }

  // Helper to update an existing task's title
  function updateExistingTaskTitle(taskId: string, newTitle: string) {
    setEditedTaskTitles((prev) => ({ ...prev, [taskId]: newTitle }));
  }

  const selectedFormula = useMemo(() => {
    return CONDITION_FORMULAS.find((f) => f.id === selectedFormulaId);
  }, [selectedFormulaId]);

  // Group formulas by related conditions for better UX
  const groupedFormulas = useMemo(() => {
    const groups: { name: string; formulas: ConditionFormula[] }[] = [
      { name: "Power Conditions", formulas: CONDITION_FORMULAS.filter((f) => f.id.startsWith("power")) },
      { name: "Affluence Conditions", formulas: CONDITION_FORMULAS.filter((f) => f.id.includes("affluence")) },
      { name: "Operating Conditions", formulas: CONDITION_FORMULAS.filter((f) => ["normal-operation", "emergency"].includes(f.id)) },
      { name: "Danger Conditions", formulas: CONDITION_FORMULAS.filter((f) => f.id.includes("danger")) },
      { name: "Non-Existence Conditions", formulas: CONDITION_FORMULAS.filter((f) => f.id.includes("non-existence")) },
      { name: "Lower Conditions", formulas: CONDITION_FORMULAS.filter((f) => ["liability", "doubt", "enemy", "treason", "confusion", "expanded-confusion"].includes(f.id)) },
    ];
    return groups.filter((g) => g.formulas.length > 0);
  }, []);

  function updateStepWriteup(stepId: string, value: string) {
    setStepWriteups((prev) => ({ ...prev, [stepId]: value }));
  }

  function handleFormulaChange(formulaId: string) {
    setSelectedFormulaId(formulaId);
    // Clear step targets when formula changes (unless editing)
    if (!editBpId) {
      setStepTargets({});
    }
  }

  // Helper to update a specific target in a step
  function updateStepTarget(stepId: string, index: number, value: string) {
    setStepTargets((prev) => {
      const current = prev[stepId] || [""];
      const updated = [...current];
      updated[index] = value;
      return { ...prev, [stepId]: updated };
    });
  }

  // Helper to add another target to a step
  function addStepTarget(stepId: string) {
    setStepTargets((prev) => {
      const current = prev[stepId] || [];
      return { ...prev, [stepId]: [...current, ""] };
    });
  }

  // Helper to remove a target from a step
  function removeStepTarget(stepId: string, index: number) {
    setStepTargets((prev) => {
      const current = prev[stepId] || [];
      if (current.length <= 1) return prev;
      const updated = current.filter((_, i) => i !== index);
      return { ...prev, [stepId]: updated };
    });
  }

  // Helper functions for additional targets
  function updateAdditionalTarget(index: number, value: string) {
    setAdditionalTargets((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  }

  function addAdditionalTarget() {
    setAdditionalTargets((prev) => [...prev, ""]);
  }

  function removeAdditionalTarget(index: number) {
    setAdditionalTargets((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!selectedFormula || !title.trim()) return;

    setSubmitting(true);
    try {
      if (editBpId && existingBP) {
        // Update existing BP - update title/notes/writeups
        const cleanedWriteups = Object.fromEntries(
          Object.entries(stepWriteups).filter(([, v]) => v.trim())
        );
        await weeklyBPApi.update(editBpId, {
          title: title.trim(),
          notes: notes.trim() || undefined,
          stepWriteups: Object.keys(cleanedWriteups).length > 0 ? cleanedWriteups : undefined,
        });

        // Delete tasks marked for deletion
        for (const taskId of deletedTaskIds) {
          dispatch({
            type: "DELETE_TASK",
            payload: { id: taskId },
          });
        }

        // Update existing tasks that have been edited
        for (const task of existingTasks) {
          // Skip deleted tasks
          if (deletedTaskIds.has(task.id)) continue;

          const newTitle = editedTaskTitles[task.id];
          // Only update if title changed and task is not complete
          if (newTitle !== undefined && newTitle !== task.title && task.status !== "complete") {
            dispatch({
              type: "UPDATE_TASK",
              payload: {
                id: task.id,
                title: newTitle.trim(),
              },
            });
          }
        }

        // Create new tasks for formula steps - use API directly to ensure persistence
        const newTaskPromises: Promise<unknown>[] = [];
        for (const step of selectedFormula.steps) {
          const targets = stepTargets[step.id] || [];

          for (const target of targets) {
            const trimmedTarget = target.trim();
            if (trimmedTarget) {
              const newTask = {
                id: generateId(),
                title: trimmedTarget,
                description: `Step ${step.stepNumber}: ${step.description}`,
                status: "todo" as const,
                order: 0,
                createdAt: new Date().toISOString(),
                weeklyBpId: editBpId,
                formulaStepId: step.id,
              };
              newTaskPromises.push(tasksApi.create(newTask));
            }
          }
        }

        // Create new additional targets
        for (const target of additionalTargets) {
          const trimmedTarget = target.trim();
          if (trimmedTarget) {
            const newTask = {
              id: generateId(),
              title: trimmedTarget,
              description: "Additional target",
              status: "todo" as const,
              order: 0,
              createdAt: new Date().toISOString(),
              weeklyBpId: editBpId,
            };
            newTaskPromises.push(tasksApi.create(newTask));
          }
        }

        // Wait for all new tasks to be created on the server
        await Promise.all(newTaskPromises);
      } else {
        // Create new BP - collect all tasks from all steps
        const tasks: { id: string; title: string; description: string; order: number; formulaStepId?: string }[] = [];
        let taskIndex = 0;

        for (const step of selectedFormula.steps) {
          const targets = stepTargets[step.id] || [];
          for (const target of targets) {
            const trimmedTarget = target.trim();
            if (trimmedTarget) {
              tasks.push({
                id: generateId(),
                title: trimmedTarget,
                description: `Step ${step.stepNumber}: ${step.description}`,
                order: taskIndex,
                formulaStepId: step.id,
              });
              taskIndex++;
            }
          }
        }

        // Add additional targets (not tied to formula steps)
        for (const target of additionalTargets) {
          const trimmedTarget = target.trim();
          if (trimmedTarget) {
            tasks.push({
              id: generateId(),
              title: trimmedTarget,
              description: "Additional target",
              order: taskIndex,
            });
            taskIndex++;
          }
        }

        const result = await weeklyBPApi.create({
          id: generateId(),
          title: title.trim(),
          weekStart: getWeekStart(),
          formulaId: selectedFormula.id,
          formulaName: selectedFormula.name,
          formulaCode: selectedFormula.code,
          notes: notes.trim() || undefined,
          stepWriteups: (() => {
            const w = Object.fromEntries(Object.entries(stepWriteups).filter(([, v]) => v.trim()));
            return Object.keys(w).length > 0 ? w : undefined;
          })(),
          tasks,
        });

        dispatch({ type: "ADD_WEEKLY_BP", payload: result.weeklyBattlePlan });
      }

      // Refresh to get updated progress counts and tasks
      await Promise.all([refreshWeeklyBPs(), refreshTasks()]);

      onClose();
    } catch (error) {
      console.error("Failed to save weekly battle plan:", error);
      alert(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-stone-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-200">
            {editBpId ? "Edit Weekly Battle Plan" : "Create Weekly Battle Plan"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={cn(
                "w-full px-3 py-2 text-sm bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2",
                accent.ring
              )}
              placeholder={defaultTitle}
            />
            {!editBpId && (
              <p className="mt-1.5 text-xs text-stone-400 dark:text-stone-500">
                Week ending: {weekEndFormatted}
              </p>
            )}
          </div>

          {/* Formula Selection */}
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">
              Condition Formula
            </label>
            <Select
              value={selectedFormulaId}
              onChange={handleFormulaChange}
              groups={[
                { label: "", options: [{ value: "", label: "Select a condition formula..." }] },
                ...groupedFormulas.map((group) => ({
                  label: group.name,
                  options: group.formulas.map((formula) => ({
                    value: formula.id,
                    label: `${formula.name} (${formula.code}) - ${formula.steps.length} steps`,
                  })),
                })),
              ]}
              placeholder="Select a condition formula..."
              className={editBpId ? "opacity-60 pointer-events-none" : ""}
            />
          </div>

          {/* Formula Steps */}
          {selectedFormula && (
            <div>
              <h3 className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-3">
                Formula Steps
              </h3>
              <div className="space-y-4">
                {selectedFormula.steps.map((step) => {
                  // Filter out deleted tasks
                  const existingStepTasks = existingTasks.filter(
                    (t) => t.formulaStepId === step.id && !deletedTaskIds.has(t.id)
                  );
                  // Always ensure at least one input slot exists for new targets
                  const targets = stepTargets[step.id] || [""];
                  const displayTargets = targets.length === 0 ? [""] : targets;

                  return (
                    <div key={step.id} className="bg-stone-50 dark:bg-stone-800/50 rounded-lg p-4">
                      <div className="flex items-start gap-3 mb-2">
                        <span className={cn(
                          "shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold",
                          accent.bgSubtle, accent.text
                        )}>
                          {step.stepNumber}
                        </span>
                        <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                      {/* Write-up textarea */}
                      <div className="ml-10 mt-2 mb-2">
                        <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
                          Write-up
                        </label>
                        <textarea
                          value={stepWriteups[step.id] || ""}
                          onChange={(e) => updateStepWriteup(step.id, e.target.value)}
                          rows={2}
                          className={cn(
                            "w-full px-3 py-2 text-sm bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2 resize-none",
                            accent.ring
                          )}
                          placeholder="Describe your approach for this step..."
                        />
                      </div>
                      <div className="ml-10 space-y-2">
                        {/* Show existing tasks - editable if not complete */}
                        {existingStepTasks.map((task) => {
                          const isComplete = task.status === "complete";
                          return (
                            <div key={task.id} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editedTaskTitles[task.id] ?? task.title}
                                onChange={(e) => updateExistingTaskTitle(task.id, e.target.value)}
                                disabled={isComplete}
                                className={cn(
                                  "flex-1 px-3 py-2 text-sm bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded border border-stone-200 dark:border-stone-700",
                                  isComplete
                                    ? "opacity-60 cursor-not-allowed"
                                    : cn("focus:outline-none focus:ring-2", accent.ring)
                                )}
                              />
                              {isComplete ? (
                                <span className="text-xs text-green-600 dark:text-green-400 shrink-0 flex items-center gap-1">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                  Done
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => markTaskForDeletion(task.id)}
                                  className="p-1.5 text-stone-400 hover:text-red-500 transition-colors"
                                  title="Delete target"
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          );
                        })}

                        {/* Show new target inputs - use stable key based on step.id and index */}
                        {displayTargets.map((target, index) => (
                          <div key={`${step.id}-target-${index}`} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={target}
                              onChange={(e) => updateStepTarget(step.id, index, e.target.value)}
                              placeholder="Enter your target for this step..."
                              className={cn(
                                "flex-1 px-3 py-2 text-sm bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2",
                                accent.ring
                              )}
                            />
                            {displayTargets.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeStepTarget(step.id, index)}
                                className="p-1.5 text-stone-400 hover:text-red-500 transition-colors"
                                title="Remove target"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </button>
                            )}
                          </div>
                        ))}

                        {/* Add another target button */}
                        <button
                          type="button"
                          onClick={() => addStepTarget(step.id)}
                          className={cn(
                            "flex items-center gap-1.5 text-xs transition-colors",
                            accent.text, accent.textHover
                          )}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                          Add another target
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Additional Targets */}
          {selectedFormula && (
            <div>
              <h3 className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-3">
                Additional Targets
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mb-3">
                Add any extra targets for this week that aren&apos;t tied to a specific formula step.
              </p>
              <div className="space-y-2">
                {/* Show existing additional tasks - editable if not complete */}
                {existingAdditionalTasks.map((task) => {
                  const isComplete = task.status === "complete";
                  return (
                    <div key={task.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editedTaskTitles[task.id] ?? task.title}
                        onChange={(e) => updateExistingTaskTitle(task.id, e.target.value)}
                        disabled={isComplete}
                        className={cn(
                          "flex-1 px-3 py-2 text-sm bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded border border-stone-200 dark:border-stone-700",
                          isComplete
                            ? "opacity-60 cursor-not-allowed"
                            : cn("focus:outline-none focus:ring-2", accent.ring)
                        )}
                      />
                      {isComplete ? (
                        <span className="text-xs text-green-600 dark:text-green-400 shrink-0 flex items-center gap-1">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Done
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => markTaskForDeletion(task.id)}
                          className="p-1.5 text-stone-400 hover:text-red-500 transition-colors"
                          title="Delete target"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* New additional targets */}
                {additionalTargets.map((target, index) => (
                  <div key={`new-additional-${index}`} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={target}
                      onChange={(e) => updateAdditionalTarget(index, e.target.value)}
                      placeholder="Enter an additional target..."
                      className={cn(
                        "flex-1 px-3 py-2 text-sm bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2",
                        accent.ring
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => removeAdditionalTarget(index)}
                      className="p-1.5 text-stone-400 hover:text-red-500 transition-colors"
                      title="Remove target"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}

                {/* Add another target button */}
                <button
                  type="button"
                  onClick={addAdditionalTarget}
                  className={cn(
                    "flex items-center gap-1.5 text-xs transition-colors",
                    accent.text, accent.textHover
                  )}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add additional target
                </button>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={cn(
                "w-full px-3 py-2 text-sm bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2 resize-none",
                accent.ring
              )}
              placeholder="Any additional notes about this week's plan..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-stone-200 dark:border-stone-800 flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-stone-600 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedFormula || !title.trim()}
            className="px-4 py-2 text-sm font-medium text-white rounded transition-colors disabled:opacity-50"
            style={{ backgroundColor: accent.swatch }}
            onMouseEnter={(e) => e.currentTarget.style.filter = "brightness(1.1)"}
            onMouseLeave={(e) => e.currentTarget.style.filter = ""}
          >
            {submitting ? "Saving..." : editBpId ? "Save Changes" : "Create Battle Plan"}
          </button>
        </div>
      </div>
    </div>
  );
}
