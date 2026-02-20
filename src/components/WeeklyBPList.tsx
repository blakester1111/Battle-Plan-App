"use client";

import { useState, useMemo } from "react";
import { useAppContext, useAccentColor } from "@/context/AppContext";
import WeeklyBPModal from "./WeeklyBPModal";
import BPNotesModal from "./BPNotesModal";
import { cn } from "@/lib/utils";
import { weeklyBPApi } from "@/lib/api";
import ConfirmModal from "./ConfirmModal";
import ForwardTasksModal from "./ForwardTasksModal";
import PrintBPModal from "./PrintBPModal";

const RECENT_LIMIT = 5;

export default function WeeklyBPList() {
  const { state, dispatch } = useAppContext();
  const accent = useAccentColor();
  const { weeklyBattlePlans, activeWeeklyBpId, tasks, myBPNotes } = state;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editBpId, setEditBpId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [selectedBPId, setSelectedBPId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [forwardBpId, setForwardBpId] = useState<string | null>(null);
  const [showPrint, setShowPrint] = useState(false);

  // Split BPs into recent and archived
  const recentBPs = weeklyBattlePlans.slice(0, RECENT_LIMIT);
  const archivedBPs = weeklyBattlePlans.slice(RECENT_LIMIT);
  const hasArchive = archivedBPs.length > 0;
  const displayedBPs = showArchive ? weeklyBattlePlans : recentBPs;

  // Compute progress dynamically from tasks state for real-time updates
  const bpProgress = useMemo(() => {
    const progressMap: Record<string, { totalTasks: number; completedTasks: number; progressPercent: number }> = {};

    for (const bp of weeklyBattlePlans) {
      const bpTasks = tasks.filter(t => t.weeklyBpId === bp.id);
      const totalTasks = bpTasks.length;
      const completedTasks = bpTasks.filter(t => t.status === "complete").length;
      const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      progressMap[bp.id] = { totalTasks, completedTasks, progressPercent };
    }

    return progressMap;
  }, [weeklyBattlePlans, tasks]);

  // Compute forwardable task counts per BP (incomplete + not already forwarded)
  const bpForwardable = useMemo(() => {
    const countMap: Record<string, number> = {};
    for (const bp of weeklyBattlePlans) {
      countMap[bp.id] = tasks.filter(
        (t) =>
          t.weeklyBpId === bp.id &&
          t.status !== "complete" &&
          !t.forwardedToTaskId
      ).length;
    }
    return countMap;
  }, [weeklyBattlePlans, tasks]);

  // Compute BP notes info (has notes, unread count)
  const bpNotesInfo = useMemo(() => {
    const info: Record<string, { hasNotes: boolean; unreadCount: number }> = {};

    for (const bp of weeklyBattlePlans) {
      const notes = myBPNotes[bp.id] || [];
      const seniorNotes = notes.filter((n) => n.authorId !== state.user?.id);
      info[bp.id] = {
        hasNotes: seniorNotes.length > 0,
        unreadCount: seniorNotes.filter((n) => !n.readAt).length,
      };
    }

    return info;
  }, [weeklyBattlePlans, myBPNotes, state.user?.id]);

  function handleSelectBP(bpId: string) {
    // Toggle off if clicking the same BP
    if (activeWeeklyBpId === bpId) {
      dispatch({ type: "SET_ACTIVE_WEEKLY_BP", payload: null });
    } else {
      dispatch({ type: "SET_ACTIVE_WEEKLY_BP", payload: bpId });
    }
  }

  function handleBackToMainBoard() {
    dispatch({ type: "SET_ACTIVE_WEEKLY_BP", payload: null });
  }

  async function handleDeleteBP(bpId: string) {
    try {
      await weeklyBPApi.delete(bpId);
      dispatch({ type: "DELETE_WEEKLY_BP", payload: { id: bpId } });
      setConfirmDeleteId(null);
    } catch (err) {
      console.error("Failed to delete battle plan:", err);
    }
  }

  return (
    <>
      <div>
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
              Weekly Battle Plans
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {weeklyBattlePlans.length > 0 && (
              <span className="text-[10px] font-medium tabular-nums text-stone-400 dark:text-stone-500">
                {weeklyBattlePlans.length}
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
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
        </button>

        {/* Content */}
        {!collapsed && (
          <div>
            {/* Back to main board button (when viewing a BP) */}
            {activeWeeklyBpId && (
              <button
                onClick={handleBackToMainBoard}
                className={cn(
                  "w-full mb-3 px-3 py-2 text-sm font-medium rounded transition-colors flex items-center gap-2",
                  accent.text,
                  accent.bgSubtle,
                  accent.bgHover
                )}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back to Main Board
              </button>
            )}

            {/* My Battle Plans List */}
            {weeklyBattlePlans.length === 0 ? (
              <p className="text-sm text-stone-400 dark:text-stone-500 text-center py-2">
                Create your first weekly battle plan
              </p>
            ) : (
              <div className="space-y-2">
                {displayedBPs.map((bp) => (
                  <div
                    key={bp.id}
                    className={cn(
                      "rounded-lg transition-colors cursor-pointer",
                      activeWeeklyBpId === bp.id
                        ? "bg-stone-200 dark:bg-stone-700"
                        : "bg-stone-50 dark:bg-stone-800/50 hover:bg-stone-100 dark:hover:bg-stone-800/70"
                    )}
                  >
                    <button
                      onClick={() => handleSelectBP(bp.id)}
                      className="w-full p-3 text-left"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span
                            className={cn(
                              "text-sm font-medium truncate",
                              activeWeeklyBpId === bp.id
                                ? accent.text
                                : "text-stone-700 dark:text-stone-300"
                            )}
                          >
                            {bp.title}
                          </span>
                          {/* Comment icon */}
                          {bpNotesInfo[bp.id]?.hasNotes && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedBPId(bp.id);
                              }}
                              className={cn(
                                "shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-colors",
                                bpNotesInfo[bp.id]?.unreadCount > 0
                                  ? "bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50"
                                  : `${accent.bgSubtle} hover:brightness-95`
                              )}
                              title={bpNotesInfo[bp.id]?.unreadCount > 0 ? "Unread notes from senior" : "Notes from senior"}
                            >
                              <svg
                                width="11"
                                height="11"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className={bpNotesInfo[bp.id]?.unreadCount > 0 ? "text-red-600 dark:text-red-400" : accent.text}
                              >
                                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                              </svg>
                            </button>
                          )}
                        </div>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-400 shrink-0 ml-2">
                          {bp.formulaCode}
                        </span>
                      </div>
                      <div className="text-xs text-stone-500 dark:text-stone-400 mb-2">
                        {bp.formulaName}
                      </div>
                      {/* Progress Bar */}
                      {(() => {
                        const progress = bpProgress[bp.id] || { totalTasks: 0, completedTasks: 0, progressPercent: 0 };
                        return (
                          <>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-300"
                                  style={{
                                    width: `${progress.progressPercent}%`,
                                    backgroundColor: progress.progressPercent === 100 ? "#22c55e" : accent.swatch,
                                  }}
                                />
                              </div>
                              <span className="text-xs font-medium text-stone-500 dark:text-stone-400 w-9 text-right">
                                {progress.progressPercent}%
                              </span>
                            </div>
                            <div className="text-xs text-stone-400 dark:text-stone-500 mt-1">
                              {progress.completedTasks}/{progress.totalTasks} tasks complete
                            </div>
                          </>
                        );
                      })()}
                    </button>

                    {/* Forward, Edit & Delete buttons */}
                    {activeWeeklyBpId === bp.id && (
                      <div className="px-3 pb-3 pt-1 flex gap-2">
                        {/* Forward button - only show if there are forwardable tasks */}
                        {bpForwardable[bp.id] > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setForwardBpId(bp.id);
                            }}
                            className={cn(
                              "flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5",
                              accent.text,
                              accent.bgSubtle,
                              accent.bgHover
                            )}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                            Forward ({bpForwardable[bp.id]})
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowPrint(true);
                          }}
                          className="px-2.5 py-1.5 text-xs font-medium text-stone-600 dark:text-stone-400 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
                          title="Print Battle Plan"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 6 2 18 2 18 9" />
                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                            <rect x="6" y="14" width="12" height="8" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditBpId(bp.id);
                          }}
                          className="flex-1 px-3 py-1.5 text-xs font-medium text-stone-600 dark:text-stone-400 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(bp.id);
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-white dark:bg-stone-800 border border-red-200 dark:border-red-900/50 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {/* Archive toggle */}
                {hasArchive && (
                  <button
                    onClick={() => setShowArchive(!showArchive)}
                    className="w-full mt-2 py-1.5 text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-400 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className={cn("transition-transform", showArchive && "rotate-180")}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                    {showArchive ? "Hide" : "Show"} {archivedBPs.length} older plans
                  </button>
                )}
              </div>
            )}

            {/* New BP Button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className={cn(
                "w-full mt-3 px-3 py-2 text-sm font-medium text-stone-600 dark:text-stone-400 border border-dashed border-stone-300 dark:border-stone-700 rounded transition-colors flex items-center justify-center gap-2",
                accent.textHover
              )}
              style={{
                // For border hover, we need inline styles since Tailwind hover:border can't be dynamic
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = accent.swatch}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = ""}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Weekly BP
            </button>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <WeeklyBPModal onClose={() => setShowCreateModal(false)} />
      )}

      {/* Edit Modal */}
      {editBpId && (
        <WeeklyBPModal
          editBpId={editBpId}
          onClose={() => setEditBpId(null)}
        />
      )}

      {/* BP Notes Modal */}
      {selectedBPId && (
        <BPNotesModal
          bpId={selectedBPId}
          onClose={() => setSelectedBPId(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <ConfirmModal
          title="Delete Battle Plan?"
          message={`"${weeklyBattlePlans.find(bp => bp.id === confirmDeleteId)?.title}" will be moved to the trash. You can restore it within 30 days.`}
          confirmLabel="Delete"
          onConfirm={() => handleDeleteBP(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}

      {/* Forward Tasks Modal */}
      {forwardBpId && (
        <ForwardTasksModal
          sourceBpId={forwardBpId}
          onClose={() => setForwardBpId(null)}
        />
      )}

      {/* Print Modal */}
      {showPrint && (
        <PrintBPModal
          viewMode="own"
          onClose={() => setShowPrint(false)}
        />
      )}
    </>
  );
}
