"use client";

import { useState } from "react";
import { useAppContext, useAccentColor } from "@/context/AppContext";
import { juniorTasksApi, bpNotesApi } from "@/lib/api";
import type { User, KanbanTask, TaskNote, BPNote, WeeklyBattlePlanWithProgress } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function JuniorsList() {
  const { state, dispatch } = useAppContext();
  const accent = useAccentColor();
  const { myJuniors, viewingJunior } = state;
  const [collapsed, setCollapsed] = useState(false);

  if (myJuniors.length === 0) {
    return null;
  }

  async function handleViewJunior(junior: User) {
    try {
      const [tasksData, bpNotesData] = await Promise.all([
        juniorTasksApi.get(junior.id),
        bpNotesApi.getJuniorNotes(junior.id).catch(() => ({ notes: {} })),
      ]);

      const { tasks, notes, weeklyBattlePlans } = tasksData;

      dispatch({
        type: "SET_VIEWING_JUNIOR",
        payload: {
          junior,
          tasks: tasks as KanbanTask[],
          notes: notes as Record<string, TaskNote[]>,
        },
      });
      dispatch({
        type: "SET_JUNIOR_WEEKLY_BPS",
        payload: (weeklyBattlePlans || []) as WeeklyBattlePlanWithProgress[],
      });
      dispatch({
        type: "SET_JUNIOR_BP_NOTES",
        payload: (bpNotesData?.notes || {}) as Record<string, BPNote[]>,
      });
    } catch (error) {
      console.error("Failed to load junior's tasks:", error);
    }
  }

  function handleBackToOwnBoard() {
    dispatch({
      type: "SET_VIEWING_JUNIOR",
      payload: { junior: null, tasks: [], notes: {} },
    });
  }

  function getDisplayName(user: User) {
    if (user.postTitle) {
      return user.postTitle;
    }
    if (user.firstName || user.lastName) {
      return `${user.firstName || ""} ${user.lastName || ""}`.trim();
    }
    return user.username;
  }

  // Get badge text: "FL" initials format
  function getBadgeText(user: User) {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user.firstName) {
      return user.firstName[0].toUpperCase();
    }
    return user.username[0].toUpperCase();
  }

  return (
    <>
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-between w-full mb-3 group"
      >
        <div className="flex items-center gap-1.5">
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn(
              "text-stone-400 dark:text-stone-500 transition-transform duration-150",
              !collapsed && "rotate-90"
            )}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500 group-hover:text-stone-500 dark:group-hover:text-stone-400 transition-colors">
            My Juniors
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {myJuniors.length > 0 && (
            <span className="text-[10px] font-medium tabular-nums text-stone-400 dark:text-stone-500">
              {myJuniors.length}
            </span>
          )}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-stone-400 dark:text-stone-500"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
      </button>

      {/* Content */}
      {!collapsed && (
        <div>
          {viewingJunior && (
            <button
              onClick={handleBackToOwnBoard}
              className={cn(
                "w-full mb-2 px-3 py-2 text-sm font-medium rounded transition-colors flex items-center gap-2",
                accent.text, accent.bgSubtle, accent.bgHover
              )}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back to My Board
            </button>
          )}

          <div className="space-y-1">
            {myJuniors.map((junior) => (
              <button
                key={junior.id}
                onClick={() => handleViewJunior(junior)}
                className={cn(
                  "w-full px-3 py-2 text-sm text-left rounded transition-colors flex items-center gap-2",
                  viewingJunior?.id === junior.id
                    ? cn(accent.bgSubtle, accent.text)
                    : "text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
                )}
              >
                <span className="shrink-0 w-6 h-6 rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center text-[10px] font-medium text-stone-600 dark:text-stone-300">
                  {getBadgeText(junior)}
                </span>
                <span className="truncate">{getDisplayName(junior)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
