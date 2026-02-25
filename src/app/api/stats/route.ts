import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { statDefinitionOps, statEntryOps, userOps, relationshipOps, infoTerminalOps } from "@/lib/db";

// Permission check: can currentUser manage stats for targetUserId?
function canManageStatsFor(currentUserId: string, targetUserId: string, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  if (currentUserId === targetUserId) return true;

  // Check if target is a junior
  const juniors = relationshipOps.getJuniors(currentUserId);
  if (juniors.some((j) => j.id === targetUserId)) return true;

  // Check if target is an info terminal owner they can view
  const viewable = infoTerminalOps.getViewableBoards(currentUserId);
  if (viewable.some((v) => v.id === targetUserId)) return true;

  return false;
}

// GET - fetch all stat definitions visible to the current user
export async function GET(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = userOps.findById(userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const periodType = searchParams.get("periodType") || "daily";
  const today = new Date().toISOString().split("T")[0];

  const isAdmin = user.role === "admin";
  const stats = statDefinitionOps.getForUser(userId, isAdmin);

  return NextResponse.json({
    stats: stats.map((s) => {
      // Parse linked_stat_ids from JSON string
      let linkedStatIds: string[] | null = null;
      if (s.linked_stat_ids) {
        try { linkedStatIds = JSON.parse(s.linked_stat_ids); } catch { /* ignore */ }
      }
      const isComposite = !!linkedStatIds?.length;

      // Compute trend: skip for composite stats (they don't have own entries)
      const isInverted = !!s.is_inverted;
      let trend: "up" | "down" | "flat" | null = null;
      let downStreak = 0;

      if (!isComposite) {
        const recentEntries = statEntryOps.getLastNBeforeDate(s.id, today, periodType, 4);
        // recentEntries are ordered DESC (most recent first)

        if (recentEntries.length >= 2) {
          const newest = recentEntries[0].value;
          const previous = recentEntries[1].value;
          if (isInverted) {
            if (newest < previous) trend = "up";
            else if (newest > previous) trend = "down";
            else trend = "flat";
          } else {
            if (newest > previous) trend = "up";
            else if (newest < previous) trend = "down";
            else trend = "flat";
          }

          for (let i = 0; i < recentEntries.length - 1; i++) {
            if (isInverted) {
              if (recentEntries[i].value > recentEntries[i + 1].value) {
                downStreak++;
              } else {
                break;
              }
            } else {
              if (recentEntries[i].value < recentEntries[i + 1].value) {
                downStreak++;
              } else {
                break;
              }
            }
          }
        }
      }

      return {
        id: s.id,
        name: s.name,
        abbreviation: s.abbreviation || undefined,
        userId: s.user_id,
        createdBy: s.created_by,
        division: s.division,
        department: s.department,
        gds: !!s.gds,
        isMoney: !!s.is_money,
        isPercentage: !!s.is_percentage,
        isInverted,
        linkedStatIds,
        createdAt: s.created_at,
        userName: s.user_username,
        userFirstName: s.user_first_name,
        userLastName: s.user_last_name,
        userOrg: s.user_org || undefined,
        userDivision: s.user_division,
        userDepartment: s.user_department,
        userPostTitle: s.user_post_title,
        trend,
        downStreak,
      };
    }),
  });
}

// POST - create a new stat definition
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
  const { id, name, abbreviation, assignedUserId, division, department, gds, isMoney, isPercentage, isInverted, linkedStatIds } = body;

  if (!id || !name) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const targetUserId = assignedUserId || userId;
  const isAdmin = user.role === "admin";

  if (!canManageStatsFor(userId, targetUserId, isAdmin)) {
    return NextResponse.json({ error: "Not authorized to create stats for this user" }, { status: 403 });
  }

  const stat = statDefinitionOps.create({
    id,
    name,
    abbreviation: abbreviation || null,
    user_id: targetUserId,
    created_by: userId,
    division: division ?? null,
    department: department ?? null,
    gds: gds ? 1 : 0,
    is_money: isMoney ? 1 : 0,
    is_percentage: isPercentage ? 1 : 0,
    is_inverted: isInverted ? 1 : 0,
    linked_stat_ids: linkedStatIds ? JSON.stringify(linkedStatIds) : null,
    created_at: new Date().toISOString(),
  });

  const created = statDefinitionOps.getById(stat.id);
  let createdLinkedStatIds: string[] | null = null;
  if (created?.linked_stat_ids) {
    try { createdLinkedStatIds = JSON.parse(created.linked_stat_ids); } catch { /* ignore */ }
  }

  return NextResponse.json({
    stat: created
      ? {
          id: created.id,
          name: created.name,
          abbreviation: created.abbreviation || undefined,
          userId: created.user_id,
          createdBy: created.created_by,
          division: created.division,
          department: created.department,
          gds: !!created.gds,
          isMoney: !!created.is_money,
          isPercentage: !!created.is_percentage,
          isInverted: !!created.is_inverted,
          linkedStatIds: createdLinkedStatIds,
          createdAt: created.created_at,
          userName: created.user_username,
          userFirstName: created.user_first_name,
          userLastName: created.user_last_name,
          userDivision: created.user_division,
          userDepartment: created.user_department,
          userPostTitle: created.user_post_title,
        }
      : null,
  });
}

