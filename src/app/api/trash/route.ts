import { NextRequest, NextResponse } from "next/server";
import { taskOps, weeklyBPOps } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";

// GET - list all soft-deleted items for current user
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const deletedTasks = taskOps.getDeleted(userId).map((t) => ({
      id: t.id,
      type: "task" as const,
      title: t.title,
      description: t.description,
      status: t.status,
      category: t.category,
      priority: t.priority,
      deletedAt: t.deleted_at,
      createdAt: t.created_at,
    }));

    const deletedBPs = weeklyBPOps.getDeleted(userId).map((bp) => ({
      id: bp.id,
      type: "bp" as const,
      title: bp.title,
      formulaName: bp.formula_name,
      formulaCode: bp.formula_code,
      deletedAt: bp.deleted_at,
      createdAt: bp.created_at,
    }));

    return NextResponse.json({ tasks: deletedTasks, bps: deletedBPs });
  } catch (error) {
    console.error("Error fetching trash:", error);
    return NextResponse.json({ error: "Failed to fetch trash" }, { status: 500 });
  }
}

// POST - restore an item from trash
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, type } = body;

    if (!id || !type) {
      return NextResponse.json({ error: "Missing id or type" }, { status: 400 });
    }

    if (type === "task") {
      taskOps.restore(id, userId);
    } else if (type === "bp") {
      weeklyBPOps.restore(id, userId);
    } else {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error restoring item:", error);
    return NextResponse.json({ error: "Failed to restore item" }, { status: 500 });
  }
}

// DELETE - permanently delete an item
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const type = searchParams.get("type");

    if (!id || !type) {
      return NextResponse.json({ error: "Missing id or type" }, { status: 400 });
    }

    if (type === "task") {
      taskOps.delete(id, userId);
    } else if (type === "bp") {
      weeklyBPOps.delete(id, userId);
    } else {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error permanently deleting item:", error);
    return NextResponse.json({ error: "Failed to delete item" }, { status: 500 });
  }
}
