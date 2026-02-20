import { NextResponse } from "next/server";
import { infoTerminalOps } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";

// GET all viewers who can see my board
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const viewers = infoTerminalOps.getViewers(userId);
    const formatted = viewers.map((u) => ({
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

    return NextResponse.json({ viewers: formatted });
  } catch (error) {
    console.error("Error fetching my viewers:", error);
    return NextResponse.json({ error: "Failed to fetch viewers" }, { status: 500 });
  }
}