// PUT - update a stat definition
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
  const { id, name, abbreviation, division, department, assignedUserId, gds, isMoney, isPercentage, isInverted, linkedStatIds } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing stat id" }, { status: 400 });
  }

  const existing = statDefinitionOps.getById(id);
  if (!existing) {
    return NextResponse.json({ error: "Stat not found" }, { status: 404 });
  }

  const isAdmin = user.role === "admin";
  if (!canManageStatsFor(userId, existing.user_id, isAdmin)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // If reassigning, verify permission for the new target user
  if (assignedUserId && assignedUserId !== existing.user_id) {
    if (!canManageStatsFor(userId, assignedUserId, isAdmin)) {
      return NextResponse.json({ error: "Not authorized to reassign to this user" }, { status: 403 });
    }
  }

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (abbreviation !== undefined) updates.abbreviation = abbreviation || null;
  if (division !== undefined) updates.division = division;
  if (department !== undefined) updates.department = department;
  if (assignedUserId !== undefined) updates.user_id = assignedUserId;
  if (gds !== undefined) updates.gds = gds ? 1 : 0;
  if (isMoney !== undefined) updates.is_money = isMoney ? 1 : 0;
  if (isPercentage !== undefined) updates.is_percentage = isPercentage ? 1 : 0;
  if (isInverted !== undefined) updates.is_inverted = isInverted ? 1 : 0;
  if (linkedStatIds !== undefined) updates.linked_stat_ids = linkedStatIds ? JSON.stringify(linkedStatIds) : null;

  statDefinitionOps.update(id, updates as { name?: string; abbreviation?: string | null; division?: number; department?: number; user_id?: string; gds?: number; is_money?: number; is_percentage?: number; is_inverted?: number; linked_stat_ids?: string | null });

  const updated = statDefinitionOps.getById(id);
  let updatedLinkedStatIds: string[] | null = null;
  if (updated?.linked_stat_ids) {
    try { updatedLinkedStatIds = JSON.parse(updated.linked_stat_ids); } catch { /* ignore */ }
  }

  return NextResponse.json({
    stat: updated
      ? {
          id: updated.id,
          name: updated.name,
          abbreviation: updated.abbreviation || undefined,
          userId: updated.user_id,
          createdBy: updated.created_by,
          division: updated.division,
          department: updated.department,
          gds: !!updated.gds,
          isMoney: !!updated.is_money,
          isPercentage: !!updated.is_percentage,
          isInverted: !!updated.is_inverted,
          linkedStatIds: updatedLinkedStatIds,
          createdAt: updated.created_at,
          userName: updated.user_username,
          userFirstName: updated.user_first_name,
          userLastName: updated.user_last_name,
          userDivision: updated.user_division,
          userDepartment: updated.user_department,
          userPostTitle: updated.user_post_title,
        }
      : null,
  });
}

// DELETE - delete a stat definition
export async function DELETE(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = userOps.findById(userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing stat id" }, { status: 400 });
  }

  const existing = statDefinitionOps.getById(id);
  if (!existing) {
    return NextResponse.json({ error: "Stat not found" }, { status: 404 });
  }

  const isAdmin = user.role === "admin";
  if (!canManageStatsFor(userId, existing.user_id, isAdmin)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  statDefinitionOps.delete(id);
  return NextResponse.json({ success: true });
}
