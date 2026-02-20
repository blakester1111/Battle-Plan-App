"use client";

import { useState, useMemo } from "react";
import { useAppContext, useAccentColor } from "@/context/AppContext";
import { tasksApi } from "@/lib/api";
import { cn, generateId } from "@/lib/utils";
import { CONDITION_FORMULAS, type ConditionFormula } from "@/lib/conditionFormulas";
import { getWeekEndDate, formatDate } from "@/lib/dateUtils";
import Select from "@/components/ui/Select";

interface ForwardTasksModalProps {
  sourceBpId: string;
  onClose: () => void;
}

export default function ForwardTasksModal({ sourceBpId, onClose }: ForwardTasksModalProps) {
  const { state, refreshWeeklyBPs, refreshTasks } = useAppContext();
  const accent = useAccentColor();

  // Get incomplete, non-forwarded tasks from the source BP
  const forwardableTasks = useMemo(
    () =>
      state.tasks.filter(
        (t) =>
          t.weeklyBpId === sourceBpId &&
          t.status !== "complete" &&
          !t.forwardedToTaskId
      ),
    [state.tasks, sourceBpId]
  );

  const sourceBp = state.weeklyBattlePlans.find((bp) => bp.id === sourceBpId);

  // Existing BPs that could be targets (exclude the source BP)
  const existingTargetBPs = useMemo(
    () => state.weeklyBattlePlans.filter((bp) => bp.id !== sourceBpId),
    [state.weeklyBattlePlans, sourceBpId]
  );

  // Generate upcoming week-ending dates
  const upcomingWeekEndings = useMemo(() => {
    const endings: { date: Date; label: string; weekStart: string }[] = [];
    const now = new Date();
    const baseEnd = getWeekEndDate(now, state.weekSettings);

    for (let i = 0; i < 6; i++) {
      const weekEnd = new Date(baseEnd);
      weekEnd.setDate(weekEnd.getDate() + i * 7);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 7);
      endings.push({
        date: weekEnd,
        label: `W/E ${formatDate(weekEnd, state.dateFormat)}`,
        weekStart: weekStart.toISOString().split("T")[0],
      });
    }
    return endings;
  }, [state.weekSettings, state.dateFormat]);

  // State
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(
    () => new Set(forwardableTasks.map((t) => t.id))
  );
  const [targetMode, setTargetMode] = useState<"new" | "existing">("new");
  const [targetBpId, setTargetBpId] = useState("");
  const [selectedWeekIdx, setSelectedWeekIdx] = useState(0);
  const [selectedFormulaId, setSelectedFormulaId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Group formulas for the dropdown (same pattern as WeeklyBPModal)
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

  const selectedFormula = CONDITION_FORMULAS.find((f) => f.id === selectedFormulaId);

  function toggleTask(taskId: string) {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  function toggleAll() {
    if (selectedTaskIds.size === forwardableTasks.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(forwardableTasks.map((t) => t.id)));
    }
  }

  const canSubmit =
    selectedTaskIds.size > 0 &&
    (targetMode === "existing" ? targetBpId !== "" : selectedFormulaId !== "");

  async function handleSubmit() {
    if (!canSubmit) return;
    setError("");
    setSubmitting(true);

    try {
      const payload: Parameters<typeof tasksApi.forward>[0] = {
        sourceTaskIds: Array.from(selectedTaskIds),
      };

      if (targetMode === "existing") {
        payload.targetBpId = targetBpId;
      } else {
        const weekEnding = upcomingWeekEndings[selectedWeekIdx];
        const formula = selectedFormula!;
        payload.createBp = {
          id: generateId(),
          title: weekEnding.label,
          weekStart: weekEnding.weekStart,
          formulaId: formula.id,
          formulaName: formula.name,
          formulaCode: formula.code,
        };
      }

      await tasksApi.forward(payload);
      await Promise.all([refreshTasks(), refreshWeeklyBPs()]);
      onClose();
    } catch (err) {
      console.error("Failed to forward tasks:", err);
      setError(err instanceof Error ? err.message : "Failed to forward tasks");
    } finally {
      setSubmitting(false);
    }
  }

  const STATUS_LABELS: Record<string, string> = {
    todo: "To Do",
    "in-progress": "In Progress",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-16"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-stone-900 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col animate-slide-up border border-stone-200 dark:border-stone-700"
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
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            <h2 className="text-base font-semibold text-stone-800 dark:text-stone-100">
              Forward Incomplete Targets
            </h2>
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
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Source BP info */}
          {sourceBp && (
            <div className="text-xs text-stone-500 dark:text-stone-400">
              From: <span className="font-medium text-stone-700 dark:text-stone-300">{sourceBp.title}</span>
              <span className="ml-2 px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-700 text-stone-500 dark:text-stone-400">
                {sourceBp.formulaCode}
              </span>
            </div>
          )}

          {/* Task Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-stone-700 dark:text-stone-300">
                Select Targets ({selectedTaskIds.size}/{forwardableTasks.length})
              </h3>
              <button
                onClick={toggleAll}
                className="text-xs text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
              >
                {selectedTaskIds.size === forwardableTasks.length ? "Deselect All" : "Select All"}
              </button>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {forwardableTasks.map((task) => (
                <label
                  key={task.id}
                  className={cn(
                    "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors",
                    selectedTaskIds.has(task.id)
                      ? accent.bgSubtle
                      : "bg-stone-50 dark:bg-stone-800/50 hover:bg-stone-100 dark:hover:bg-stone-800/70"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedTaskIds.has(task.id)}
                    onChange={() => toggleTask(task.id)}
                    className="rounded border-stone-300 dark:border-stone-600"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-stone-700 dark:text-stone-300 truncate">{task.title}</p>
                    {task.description && (
                      <p className="text-xs text-stone-400 dark:text-stone-500 truncate">{task.description}</p>
                    )}
                  </div>
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded shrink-0",
                    task.status === "in-progress"
                      ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                      : "bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-400"
                  )}>
                    {STATUS_LABELS[task.status] || task.status}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Target Selection */}
          <div>
            <h3 className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
              Forward To
            </h3>

            {/* Mode Toggle */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setTargetMode("new")}
                className={cn(
                  "flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition-colors",
                  targetMode === "new"
                    ? `${accent.border} ${accent.bgSubtle} ${accent.text}`
                    : "border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800"
                )}
              >
                Create New BP
              </button>
              {existingTargetBPs.length > 0 && (
                <button
                  onClick={() => setTargetMode("existing")}
                  className={cn(
                    "flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition-colors",
                    targetMode === "existing"
                      ? `${accent.border} ${accent.bgSubtle} ${accent.text}`
                      : "border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800"
                  )}
                >
                  Existing BP
                </button>
              )}
            </div>

            {targetMode === "new" ? (
              <div className="space-y-3">
                {/* Week Ending Selector */}
                <div>
                  <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
                    Week Ending
                  </label>
                  <Select
                    value={String(selectedWeekIdx)}
                    onChange={(val) => setSelectedWeekIdx(Number(val))}
                    options={upcomingWeekEndings.map((we, idx) => ({ value: String(idx), label: we.label }))}
                  />
                </div>

                {/* Formula Selector */}
                <div>
                  <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
                    Condition Formula
                  </label>
                  <Select
                    value={selectedFormulaId}
                    onChange={setSelectedFormulaId}
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
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
                  Select Battle Plan
                </label>
                <Select
                  value={targetBpId}
                  onChange={setTargetBpId}
                  options={[
                    { value: "", label: "Select a battle plan..." },
                    ...existingTargetBPs.map((bp) => ({ value: bp.id, label: `${bp.title} (${bp.formulaCode})` })),
                  ]}
                  placeholder="Select a battle plan..."
                />
              </div>
            )}
          </div>

          {/* Error display */}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-stone-200 dark:border-stone-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-stone-600 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2",
              canSubmit && !submitting
                ? `${accent.bg} text-white hover:brightness-110`
                : "bg-stone-200 dark:bg-stone-700 text-stone-400 dark:text-stone-500 cursor-not-allowed"
            )}
          >
            {submitting ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Forwarding...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                Forward {selectedTaskIds.size} Target{selectedTaskIds.size !== 1 ? "s" : ""}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
