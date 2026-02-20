"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppContext, useAccentColor } from "@/context/AppContext";
import type { User, KanbanTask, TaskNote, BPNote, WeeklyBattlePlanWithProgress } from "@/lib/types";
import { cn, getDisplayName } from "@/lib/utils";

export default function InfoTerminalsList() {
  const { state, dispatch } = useAppContext();
  const accent = useAccentColor();
  const { viewingInfoTerminal } = state;
  const [collapsed, setCollapsed] = useState(false);
  const [viewableBoards, setViewableBoards] = useState<User[]>([]);

  // Load viewable boards on mount
  const loadViewableBoards = useCallback(async () => {
    try {
      const res = await fetch("/api/info-terminals/viewable");
      if (res.ok) {
        const data = await res.json();
        setViewableBoards(data.boards || []);
      }
    } catch (error) {
      console.error("Failed to load viewable boards:", error);
    }
  }, []);

  useEffect(() => {
    loadViewableBoards();
  }, [loadViewableBoards]);

  if (viewableBoards.length === 0) {
    return null;
  }

  async function handleViewBoard(owner: User) {
    try {
      const res = await fetch(`/api/info-terminals/board/${owner.id}`);
      if (!res.ok) {
        console.error("Failed to load info terminal board");
        return;
      }

      const { tasks, taskNotes, weeklyBPs, bpNotes } = await res.json();

      dispatch({
        type: "SET_VIEWING_INFO_TERMINAL",
        payload: {
          user: owner,
          tasks: tasks as KanbanTask[],
          taskNotes: taskNotes as Record<string, TaskNote[]>,
          bpNotes: bpNotes as Record<string, BPNote[]>,
          weeklyBPs: (weeklyBPs || []) as WeeklyBattlePlanWithProgress[],
        },
      });
    } catch (error) {
      console.error("Failed to load info terminal board:", error);
    }
  }

  function handleBackToOwnBoard() {
    dispatch({
      type: "SET_VIEWING_INFO_TERMINAL",
      payload: {
        user: null,
        tasks: [],
        taskNotes: {},
        bpNotes: {},
        weeklyBPs: [],
      },
    });
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
            Info Terminals
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {viewableBoards.length > 0 && (
            <span className="text-[10px] font-medium tabular-nums text-stone-400 dark:text-stone-500">
              {viewableBoards.length}
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
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </div>
      </button>

      {/* Content */}
      {!collapsed && (
        <div>
          {viewingInfoTerminal && (
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
            {viewableBoards.map((owner) => (
              <button
                key={owner.id}
                onClick={() => handleViewBoard(owner)}
                className={cn(
                  "w-full px-3 py-2 text-sm text-left rounded transition-colors flex items-center gap-2",
                  viewingInfoTerminal?.id === owner.id
                    ? cn(accent.bgSubtle, accent.text)
                    : "text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
                )}
              >
                <span className="shrink-0 w-6 h-6 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center text-[10px] font-medium text-cyan-600 dark:text-cyan-400">
                  {getBadgeText(owner)}
                </span>
                <span className="truncate">{getDisplayName(owner)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
