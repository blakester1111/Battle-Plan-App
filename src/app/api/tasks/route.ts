import { NextRequest, NextResponse } from "next/server";
import { taskOps, settingsOps, type DbTask } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { getWeekEndDate, DEFAULT_WEEK_SETTINGS } from "@/lib/dateUtils";
import type { WeekSettings } from "@/lib/types";
import { calculateNextRecurrence } from "@/lib/recurrence";

// Calculate the start of the current week from settings
function getCurrentWeekStart(weekSettings: WeekSettings): string {
  const now = new Date();
  const weekEnd = getWeekEndDate(now, weekSettings);
  // Week start = week end minus 7 days
  const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
  return weekStart.toISOString();
}

// GET all tasks for current user
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Auto-archive completed tasks from previous weeks
    try {
      const rawSettings = settingsOps.get(userId, "weekSettings");
      const weekSettings: WeekSettings = rawSettings ? JSON.parse(rawSettings as string) : DEFAULT_WEEK_SETTINGS;
      const weekStartIso = getCurrentWeekStart(weekSettings);
      taskOps.archiveCompleted(userId, weekStartIso);
    } catch {
      // If week settings parse fails, skip archiving this request
    }

    const tasks = taskOps.getAll(userId);
    // Map to camelCase
    const formatted = tasks.map((t) => ({
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
      forwardedFromTaskId: t.forwarded_from_task_id || undefined,
      forwardedToTaskId: t.forwarded_to_task_id || undefined,
      dueAt: t.due_at || undefined,
      reminderAt: t.reminder_at || undefined,
      recurrenceRule: t.recurrence_rule ? JSON.parse(t.recurrence_rule) : undefined,
      recurrenceSourceId: t.recurrence_source_id || undefined,
      archivedAt: t.archived_at || undefined,
    }));
    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

// POST create new task
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.id) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }
    if (!body.title) {
      return NextResponse.json({ error: "Task title is required" }, { status: 400 });
    }
    if (!body.status) {
      return NextResponse.json({ error: "Task status is required" }, { status: 400 });
    }

    const task = taskOps.create({
      id: body.id,
      user_id: userId,
      title: body.title,
      description: body.description || "",
      status: body.status,
      order: body.order || 0,
      created_at: body.createdAt || new Date().toISOString(),
      label: body.label || "none",
      priority: body.priority || "none",
      category: body.category || null,
      bugged: body.bugged ? 1 : 0,
      weekly_bp_id: body.weeklyBpId || null,
      formula_step_id: body.formulaStepId || null,
      forwarded_from_task_id: body.forwardedFromTaskId || null,
      forwarded_to_task_id: body.forwardedToTaskId || null,
      due_at: body.dueAt || null,
      reminder_at: body.reminderAt || null,
      recurrence_rule: body.recurrenceRule ? JSON.stringify(body.recurrenceRule) : null,
      recurrence_source_id: body.recurrenceSourceId || null,
    });
    return NextResponse.json({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      order: task.order,
      createdAt: task.created_at,
      label: task.label,
      priority: task.priority,
      category: task.category,
      bugged: Boolean(task.bugged),
      weeklyBpId: task.weekly_bp_id || undefined,
      formulaStepId: task.formula_step_id || undefined,
      forwardedFromTaskId: task.forwarded_from_task_id || undefined,
      forwardedToTaskId: task.forwarded_to_task_id || undefined,
      dueAt: task.due_at || undefined,
      reminderAt: task.reminder_at || undefined,
      recurrenceRule: task.recurrence_rule ? JSON.parse(task.recurrence_rule) : undefined,
      recurrenceSourceId: task.recurrence_source_id || undefined,
    });
  } catch (error) {
    console.error("Error creating task:", error);
    const message = error instanceof Error ? error.message : "Failed to create task";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT update task
export async function PUT(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    // Map camelCase to snake_case for db
    const dbUpdates: Record<string, unknown> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.order !== undefined) dbUpdates.order = updates.order;
    if (updates.label !== undefined) dbUpdates.label = updates.label;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.bugged !== undefined) dbUpdates.bugged = updates.bugged;
    if (updates.weeklyBpId !== undefined) dbUpdates.weekly_bp_id = updates.weeklyBpId || null;
    if (updates.formulaStepId !== undefined) dbUpdates.formula_step_id = updates.formulaStepId || null;
    if (updates.forwardedFromTaskId !== undefined) dbUpdates.forwarded_from_task_id = updates.forwardedFromTaskId || null;
    if (updates.forwardedToTaskId !== undefined) dbUpdates.forwarded_to_task_id = updates.forwardedToTaskId || null;
    if (updates.dueAt !== undefined) dbUpdates.due_at = updates.dueAt || null;
    if (updates.reminderAt !== undefined) dbUpdates.reminder_at = updates.reminderAt || null;
    if (updates.recurrenceRule !== undefined) dbUpdates.recurrence_rule = updates.recurrenceRule ? JSON.stringify(updates.recurrenceRule) : null;
    if (updates.recurrenceSourceId !== undefined) dbUpdates.recurrence_source_id = updates.recurrenceSourceId || null;

    taskOps.update(id, userId, dbUpdates);

    // If a recurring task was marked complete, auto-create the next occurrence
    let newRecurringTask = null;
    if (updates.status === "complete") {
      const completedTask = taskOps.getById(id);
      if (completedTask?.recurrence_rule) {
        try {
          const rule = JSON.parse(completedTask.recurrence_rule);
          const nextDate = calculateNextRecurrence(rule.frequency, new Date());
          const cloneId = crypto.randomUUID();
          const newTask: DbTask = {
            id: cloneId,
            user_id: userId,
            title: completedTask.title,
            description: completedTask.description || "",
            status: "todo",
            order: 0,
            created_at: new Date().toISOString(),
            label: completedTask.label || "none",
            priority: completedTask.priority || "none",
            category: completedTask.category || null,
            bugged: 0,
            weekly_bp_id: null,
            formula_step_id: null, // Don't copy — recurring task may land in a different BP/step
            forwarded_from_task_id: null,
            forwarded_to_task_id: null,
            due_at: completedTask.due_at || null,
            reminder_at: completedTask.reminder_at || null,
            recurrence_rule: completedTask.recurrence_rule,
            recurrence_source_id: completedTask.recurrence_source_id || completedTask.id,
          };
          taskOps.create(newTask);
          // Clear recurrence from the completed task so it doesn't trigger again
          taskOps.update(id, userId, { recurrence_rule: null });
          newRecurringTask = {
            id: cloneId,
            title: newTask.title,
            description: newTask.description,
            status: newTask.status,
            order: newTask.order,
            createdAt: newTask.created_at,
            label: newTask.label,
            priority: newTask.priority,
            category: newTask.category,
            bugged: false,
            formulaStepId: undefined,
            dueAt: newTask.due_at || undefined,
            reminderAt: newTask.reminder_at || undefined,
            recurrenceRule: rule,
            recurrenceSourceId: newTask.recurrence_source_id || undefined,
          };
        } catch {
          // Ignore recurrence creation errors
        }
      }
    }

    return NextResponse.json({ success: true, newRecurringTask });
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

// DELETE task
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing task id" }, { status: 400 });
    }
    taskOps.softDelete(id, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}

// PATCH for reordering
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    if (body.action === "reorder" && Array.isArray(body.tasks)) {
      taskOps.updateOrder(userId, body.tasks);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error reordering tasks:", error);
    return NextResponse.json({ error: "Failed to reorder tasks" }, { status: 500 });
  }
}
