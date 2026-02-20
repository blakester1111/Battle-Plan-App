"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useAppContext } from "@/context/AppContext";
import type { KanbanTask, ColumnStatus, Priority } from "@/lib/types";
import { getFormulaSortKey } from "@/lib/conditionFormulas";
import KanbanColumn from "./KanbanColumn";
import KanbanCard from "./KanbanCard";
import KanbanCardModal from "./KanbanCardModal";

const COLUMNS: ColumnStatus[] = ["todo", "in-progress", "complete"];

// Custom collision detection that prioritizes column droppables
// This helps when columns have sparse cards and adjacent columns have cards at the same level
const columnAwareCollision: CollisionDetection = (args) => {
  // First try pointerWithin - this checks if pointer is inside droppable bounds
  const pointerCollisions = pointerWithin(args);

  // If we found collisions with pointerWithin, check if any is a column
  if (pointerCollisions.length > 0) {
    // Prioritize column droppables (which have status IDs)
    const columnCollision = pointerCollisions.find(
      (collision) => COLUMNS.includes(collision.id as ColumnStatus)
    );

    // If pointer is within a column and there are also card collisions,
    // return the card collision for precise positioning, but include column as fallback
    if (columnCollision) {
      const cardCollisions = pointerCollisions.filter(
        (c) => !COLUMNS.includes(c.id as ColumnStatus)
      );
      if (cardCollisions.length > 0) {
        return cardCollisions;
      }
      // No card collisions, return the column
      return [columnCollision];
    }

    return pointerCollisions;
  }

  // Fallback to rectIntersection for edge cases
  return rectIntersection(args);
};

const PRIORITY_ORDER: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
  none: 3,
};

