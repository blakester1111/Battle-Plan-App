import { NextRequest, NextResponse } from "next/server";
import { infoTerminalOps, taskOps, taskNoteOps, bpNoteOps, weeklyBPOps } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";

// GET board data for an info terminal (viewer accessing owner's board)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const viewerId = await getCurrentUserId();
    if (!viewerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId: ownerId } = await params;

    // Check if viewer has permission to view this board
    const canView = infoTerminalOps.canView(ownerId, viewerId);
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get tasks
    const tasks = taskOps.getAll(ownerId);
    const formattedTasks = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      order: t.order,
      createdAt: t.created_at,
      label: t.label,
      priority: t.priority,
      category: t.category,
      bugged: !!t.bugged,
      weeklyBpId: t.weekly_bp_id,
      formulaStepId: t.formula_step_id,
      dueAt: t.due_at || undefined,
      reminderAt: t.reminder_at || undefined,
      recurrenceRule: t.recurrence_rule ? JSON.parse(t.recurrence_rule) : undefined,
      recurrenceSourceId: t.recurrence_source_id || undefined,
      archivedAt: t.archived_at || undefined,
    }));

    // Get task notes (only info type)
    const taskIds = tasks.map((t) => t.id);
    const taskNotesRaw = taskNoteOps.getByTaskIds(taskIds, "info");
    const taskNotes: Record<string, typeof formattedTaskNotes> = {};
    const formattedTaskNotes = taskNotesRaw.map((n) => ({
      id: n.id,
      taskId: n.task_id,
      authorId: n.author_id,
      authorUsername: n.author_username,
      authorFirstName: n.author_first_name,
      authorLastName: n.author_last_name,
      content: n.content,
      createdAt: n.created_at,
      readAt: n.read_at,
      noteType: n.note_type as "senior" | "info",
    }));
    for (const note of formattedTaskNotes) {
      if (!taskNotes[note.taskId]) {
        taskNotes[note.taskId] = [];
      }
      taskNotes[note.taskId].push(note);
    }

    // Get weekly BPs with progress
    const weeklyBPs = weeklyBPOps.getAllWithProgress(ownerId);
    const formattedBPs = weeklyBPs.map((bp) => ({
      id: bp.id,
      userId: bp.user_id,
      title: bp.title,
      weekStart: bp.week_start,
      formulaId: bp.formula_id,
      formulaName: bp.formula_name,
      formulaCode: bp.formula_code,
      notes: bp.notes,
      stepWriteups: bp.step_writeups_json ? JSON.parse(bp.step_writeups_json) : undefined,
      createdAt: bp.created_at,
      totalTasks: bp.totalTasks,
      completedTasks: bp.completedTasks,
      progressPercent: bp.progressPercent,
    }));

    // Get BP notes (only info type)
    const bpIds = weeklyBPs.map((bp) => bp.id);
    const bpNotesRaw = bpNoteOps.getByBpIds(bpIds, "info");
    const bpNotes: Record<string, typeof formattedBPNotes> = {};
    const formattedBPNotes = bpNotesRaw.map((n) => ({
      id: n.id,
      bpId: n.bp_id,
      authorId: n.author_id,
      authorUsername: n.author_username,
      authorFirstName: n.author_first_name,
      authorLastName: n.author_last_name,
      content: n.content,
      createdAt: n.created_at,
      readAt: n.read_at,
      noteType: n.note_type as "senior" | "info",
    }));
    for (const note of formattedBPNotes) {
      if (!bpNotes[note.bpId]) {
        bpNotes[note.bpId] = [];
      }
      bpNotes[note.bpId].push(note);
    }

    return NextResponse.json({
      tasks: formattedTasks,
      taskNotes,
      weeklyBPs: formattedBPs,
      bpNotes,
    });
  } catch (error) {
    console.error("Error fetching info terminal board:", error);
    return NextResponse.json({ error: "Failed to fetch board" }, { status: 500 });
  }
}
