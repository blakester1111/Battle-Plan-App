import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { statDefinitionOps, statEntryOps, userOps, relationshipOps, infoTerminalOps } from "@/lib/db";

function canManageStatsFor(currentUserId: string, targetUserId: string, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  if (currentUserId === targetUserId) return true;

  const juniors = relationshipOps.getJuniors(currentUserId);
  if (juniors.some((j) => j.id === targetUserId)) return true;

  const viewable = infoTerminalOps.getViewableBoards(currentUserId);
  if (viewable.some((v) => v.id === targetUserId)) return true;

  return false;
}

// GET - fetch entries for a stat with optional date range
export async function GET(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const statId = searchParams.get("statId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!statId) {
    return NextResponse.json({ error: "Missing statId" }, { status: 400 });
  }

  let entries;
  if (startDate && endDate) {
    entries = statEntryOps.getByStatIdInRange(statId, startDate, endDate);
  } else {
    entries = statEntryOps.getByStatId(statId);
  }

  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      statId: e.stat_id,
      value: e.value,
      date: e.date,
      periodType: e.period_type,
      createdAt: e.created_at,
      updatedAt: e.updated_at,
    })),
  });
}

// POST - upsert a stat entry (create or update if same stat+date+period exists)
export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = userOps.findById(userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await req.json();
  const { id, statId, value, date, periodType } = body;

  if (!id || !statId || value === undefined || !date || !periodType) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Verify user has permission to manage this stat
  const stat = statDefinitionOps.getById(statId);
  if (!stat) {
    return NextResponse.json({ error: "Stat not found" }, { status: 404 });
  }

  const isAdmin = user.role === "admin";
  if (!canManageStatsFor(userId, stat.user_id, isAdmin)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const now = new Date().toISOString();
  const entry = statEntryOps.upsert({
    id,
    stat_id: statId,
    value: Number(value),
    date,
    period_type: periodType,
    created_at: now,
    updated_at: now,
  });

  return NextResponse.json({
    entry: {
      id: entry.id,
      statId: entry.stat_id,
      value: entry.value,
      date: entry.date,
      periodType: entry.period_type,
      createdAt: entry.created_at,
      updatedAt: entry.updated_at,
    },
  });
}

// PATCH - bulk upsert entries (for import)
export async function PATCH(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = userOps.findById(userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await req.json();
  const { statId, entries } = body as {
    statId: string;
    entries: { date: string; value: number; periodType: string }[];
  };

  if (!statId || !entries || !Array.isArray(entries)) {
    return NextResponse.json({ error: "Missing statId or entries array" }, { status: 400 });
  }

  const stat = statDefinitionOps.getById(statId);
  if (!stat) {
    return NextResponse.json({ error: "Stat not found" }, { status: 404 });
  }

  const isAdmin = user.role === "admin";
  if (!canManageStatsFor(userId, stat.user_id, isAdmin)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const now = new Date().toISOString();
  const dbEntries = entries.map((e) => ({
    id: crypto.randomUUID(),
    stat_id: statId,
    value: Number(e.value),
    date: e.date,
    period_type: e.periodType || "daily",
    created_at: now,
    updated_at: now,
  }));

  statEntryOps.bulkUpsert(dbEntries);

  return NextResponse.json({ success: true, count: dbEntries.length });
}

// PUT - update an existing entry's value
export async function PUT(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = userOps.findById(userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await req.json();
  const { id, value } = body;

  if (!id || value === undefined) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  statEntryOps.update(id, Number(value));
  return NextResponse.json({ success: true });
}

// DELETE - delete a stat entry
export async function DELETE(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing entry id" }, { status: 400 });
  }

  statEntryOps.delete(id);
  return NextResponse.json({ success: true });
}
