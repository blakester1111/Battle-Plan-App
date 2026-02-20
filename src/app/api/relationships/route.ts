import { NextRequest, NextResponse } from "next/server";
import { userOps, relationshipOps } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";

// GET - get relationships (admin: all, user: own juniors)
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUser = userOps.findById(userId);
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    // Get current user's juniors
    if (action === "my-juniors") {
      const juniors = relationshipOps.getJuniors(userId).map((u) => ({
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
      return NextResponse.json({ juniors });
    }

    // Admin only: get all relationships
    if (currentUser.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const relationships = relationshipOps.getAll().map((r) => ({
      id: r.id,
      seniorId: r.senior_id,
      juniorId: r.junior_id,
      seniorUsername: r.senior_username,
      seniorFirstName: r.senior_first_name,
      seniorLastName: r.senior_last_name,
      juniorUsername: r.junior_username,
      juniorFirstName: r.junior_first_name,
      juniorLastName: r.junior_last_name,
    }));

    return NextResponse.json({ relationships });
  } catch (error) {
    console.error("Error getting relationships:", error);
    return NextResponse.json({ error: "Failed to get relationships" }, { status: 500 });
  }
}

// POST - create a relationship (admin only)
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUser = userOps.findById(userId);
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { seniorId, juniorId } = body;

    if (!seniorId || !juniorId) {
      return NextResponse.json({ error: "Senior ID and Junior ID required" }, { status: 400 });
    }

    if (seniorId === juniorId) {
      return NextResponse.json({ error: "User cannot be their own senior" }, { status: 400 });
    }

    // Verify both users exist
    const senior = userOps.findById(seniorId);
    const junior = userOps.findById(juniorId);

    if (!senior || !junior) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const success = relationshipOps.create(seniorId, juniorId);
    if (!success) {
      return NextResponse.json({ error: "Relationship already exists" }, { status: 409 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error creating relationship:", error);
    return NextResponse.json({ error: "Failed to create relationship" }, { status: 500 });
  }
}

// DELETE - delete a relationship (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUser = userOps.findById(userId);
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const relationshipId = searchParams.get("id");

    if (!relationshipId) {
      return NextResponse.json({ error: "Relationship ID required" }, { status: 400 });
    }

    relationshipOps.deleteById(parseInt(relationshipId, 10));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting relationship:", error);
    return NextResponse.json({ error: "Failed to delete relationship" }, { status: 500 });
  }
}
