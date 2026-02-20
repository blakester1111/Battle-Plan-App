"use client";

import { useState, useRef, useEffect } from "react";
import { useAppContext, useAccentColor } from "@/context/AppContext";
import { DEFAULT_CATEGORIES } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CONDITION_FORMULAS } from "@/lib/conditionFormulas";

export default function CategoryFilter() {
  const { state, dispatch } = useAppContext();
  const accent = useAccentColor();
  const [open, setOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const allCategories = [...DEFAULT_CATEGORIES, ...state.customCategories];
  const activeCount = state.categoryFilter.length + (state.buggedFilter ? 1 : 0) + state.formulaStepFilter.length;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  function toggleCategory(cat: string) {
    const current = state.categoryFilter;
    const updated = current.includes(cat)
      ? current.filter((c) => c !== cat)
      : [...current, cat];
    dispatch({ type: "SET_CATEGORY_FILTER", payload: { categories: updated } });
  }

  function clearFilter() {
    dispatch({ type: "SET_CATEGORY_FILTER", payload: { categories: [] } });
    if (state.buggedFilter) {
      dispatch({ type: "TOGGLE_BUGGED_FILTER" });
    }
    if (state.formulaStepFilter.length > 0) {
      dispatch({ type: "SET_FORMULA_STEP_FILTER", payload: [] });
    }
  }

  function handleAddCategory() {
    const name = newCategory.trim();
    if (name && !allCategories.includes(name)) {
      dispatch({ type: "ADD_CUSTOM_CATEGORY", payload: { name } });
      setNewCategory("");
    }
  }

  function handleDeleteCustomCategory(name: string) {
    dispatch({ type: "DELETE_CUSTOM_CATEGORY", payload: { name } });
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm transition-colors",
          activeCount > 0
            ? cn(accent.bgSubtle, accent.text)
            : "text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
        )}
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
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        <span className="hidden sm:inline">
          {activeCount > 0 ? `${activeCount} filter${activeCount > 1 ? "s" : ""}` : "Filter"}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-800 shadow-xl dark:shadow-black/40 z-50 animate-fade-in">
          {/* Bugged Filter */}
          <div className="p-3 border-b border-stone-100 dark:border-stone-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">
                Status
              </span>
            </div>
            <button
              onClick={() => dispatch({ type: "TOGGLE_BUGGED_FILTER" })}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-all w-full",
                state.buggedFilter
                  ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                  : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700"
              )}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke={state.buggedFilter ? "#f87171" : "currentColor"}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3.003 3.003 0 116 0v1" />
                <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 014-4h4a4 4 0 014 4v3c0 3.3-2.7 6-6 6" />
                <path d="M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M20.97 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4" />
              </svg>
              <span>Bugged only</span>
              {state.buggedFilter && (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="ml-auto"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          </div>

          <div className="p-3 border-b border-stone-100 dark:border-stone-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">
                Categories
              </span>
              {activeCount > 0 && (
                <button
                  onClick={clearFilter}
                  className="text-[11px] text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {allCategories.map((cat) => {
                const isActive = state.categoryFilter.includes(cat);
                const isCustom = state.customCategories.includes(cat);
                return (
                  <div key={cat} className="group flex items-center">
                    <button
                      onClick={() => toggleCategory(cat)}
                      className={cn(
                        "px-2 py-1 rounded text-xs transition-all",
                        isActive
                          ? "bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900"
                          : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700"
                      )}
                    >
                      {cat}
                    </button>
                    {isCustom && (
                      <button
                        onClick={() => handleDeleteCustomCategory(cat)}
                        className="ml-0.5 opacity-0 group-hover:opacity-100 p-0.5 text-stone-400 hover:text-red-500 transition-all"
                        title="Delete category"
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
                );
              })}
            </div>
          </div>

          {/* Formula Step Filter */}
          <div className="p-3 border-b border-stone-100 dark:border-stone-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">
                Formula Steps
              </span>
              {state.formulaStepFilter.length > 0 && (
                <button
                  onClick={() => dispatch({ type: "SET_FORMULA_STEP_FILTER", payload: [] })}
                  className="text-[11px] text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {CONDITION_FORMULAS.map((formula) => {
                const formulaStepIds = formula.steps.map((s) => s.id);
                const anyActive = formulaStepIds.some((id) => state.formulaStepFilter.includes(id));
                return (
                  <div key={formula.id}>
                    <button
                      onClick={() => {
                        // Toggle all steps in this formula
                        if (anyActive) {
                          const updated = state.formulaStepFilter.filter((id) => !formulaStepIds.includes(id));
                          dispatch({ type: "SET_FORMULA_STEP_FILTER", payload: updated });
                        } else {
                          const updated = [...state.formulaStepFilter, ...formulaStepIds];
                          dispatch({ type: "SET_FORMULA_STEP_FILTER", payload: updated });
                        }
                      }}
                      className={cn(
                        "w-full text-left px-2 py-1 rounded text-xs transition-all flex items-center gap-1.5",
                        anyActive
                          ? "bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900"
                          : "bg-stone-50 dark:bg-stone-800/50 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700"
                      )}
                    >
                      <span className="font-medium w-6 text-center shrink-0">{formula.code}</span>
                      <span className="truncate">{formula.name}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-3">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500 block mb-2">
              Add Custom
            </span>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddCategory();
                }}
                placeholder="New category..."
                className={cn(
                  "flex-1 rounded px-2 py-1 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2 placeholder:text-stone-400 transition-shadow",
                  accent.ring
                )}
              />
              <button
                onClick={handleAddCategory}
                className="px-2 py-1 rounded text-xs font-medium border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-400 hover:border-stone-400 dark:hover:border-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
