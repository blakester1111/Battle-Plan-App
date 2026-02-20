import { NextRequest, NextResponse } from "next/server";
import { taskOps, weeklyBPOps } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";

// GET archived tasks for current user
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tasks = taskOps.getArchived(userId);
    // Get all BPs for this user to look up BP titles
    const bps = weeklyBPOps.getAll(userId);
    const bpMap = new Map(bps.map((bp) => [bp.id, bp.title]));

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
      weeklyBpTitle: t.weekly_bp_id ? bpMap.get(t.weekly_bp_id) || undefined : undefined,
      formulaStepId: t.formula_step_id || undefined,
      archivedAt: t.archived_at,
      forwardedFromTaskId: t.forwarded_from_task_id || undefined,
      forwardedToTaskId: t.forwarded_to_task_id || undefined,
    }));
    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Error fetching archived tasks:", error);
    return NextResponse.json({ error: "Failed to fetch archived tasks" }, { status: 500 });
  }
}

// POST restore an archived task
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing task id" }, { status: 400 });
    }

    taskOps.unarchive(id, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error restoring archived task:", error);
    return NextResponse.json({ error: "Failed to restore task" }, { status: 500 });
  }
}
