import { NextRequest, NextResponse } from "next/server";
import { taskOps, weeklyBPOps } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";

// POST forward incomplete tasks to a target BP
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { sourceTaskIds, targetBpId, createBp } = body;

    if (!Array.isArray(sourceTaskIds) || sourceTaskIds.length === 0) {
      return NextResponse.json({ error: "No tasks selected to forward" }, { status: 400 });
    }

    if (!targetBpId && !createBp) {
      return NextResponse.json({ error: "Must specify targetBpId or createBp" }, { status: 400 });
    }

    // Validate all source tasks exist, belong to user, aren't complete, and aren't already forwarded
    const sourceTasks = [];
    for (const taskId of sourceTaskIds) {
      const task = taskOps.getById(taskId);
      if (!task) {
        return NextResponse.json({ error: `Task ${taskId} not found` }, { status: 404 });
      }
      if (task.user_id !== userId) {
        return NextResponse.json({ error: "Unauthorized access to task" }, { status: 403 });
      }
      if (task.status === "complete") {
        return NextResponse.json({ error: `Task "${task.title}" is already complete` }, { status: 400 });
      }
      if (task.forwarded_to_task_id) {
        return NextResponse.json({ error: `Task "${task.title}" has already been forwarded` }, { status: 400 });
      }
      if (task.deleted_at) {
        return NextResponse.json({ error: `Task "${task.title}" is deleted` }, { status: 400 });
      }
      sourceTasks.push(task);
    }

    // Determine target BP
    let finalTargetBpId = targetBpId;

    if (createBp) {
      // Validate required fields for new BP
      if (!createBp.id || !createBp.title || !createBp.formulaId) {
        return NextResponse.json({ error: "New BP requires id, title, and formulaId" }, { status: 400 });
      }

      weeklyBPOps.create({
        id: createBp.id,
        user_id: userId,
        title: createBp.title,
        week_start: createBp.weekStart || new Date().toISOString().split("T")[0],
        formula_id: createBp.formulaId,
        formula_name: createBp.formulaName,
        formula_code: createBp.formulaCode,
        notes: createBp.notes || null,
        created_at: new Date().toISOString(),
      });

      finalTargetBpId = createBp.id;
    } else {
      // Validate target BP exists and belongs to user
      const targetBp = weeklyBPOps.getById(finalTargetBpId);
      if (!targetBp) {
        return NextResponse.json({ error: "Target battle plan not found" }, { status: 404 });
      }
      if (targetBp.user_id !== userId) {
        return NextResponse.json({ error: "Unauthorized access to target battle plan" }, { status: 403 });
      }
    }

    // Prevent forwarding to the same BP
    const sourceBpIds = new Set(sourceTasks.map(t => t.weekly_bp_id).filter(Boolean));
    if (sourceBpIds.has(finalTargetBpId)) {
      return NextResponse.json({ error: "Cannot forward tasks to the same battle plan" }, { status: 400 });
    }

    // Forward tasks atomically
    const results = taskOps.forwardTasks(userId, sourceTasks, finalTargetBpId);

    return NextResponse.json({
      success: true,
      forwardedCount: results.length,
      targetBpId: finalTargetBpId,
    });
  } catch (error) {
    console.error("Error forwarding tasks:", error);
    const message = error instanceof Error ? error.message : "Failed to forward tasks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
