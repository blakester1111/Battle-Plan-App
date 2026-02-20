import { NextRequest, NextResponse } from "next/server";
import { infoTerminalOps, userOps } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";

// GET all info terminal relationships (admin only)
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = userOps.findById(userId);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const relationships = infoTerminalOps.getAll();
    const formatted = relationships.map((r) => ({
      id: r.id,
      ownerId: r.owner_id,
      viewerId: r.viewer_id,
      ownerUsername: r.owner_username,
      ownerFirstName: r.owner_first_name,
      ownerLastName: r.owner_last_name,
      viewerUsername: r.viewer_username,
      viewerFirstName: r.viewer_first_name,
      viewerLastName: r.viewer_last_name,
    }));

    return NextResponse.json({ relationships: formatted });
  } catch (error) {
    console.error("Error fetching info terminal relationships:", error);
    return NextResponse.json({ error: "Failed to fetch info terminal relationships" }, { status: 500 });
  }
}

// POST create new info terminal relationship (owner grants access to viewer)
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { viewerId } = body;

    if (!viewerId) {
      return NextResponse.json({ error: "Missing viewerId" }, { status: 400 });
    }

    // Users can only grant access to their own board
    const success = infoTerminalOps.create(userId, viewerId);
    if (!success) {
      return NextResponse.json({ error: "Relationship already exists or invalid" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error creating info terminal relationship:", error);
    return NextResponse.json({ error: "Failed to create info terminal relationship" }, { status: 500 });
  }
}

// DELETE remove info terminal relationship
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const viewerId = searchParams.get("viewerId");

    if (!viewerId) {
      return NextResponse.json({ error: "Missing viewerId" }, { status: 400 });
    }

    // Users can only remove access from their own board
    infoTerminalOps.delete(userId, viewerId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting info terminal relationship:", error);
    return NextResponse.json({ error: "Failed to delete info terminal relationship" }, { status: 500 });
  }
}
