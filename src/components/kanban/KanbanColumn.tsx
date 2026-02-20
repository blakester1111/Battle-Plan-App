"use client";

import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useAppContext, useAccentColor } from "@/context/AppContext";
import type { KanbanTask, ColumnStatus } from "@/lib/types";
import { cn, LABEL_COLORS, PRIORITY_COLORS, PRIORITY_LABELS } from "@/lib/utils";
import { getStepLabel, getStepById } from "@/lib/conditionFormulas";

// Formula badge style - neutral gray for readability
const FORMULA_BADGE_STYLE = "bg-gray-100 text-gray-600 dark:bg-stone-700 dark:text-stone-400";

const COLUMN_CONFIG: Record<
  ColumnStatus,
  { label: string; emptyText: string; emptyIcon: string }
> = {
  todo: {
    label: "To Do",
    emptyText: "What needs to be done?",
    emptyIcon: "M12 6v6m0 0v6m0-6h6m-6 0H6",
  },
  "in-progress": {
    label: "In Progress",
    emptyText: "Drag cards here to start",
    emptyIcon: "M13 10V3L4 14h7v7l9-11h-7z",
  },
  complete: {
    label: "Complete",
    emptyText: "Finished work shows up here",
    emptyIcon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  },
};

interface SortableCardProps {
  task: KanbanTask;
  onClick: () => void;
  onMarkComplete?: () => void;
  onDelete?: () => void;
}

function SortableCard({ task, onClick, onMarkComplete, onDelete }: SortableCardProps) {
  const { state } = useAppContext();
  const accent = useAccentColor();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: task.id });

  const hasLabel = task.label && task.label !== "none";
  const hasPriority = task.priority && task.priority !== "none";
  const showCompleteCheckbox = task.status === "in-progress" || task.status === "todo";
  const isForwardedAway = !!task.forwardedToTaskId;
  const isForwardedIn = !!task.forwardedFromTaskId;

  // Get formula code from the weekly BP if task is linked to one
  const linkedBP = task.weeklyBpId
    ? state.weeklyBattlePlans.find((bp) => bp.id === task.weeklyBpId)
    : null;
  const formulaCode = linkedBP?.formulaCode;
  const stepData = task.formulaStepId ? getStepById(task.formulaStepId) : null;
  const stepInfo = task.formulaStepId ? getStepLabel(task.formulaStepId) : null;
  const displayBadge = stepInfo || formulaCode;
  // Show step description from formula data (not just the task description)
  const stepDescription = stepData ? `${stepData.stepNumber}. ${stepData.description}` : null;

  // Check if this task has notes from seniors
  const taskNotes = state.myTaskNotes[task.id] || [];
  const hasNotes = taskNotes.length > 0;
  const hasUnreadNotes = taskNotes.some((n) => !n.readAt && n.authorId !== state.user?.id);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    borderLeftWidth: hasLabel ? "3px" : undefined,
    borderLeftColor: hasLabel ? LABEL_COLORS[task.label!] : undefined,
  };

  return (
    <div className="relative">
      {/* Drop indicator line */}
      {isOver && (
        <div className="absolute -top-1 left-0 right-0 h-0.5 bg-white rounded-full z-10 shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
      )}
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={() => {
          if (!isDragging) onClick();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !isDragging) {
            e.preventDefault();
            onClick();
          }
        }}
        className={cn(
          "p-3 rounded-md border cursor-grab active:cursor-grabbing transition-all duration-150 outline-none animate-fade-in group/card relative",
          "bg-white dark:bg-stone-800/40",
          "border-stone-200/80 dark:border-stone-700/50",
          "hover:bg-stone-50 dark:hover:bg-stone-800/60",
          "hover:-translate-y-px hover:shadow-sm dark:hover:shadow-stone-900/50",
          "focus-visible:ring-2",
          accent.ring,
          isDragging && "opacity-40",
          isForwardedAway && !isDragging && "opacity-50"
        )}
      >
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-stone-800 dark:text-stone-200 leading-snug">
              {task.title}
            </p>
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
            {(hasPriority || task.category || task.bugged || isForwardedAway || isForwardedIn) && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {isForwardedAway && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-400 flex items-center gap-1">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                    Forwarded
                  </span>
                )}
                {isForwardedIn && (
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1",
                    accent.bgSubtle, accent.text
                  )}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    From prev. week
                  </span>
                )}
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
                {task.bugged && (
                  <div className="flex items-center gap-1" title="Bugged">
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
                    <span className="text-[10px] uppercase tracking-wider text-red-400">
                      Bugged
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Action buttons */}
          {(hasNotes || onDelete || (showCompleteCheckbox && onMarkComplete)) && (
            <div className="flex items-center gap-1 shrink-0">
              {hasNotes && (
                <span
                  className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center",
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
              {showCompleteCheckbox && onMarkComplete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkComplete();
                  }}
                  className="w-5 h-5 rounded-md border-2 border-stone-300 dark:border-stone-600 hover:border-green-500 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 flex items-center justify-center transition-all group/check"
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
              {onDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover/card:opacity-100 text-stone-400 hover:text-stone-600 dark:text-stone-600 dark:hover:text-stone-400 hover:bg-stone-200/50 dark:hover:bg-stone-700/50 transition-all"
                  aria-label="Delete target"
                >
                  <svg
                    width="12"
                    height="12"
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
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface Props {
  status: ColumnStatus;
  tasks: KanbanTask[];
  onAddCard: () => void;
  onEditCard: (task: KanbanTask) => void;
  onMarkComplete?: (task: KanbanTask) => void;
  onDeleteCard?: (task: KanbanTask) => void;
}

export default function KanbanColumn({
  status,
  tasks,
  onAddCard,
  onEditCard,
  onMarkComplete,
  onDeleteCard,
}: Props) {
  const accent = useAccentColor();
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const config = COLUMN_CONFIG[status];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-lg p-3 min-h-[200px] transition-all duration-200",
        "bg-stone-100/50 dark:bg-stone-900/30",
        isOver && cn("bg-stone-100 dark:bg-stone-900/50 ring-1", accent.ring)
      )}
    >
      <div className="flex items-center justify-between mb-3 px-0.5">
        <div className="flex items-center gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">
            {config.label}
          </h2>
          {tasks.length > 0 && (
            <span className="text-[10px] font-medium tabular-nums bg-stone-200/70 dark:bg-stone-800/70 text-stone-500 dark:text-stone-400 px-1.5 py-0.5 rounded">
              {tasks.length}
            </span>
          )}
        </div>
        <button
          onClick={onAddCard}
          className={cn(
            "text-stone-400 dark:text-stone-500 transition-colors p-0.5",
            accent.textHover
          )}
          aria-label={`Add card to ${config.label}`}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-2 flex-1 min-h-[150px] transition-all duration-300">
          {tasks.map((task) => (
            <div key={task.id} className="transition-all duration-300 ease-out">
              <SortableCard
                task={task}
                onClick={() => onEditCard(task)}
                onMarkComplete={onMarkComplete ? () => onMarkComplete(task) : undefined}
                onDelete={onDeleteCard ? () => onDeleteCard(task) : undefined}
              />
            </div>
          ))}
          {tasks.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center py-8 opacity-40">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mb-2 text-stone-400 dark:text-stone-600"
              >
                <path d={config.emptyIcon} />
              </svg>
              <p className="text-xs text-stone-400 dark:text-stone-600 text-center">
                {config.emptyText}
              </p>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
