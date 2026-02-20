"use client";

import { useState } from "react";
import { useAppContext, useAccentColor } from "@/context/AppContext";
import NoteEditor from "./NoteEditor";
import { cn } from "@/lib/utils";

const RECENT_LIMIT = 10;

export default function NotesArea() {
  const { state, dispatch } = useAppContext();
  const accent = useAccentColor();
  const [input, setInput] = useState("");
  const [showArchive, setShowArchive] = useState(false);

  // Split notes into recent and archived
  const recentNotes = state.notes.slice(0, RECENT_LIMIT);
  const archivedNotes = state.notes.slice(RECENT_LIMIT);
  const hasArchive = archivedNotes.length > 0;
  const displayedNotes = showArchive ? state.notes : recentNotes;

  function handleAdd() {
    const text = input.trim();
    if (!text) return;
    dispatch({
      type: "ADD_NOTE",
      payload: {
        title: text,
        content: "",
      },
    });
    setInput("");
  }

  function toggleNote(id: string) {
    dispatch({
      type: "SET_ACTIVE_NOTE",
      payload: { id: state.activeNoteId === id ? null : id },
    });
  }

  const isCollapsed = state.notesCollapsed;

  return (
    <div className="flex flex-col h-full">
      <button
        onClick={() => dispatch({ type: "TOGGLE_NOTES_COLLAPSED" })}
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
              !isCollapsed && "rotate-90"
            )}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500 group-hover:text-stone-500 dark:group-hover:text-stone-400 transition-colors">
            Notes
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {state.notes.length > 0 && (
            <span className="text-[10px] font-medium tabular-nums text-stone-400 dark:text-stone-500">
              {state.notes.length}
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
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>
        </div>
      </button>

      {/* Quick add */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          placeholder="Quick add note..."
          className={cn(
            "flex-1 rounded px-3 py-1.5 text-sm bg-white dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700/50 focus:outline-none focus:ring-2 placeholder:text-stone-400 transition-shadow",
            accent.ring
          )}
        />
        <button
          type="button"
          onClick={handleAdd}
          className="rounded px-2.5 py-1.5 text-sm font-medium border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-400 hover:border-stone-400 dark:hover:border-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
        >
          Add
        </button>
      </div>

      {/* Notes list */}
      {!isCollapsed && (
        state.notes.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-xs text-stone-400 dark:text-stone-500">
              Jot something down
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
          {displayedNotes.map((note) => {
            const isExpanded = note.id === state.activeNoteId;
            return (
              <div key={note.id} className="animate-fade-in">
                {/* Title row */}
                <div
                  className={cn(
                    "flex items-center justify-between group rounded px-2 py-1.5 cursor-pointer transition-colors",
                    isExpanded
                      ? "bg-stone-200/70 dark:bg-stone-800/70"
                      : "hover:bg-stone-200/40 dark:hover:bg-stone-800/40"
                  )}
                >
                  <button
                    onClick={() => toggleNote(note.id)}
                    className={cn(
                      "text-sm truncate text-left flex-1 min-w-0 leading-snug flex items-center gap-1.5",
                      isExpanded
                        ? "text-stone-800 dark:text-stone-200"
                        : "text-stone-600 dark:text-stone-400"
                    )}
                  >
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
                        "shrink-0 transition-transform duration-150",
                        isExpanded && "rotate-90"
                      )}
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    <span className="truncate">
                      {note.title || "Untitled"}
                    </span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch({
                        type: "DELETE_NOTE",
                        payload: { id: note.id },
                      });
                    }}
                    className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 p-0.5 text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 transition-all focus:opacity-100 shrink-0"
                    aria-label="Delete note"
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
                </div>

                {/* Expanded content */}
                {isExpanded && <NoteEditor note={note} />}
              </div>
            );
          })}

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
              {showArchive ? "Hide" : "Show"} {archivedNotes.length} older notes
            </button>
          )}
          </div>
        )
      )}
    </div>
  );
}