export default function KanbanBoard() {
  const { state, dispatch } = useAppContext();
  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null);
  const [modalState, setModalState] = useState<{
    open: boolean;
    task?: KanbanTask;
    defaultStatus?: ColumnStatus;
  }>({ open: false });

  // Keep a ref to the latest state to avoid stale closures in drag handlers
  const stateRef = useRef(state);
  stateRef.current = state;

  // Track last move to prevent redundant dispatches during dragOver
  const lastMoveRef = useRef<{ taskId: string; toStatus: ColumnStatus; toIndex: number } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const hasActiveFilters = state.categoryFilter.length > 0 || state.buggedFilter || state.formulaStepFilter.length > 0 || state.activeWeeklyBpId;

  // Build BP lookup for chronological sorting (bpId → weekStart epoch)
  const bpWeekStartLookup = useMemo(() => {
    const m = new Map<string, number>();
    for (const bp of state.weeklyBattlePlans) {
      m.set(bp.id, new Date(bp.weekStart).getTime());
    }
    return m;
  }, [state.weeklyBattlePlans]);

  function getWeekStartTime(task: KanbanTask): number {
    if (!task.weeklyBpId) return 0;
    return bpWeekStartLookup.get(task.weeklyBpId) || 0;
  }

  function getTasksForColumn(status: ColumnStatus) {
    let columnTasks = state.tasks.filter((t) => t.status === status);

    // Filter by active Weekly BP if one is selected
    if (state.activeWeeklyBpId) {
      columnTasks = columnTasks.filter((t) => t.weeklyBpId === state.activeWeeklyBpId);
    } else {
      // Main board: hide tasks that have been forwarded (superseded by a clone)
      // and hide archived tasks (they remain visible in BP-specific views)
      columnTasks = columnTasks.filter((t) => !t.forwardedToTaskId && !t.archivedAt);
    }

    // Apply category filter if active
    if (state.categoryFilter.length > 0) {
      columnTasks = columnTasks.filter(
        (t) => t.category && state.categoryFilter.includes(t.category)
      );
    }

    // Apply bugged filter if active
    if (state.buggedFilter) {
      columnTasks = columnTasks.filter((t) => t.bugged);
    }

    // Apply formula step filter if active
    if (state.formulaStepFilter.length > 0) {
      columnTasks = columnTasks.filter(
        (t) => t.formulaStepId && state.formulaStepFilter.includes(t.formulaStepId)
      );
    }

    // Sort based on current sort mode
    const { sortMode } = state;

    if (sortMode === "manual") {
      // Manual mode: use user-defined order
      return columnTasks.sort((a, b) => a.order - b.order);
    }

    if (sortMode === "overdue") {
      // Overdue mode: overdue targets first, then by how overdue they are
      const now = new Date();
      return columnTasks.sort((a, b) => {
        const aOverdue = a.dueAt && a.status !== "complete" && new Date(a.dueAt) < now;
        const bOverdue = b.dueAt && b.status !== "complete" && new Date(b.dueAt) < now;
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;
        // Both overdue: most overdue first
        if (aOverdue && bOverdue) {
          return new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime();
        }
        // Both not overdue but have due dates: soonest first
        if (a.dueAt && b.dueAt) {
          return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
        }
        if (a.dueAt && !b.dueAt) return -1;
        if (!a.dueAt && b.dueAt) return 1;
        return a.order - b.order;
      });
    }

    if (sortMode === "formula") {
      // Formula mode: sort by condition formula step order (higher = earlier condition)
      return columnTasks.sort((a, b) => {
        const aKey = a.formulaStepId ? getFormulaSortKey(a.formulaStepId) : -1;
        const bKey = b.formulaStepId ? getFormulaSortKey(b.formulaStepId) : -1;
        if (aKey !== bKey) return bKey - aKey; // Higher key sorts first
        // Chronological tiebreaker: earlier weeks first (main board only)
        if (!state.activeWeeklyBpId) {
          const aWeek = getWeekStartTime(a);
          const bWeek = getWeekStartTime(b);
          if (aWeek !== bWeek) return aWeek - bWeek;
        }
        return a.order - b.order;
      });
    }

    // Default: priority-formula mode
    // Sort by priority first, then by formula step, then by order
    return columnTasks.sort((a, b) => {
      const aPriority = PRIORITY_ORDER[a.priority || "none"];
      const bPriority = PRIORITY_ORDER[b.priority || "none"];
      if (aPriority !== bPriority) return aPriority - bPriority;

      const aKey = a.formulaStepId ? getFormulaSortKey(a.formulaStepId) : -1;
      const bKey = b.formulaStepId ? getFormulaSortKey(b.formulaStepId) : -1;
      if (aKey !== bKey) return bKey - aKey;

      // Chronological tiebreaker: earlier weeks first (main board only)
      if (!state.activeWeeklyBpId) {
        const aWeek = getWeekStartTime(a);
        const bWeek = getWeekStartTime(b);
        if (aWeek !== bWeek) return aWeek - bWeek;
      }

      return a.order - b.order;
    });
  }

  // Always show all columns to allow drag-and-drop between them
  const visibleColumns = COLUMNS;

  // Grid class - always use 3 columns
  const gridClass = "grid-cols-3";

  const findColumnForId = useCallback((id: string): ColumnStatus | null => {
    if (COLUMNS.includes(id as ColumnStatus)) return id as ColumnStatus;
    const task = stateRef.current.tasks.find((t) => t.id === id);
    return task ? task.status : null;
  }, []);

  function handleDragStart(event: DragStartEvent) {
    const task = stateRef.current.tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
    lastMoveRef.current = null;
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeColumn = findColumnForId(activeId);
    const overColumn = findColumnForId(overId);

    if (!activeColumn || !overColumn || activeColumn === overColumn) return;

    const currentTasks = stateRef.current.tasks;
    const overTask = currentTasks.find((t) => t.id === overId);
    const destTasks = currentTasks
      .filter((t) => t.status === overColumn && t.id !== activeId)
      .sort((a, b) => a.order - b.order);

    let toIndex = destTasks.length;
    if (overTask) {
      const overIndex = destTasks.findIndex((t) => t.id === overId);
      if (overIndex >= 0) toIndex = overIndex;
    }

    // Skip if this is the same move we just dispatched
    const last = lastMoveRef.current;
    if (last && last.taskId === activeId && last.toStatus === overColumn && last.toIndex === toIndex) {
      return;
    }

    lastMoveRef.current = { taskId: activeId, toStatus: overColumn, toIndex };
    dispatch({
      type: "MOVE_TASK",
      payload: { taskId: activeId, toStatus: overColumn, toIndex },
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    lastMoveRef.current = null;

    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    // Use ref for fresh state
    const currentTasks = stateRef.current.tasks;
    const activeT = currentTasks.find((t) => t.id === activeId);
    const overT = currentTasks.find((t) => t.id === overId);

    if (!activeT) return;

    // Within same column reorder
    if (overT && activeT.status === overT.status) {
      const columnTasks = currentTasks
        .filter((t) => t.status === activeT.status)
        .sort((a, b) => a.order - b.order);

      const oldIndex = columnTasks.findIndex((t) => t.id === activeId);
      const newIndex = columnTasks.findIndex((t) => t.id === overId);

      if (oldIndex !== newIndex) {
        dispatch({
          type: "REORDER_TASK",
          payload: { taskId: activeId, toIndex: newIndex },
        });
      }
    }
  }

  return (
    <>
      {hasActiveFilters && visibleColumns.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-stone-300 dark:text-stone-700 mb-4"
          >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          <p className="text-stone-400 dark:text-stone-500 text-sm">
            No targets match the current filters
          </p>
          <p className="text-stone-400 dark:text-stone-600 text-xs mt-1">
            Try adjusting your filter settings
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={columnAwareCollision}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className={`grid ${gridClass} gap-4 h-full transition-all duration-200`}>
            {visibleColumns.map((colStatus) => (
              <KanbanColumn
                key={colStatus}
                status={colStatus}
                tasks={getTasksForColumn(colStatus)}
                onAddCard={() =>
                  setModalState({ open: true, defaultStatus: colStatus })
                }
                onEditCard={(task) =>
                  setModalState({ open: true, task })
                }
                onMarkComplete={(task) => {
                  const completeCount = state.tasks.filter(
                    (t) => t.status === "complete"
                  ).length;
                  dispatch({
                    type: "MOVE_TASK",
                    payload: { taskId: task.id, toStatus: "complete", toIndex: completeCount },
                  });
                }}
                onDeleteCard={(task) => {
                  dispatch({
                    type: "DELETE_TASK",
                    payload: { id: task.id },
                  });
                }}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTask ? <KanbanCard task={activeTask} isOverlay /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {modalState.open && (
        <KanbanCardModal
          task={modalState.task}
          defaultStatus={modalState.defaultStatus}
          onClose={() => setModalState({ open: false })}
        />
      )}
    </>
  );
}
