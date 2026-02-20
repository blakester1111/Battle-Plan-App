import { NextRequest, NextResponse } from "next/server";
import { relationshipOps, taskOps, taskNoteOps, weeklyBPOps } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";

// GET - get a junior's tasks (must be senior of the junior)
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const juniorId = searchParams.get("juniorId");

    if (!juniorId) {
      return NextResponse.json({ error: "Junior ID required" }, { status: 400 });
    }

    // Verify the current user is a senior of this junior
    const juniors = relationshipOps.getJuniors(userId);
    const isValidSenior = juniors.some((j) => j.id === juniorId);

    if (!isValidSenior) {
      return NextResponse.json({ error: "Not authorized to view this user's tasks" }, { status: 403 });
    }

    // Get all tasks for the junior
    const dbTasks = taskOps.getAll(juniorId);
    const tasks = dbTasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      order: t.order,
      createdAt: t.created_at,
      label: t.label,
      priority: t.priority,
      category: t.category,
      bugged: Boolean(t.bugged),
      weeklyBpId: t.weekly_bp_id || undefined,
      formulaStepId: t.formula_step_id || undefined,
      dueAt: t.due_at || undefined,
      reminderAt: t.reminder_at || undefined,
      recurrenceRule: t.recurrence_rule ? JSON.parse(t.recurrence_rule) : undefined,
      recurrenceSourceId: t.recurrence_source_id || undefined,
      archivedAt: t.archived_at || undefined,
    }));

    // Get junior's weekly battle plans with progress
    const weeklyBPs = weeklyBPOps.getAllWithProgress(juniorId).map((bp) => ({
      id: bp.id,
      userId: bp.user_id,
      title: bp.title,
      weekStart: bp.week_start,
      formulaId: bp.formula_id,
      formulaName: bp.formula_name,
      formulaCode: bp.formula_code,
      notes: bp.notes || undefined,
      stepWriteups: bp.step_writeups_json ? JSON.parse(bp.step_writeups_json) : undefined,
      createdAt: bp.created_at,
      totalTasks: bp.totalTasks,
      completedTasks: bp.completedTasks,
      progressPercent: bp.progressPercent,
    }));

    // Get all notes for these tasks
    const taskIds = dbTasks.map((t) => t.id);
    const notes = taskNoteOps.getByTaskIds(taskIds).map((n) => ({
      id: n.id,
      taskId: n.task_id,
      authorId: n.author_id,
      authorUsername: n.author_username,
      authorFirstName: n.author_first_name,
      authorLastName: n.author_last_name,
      content: n.content,
      createdAt: n.created_at,
    }));

    // Group notes by task ID
    const notesByTask: Record<string, typeof notes> = {};
    for (const note of notes) {
      if (!notesByTask[note.taskId]) {
        notesByTask[note.taskId] = [];
      }
      notesByTask[note.taskId].push(note);
    }

    return NextResponse.json({ tasks, notes: notesByTask, weeklyBattlePlans: weeklyBPs });
  } catch (error) {
    console.error("Error getting junior tasks:", error);
    return NextResponse.json({ error: "Failed to get tasks" }, { status: 500 });
  }
}
