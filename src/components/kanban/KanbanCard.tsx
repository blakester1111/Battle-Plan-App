"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAppContext, useAccentColor } from "@/context/AppContext";
import type { KanbanTask } from "@/lib/types";
import { cn, LABEL_COLORS, PRIORITY_COLORS, PRIORITY_LABELS } from "@/lib/utils";
import { getStepLabel, getStepById } from "@/lib/conditionFormulas";

// Formula badge style - neutral gray for readability
const FORMULA_BADGE_STYLE = "bg-gray-100 text-gray-600 dark:bg-stone-700 dark:text-stone-400";

interface Props {
  task: KanbanTask;
  isOverlay?: boolean;
  onClick?: () => void;
  onMarkComplete?: () => void;
}

export default function KanbanCard({ task, isOverlay, onClick, onMarkComplete }: Props) {
  const { state } = useAppContext();
  const accent = useAccentColor();
  const showCompleteCheckbox = task.status === "in-progress" || task.status === "todo";
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const hasLabel = task.label && task.label !== "none";
  const hasPriority = task.priority && task.priority !== "none";

  // Get formula code from the weekly BP if task is linked to one
  const linkedBP = task.weeklyBpId
    ? state.weeklyBattlePlans.find((bp) => bp.id === task.weeklyBpId)
    : null;
  const formulaCode = linkedBP?.formulaCode;
  const stepData = task.formulaStepId ? getStepById(task.formulaStepId) : null;
  const stepLabel = task.formulaStepId ? getStepLabel(task.formulaStepId) : null;
  const displayBadge = stepLabel || formulaCode;
  const stepDescription = stepData ? `${stepData.stepNumber}. ${stepData.description}` : null;

  // Check if this task has notes from seniors
  const taskNotes = state.myTaskNotes[task.id] || [];
  const hasNotes = taskNotes.length > 0;
  const hasUnreadNotes = taskNotes.some((n) => !n.readAt && n.authorId !== state.user?.id);

  // Overdue check
  const isOverdue = task.dueAt && task.status !== "complete" && new Date(task.dueAt) < new Date();
  const hasReminder = task.reminderAt && new Date(task.reminderAt) > new Date();
  const hasRecurrence = !!task.recurrenceRule;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    borderLeftWidth: hasLabel ? "3px" : undefined,
    borderLeftColor: hasLabel ? LABEL_COLORS[task.label!] : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (!isDragging && onClick) onClick();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !isDragging && onClick) {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "p-3 rounded-md border cursor-grab active:cursor-grabbing transition-all duration-150 outline-none animate-fade-in",
        "bg-white dark:bg-stone-800/40",
        isOverdue
          ? "border-red-500 dark:border-red-500 border-2"
          : "border-stone-200/80 dark:border-stone-700/50",
        "hover:bg-stone-50 dark:hover:bg-stone-800/60",
        "hover:-translate-y-px hover:shadow-sm dark:hover:shadow-stone-900/50",
        "focus-visible:ring-2",
        accent.ring,
        isDragging && "opacity-40",
        isOverlay && "shadow-lg shadow-black/10 dark:shadow-black/40 ring-1 ring-stone-200/50 dark:ring-stone-600/50"
      )}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-stone-800 dark:text-stone-200 leading-snug flex-1">
              {task.title}
            </p>
            {hasNotes && (
              <span
                className={cn(
                  "shrink-0 w-5 h-5 rounded-full flex items-center justify-center",
                  hasUnreadNotes
                    ? "bg-red-100 dark:bg-red-900/30"
                    : accent.bgSubtle
                )}
                title={hasUnreadNotes ? "Unread notes from senior" : "Notes from senior"}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={hasUnreadNotes ? "text-red-600 dark:text-red-400" : accent.text}
                >
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
              </span>
            )}
          </div>
          {/* Formula badge + step/task description */}
          {(displayBadge || ((stepDescription || task.description) && state.showStepDescriptions)) && (
            <div className="flex items-start gap-1.5 mt-1.5">
              {displayBadge && (
                <span className={cn(
                  "shrink-0 mt-px px-1.5 py-0.5 text-[10px] font-medium rounded",
                  FORMULA_BADGE_STYLE
                )}>
                  {displayBadge}
                </span>
              )}
              {state.showStepDescriptions && (stepDescription || task.description) && (
                <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed line-clamp-2">
                  {stepDescription || task.description}
                </p>
              )}
            </div>
          )}
          {(hasPriority || task.category) && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {hasPriority && (
                <div className="flex items-center gap-1">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: PRIORITY_COLORS[task.priority!] }}
                  />
                  <span className="text-[10px] uppercase tracking-wider text-stone-400 dark:text-stone-500">
                    {PRIORITY_LABELS[task.priority!]}
                  </span>
                </div>
              )}
              {task.category && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-700/50 text-stone-500 dark:text-stone-400">
                  {task.category}
                </span>
              )}
            </div>
          )}
          {/* TM / Reminder / Recurrence icons */}
          {(task.dueAt || hasReminder || hasRecurrence) && (
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {task.dueAt && (
                <span className={cn(
                  "flex items-center gap-1 text-[10px]",
                  isOverdue ? "text-red-500 dark:text-red-400 font-medium" : "text-stone-400 dark:text-stone-500"
                )} title={isOverdue ? "Overdue" : `Due: ${new Date(task.dueAt).toLocaleString()}`}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  {isOverdue ? "Overdue" : new Date(task.dueAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </span>
              )}
              {hasReminder && (
                <span className="flex items-center gap-0.5 text-[10px] text-stone-400 dark:text-stone-500" title={`Reminder: ${new Date(task.reminderAt!).toLocaleString()}`}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 01-3.46 0" />
                  </svg>
                </span>
              )}
              {hasRecurrence && (
                <span className="flex items-center gap-0.5 text-[10px] text-stone-400 dark:text-stone-500" title={`Repeats ${task.recurrenceRule!.frequency}`}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                  </svg>
                </span>
              )}
            </div>
          )}
        </div>
        {showCompleteCheckbox && onMarkComplete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMarkComplete();
            }}
            className={cn(
              "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all group/check",
              isOverdue
                ? "border-red-500 dark:border-red-500 hover:border-red-600 dark:hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                : "border-stone-300 dark:border-stone-600 hover:border-green-500 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20"
            )}
            aria-label="Mark as complete"
            title="Mark as complete"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-transparent group-hover/check:text-green-500 transition-colors"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
