import { NextRequest, NextResponse } from "next/server";
import { weeklyBPOps, taskOps } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import type { DbWeeklyBattlePlan } from "@/lib/db";

// Helper to convert DB format to camelCase
function formatBP(bp: DbWeeklyBattlePlan & { totalTasks?: number; completedTasks?: number; progressPercent?: number }) {
  return {
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
    totalTasks: bp.totalTasks ?? 0,
    completedTasks: bp.completedTasks ?? 0,
    progressPercent: bp.progressPercent ?? 0,
  };
}

// GET all weekly battle plans for current user (with progress)
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const juniorId = searchParams.get("juniorId");

    // If juniorId provided, get that user's BPs (for seniors viewing juniors)
    if (juniorId) {
      // TODO: Verify the current user is a senior of this junior
      const bps = weeklyBPOps.getAllWithProgress(juniorId);
      return NextResponse.json({ weeklyBattlePlans: bps.map(formatBP) });
    }

    const bps = weeklyBPOps.getAllWithProgress(userId);
    return NextResponse.json({ weeklyBattlePlans: bps.map(formatBP) });
  } catch (error) {
    console.error("Error fetching weekly battle plans:", error);
    return NextResponse.json({ error: "Failed to fetch weekly battle plans" }, { status: 500 });
  }
}

// POST create new weekly battle plan
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.id) {
      return NextResponse.json({ error: "Battle plan ID is required" }, { status: 400 });
    }
    if (!body.title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!body.formulaId) {
      return NextResponse.json({ error: "Formula ID is required" }, { status: 400 });
    }

    const bp = weeklyBPOps.create({
      id: body.id,
      user_id: userId,
      title: body.title,
      week_start: body.weekStart || new Date().toISOString(),
      formula_id: body.formulaId,
      formula_name: body.formulaName,
      formula_code: body.formulaCode,
      notes: body.notes || null,
      step_writeups_json: body.stepWriteups ? JSON.stringify(body.stepWriteups) : null,
      created_at: body.createdAt || new Date().toISOString(),
    });

    // If tasks are provided, create them
    if (body.tasks && Array.isArray(body.tasks)) {
      for (const task of body.tasks) {
        taskOps.create({
          id: task.id,
          user_id: userId,
          title: task.title,
          description: task.description || "",
          status: "todo",
          order: task.order || 0,
          created_at: new Date().toISOString(),
          label: task.label || "none",
          priority: task.priority || "none",
          category: task.category || null,
          bugged: 0,
          weekly_bp_id: bp.id,
          formula_step_id: task.formulaStepId || null,
          due_at: null,
          reminder_at: null,
          recurrence_rule: null,
          recurrence_source_id: null,
        });
      }
    }

    // Get counts for the new BP
    const counts = weeklyBPOps.getTaskCounts(bp.id);

    return NextResponse.json({
      weeklyBattlePlan: formatBP({
        ...bp,
        totalTasks: counts.total,
        completedTasks: counts.completed,
        progressPercent: counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0,
      }),
    });
  } catch (error) {
    console.error("Error creating weekly battle plan:", error);
    const message = error instanceof Error ? error.message : "Failed to create weekly battle plan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT update weekly battle plan
export async function PUT(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Battle plan ID is required" }, { status: 400 });
    }

    // Map camelCase to snake_case for db
    const dbUpdates: Record<string, unknown> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.weekStart !== undefined) dbUpdates.week_start = updates.weekStart;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.stepWriteups !== undefined) dbUpdates.step_writeups_json = updates.stepWriteups ? JSON.stringify(updates.stepWriteups) : null;

    weeklyBPOps.update(id, userId, dbUpdates);

    // Get updated BP with counts
    const bp = weeklyBPOps.getById(id);
    if (!bp) {
      return NextResponse.json({ error: "Battle plan not found" }, { status: 404 });
    }

    const counts = weeklyBPOps.getTaskCounts(id);

    return NextResponse.json({
      weeklyBattlePlan: formatBP({
        ...bp,
        totalTasks: counts.total,
        completedTasks: counts.completed,
        progressPercent: counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0,
      }),
    });
  } catch (error) {
    console.error("Error updating weekly battle plan:", error);
    return NextResponse.json({ error: "Failed to update weekly battle plan" }, { status: 500 });
  }
}

// DELETE weekly battle plan
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing battle plan id" }, { status: 400 });
    }

    weeklyBPOps.softDelete(id, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting weekly battle plan:", error);
    return NextResponse.json({ error: "Failed to delete weekly battle plan" }, { status: 500 });
  }
}
