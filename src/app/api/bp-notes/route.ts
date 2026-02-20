import { NextRequest, NextResponse } from "next/server";
import { userOps, relationshipOps, weeklyBPOps, bpNoteOps, infoTerminalOps } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { generateId } from "@/lib/utils";

// GET - get notes for a BP or all notes on my BPs
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const bpId = searchParams.get("bpId");
    const juniorId = searchParams.get("juniorId");
    const action = searchParams.get("action");
    const noteType = searchParams.get("noteType") as "senior" | "info" | null;

    // Get all notes on my own BPs (for juniors to see senior feedback)
    if (action === "my-notes") {
      const notes = bpNoteOps.getForBPOwner(userId, noteType || undefined).map((n) => ({
        id: n.id,
        bpId: n.bp_id,
        authorId: n.author_id,
        authorUsername: n.author_username,
        authorFirstName: n.author_first_name,
        authorLastName: n.author_last_name,
        content: n.content,
        createdAt: n.created_at,
        readAt: n.read_at,
        bpTitle: n.bp_title,
        noteType: n.note_type,
      }));

      // Group by BP ID
      const notesByBP: Record<string, typeof notes> = {};
      for (const note of notes) {
        if (!notesByBP[note.bpId]) {
          notesByBP[note.bpId] = [];
        }
        notesByBP[note.bpId].push(note);
      }

      const unreadCount = bpNoteOps.getUnreadCount(userId, noteType || undefined);

      return NextResponse.json({ notes: notesByBP, unreadCount });
    }

    // Get notes for all BPs of a junior (for seniors viewing junior board)
    if (juniorId) {
      const juniors = relationshipOps.getJuniors(userId);
      const isValidSenior = juniors.some((j) => j.id === juniorId);

      if (!isValidSenior) {
        return NextResponse.json({ error: "Not authorized to view this user's notes" }, { status: 403 });
      }

      const bps = weeklyBPOps.getAll(juniorId);
      const bpIds = bps.map((bp) => bp.id);
      const notes = bpNoteOps.getByBpIds(bpIds).map((n) => ({
        id: n.id,
        bpId: n.bp_id,
        authorId: n.author_id,
        authorUsername: n.author_username,
        authorFirstName: n.author_first_name,
        authorLastName: n.author_last_name,
        content: n.content,
        createdAt: n.created_at,
        readAt: n.read_at,
      }));

      const notesByBP: Record<string, typeof notes> = {};
      for (const note of notes) {
        if (!notesByBP[note.bpId]) {
          notesByBP[note.bpId] = [];
        }
        notesByBP[note.bpId].push(note);
      }

      return NextResponse.json({ notes: notesByBP });
    }

    // Get notes for a specific BP
    if (!bpId) {
      return NextResponse.json({ error: "BP ID or Junior ID required" }, { status: 400 });
    }

    const bp = weeklyBPOps.getById(bpId);
    if (!bp) {
      return NextResponse.json({ error: "Battle plan not found" }, { status: 404 });
    }

    const isOwner = bp.user_id === userId;
    const juniors = relationshipOps.getJuniors(userId);
    const isSenior = juniors.some((j) => j.id === bp.user_id);

    if (!isOwner && !isSenior) {
      return NextResponse.json({ error: "Not authorized to view notes for this battle plan" }, { status: 403 });
    }

    const notes = bpNoteOps.getByBpId(bpId).map((n) => ({
      id: n.id,
      bpId: n.bp_id,
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
    console.error("Error getting BP notes:", error);
    return NextResponse.json({ error: "Failed to get notes" }, { status: 500 });
  }
}

// POST - create a note on a BP (seniors on junior BPs, info terminals, or BP owner replying)
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { bpId, content, noteType } = body;

    if (!bpId || !content) {
      return NextResponse.json({ error: "BP ID and content required" }, { status: 400 });
    }

    const bp = weeklyBPOps.getById(bpId);
    if (!bp) {
      return NextResponse.json({ error: "Battle plan not found" }, { status: 404 });
    }

    // Check if user is allowed to add a note:
    // 1. User is a senior of the BP owner (noteType = senior)
    // 2. User is the BP owner (replying to a note)
    // 3. User is an info terminal viewer (noteType = info)
    const isOwner = bp.user_id === userId;
    const juniors = relationshipOps.getJuniors(userId);
    const isSenior = juniors.some((j) => j.id === bp.user_id);
    const isInfoTerminal = infoTerminalOps.canView(bp.user_id, userId);

    // Determine the note type
    const effectiveNoteType = noteType || (isSenior ? "senior" : isInfoTerminal ? "info" : "senior");

    if (!isOwner && !isSenior && !isInfoTerminal) {
      return NextResponse.json({ error: "Not authorized to add notes to this battle plan" }, { status: 403 });
    }

    // If info terminal is commenting, must use info note type
    if (isInfoTerminal && !isSenior && effectiveNoteType !== "info") {
      return NextResponse.json({ error: "Info terminals can only add info notes" }, { status: 403 });
    }

    // If owner is replying, there should be existing notes of the same type
    if (isOwner && !isSenior && !isInfoTerminal) {
      const existingNotes = bpNoteOps.getByBpId(bpId, effectiveNoteType);
      const hasOtherNotes = existingNotes.some((n) => n.author_id !== userId);
      if (!hasOtherNotes) {
        return NextResponse.json({ error: "Can only reply to existing notes" }, { status: 403 });
      }
    }

    const noteId = generateId();
    bpNoteOps.create({
      id: noteId,
      bpId,
      authorId: userId,
      content: content.trim(),
      noteType: effectiveNoteType,
    });

    const author = userOps.findById(userId);

    return NextResponse.json({
      note: {
        id: noteId,
        bpId,
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
    console.error("Error creating BP note:", error);
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
    const { bpId } = body;

    if (!bpId) {
      return NextResponse.json({ error: "BP ID required" }, { status: 400 });
    }

    const bp = weeklyBPOps.getById(bpId);
    if (!bp) {
      return NextResponse.json({ error: "Battle plan not found" }, { status: 404 });
    }

    // Only the BP owner can mark notes as read
    if (bp.user_id !== userId) {
      return NextResponse.json({ error: "Only battle plan owner can mark notes as read" }, { status: 403 });
    }

    bpNoteOps.markBPNotesAsRead(bpId, userId);

    const newUnreadCount = bpNoteOps.getUnreadCount(userId);

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
    const note = bpNoteOps.getById(noteId);
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

    bpNoteOps.delete(noteId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting BP note:", error);
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
}
