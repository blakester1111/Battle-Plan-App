import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { statDefinitionOps, statQuotaOps, userOps, relationshipOps, infoTerminalOps } from "@/lib/db";

function canManageStatsFor(currentUserId: string, targetUserId: string, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  if (currentUserId === targetUserId) return true;

  const juniors = relationshipOps.getJuniors(currentUserId);
  if (juniors.some((j) => j.id === targetUserId)) return true;

  const viewable = infoTerminalOps.getViewableBoards(currentUserId);
  if (viewable.some((v) => v.id === targetUserId)) return true;

  return false;
}

// GET - fetch quotas for a stat (optionally for a specific week)
export async function GET(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const statId = searchParams.get("statId");
  const weekEndingDate = searchParams.get("weekEndingDate");

  if (!statId) {
    return NextResponse.json({ error: "Missing statId" }, { status: 400 });
  }

  try {
    if (weekEndingDate) {
      // Get quota for specific week, falling back to most recent
      let quota = statQuotaOps.getByStatAndWeek(statId, weekEndingDate);
      if (!quota) {
        quota = statQuotaOps.getMostRecentForStat(statId, weekEndingDate);
      }
      if (quota) {
        return NextResponse.json({
          quota: {
            id: quota.id,
            statId: quota.stat_id,
            weekEndingDate: quota.week_ending_date,
            quotas: JSON.parse(quota.quotas_json),
            createdAt: quota.created_at,
            updatedAt: quota.updated_at,
          },
        });
      }
      return NextResponse.json({ quota: null });
    }

    // Get all quotas for a stat
    const quotas = statQuotaOps.getByStatId(statId);
    return NextResponse.json({
      quotas: quotas.map((q) => ({
        id: q.id,
        statId: q.stat_id,
        weekEndingDate: q.week_ending_date,
        quotas: JSON.parse(q.quotas_json),
        createdAt: q.created_at,
        updatedAt: q.updated_at,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch stat quotas:", error);
    return NextResponse.json({ error: "Failed to fetch quotas" }, { status: 500 });
  }
}

// POST - upsert a quota for a stat+week
export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = userOps.findById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const { id, statId, weekEndingDate, quotas } = body;

    if (!id || !statId || !weekEndingDate || !Array.isArray(quotas)) {
      return NextResponse.json({ error: `Missing required fields (id=${!!id}, statId=${!!statId}, weekEndingDate=${!!weekEndingDate}, quotas=${Array.isArray(quotas)})` }, { status: 400 });
    }

    // Verify permission
    const stat = statDefinitionOps.getById(statId);
    if (!stat) {
      return NextResponse.json({ error: `Stat not found: ${statId}` }, { status: 404 });
    }

    const isAdmin = user.role === "admin";
    if (!canManageStatsFor(userId, stat.user_id, isAdmin)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const now = new Date().toISOString();
    const quota = statQuotaOps.upsert({
      id,
      stat_id: statId,
      week_ending_date: weekEndingDate,
      quotas_json: JSON.stringify(quotas),
      created_at: now,
      updated_at: now,
    });

    return NextResponse.json({
      quota: {
        id: quota.id,
        statId: quota.stat_id,
        weekEndingDate: quota.week_ending_date,
        quotas: JSON.parse(quota.quotas_json),
        createdAt: quota.created_at,
        updatedAt: quota.updated_at,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Failed to upsert stat quota:", msg, error);
    return NextResponse.json({ error: `Failed to save quota: ${msg}` }, { status: 500 });
  }
}

// DELETE - delete a quota
export async function DELETE(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing quota id" }, { status: 400 });
  }

  statQuotaOps.delete(id);
  return NextResponse.json({ success: true });
}
