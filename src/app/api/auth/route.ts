import { NextRequest, NextResponse } from "next/server";
import { userOps, sessionOps } from "@/lib/db";
import {
  hashPassword,
  verifyPassword,
  generateSessionId,
  getSessionExpiry,
  createSessionCookie,
  clearSessionCookie,
  getSessionFromCookie,
} from "@/lib/auth";
import { generateId } from "@/lib/utils";

// GET - get current user from session
export async function GET() {
  try {
    const sessionId = await getSessionFromCookie();
    if (!sessionId) {
      return NextResponse.json({ user: null });
    }

    const session = sessionOps.findById(sessionId);
    if (!session) {
      return NextResponse.json({ user: null });
    }

    // Check if session is expired
    if (new Date(session.expires_at) < new Date()) {
      sessionOps.delete(sessionId);
      await clearSessionCookie();
      return NextResponse.json({ user: null });
    }

    const user = userOps.findById(session.user_id);
    if (!user) {
      sessionOps.delete(sessionId);
      await clearSessionCookie();
      return NextResponse.json({ user: null });
    }

    // Refresh session expiry
    sessionOps.refresh(sessionId, getSessionExpiry());

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        org: user.org,
        division: user.division,
        department: user.department,
        postTitle: user.post_title,
        role: user.role || "user",
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error("Error getting current user:", error);
    return NextResponse.json({ error: "Failed to get user" }, { status: 500 });
  }
}

// POST - login or register
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password required" }, { status: 400 });
    }

    if (username.length < 3) {
      return NextResponse.json({ error: "Username must be at least 3 characters" }, { status: 400 });
    }

    if (password.length < 4) {
      return NextResponse.json({ error: "Password must be at least 4 characters" }, { status: 400 });
    }

    // Register
    if (action === "register") {
      const existingUser = userOps.findByUsername(username);
      if (existingUser) {
        return NextResponse.json({ error: "Username already taken" }, { status: 409 });
      }

      const passwordHash = await hashPassword(password);
      const userId = generateId();

      // First user becomes admin
      const userCount = userOps.count();
      const role = userCount === 0 ? "admin" : "user";

      userOps.create({
        id: userId,
        username,
        passwordHash,
        role,
      });

      // Create session
      const sessionId = generateSessionId();
      sessionOps.create({
        id: sessionId,
        userId,
        expiresAt: getSessionExpiry(),
      });

      await createSessionCookie(sessionId);

      return NextResponse.json({
        user: {
          id: userId,
          username,
          role,
          createdAt: new Date().toISOString(),
        },
      });
    }

    // Login
    const user = userOps.findByUsername(username);
    if (!user) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    const passwordValid = await verifyPassword(password, user.password_hash);
    if (!passwordValid) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    // Create session
    const sessionId = generateSessionId();
    sessionOps.create({
      id: sessionId,
      userId: user.id,
      expiresAt: getSessionExpiry(),
    });

    await createSessionCookie(sessionId);

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        org: user.org,
        division: user.division,
        department: user.department,
        postTitle: user.post_title,
        role: user.role || "user",
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error("Error in auth:", error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}

// DELETE - logout
export async function DELETE() {
  try {
    const sessionId = await getSessionFromCookie();
    if (sessionId) {
      sessionOps.delete(sessionId);
    }
    await clearSessionCookie();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error logging out:", error);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}
