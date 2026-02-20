"use client";

import { useAppContext } from "@/context/AppContext";
import type { BoardSortMode } from "@/lib/types";
import { cn } from "@/lib/utils";

const SORT_MODES: { value: BoardSortMode; label: string; shortLabel: string; description: string }[] = [
  {
    value: "priority-formula",
    label: "Priority",
    shortLabel: "Priority",
    description: "Sort by priority first, then by formula step",
  },
  {
    value: "formula",
    label: "Formula Step",
    shortLabel: "Formula",
    description: "Sort by condition formula step order",
  },
  {
    value: "manual",
    label: "Manual",
    shortLabel: "Manual",
    description: "Custom order via drag-and-drop",
  },
  {
    value: "overdue",
    label: "Overdue",
    shortLabel: "Overdue",
    description: "Overdue targets first, then by due date",
  },
];

export default function SortModeSelector() {
  const { state, dispatch } = useAppContext();

  function handleSortModeChange(mode: BoardSortMode) {
    dispatch({ type: "SET_SORT_MODE", payload: mode });
  }

  return (
    <div className="flex items-center gap-0.5 bg-stone-100 dark:bg-stone-800/60 rounded-md p-0.5">
      {SORT_MODES.map((mode) => (
        <button
          key={mode.value}
          onClick={() => handleSortModeChange(mode.value)}
          className={cn(
            "px-2.5 py-1 text-xs font-medium rounded transition-all",
            state.sortMode === mode.value
              ? "bg-white dark:bg-stone-700 text-stone-800 dark:text-stone-200 shadow-sm"
              : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300"
          )}
          title={mode.description}
        >
          <span className="hidden sm:inline">{mode.label}</span>
          <span className="sm:hidden">{mode.shortLabel}</span>
        </button>
      ))}
    </div>
  );
}
