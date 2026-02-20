import { NextRequest, NextResponse } from "next/server";
import { userOps } from "@/lib/db";
import { getCurrentUserId, hashPassword } from "@/lib/auth";
import { generateId } from "@/lib/utils";

// GET - get all users (admin only) or current user's profile
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

    // Get current user's profile
    if (action === "profile") {
      return NextResponse.json({
        user: {
          id: currentUser.id,
          username: currentUser.username,
          firstName: currentUser.first_name,
          lastName: currentUser.last_name,
          org: currentUser.org,
          division: currentUser.division,
          department: currentUser.department,
          postTitle: currentUser.post_title,
          role: currentUser.role,
          createdAt: currentUser.created_at,
        },
      });
    }

    // Admin only: get all users
    if (currentUser.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const users = userOps.getAll().map((u) => ({
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

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Error in users API:", error);
    return NextResponse.json({ error: "Failed to get users" }, { status: 500 });
  }
}

// PUT - update user profile
export async function PUT(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { firstName, lastName, org, division, department, postTitle } = body;

    // Validate org
    if (org && org !== "Day" && org !== "Foundation") {
      return NextResponse.json({ error: "Invalid org value" }, { status: 400 });
    }

    userOps.updateProfile(userId, {
      first_name: firstName,
      last_name: lastName,
      org,
      division: division ? parseInt(division, 10) : null,
      department: department ? parseInt(department, 10) : null,
      post_title: postTitle,
    });

    const updatedUser = userOps.findById(userId);
    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        org: updatedUser.org,
        division: updatedUser.division,
        department: updatedUser.department,
        postTitle: updatedUser.post_title,
        role: updatedUser.role,
        createdAt: updatedUser.created_at,
      },
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}

// POST - create a new user (admin only)
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
    const { username, password, firstName, lastName, org, division, department, postTitle, role } = body;

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password required" }, { status: 400 });
    }

    if (username.length < 3) {
      return NextResponse.json({ error: "Username must be at least 3 characters" }, { status: 400 });
    }

    if (password.length < 4) {
      return NextResponse.json({ error: "Password must be at least 4 characters" }, { status: 400 });
    }

    // Check if username already exists
    const existingUser = userOps.findByUsername(username);
    if (existingUser) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }

    // Validate org if provided
    if (org && org !== "Day" && org !== "Foundation") {
      return NextResponse.json({ error: "Invalid org value" }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);
    const newUserId = generateId();
    const userRole = role === "admin" ? "admin" : "user";

    userOps.create({
      id: newUserId,
      username,
      passwordHash,
      role: userRole,
    });

    // Update profile fields if provided
    userOps.updateProfile(newUserId, {
      first_name: firstName || null,
      last_name: lastName || null,
      org: org || null,
      division: division ? parseInt(division, 10) : null,
      department: department ? parseInt(department, 10) : null,
      post_title: postTitle || null,
    });

    const newUser = userOps.findById(newUserId);

    return NextResponse.json({
      user: {
        id: newUser!.id,
        username: newUser!.username,
        firstName: newUser!.first_name,
        lastName: newUser!.last_name,
        org: newUser!.org,
        division: newUser!.division,
        department: newUser!.department,
        postTitle: newUser!.post_title,
        role: newUser!.role,
        createdAt: newUser!.created_at,
      },
    });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}

// PATCH - reset user password or change username (admin only)
export async function PATCH(request: NextRequest) {
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
    const { targetUserId, newPassword, newUsername } = body;

    if (!targetUserId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }

    const targetUser = userOps.findById(targetUserId);
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Handle password reset
    if (newPassword) {
      if (newPassword.length < 4) {
        return NextResponse.json({ error: "Password must be at least 4 characters" }, { status: 400 });
      }
      const passwordHash = await hashPassword(newPassword);
      userOps.updatePassword(targetUserId, passwordHash);
    }

    // Handle username change
    if (newUsername) {
      if (newUsername.length < 3) {
        return NextResponse.json({ error: "Username must be at least 3 characters" }, { status: 400 });
      }
      // Check if username already taken by someone else
      const existingUser = userOps.findByUsername(newUsername);
      if (existingUser && existingUser.id !== targetUserId) {
        return NextResponse.json({ error: "Username already taken" }, { status: 409 });
      }
      userOps.updateUsername(targetUserId, newUsername);
    }

    if (!newPassword && !newUsername) {
      return NextResponse.json({ error: "New password or new username required" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

// DELETE - delete a user (admin only)
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
    const targetUserId = searchParams.get("id");

    if (!targetUserId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }

    // Cannot delete yourself
    if (targetUserId === userId) {
      return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
    }

    userOps.delete(targetUserId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
