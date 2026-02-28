"use client";

import { useState, useEffect, useRef } from "react";
import type { KanbanTask, ColumnStatus, CardLabel, Priority, DEFAULT_CATEGORIES, RecurrenceFrequency, RecurrenceRule } from "@/lib/types";
import { DEFAULT_CATEGORIES as CATEGORIES } from "@/lib/types";
import { useAppContext, useAccentColor } from "@/context/AppContext";
import { cn, LABEL_COLORS, PRIORITY_COLORS, PRIORITY_LABELS } from "@/lib/utils";
import { CONDITION_FORMULAS, getStepById } from "@/lib/conditionFormulas";
import { getWeekStartDate } from "@/lib/dateUtils";
import Select from "@/components/ui/Select";
import ConfirmModal from "@/components/ConfirmModal";

interface Props {
  task?: KanbanTask;
  defaultStatus?: ColumnStatus;
  onClose: () => void;
}

const COLUMN_LABELS: Record<ColumnStatus, string> = {
  todo: "To Do",
  "in-progress": "In Progress",
  complete: "Complete",
};

const SELECTABLE_LABELS: CardLabel[] = [
  "none",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
];

const SELECTABLE_PRIORITIES: Priority[] = ["none", "low", "medium", "high"];

const RECURRENCE_OPTIONS: { value: RecurrenceFrequency | ""; label: string }[] = [
  { value: "", label: "None" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

// Convert ISO string to datetime-local input value (YYYY-MM-DDTHH:mm)
function toDatetimeLocalValue(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

export default function KanbanCardModal({
  task,
  defaultStatus = "todo",
  onClose,
}: Props) {
  const { state, dispatch } = useAppContext();
  const accent = useAccentColor();
  const allCategories = [...CATEGORIES, ...state.customCategories];

  // Find the BP for the current week (if any) — used as default for new tasks
  const currentWeekBpId = (() => {
    if (state.weeklyBattlePlans.length === 0) return "";
    const ws = getWeekStartDate(new Date(), state.weekSettings);
    const wsY = ws.getFullYear(), wsM = ws.getMonth(), wsD = ws.getDate();
    return state.weeklyBattlePlans.find((bp) => {
      // Handle both "YYYY-MM-DD" and full ISO formats
      const d = bp.weekStart.includes("T")
        ? new Date(bp.weekStart)
        : new Date(bp.weekStart + "T00:00:00");
      return d.getFullYear() === wsY && d.getMonth() === wsM && d.getDate() === wsD;
    })?.id || "";
  })();

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<ColumnStatus>(
    task?.status ?? defaultStatus
  );
  const [label, setLabel] = useState<CardLabel>(task?.label ?? "none");
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "none");
  const [category, setCategory] = useState<string>(task?.category ?? "");
  const [bugged, setBugged] = useState<boolean>(task?.bugged ?? false);
  const [formulaStepId, setFormulaStepId] = useState<string>(task?.formulaStepId ?? "");
  const [weeklyBpId, setWeeklyBpId] = useState<string>(task?.weeklyBpId ?? state.activeWeeklyBpId ?? currentWeekBpId);
  const [dueAt, setDueAt] = useState<string>(task?.dueAt ? toDatetimeLocalValue(task.dueAt) : "");
  const [reminderAt, setReminderAt] = useState<string>(task?.reminderAt ? toDatetimeLocalValue(task.reminderAt) : "");
  const [completedAt, setCompletedAt] = useState<string>(task?.completedAt ? task.completedAt.split("T")[0] : "");
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency | "">(task?.recurrenceRule?.frequency ?? "");
  const [recurrenceStartDate, setRecurrenceStartDate] = useState<string>(task?.recurrenceRule?.startDate?.split("T")[0] ?? new Date().toISOString().split("T")[0]);
  const backdropRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Get current step info if set
  const currentStep = formulaStepId ? getStepById(formulaStepId) : null;
  const currentFormula = currentStep
    ? CONDITION_FORMULAS.find((f) => f.id === currentStep.formulaId)
    : null;

  // If the selected BP has a formula, only show that formula's steps
  const selectedBP = weeklyBpId
    ? state.weeklyBattlePlans.find((bp) => bp.id === weeklyBpId)
    : null;
  const bpFormula = selectedBP?.formulaId
    ? CONDITION_FORMULAS.find((f) => f.id === selectedBP.formulaId)
    : null;
  const formulaStepGroups = bpFormula
    ? [{ label: `${bpFormula.name} (${bpFormula.code})`, options: bpFormula.steps.map((step) => ({
        value: step.id,
        label: `${bpFormula.code}-${step.stepNumber}: ${step.description.slice(0, 50)}${step.description.length > 50 ? "..." : ""}`,
      })) }]
    : CONDITION_FORMULAS.map((formula) => ({
        label: `${formula.name} (${formula.code})`,
        options: formula.steps.map((step) => ({
          value: step.id,
          label: `${formula.code}-${step.stepNumber}: ${step.description.slice(0, 50)}${step.description.length > 50 ? "..." : ""}`,
        })),
      }));

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();

      if (e.key === "Tab" && formRef.current) {
        const focusable = formRef.current.querySelectorAll<HTMLElement>(
          'input, textarea, select, button, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    const recurrenceRule: RecurrenceRule | undefined = recurrenceFrequency
      ? { frequency: recurrenceFrequency, startDate: recurrenceStartDate }
      : undefined;

    if (task) {
      dispatch({
        type: "UPDATE_TASK",
        payload: {
          id: task.id,
          title: trimmedTitle,
          description,
          label,
          priority,
          category: category || null,
          bugged: bugged || undefined,
          formulaStepId: formulaStepId || null,
          weeklyBpId: weeklyBpId || null,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
          reminderAt: reminderAt ? new Date(reminderAt).toISOString() : null,
          recurrenceRule: recurrenceRule || null,
          completedAt: status === "complete" && completedAt ? new Date(completedAt).toISOString() : status === "complete" ? undefined : null,
        },
      });
      if (status !== task.status) {
        dispatch({
          type: "MOVE_TASK",
          payload: { taskId: task.id, toStatus: status, toIndex: 0 },
        });
      }
    } else {
      dispatch({
        type: "ADD_TASK",
        payload: {
          title: trimmedTitle,
          description,
          status,
          label,
          priority,
          category: category || undefined,
          bugged: bugged || undefined,
          formulaStepId: formulaStepId || undefined,
          weeklyBpId: weeklyBpId || undefined,
          dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
          reminderAt: reminderAt ? new Date(reminderAt).toISOString() : undefined,
          recurrenceRule,
        },
      });
    }
    onClose();
  }

  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  function handleDelete() {
    if (task) {
      dispatch({ type: "DELETE_TASK", payload: { id: task.id } });
      onClose();
    }
  }

  return (
    <>
    <div
      ref={backdropRef}
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={task ? "Edit card" : "New card"}
    >
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="w-full max-w-lg bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-800 shadow-2xl dark:shadow-black/40 animate-slide-up flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-medium text-stone-900 dark:text-stone-100 px-5 pt-5 pb-3 shrink-0">
          {task ? "Edit Card" : "New Card"}
        </h2>

        <div className="space-y-3 overflow-y-auto px-5 flex-1 min-h-0">
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-1.5">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className={cn(
                "w-full rounded px-3 py-2 text-sm bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700/50 focus:outline-none focus:ring-2 placeholder:text-stone-400 transition-shadow",
                accent.ring
              )}
              placeholder="Card title"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={cn(
                "w-full rounded px-3 py-2 text-sm bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700/50 focus:outline-none focus:ring-2 placeholder:text-stone-400 transition-shadow",
                accent.ring
              )}
              placeholder="Optional description"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-1.5">
              Label
            </label>
            <div className="flex items-center gap-3">
              {SELECTABLE_LABELS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setLabel(color)}
                  className={cn(
                    "w-5 h-5 rounded-full transition-transform",
                    label === color && "scale-125"
                  )}
                  style={{
                    backgroundColor:
                      color === "none" ? "transparent" : LABEL_COLORS[color],
                    border:
                      color === "none"
                        ? "2px dashed currentColor"
                        : "2px solid transparent",
                    outline:
                      label === color ? "2px solid currentColor" : "none",
                    outlineOffset: "2px",
                    opacity: color === "none" ? 0.35 : 1,
                  }}
                  aria-label={`Label: ${color}`}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-1.5">
              Priority
            </label>
            <div className="flex items-center gap-1.5">
              {SELECTABLE_PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-all",
                    priority === p
                      ? "bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 font-medium"
                      : "text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
                  )}
                >
                  {p !== "none" && (
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: PRIORITY_COLORS[p] }}
                    />
                  )}
                  {PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-1.5">
              Category
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setCategory("")}
                className={cn(
                  "px-2 py-1 rounded text-xs transition-all",
                  category === ""
                    ? "bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 font-medium"
                    : "text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
                )}
              >
                None
              </button>
              {allCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={cn(
                    "px-2 py-1 rounded text-xs transition-all",
                    category === cat
                      ? "bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 font-medium"
                      : "text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-1.5">
              Bugged?
            </label>
            <button
              type="button"
              onClick={() => setBugged(!bugged)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded transition-all",
                bugged
                  ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50"
                  : "bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700/50 hover:border-stone-300 dark:hover:border-stone-600"
              )}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke={bugged ? "#f87171" : "currentColor"}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={bugged ? "" : "text-stone-400 dark:text-stone-500"}
              >
                <path d="M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3.003 3.003 0 116 0v1" />
                <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 014-4h4a4 4 0 014 4v3c0 3.3-2.7 6-6 6" />
                <path d="M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M20.97 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4" />
              </svg>
              <span className={cn(
                "text-sm",
                bugged ? "text-red-500 dark:text-red-400 font-medium" : "text-stone-500 dark:text-stone-400"
              )}>
                {bugged ? "Bugged" : "Mark as bugged"}
              </span>
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-1.5">
              Status
            </label>
            <Select
              value={status}
              onChange={(val) => setStatus(val as ColumnStatus)}
              options={(Object.entries(COLUMN_LABELS) as [ColumnStatus, string][]).map(([v, l]) => ({ value: v, label: l }))}
            />
          </div>

          {/* Completed on date picker (only shown for completed tasks) */}
          {status === "complete" && (
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-1.5">
                Completed On
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={completedAt}
                  onChange={(e) => setCompletedAt(e.target.value)}
                  className={cn(
                    "flex-1 rounded px-3 py-2 text-sm bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700/50 focus:outline-none focus:ring-2 transition-shadow",
                    accent.ring
                  )}
                />
                {completedAt && (
                  <button
                    type="button"
                    onClick={() => setCompletedAt("")}
                    className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
                  >
                    Clear
                  </button>
                )}
              </div>
              <p className="mt-1 text-[10px] text-stone-400 dark:text-stone-500">
                Set the date this task was actually completed. Useful for backdating to the correct week.
              </p>
            </div>
          )}

          {/* Weekly Battle Plan Assignment */}
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-1.5">
              Weekly Battle Plan
            </label>
            <Select
              value={weeklyBpId}
              onChange={(newBpId) => {
                setWeeklyBpId(newBpId);
                // Clear formula step if it doesn't belong to the new BP's formula
                if (formulaStepId) {
                  const newBP = state.weeklyBattlePlans.find((bp) => bp.id === newBpId);
                  if (newBP?.formulaId) {
                    const newFormula = CONDITION_FORMULAS.find((f) => f.id === newBP.formulaId);
                    if (newFormula && !newFormula.steps.some((s) => s.id === formulaStepId)) {
                      setFormulaStepId("");
                    }
                  }
                }
              }}
              options={[
                { value: "", label: "None" },
                ...state.weeklyBattlePlans.map((bp) => ({ value: bp.id, label: `${bp.title} (${bp.formulaCode})` })),
              ]}
            />
          </div>

          {/* Formula Step Assignment */}
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-1.5">
              Formula Step (optional)
            </label>
            <Select
              value={formulaStepId}
              onChange={setFormulaStepId}
              groups={[
                { label: "", options: [{ value: "", label: "None (additional target)" }] },
                ...formulaStepGroups,
              ]}
              placeholder="None"
            />
            {currentStep && currentFormula && (
              <div className={cn("mt-2 p-2 rounded text-xs", accent.bgSubtle, accent.text)}>
                <span className="font-medium">{currentFormula.code}-{currentStep.stepNumber}:</span> {currentStep.description}
              </div>
            )}
          </div>

          {/* TM (Time Due) */}
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-1.5">
              TM (Time Due)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className={cn(
                  "flex-1 rounded px-3 py-2 text-sm bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700/50 focus:outline-none focus:ring-2 transition-shadow",
                  accent.ring
                )}
              />
              {dueAt && (
                <button
                  type="button"
                  onClick={() => setDueAt("")}
                  className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Reminder */}
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-1.5">
              Reminder
            </label>
            <div className="flex items-center gap-2">
              <input
                type="datetime-local"
                value={reminderAt}
                onChange={(e) => setReminderAt(e.target.value)}
                className={cn(
                  "flex-1 rounded px-3 py-2 text-sm bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700/50 focus:outline-none focus:ring-2 transition-shadow",
                  accent.ring
                )}
              />
              {reminderAt && (
                <button
                  type="button"
                  onClick={() => setReminderAt("")}
                  className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Recurring */}
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-1.5">
              Recurring
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Select
                  value={recurrenceFrequency}
                  onChange={(val) => setRecurrenceFrequency(val as RecurrenceFrequency | "")}
                  options={RECURRENCE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
                />
              </div>
              {recurrenceFrequency && (
                <input
                  type="date"
                  value={recurrenceStartDate}
                  onChange={(e) => setRecurrenceStartDate(e.target.value)}
                  className={cn(
                    "rounded px-3 py-2 text-sm bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700/50 focus:outline-none focus:ring-2 transition-shadow",
                    accent.ring
                  )}
                />
              )}
            </div>
            {recurrenceFrequency && (
              <p className="mt-1.5 text-[10px] text-stone-400 dark:text-stone-500">
                Repeats {recurrenceFrequency} from {recurrenceStartDate}. A new task is automatically created on schedule.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-stone-100 dark:border-stone-800/60 shrink-0">
          <div>
            {task && (
              <button
                type="button"
                onClick={() => setShowConfirmDelete(true)}
                className="text-sm text-red-400 hover:text-red-500 dark:text-red-400/70 dark:hover:text-red-400 transition-colors"
              >
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-3 py-1.5 text-sm text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded px-4 py-1.5 text-sm font-medium bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 hover:bg-stone-700 dark:hover:bg-stone-300 transition-colors"
            >
              {task ? "Save" : "Create"}
            </button>
          </div>
        </div>
      </form>
    </div>

    {showConfirmDelete && task && (
      <ConfirmModal
        title="Delete Task?"
        message={`"${task.title}" will be moved to the trash. You can restore it within 30 days.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setShowConfirmDelete(false)}
      />
    )}
    </>
  );
}
