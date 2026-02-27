"use client";

import { useState } from "react";
import { useAppContext, useAccentColor } from "@/context/AppContext";
import ThemeToggle from "./ThemeToggle";
import CategoryFilter from "./CategoryFilter";
import SortModeSelector from "./SortModeSelector";
import SettingsModal from "./SettingsModal";
import ProfileModal from "./ProfileModal";
import AdminPanel from "./AdminPanel";
import NotificationBell from "./NotificationBell";
import TrashModal from "./TrashModal";
import ArchiveModal from "./ArchiveModal";
import PrintBPModal from "./PrintBPModal";
import SearchModal from "./SearchModal";
import RecurringTargetsModal from "./RecurringTargetsModal";

export default function Header() {
  const { state, dispatch, logout } = useAppContext();
  const accent = useAccentColor();
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);
  const [trayOpen, setTrayOpen] = useState(false);

  const isAdmin = state.user?.role === "admin";

  function getDisplayName() {
    if (!state.user) return "";
    if (state.user.postTitle) return state.user.postTitle;
    if (state.user.firstName || state.user.lastName) {
      return `${state.user.firstName || ""} ${state.user.lastName || ""}`.trim();
    }
    return state.user.username;
  }

  async function handleLogout() {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  return (
    <>
      <header className="header-border h-14 flex items-center justify-between px-5 bg-white dark:bg-stone-950 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() =>
              dispatch({ type: state.viewingStats ? "TOGGLE_STATS_SIDEBAR" : "TOGGLE_SIDEBAR" })
            }
            className="p-1.5 rounded text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 transition-colors"
            aria-label="Toggle sidebar"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="15" y2="12" />
              <line x1="3" y1="18" x2="18" y2="18" />
            </svg>
          </button>
          <h1 className="text-xl font-semibold tracking-tight text-stone-800 dark:text-stone-200">
            {state.viewingStats ? "Stats & Graphs" : "Battle Plan"}
          </h1>
          <button
            onClick={() => {
              const entering = !state.viewingStats;
              dispatch({ type: "SET_VIEWING_STATS", payload: entering });
              if (entering) {
                // Clear other viewing modes
                if (state.viewingJunior) {
                  dispatch({ type: "SET_VIEWING_JUNIOR", payload: { junior: null, tasks: [], notes: {} } });
                }
                if (state.viewingInfoTerminal) {
                  dispatch({ type: "SET_VIEWING_INFO_TERMINAL", payload: { user: null, tasks: [], taskNotes: {}, bpNotes: {}, weeklyBPs: [] } });
                }
              }
            }}
            className={`p-1.5 rounded-md transition-colors ${
              state.viewingStats
                ? `${accent.bgSubtle} ${accent.text}`
                : "text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300"
            }`}
            aria-label={state.viewingStats ? "Back to Battle Plan" : "Stats & Graphs"}
            title={state.viewingStats ? "Back to Battle Plan" : "Stats & Graphs"}
          >
            {state.viewingStats ? (
              /* Checklist / task-page icon — go back to BP */
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            ) : (
              /* Chart icon — go to Stats & Graphs */
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 3v18h18" />
                <path d="M7 16l4-8 4 4 5-6" />
              </svg>
            )}
          </button>
        </div>
        <div className="flex items-center gap-2">
          {!state.viewingStats && (
            <>
              {/* Search button */}
              <button
                onClick={() => setShowSearch(true)}
                className="p-1.5 rounded text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 transition-colors"
                aria-label="Search targets"
                title="Search Targets"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </button>
              <SortModeSelector />
              <div className="h-5 w-px bg-stone-200 dark:bg-stone-700" />
              <CategoryFilter />
            </>
          )}
          {/* Tray toggle chevron */}
          <button
            onClick={() => setTrayOpen((v) => !v)}
            className="p-1.5 rounded text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 transition-colors"
            aria-label={trayOpen ? "Collapse toolbar" : "Expand toolbar"}
            title={trayOpen ? "Collapse toolbar" : "Expand toolbar"}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform duration-200 ${trayOpen ? "rotate-180" : ""}`}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          {/* Collapsible tray */}
          <div
            className={`flex items-center gap-2 overflow-hidden transition-all duration-200 ${
              trayOpen ? "max-w-[400px] opacity-100" : "max-w-0 opacity-0"
            }`}
          >
            <button
              onClick={() => setShowSettings(true)}
              className="p-1.5 rounded text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 transition-colors shrink-0"
              aria-label="Settings"
              title="Settings"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
            <ThemeToggle />
            <NotificationBell />
            {!state.viewingJunior && !state.viewingInfoTerminal && (
              <button
                onClick={() => setShowRecurring(true)}
                className="p-1.5 rounded text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 transition-colors shrink-0"
                aria-label="Recurring Targets"
                title="Recurring Targets"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                </svg>
              </button>
            )}
            {!state.viewingJunior && !state.viewingInfoTerminal && (
              <button
                onClick={() => setShowPrint(true)}
                className="p-1.5 rounded text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 transition-colors shrink-0"
                aria-label="Print"
                title="Print"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
              </button>
            )}
            <button
              onClick={() => setShowTrash(true)}
              className="p-1.5 rounded text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 transition-colors shrink-0"
              aria-label="Trash"
              title="Recently Deleted"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </button>
            {!state.viewingJunior && !state.viewingInfoTerminal && (
              <button
                onClick={() => setShowArchive(true)}
                className="p-1.5 rounded text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 transition-colors shrink-0"
                aria-label="Archive"
                title="Completed Archive"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="21 8 21 21 3 21 3 8" />
                  <rect x="1" y="3" width="22" height="5" />
                  <line x1="10" y1="12" x2="14" y2="12" />
                </svg>
              </button>
            )}
          </div>
          <div className="h-5 w-px bg-stone-300 dark:bg-stone-700 mx-1" />
          {isAdmin && (
            <button
              onClick={() => setShowAdmin(true)}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${accent.bgSubtle} ${accent.text} ${accent.bgHover}`}
              title="Admin Panel"
            >
              Admin
            </button>
          )}
          <button
            onClick={() => setShowProfile(true)}
            className="flex items-center gap-1.5 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
            title="My Profile"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            {getDisplayName()}
          </button>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 transition-colors"
            aria-label="Logout"
            title="Logout"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </header>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
      {showTrash && <TrashModal onClose={() => setShowTrash(false)} />}
      {showArchive && <ArchiveModal onClose={() => setShowArchive(false)} />}
      {showPrint && <PrintBPModal onClose={() => setShowPrint(false)} viewMode="own" />}
      {showSearch && <SearchModal onClose={() => setShowSearch(false)} />}
      {showRecurring && <RecurringTargetsModal onClose={() => setShowRecurring(false)} />}
    </>
  );
}
