import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { sessionOps } from "./db";

const SALT_ROUNDS = 10;
const SESSION_COOKIE_NAME = "battleplan_session";
const SESSION_DURATION_DAYS = 7;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateSessionId(): string {
  return randomBytes(32).toString("hex");
}

export function getSessionExpiry(): string {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + SESSION_DURATION_DAYS);
  return expiry.toISOString();
}

export async function createSessionCookie(sessionId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSessionFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function getCurrentUserId(): Promise<string | null> {
  const sessionId = await getSessionFromCookie();
  if (!sessionId) return null;

  const session = sessionOps.findById(sessionId);
  if (!session) return null;

  // Check if session is expired
  if (new Date(session.expires_at) < new Date()) {
    sessionOps.delete(sessionId);
    return null;
  }

  // Refresh session expiry on activity
  sessionOps.refresh(sessionId, getSessionExpiry());

  return session.user_id;
}
