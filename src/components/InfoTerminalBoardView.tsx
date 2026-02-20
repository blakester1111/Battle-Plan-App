"use client";

import { useState, useMemo } from "react";
import { useAppContext, useAccentColor } from "@/context/AppContext";
import PrintBPModal from "./PrintBPModal";
import type { KanbanTask, ColumnStatus, Priority, TaskNote, BPNote } from "@/lib/types";
import { cn, LABEL_COLORS, PRIORITY_COLORS, PRIORITY_LABELS, getDisplayName } from "@/lib/utils";
import Select from "@/components/ui/Select";

// Formula badge style - neutral gray for readability
const FORMULA_BADGE_STYLE = "bg-gray-100 text-gray-600 dark:bg-stone-700 dark:text-stone-400";

const COLUMNS: ColumnStatus[] = ["todo", "in-progress", "complete"];
const COLUMN_LABELS: Record<ColumnStatus, string> = {
  todo: "To Do",
  "in-progress": "In Progress",
  complete: "Complete",
};

const PRIORITY_ORDER: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
  none: 3,
};

export default function InfoTerminalBoardView() {
  const { state, dispatch } = useAppContext();
  const accent = useAccentColor();
  const { viewingInfoTerminal, infoTerminalTasks, infoTerminalTaskNotes, infoTerminalWeeklyBPs, infoTerminalBPNotes } = state;
  const [selectedTask, setSelectedTask] = useState<KanbanTask | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [selectedBpId, setSelectedBpId] = useState<string | null>(null);
  const [showPrint, setShowPrint] = useState(false);

  // Compute BP notes info (has notes, count)
  const bpNotesInfo = useMemo(() => {
    const info: Record<string, { hasNotes: boolean; notesCount: number }> = {};

    for (const bp of infoTerminalWeeklyBPs) {
      const notes = infoTerminalBPNotes[bp.id] || [];
      info[bp.id] = {
        hasNotes: notes.length > 0,
        notesCount: notes.length,
      };
    }

    return info;
  }, [infoTerminalWeeklyBPs, infoTerminalBPNotes]);

  if (!viewingInfoTerminal) return null;

  const owner = viewingInfoTerminal;

  // Filter tasks by selected BP
  const filteredTasks = selectedBpId
    ? infoTerminalTasks.filter((t) => t.weeklyBpId === selectedBpId)
    : infoTerminalTasks;

  // Calculate progress
  const totalTasks = filteredTasks.length;
  const completedTasks = filteredTasks.filter((t) => t.status === "complete").length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Get selected BP details
  const selectedBp = selectedBpId ? infoTerminalWeeklyBPs.find((bp) => bp.id === selectedBpId) : null;

  function getTasksForColumn(status: ColumnStatus) {
    const columnTasks = filteredTasks.filter((t) => t.status === status);

    const withPriority = columnTasks
      .filter((t) => t.priority && t.priority !== "none")
      .sort(
        (a, b) =>
          PRIORITY_ORDER[a.priority || "none"] - PRIORITY_ORDER[b.priority || "none"] ||
          a.order - b.order
      );

    const withoutPriority = columnTasks
      .filter((t) => !t.priority || t.priority === "none")
      .sort((a, b) => a.order - b.order);

    return [...withPriority, ...withoutPriority];
  }

  // Get badge text: "FL" initials format
  function getBadgeText() {
    if (owner.firstName && owner.lastName) {
      return `${owner.firstName[0]}${owner.lastName[0]}`.toUpperCase();
    }
    if (owner.firstName) {
      return owner.firstName[0].toUpperCase();
    }
    return owner.username[0].toUpperCase();
  }

  async function handleAddNote() {
    if (!selectedTask || !noteContent.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/task-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: selectedTask.id,
          content: noteContent.trim(),
          noteType: "info",
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to add note");
      }

      const { note } = await res.json();
      dispatch({
        type: "ADD_INFO_TERMINAL_TASK_NOTE",
        payload: { taskId: selectedTask.id, note: note as TaskNote },
      });
      setNoteContent("");
    } catch (error) {
      console.error("Failed to add note:", error);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteNote(noteId: string, taskId: string) {
    setDeletingNoteId(noteId);
    try {
      const res = await fetch(`/api/task-notes?id=${noteId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete note");
      }

      // Remove note from local state
      dispatch({
        type: "SET_VIEWING_INFO_TERMINAL",
        payload: {
          user: viewingInfoTerminal,
          tasks: infoTerminalTasks,
          taskNotes: {
            ...infoTerminalTaskNotes,
            [taskId]: infoTerminalTaskNotes[taskId].filter((n) => n.id !== noteId),
          },
          bpNotes: infoTerminalBPNotes,
          weeklyBPs: infoTerminalWeeklyBPs,
        },
      });
    } catch (error) {
      console.error("Failed to delete note:", error);
      alert(error instanceof Error ? error.message : "Failed to delete note");
    } finally {
      setDeletingNoteId(null);
    }
  }

  const taskNotes = selectedTask ? infoTerminalTaskNotes[selectedTask.id] || [] : [];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400">
            {getBadgeText()}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-2">
              {getDisplayName(owner)}&apos;s {selectedBp ? selectedBp.title : "Battle Plan"}
              <span className="text-xs font-normal px-2 py-0.5 rounded bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400">
                Info Terminal
              </span>
            </h2>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Read-only view
              {owner.postTitle && ` - ${owner.postTitle}`}
            </p>
          </div>
        </div>

        {/* BP Filter & Progress */}
        <div className="flex items-center gap-4">
          {/* Progress Bar */}
          <div className="flex items-center gap-3">
            <div className="w-32 h-2 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  backgroundColor: progressPercent === 100 ? "#22c55e" : "#06b6d4",
                  width: `${progressPercent}%`,
                }}
              />
            </div>
            <span className="text-xs font-medium text-stone-500 dark:text-stone-400 whitespace-nowrap">
              {completedTasks}/{totalTasks} ({progressPercent}%)
            </span>
          </div>

          {/* BP Filter Dropdown */}
          {infoTerminalWeeklyBPs.length > 0 && (
            <div className="flex items-center gap-2">
              <Select
                value={selectedBpId || ""}
                onChange={(val) => setSelectedBpId(val || null)}
                options={[
                  { value: "", label: "All Tasks (Main Board)" },
                  ...infoTerminalWeeklyBPs.map((bp) => ({
                    value: bp.id,
                    label: `${bp.title} (${bp.formulaCode})${bpNotesInfo[bp.id]?.hasNotes ? ` [${bpNotesInfo[bp.id].notesCount} notes]` : ""}`,
                  })),
                ]}
              />

              {/* Print Button - shown when a BP is selected */}
              {selectedBpId && (
                <button
                  onClick={() => setShowPrint(true)}
                  className="p-1.5 rounded text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                  title="Print this battle plan"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 6 2 18 2 18 9" />
                    <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 grid grid-cols-3 gap-4">
        {COLUMNS.map((status) => (
          <div key={status} className="flex flex-col">
            <div className="flex items-center justify-between mb-3 px-0.5">
              <div className="flex items-center gap-2">
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">
                  {COLUMN_LABELS[status]}
                </h2>
                {getTasksForColumn(status).length > 0 && (
                  <span className="text-[10px] font-medium tabular-nums bg-stone-200/70 dark:bg-stone-800/70 text-stone-500 dark:text-stone-400 px-1.5 py-0.5 rounded">
                    {getTasksForColumn(status).length}
                  </span>
                )}
              </div>
            </div>
            <div className="flex-1 space-y-2 overflow-auto">
              {getTasksForColumn(status).map((task) => {
                const hasLabel = task.label && task.label !== "none";
                const hasPriority = task.priority && task.priority !== "none";
                const hasNotes = (infoTerminalTaskNotes[task.id] || []).length > 0;

                return (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className={cn(
                      "p-3 rounded-md border cursor-pointer transition-all",
                      selectedTask?.id === task.id
                        ? "bg-cyan-50 dark:bg-cyan-900/20 border-cyan-400 dark:border-cyan-600"
                        : "bg-white dark:bg-stone-800/40 border-stone-200/80 dark:border-stone-700/50 hover:bg-stone-50 dark:hover:bg-stone-800/60"
                    )}
                    style={{
                      borderLeftWidth: hasLabel ? "3px" : undefined,
                      borderLeftColor: hasLabel ? LABEL_COLORS[task.label!] : undefined,
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-stone-800 dark:text-stone-200 leading-snug truncate flex-1 min-w-0">
                        {task.title}
                      </p>
                      {hasNotes && (
                        <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center bg-cyan-100 dark:bg-cyan-900/30">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan-600 dark:text-cyan-400">
                            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                          </svg>
                        </span>
                      )}
                    </div>
                    {/* Formula code + description row */}
                    {(task.weeklyBpId || task.description) && (() => {
                      const bp = task.weeklyBpId ? infoTerminalWeeklyBPs.find((b) => b.id === task.weeklyBpId) : null;
                      return (
                        <div className="flex items-start gap-1.5 mt-1.5">
                          {bp?.formulaCode && (
                            <span className={cn(
                              "shrink-0 mt-px px-1.5 py-0.5 text-[10px] font-medium rounded",
                              FORMULA_BADGE_STYLE
                            )}>
                              {bp.formulaCode}
                            </span>
                          )}
                          {task.description && (
                            <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed line-clamp-2">
                              {task.description}
                            </p>
                          )}
                        </div>
                      );
                    })()}
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
                  </div>
                );
              })}
              {getTasksForColumn(status).length === 0 && (
                <div className="text-center py-8 text-stone-400 dark:text-stone-500 text-sm">
                  No tasks
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Print BP Modal */}
      {showPrint && selectedBpId && (
        <PrintBPModal
          onClose={() => setShowPrint(false)}
          viewMode="info"
          bpId={selectedBpId}
        />
      )}

      {/* Task detail / notes panel */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-stone-900 rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
            <div className="p-5 border-b border-stone-200 dark:border-stone-800 flex items-start justify-between shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-stone-800 dark:text-stone-200">
                  {selectedTask.title}
                </h3>
                {selectedTask.description && (
                  <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
                    {selectedTask.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                className="p-1 rounded text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-auto p-5">
              <h4 className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-3 flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
                Info Notes ({taskNotes.length})
              </h4>

              {taskNotes.length === 0 ? (
                <p className="text-sm text-stone-400 dark:text-stone-500 text-center py-4">
                  No info notes yet. Add one below.
                </p>
              ) : (
                <div className="space-y-3 mb-4">
                  {taskNotes.map((note) => {
                    const isMyNote = note.authorId === state.user?.id;
                    const canDelete = isMyNote && !note.readAt;

                    return (
                      <div
                        key={note.id}
                        className={cn(
                          "p-3 rounded-lg",
                          isMyNote
                            ? "bg-cyan-50 dark:bg-cyan-900/20"
                            : "bg-stone-50 dark:bg-stone-800/50"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-sm font-medium",
                              isMyNote
                                ? "text-cyan-600 dark:text-cyan-400"
                                : "text-stone-700 dark:text-stone-300"
                            )}>
                              {isMyNote ? "You" : (note.authorFirstName || note.authorLastName
                                ? `${note.authorFirstName || ""} ${note.authorLastName || ""}`.trim()
                                : note.authorUsername)}
                            </span>
                            <span className="text-xs text-stone-400 dark:text-stone-500">
                              {new Date(note.createdAt).toLocaleDateString()}{" "}
                              {new Date(note.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            {isMyNote && !note.readAt && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                Unread
                              </span>
                            )}
                            {isMyNote && note.readAt && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                                Read
                              </span>
                            )}
                          </div>
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteNote(note.id, selectedTask.id)}
                              disabled={deletingNoteId === note.id}
                              className="p-1 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                              title="Delete note (only possible while unread)"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                              </svg>
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-stone-600 dark:text-stone-400 whitespace-pre-wrap">
                          {note.content}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-stone-200 dark:border-stone-800 shrink-0">
              <div className="flex gap-2">
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Add an info note..."
                  className="flex-1 px-3 py-2 text-sm bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                  rows={2}
                />
                <button
                  onClick={handleAddNote}
                  disabled={submitting || !noteContent.trim()}
                  className="px-4 py-2 text-sm font-medium text-white rounded transition-colors disabled:opacity-50 self-end bg-cyan-500 hover:bg-cyan-600"
                >
                  {submitting ? "..." : "Add"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
