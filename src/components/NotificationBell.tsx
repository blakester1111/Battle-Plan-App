"use client";

import { useState, useMemo } from "react";
import { useAppContext, useAccentColor } from "@/context/AppContext";
import TaskNotesModal from "./TaskNotesModal";
import BPNotesModal from "./BPNotesModal";
import { cn } from "@/lib/utils";

// Time constants in milliseconds
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export default function NotificationBell() {
  const { state } = useAppContext();
  const accent = useAccentColor();
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedBPId, setSelectedBPId] = useState<string | null>(null);
  const [monthsLoaded, setMonthsLoaded] = useState(0); // 0 = just last 7 days

  const { unreadNoteCount, unreadBPNoteCount, myTaskNotes, myBPNotes, tasks, weeklyBattlePlans } = state;

  // Total unread count (task notes + BP notes)
  const totalUnreadCount = unreadNoteCount + unreadBPNoteCount;

  // Calculate the cutoff time based on months loaded
  // 0 months = last 7 days
  // 1 month = last 7 days + previous 30 days (37 days total)
  // 2 months = 67 days, etc.
  const cutoffTime = useMemo(() => {
    return Date.now() - SEVEN_DAYS_MS - (monthsLoaded * THIRTY_DAYS_MS);
  }, [monthsLoaded]);

  // Get the label for the current time range
  const timeRangeLabel = useMemo(() => {
    if (monthsLoaded === 0) return "Last 7 days";
    if (monthsLoaded === 1) return "Last 37 days";
    return `Last ${7 + monthsLoaded * 30} days`;
  }, [monthsLoaded]);

  // Get list of tasks with notes within the time range
  const tasksWithNotes = useMemo(() => {
    return Object.entries(myTaskNotes)
      .map(([taskId, notes]) => {
        // Filter to notes from seniors within time range
        const filteredNotes = notes.filter((n) => {
          const noteTime = new Date(n.createdAt).getTime();
          return n.authorId !== state.user?.id && noteTime >= cutoffTime;
        });

        if (filteredNotes.length === 0) return null;

        const task = tasks.find((t) => t.id === taskId);
        const unreadCount = filteredNotes.filter((n) => !n.readAt).length;
        const latestNote = filteredNotes.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];

        return {
          type: "task" as const,
          id: taskId,
          title: task?.title || notes[0]?.taskTitle || "Unknown Task",
          unreadCount,
          latestNote,
        };
      })
      .filter(Boolean) as Array<{
        type: "task";
        id: string;
        title: string;
        unreadCount: number;
        latestNote: typeof myTaskNotes[string][0];
      }>;
  }, [myTaskNotes, tasks, state.user?.id, cutoffTime]);

  // Get list of BPs with notes within the time range
  const bpsWithNotes = useMemo(() => {
    return Object.entries(myBPNotes)
      .map(([bpId, notes]) => {
        // Filter to notes from seniors within time range
        const filteredNotes = notes.filter((n) => {
          const noteTime = new Date(n.createdAt).getTime();
          return n.authorId !== state.user?.id && noteTime >= cutoffTime;
        });

        if (filteredNotes.length === 0) return null;

        const bp = weeklyBattlePlans.find((b) => b.id === bpId);
        const unreadCount = filteredNotes.filter((n) => !n.readAt).length;
        const latestNote = filteredNotes.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];

        return {
          type: "bp" as const,
          id: bpId,
          title: bp?.title || notes[0]?.bpTitle || "Battle Plan",
          unreadCount,
          latestNote,
        };
      })
      .filter(Boolean) as Array<{
        type: "bp";
        id: string;
        title: string;
        unreadCount: number;
        latestNote: typeof myBPNotes[string][0];
      }>;
  }, [myBPNotes, weeklyBattlePlans, state.user?.id, cutoffTime]);

  // Combine and sort all notifications (unread first, then by recency)
  const allNotifications = useMemo(() => {
    const all = [...tasksWithNotes, ...bpsWithNotes];
    return all.sort((a, b) => {
      // Unread items first
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
      if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
      // Then by recency
      const aTime = a.latestNote ? new Date(a.latestNote.createdAt).getTime() : 0;
      const bTime = b.latestNote ? new Date(b.latestNote.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [tasksWithNotes, bpsWithNotes]);

  // Check if there might be older notifications (simple heuristic: check if any notes exist older than current cutoff)
  const hasOlderNotifications = useMemo(() => {
    const checkNotes = (notesMap: Record<string, Array<{ createdAt: string; authorId: string }>>) => {
      for (const notes of Object.values(notesMap)) {
        for (const note of notes) {
          if (note.authorId !== state.user?.id) {
            const noteTime = new Date(note.createdAt).getTime();
            if (noteTime < cutoffTime) {
              return true;
            }
          }
        }
      }
      return false;
    };

    return checkNotes(myTaskNotes) || checkNotes(myBPNotes);
  }, [myTaskNotes, myBPNotes, state.user?.id, cutoffTime]);

  function handleNotificationClick(item: typeof allNotifications[0]) {
    if (item.type === "task") {
      setSelectedTaskId(item.id);
    } else {
      setSelectedBPId(item.id);
    }
    setShowNotifications(false);
  }

  function handleLoadOlder() {
    setMonthsLoaded((prev) => prev + 1);
  }

  function handleResetToRecent() {
    setMonthsLoaded(0);
  }

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          className="p-1.5 rounded text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 transition-colors relative"
          aria-label="Notifications"
          title="Notifications"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {totalUnreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold bg-red-500 text-white rounded-full px-1">
              {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
            </span>
          )}
        </button>

        {/* Dropdown */}
        {showNotifications && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowNotifications(false)}
            />
            <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-stone-900 rounded-lg shadow-xl border border-stone-200 dark:border-stone-800 z-50 overflow-hidden">
              <div className="p-3 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                    Notifications
                  </h3>
                  <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-0.5">
                    {timeRangeLabel}
                  </p>
                </div>
                {monthsLoaded > 0 && (
                  <button
                    onClick={handleResetToRecent}
                    className="text-[10px] text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-auto">
                {allNotifications.length === 0 ? (
                  <div className="p-4 text-center text-sm text-stone-500 dark:text-stone-400">
                    No notifications
                  </div>
                ) : (
                  allNotifications.map((item) => (
                    <button
                      key={`${item.type}-${item.id}`}
                      onClick={() => handleNotificationClick(item)}
                      className="w-full p-3 text-left hover:bg-stone-50 dark:hover:bg-stone-800/50 border-b border-stone-100 dark:border-stone-800/50 last:border-b-0 transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        <span className={cn(
                          "shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5",
                          item.unreadCount > 0 ? "bg-red-100 dark:bg-red-900/30" : accent.bgSubtle
                        )}>
                          {item.type === "task" ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={item.unreadCount > 0 ? "text-red-600 dark:text-red-400" : accent.text}>
                              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                            </svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={item.unreadCount > 0 ? "text-red-600 dark:text-red-400" : accent.text}>
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                              <line x1="16" y1="2" x2="16" y2="6" />
                              <line x1="8" y1="2" x2="8" y2="6" />
                              <line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                          )}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-stone-800 dark:text-stone-200 truncate">
                              {item.title}
                            </span>
                            {item.unreadCount > 0 && (
                              <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full">
                                {item.unreadCount}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={cn(
                              "text-[9px] uppercase tracking-wide font-medium px-1 py-0.5 rounded",
                              item.type === "bp"
                                ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                                : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                            )}>
                              {item.type === "bp" ? "Battle Plan" : "Target"}
                            </span>
                          </div>
                          {item.latestNote && (
                            <p className="text-xs text-stone-500 dark:text-stone-400 truncate mt-1">
                              {item.latestNote.authorFirstName || item.latestNote.authorUsername}: {item.latestNote.content}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* Load older button */}
              {hasOlderNotifications && (
                <div className="p-2 border-t border-stone-200 dark:border-stone-800">
                  <button
                    onClick={handleLoadOlder}
                    className={cn(
                      "w-full py-2 text-xs font-medium rounded transition-colors",
                      "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200",
                      "hover:bg-stone-100 dark:hover:bg-stone-800"
                    )}
                  >
                    Load previous month
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Task Notes Modal */}
      {selectedTaskId && (
        <TaskNotesModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      {/* BP Notes Modal */}
      {selectedBPId && (
        <BPNotesModal
          bpId={selectedBPId}
          onClose={() => setSelectedBPId(null)}
        />
      )}
    </>
  );
}
