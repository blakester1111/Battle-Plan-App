"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Note } from "@/lib/types";
import { useAppContext, useAccentColor } from "@/context/AppContext";
import { cn } from "@/lib/utils";

interface Props {
  note: Note;
}

export default function NoteEditor({ note }: Props) {
  const { dispatch } = useAppContext();
  const accent = useAccentColor();
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Sync local state only when switching to a different note
  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  const save = useCallback(
    (newTitle: string, newContent: string) => {
      dispatch({
        type: "UPDATE_NOTE",
        payload: { id: note.id, title: newTitle, content: newContent },
      });
    },
    [dispatch, note.id]
  );

  // Flush pending save on unmount
  const titleRef = useRef(title);
  const contentRef = useRef(content);
  titleRef.current = title;
  contentRef.current = content;

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        save(titleRef.current, contentRef.current);
      }
    };
  }, [save]);

  function handleChange(field: "title" | "content", value: string) {
    const newTitle = field === "title" ? value : title;
    const newContent = field === "content" ? value : content;

    if (field === "title") setTitle(value);
    else setContent(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(newTitle, newContent), 300);
  }

  function handleBlur() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    save(title, content);
  }

  // Format timestamp for display
  function formatTimestamp(isoString: string) {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Check if note was updated after creation (with 1 second tolerance)
  const wasUpdated = note.createdAt && note.updatedAt &&
    new Date(note.updatedAt).getTime() - new Date(note.createdAt).getTime() > 1000;

  return (
    <div className="flex flex-col gap-2 mt-2 animate-fade-in">
      <input
        type="text"
        value={title}
        onChange={(e) => handleChange("title", e.target.value)}
        onBlur={handleBlur}
        className={cn(
          "w-full rounded px-2 py-1.5 text-sm font-medium bg-white dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700/50 focus:outline-none focus:ring-2 transition-shadow",
          accent.ring
        )}
        placeholder="Note title"
      />
      <textarea
        value={content}
        onChange={(e) => handleChange("content", e.target.value)}
        onBlur={handleBlur}
        rows={8}
        className={cn(
          "w-full rounded px-2 py-1.5 text-sm leading-relaxed bg-white dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700/50 focus:outline-none focus:ring-2 placeholder:text-stone-400 transition-shadow",
          accent.ring
        )}
        placeholder="Write your notes..."
      />

      {/* Timestamps */}
      {note.createdAt && (
        <div className="text-[10px] text-stone-400 dark:text-stone-500 space-y-0.5 pt-1">
          {wasUpdated && (
            <p>Last updated: {formatTimestamp(note.updatedAt)}</p>
          )}
          <p>Created: {formatTimestamp(note.createdAt)}</p>
        </div>
      )}
    </div>
  );
}
