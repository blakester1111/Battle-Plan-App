import { NextResponse } from "next/server";
import { infoTerminalOps } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";

// GET all boards I can view as info terminal
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const boards = infoTerminalOps.getViewableBoards(userId);
    const formatted = boards.map((u) => ({
      id: u.id,
      username: u.username,
      firstName: u.first_name,
      lastName: u.last_name,
      org: u.org,
      division: u.division,
      department: u.department,
      postTitle: u.post_title,
      role: u.role,
      createdAt: u.created_at,
    }));

    return NextResponse.json({ boards: formatted });
  } catch (error) {
    console.error("Error fetching viewable boards:", error);
    return NextResponse.json({ error: "Failed to fetch viewable boards" }, { status: 500 });
  }
}
