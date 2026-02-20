"use client";

import { useState, useEffect } from "react";
import { useAppContext, useAccentColor } from "@/context/AppContext";
import { bpNotesApi } from "@/lib/api";
import type { BPNote } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BPNotesModalProps {
  bpId: string;
  onClose: () => void;
  isJuniorView?: boolean; // true when senior is viewing junior's BP
}

export default function BPNotesModal({ bpId, onClose, isJuniorView }: BPNotesModalProps) {
  const { state, dispatch, refreshMyBPNotes } = useAppContext();
  const accent = useAccentColor();
  const [replyContent, setReplyContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Get BP info and notes based on context
  const bp = isJuniorView
    ? state.juniorWeeklyBPs.find((b) => b.id === bpId)
    : state.weeklyBattlePlans.find((b) => b.id === bpId);

  const notes = isJuniorView
    ? state.juniorBPNotes[bpId] || []
    : state.myBPNotes[bpId] || [];

  // Mark notes as read when modal opens (only for own BPs)
  useEffect(() => {
    if (isJuniorView) return;

    async function markRead() {
      const hasUnread = notes.some((n) => !n.readAt && n.authorId !== state.user?.id);
      if (hasUnread) {
        try {
          await bpNotesApi.markAsRead(bpId);
          dispatch({ type: "MARK_BP_NOTES_READ", payload: { bpId } });
        } catch (error) {
          console.error("Failed to mark BP notes as read:", error);
        }
      }
    }
    markRead();
  }, [bpId, notes, state.user?.id, dispatch, isJuniorView]);

  async function handleSubmit() {
    if (!replyContent.trim()) return;

    setSubmitting(true);
    try {
      const { note } = await bpNotesApi.create(bpId, replyContent.trim());

      if (isJuniorView) {
        dispatch({
          type: "ADD_JUNIOR_BP_NOTE",
          payload: { bpId, note: note as BPNote },
        });
      } else {
        dispatch({
          type: "ADD_MY_BP_NOTE",
          payload: { bpId, note: note as BPNote },
        });
      }
      setReplyContent("");
    } catch (error) {
      console.error("Failed to add note:", error);
    } finally {
      setSubmitting(false);
    }
  }

  function getAuthorName(note: BPNote) {
    if (note.authorFirstName || note.authorLastName) {
      return `${note.authorFirstName || ""} ${note.authorLastName || ""}`.trim();
    }
    return note.authorUsername;
  }

  const isMyNote = (note: BPNote) => note.authorId === state.user?.id;

  // For seniors viewing junior BPs, they can always add notes
  // For juniors viewing own BPs, they can only reply if there are senior notes
  const canAddNote = isJuniorView || notes.some((n) => n.authorId !== state.user?.id);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-stone-900 rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
        <div className="p-5 border-b border-stone-200 dark:border-stone-800 flex items-start justify-between shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-stone-800 dark:text-stone-200">
              {bp?.title || "Battle Plan Notes"}
            </h3>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
              {bp?.formulaName}
            </p>
          </div>
          <button
            onClick={onClose}
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
            Conversation ({notes.length})
          </h4>

          {notes.length === 0 ? (
            <p className="text-sm text-stone-400 dark:text-stone-500 text-center py-4">
              {isJuniorView
                ? "Add a note about this battle plan."
                : "No notes yet."}
            </p>
          ) : (
            <div className="space-y-3">
              {notes
                .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                .map((note) => (
                  <div
                    key={note.id}
                    className={cn(
                      "p-3 rounded-lg",
                      isMyNote(note)
                        ? `${accent.bgSubtle} ml-6`
                        : "bg-stone-50 dark:bg-stone-800/50 mr-6"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn(
                        "text-sm font-medium",
                        isMyNote(note)
                          ? accent.text
                          : "text-stone-700 dark:text-stone-300"
                      )}>
                        {isMyNote(note) ? "You" : getAuthorName(note)}
                      </span>
                      {!isMyNote(note) && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                          {isJuniorView ? "Junior" : "Senior"}
                        </span>
                      )}
                      <span className="text-xs text-stone-400 dark:text-stone-500">
                        {new Date(note.createdAt).toLocaleDateString()}{" "}
                        {new Date(note.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-sm text-stone-600 dark:text-stone-400 whitespace-pre-wrap">
                      {note.content}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Add note section */}
        {canAddNote && (
          <div className="p-5 border-t border-stone-200 dark:border-stone-800 shrink-0">
            <div className="flex gap-2">
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder={isJuniorView ? "Add a note about this battle plan..." : "Write a reply..."}
                className="flex-1 px-3 py-2 text-sm bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-current resize-none"
                style={{ ["--tw-ring-color" as string]: accent.swatch }}
                rows={2}
              />
              <button
                onClick={handleSubmit}
                disabled={submitting || !replyContent.trim()}
                className="px-4 py-2 text-sm font-medium text-white rounded transition-colors disabled:opacity-50 self-end"
                style={{ backgroundColor: accent.swatch }}
                onMouseEnter={(e) => e.currentTarget.style.filter = "brightness(1.1)"}
                onMouseLeave={(e) => e.currentTarget.style.filter = ""}
              >
                {submitting ? "..." : "Send"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
