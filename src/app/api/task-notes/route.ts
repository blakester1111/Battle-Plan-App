import { NextRequest, NextResponse } from "next/server";
import { userOps, relationshipOps, taskOps, taskNoteOps, infoTerminalOps } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { generateId } from "@/lib/utils";

// GET - get notes for a task or all notes on my tasks
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("taskId");
    const juniorId = searchParams.get("juniorId");
    const action = searchParams.get("action");
    const noteType = searchParams.get("noteType") as "senior" | "info" | null;

    // Get all notes on my own tasks (for juniors to see senior feedback)
    if (action === "my-notes") {
      const notes = taskNoteOps.getForTaskOwner(userId, noteType || undefined).map((n) => ({
        id: n.id,
        taskId: n.task_id,
        authorId: n.author_id,
        authorUsername: n.author_username,
        authorFirstName: n.author_first_name,
        authorLastName: n.author_last_name,
        content: n.content,
        createdAt: n.created_at,
        readAt: n.read_at,
        taskTitle: n.task_title,
        noteType: n.note_type,
      }));

      // Group by task ID
      const notesByTask: Record<string, typeof notes> = {};
      for (const note of notes) {
        if (!notesByTask[note.taskId]) {
          notesByTask[note.taskId] = [];
        }
        notesByTask[note.taskId].push(note);
      }

      const unreadCount = taskNoteOps.getUnreadCount(userId, noteType || undefined);

      return NextResponse.json({ notes: notesByTask, unreadCount });
    }

    // Get notes for all tasks of a junior (for seniors viewing junior board)
    if (juniorId) {
      const juniors = relationshipOps.getJuniors(userId);
      const isValidSenior = juniors.some((j) => j.id === juniorId);

      if (!isValidSenior) {
        return NextResponse.json({ error: "Not authorized to view this user's notes" }, { status: 403 });
      }

      const tasks = taskOps.getAll(juniorId);
      const taskIds = tasks.map((t) => t.id);
      const notes = taskNoteOps.getByTaskIds(taskIds).map((n) => ({
        id: n.id,
        taskId: n.task_id,
        authorId: n.author_id,
        authorUsername: n.author_username,
        authorFirstName: n.author_first_name,
        authorLastName: n.author_last_name,
        content: n.content,
        createdAt: n.created_at,
        readAt: n.read_at,
      }));

      const notesByTask: Record<string, typeof notes> = {};
      for (const note of notes) {
        if (!notesByTask[note.taskId]) {
          notesByTask[note.taskId] = [];
        }
        notesByTask[note.taskId].push(note);
      }

      return NextResponse.json({ notes: notesByTask });
    }

    // Get notes for a specific task
    if (!taskId) {
      return NextResponse.json({ error: "Task ID or Junior ID required" }, { status: 400 });
    }

    const task = taskOps.getById(taskId);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const isOwner = task.user_id === userId;
    const juniors = relationshipOps.getJuniors(userId);
    const isSenior = juniors.some((j) => j.id === task.user_id);

    if (!isOwner && !isSenior) {
      return NextResponse.json({ error: "Not authorized to view notes for this task" }, { status: 403 });
    }

    const notes = taskNoteOps.getByTaskId(taskId).map((n) => ({
      id: n.id,
      taskId: n.task_id,
      authorId: n.author_id,
      authorUsername: n.author_username,
      authorFirstName: n.author_first_name,
      authorLastName: n.author_last_name,
      content: n.content,
      createdAt: n.created_at,
      readAt: n.read_at,
    }));

    return NextResponse.json({ notes });
  } catch (error) {
    console.error("Error getting task notes:", error);
    return NextResponse.json({ error: "Failed to get notes" }, { status: 500 });
  }
}

// POST - create a note on a task (seniors on junior tasks, info terminals, or task owner replying)
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { taskId, content, noteType } = body;

    if (!taskId || !content) {
      return NextResponse.json({ error: "Task ID and content required" }, { status: 400 });
    }

    const task = taskOps.getById(taskId);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Check if user is allowed to add a note:
    // 1. User is a senior of the task owner (noteType = senior)
    // 2. User is the task owner (replying to a note)
    // 3. User is an info terminal viewer (noteType = info)
    const isOwner = task.user_id === userId;
    const juniors = relationshipOps.getJuniors(userId);
    const isSenior = juniors.some((j) => j.id === task.user_id);
    const isInfoTerminal = infoTerminalOps.canView(task.user_id, userId);

    // Determine the note type
    const effectiveNoteType = noteType || (isSenior ? "senior" : isInfoTerminal ? "info" : "senior");

    if (!isOwner && !isSenior && !isInfoTerminal) {
      return NextResponse.json({ error: "Not authorized to add notes to this task" }, { status: 403 });
    }

    // If info terminal is commenting, must use info note type
    if (isInfoTerminal && !isSenior && effectiveNoteType !== "info") {
      return NextResponse.json({ error: "Info terminals can only add info notes" }, { status: 403 });
    }

    // If owner is replying, there should be existing notes of the same type
    if (isOwner && !isSenior && !isInfoTerminal) {
      const existingNotes = taskNoteOps.getByTaskId(taskId, effectiveNoteType);
      const hasOtherNotes = existingNotes.some((n) => n.author_id !== userId);
      if (!hasOtherNotes) {
        return NextResponse.json({ error: "Can only reply to existing notes" }, { status: 403 });
      }
    }

    const noteId = generateId();
    taskNoteOps.create({
      id: noteId,
      taskId,
      authorId: userId,
      content: content.trim(),
      noteType: effectiveNoteType,
    });

    const author = userOps.findById(userId);

    return NextResponse.json({
      note: {
        id: noteId,
        taskId,
        authorId: userId,
        authorUsername: author?.username || "",
        authorFirstName: author?.first_name,
        authorLastName: author?.last_name,
        content: content.trim(),
        createdAt: new Date().toISOString(),
        readAt: null,
        noteType: effectiveNoteType,
      },
    });
  } catch (error) {
    console.error("Error creating task note:", error);
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
  }
}

// PATCH - mark notes as read
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { taskId } = body;

    if (!taskId) {
      return NextResponse.json({ error: "Task ID required" }, { status: 400 });
    }

    const task = taskOps.getById(taskId);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Only the task owner can mark notes as read
    if (task.user_id !== userId) {
      return NextResponse.json({ error: "Only task owner can mark notes as read" }, { status: 403 });
    }

    taskNoteOps.markTaskNotesAsRead(taskId, userId);

    const newUnreadCount = taskNoteOps.getUnreadCount(userId);

    return NextResponse.json({ success: true, unreadCount: newUnreadCount });
  } catch (error) {
    console.error("Error marking notes as read:", error);
    return NextResponse.json({ error: "Failed to mark notes as read" }, { status: 500 });
  }
}

// DELETE - delete a note (only author can delete, and only if unread by recipient)
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get("id");

    if (!noteId) {
      return NextResponse.json({ error: "Note ID required" }, { status: 400 });
    }

    // Get the note to verify ownership and read status
    const note = taskNoteOps.getById(noteId);
    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    // Only the author can delete their own notes
    if (note.author_id !== userId) {
      return NextResponse.json({ error: "Can only delete your own notes" }, { status: 403 });
    }

    // Can only delete if the note hasn't been read yet
    if (note.read_at) {
      return NextResponse.json({ error: "Cannot delete a note that has already been read" }, { status: 400 });
    }

    taskNoteOps.delete(noteId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting task note:", error);
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
}
