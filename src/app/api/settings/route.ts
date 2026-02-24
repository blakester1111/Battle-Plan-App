import { NextRequest, NextResponse } from "next/server";
import { settingsOps } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";

// GET settings for current user
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (key) {
      const value = settingsOps.get(userId, key);
      return NextResponse.json({ key, value });
    }

    // Get all common settings
    const allSettings = settingsOps.getAll(userId);

    return NextResponse.json({
      priorityShortcuts: allSettings.priorityShortcuts ?? null,
      sidebarOpen: allSettings.sidebarOpen ?? null,
      tasksCollapsed: allSettings.tasksCollapsed ?? null,
      notesCollapsed: allSettings.notesCollapsed ?? null,
      buggedFilter: allSettings.buggedFilter ?? null,
      categoryFilter: allSettings.categoryFilter ?? null,
      activeNoteId: allSettings.activeNoteId ?? null,
      sortMode: allSettings.sortMode ?? null,
      weekSettings: allSettings.weekSettings ?? null,
      dateFormat: allSettings.dateFormat ?? null,
      sidebarOrder: allSettings.sidebarOrder ?? null,
      accentColor: allSettings.accentColor ?? null,
      showStepDescriptions: allSettings.showStepDescriptions ?? null,
      viewingStats: allSettings.viewingStats ?? null,
      selectedStatId: allSettings.selectedStatId ?? null,
      statsSidebarOpen: allSettings.statsSidebarOpen ?? null,
      statGraphColors: allSettings.statGraphColors ?? null,
    });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

// POST update setting
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { key, value } = body;

    if (!key) {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }

    settingsOps.set(userId, key, value);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating setting:", error);
    return NextResponse.json({ error: "Failed to update setting" }, { status: 500 });
  }
}
