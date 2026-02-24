"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAppContext, useAccentColor } from "@/context/AppContext";
import { statsApi, statEntriesApi } from "@/lib/api";
import { getDisplayName } from "@/lib/utils";
import type { StatDefinition } from "@/lib/types";
import StatDefinitionModal from "./StatDefinitionModal";

interface Props {
  onEnterData: () => void;
}

function StatOrgLabel({ stat }: { stat: StatDefinition }) {
  const parts: string[] = [];
  if (stat.userDivision != null) parts.push(`Div ${stat.userDivision}`);
  if (stat.userDepartment != null) parts.push(`Dept ${stat.userDepartment}`);
  const orgStr = parts.join(" \u00B7 ");
  const userName = getDisplayName({
    username: stat.userName || "Unknown",
    firstName: stat.userFirstName,
    lastName: stat.userLastName,
  });
  const label = orgStr ? `${orgStr} \u2014 ${userName}` : userName;
  return (
    <p className="text-[10px] text-stone-400 dark:text-stone-500 truncate pl-[22px]">
      {label}
    </p>
  );
}

type StatsFilter = "all" | "gds" | "up" | "down" | "down3";

export default function StatsList({ onEnterData }: Props) {
  const { state, dispatch } = useAppContext();
  const accent = useAccentColor();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingStat, setEditingStat] = useState<StatDefinition | null>(null);
  const [menuStatId, setMenuStatId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteConfirmStat, setDeleteConfirmStat] = useState<StatDefinition | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [activeFilter, setActiveFilter] = useState<StatsFilter>("all");
  const menuRef = useRef<HTMLDivElement>(null);

  // Section collapse state (all expanded by default)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Close context menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuStatId(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const currentUserId = state.user?.id;
  const juniorIds = new Set(state.myJuniors.map((j) => j.id));
  const infoTerminalIds = new Set(state.viewableAsInfoTerminal.map((v) => v.id));

  // Apply filter before categorizing
  const filteredStats = state.statDefinitions.filter((stat) => {
    switch (activeFilter) {
      case "gds": return !!stat.gds;
      case "up": return stat.trend === "up";
      case "down": return stat.trend === "down";
      case "down3": return (stat.downStreak ?? 0) >= 3;
      default: return true;
    }
  });

  // Categorize stats into sections
  const myStats: StatDefinition[] = [];
  const juniorStats: StatDefinition[] = [];
  const infoTerminalStats: StatDefinition[] = [];
  const allOtherStats: StatDefinition[] = [];

  for (const stat of filteredStats) {
    if (stat.userId === currentUserId) {
      myStats.push(stat);
    } else if (juniorIds.has(stat.userId)) {
      juniorStats.push(stat);
    } else if (infoTerminalIds.has(stat.userId)) {
      infoTerminalStats.push(stat);
    } else {
      allOtherStats.push(stat);
    }
  }

  const isAdmin = state.user?.role === "admin";

  const sections = [
    { key: "my", label: "MY STATS", stats: myStats, showOrgLabel: false },
    { key: "juniors", label: "JUNIORS' STATS", stats: juniorStats, showOrgLabel: true },
    { key: "info", label: "INFO TERMINAL STATS", stats: infoTerminalStats, showOrgLabel: true },
    ...(isAdmin && allOtherStats.length > 0
      ? [{ key: "all", label: "ALL STATS", stats: allOtherStats, showOrgLabel: true }]
      : []),
  ].filter((s) => s.stats.length > 0);

  const selectStat = useCallback(
    async (statId: string) => {
      dispatch({ type: "SET_SELECTED_STAT", payload: statId });

      // Fetch entries if not already loaded
      if (!state.statEntries[statId]) {
        try {
          const { entries } = await statEntriesApi.getByStatId(statId);
          dispatch({ type: "SET_STAT_ENTRIES", payload: { statId, entries: entries || [] } });
        } catch (error) {
          console.error("Failed to fetch entries:", error);
        }
      }
    },
    [dispatch, state.statEntries]
  );

  function requestDelete(stat: StatDefinition) {
    setMenuStatId(null);
    setDeleteConfirmStat(stat);
    setDeleteConfirmInput("");
  }

  async function handleConfirmDelete() {
    if (!deleteConfirmStat) return;
    const id = deleteConfirmStat.id;
    setDeleting(id);
    try {
      await statsApi.delete(id);
      dispatch({ type: "DELETE_STAT_DEFINITION", payload: { id } });
    } catch (error) {
      console.error("Failed to delete stat:", error);
    } finally {
      setDeleting(null);
      setDeleteConfirmStat(null);
      setDeleteConfirmInput("");
    }
  }

  return (
    <div className="w-72 shrink-0 border-r border-stone-200 dark:border-stone-800 flex flex-col h-full bg-white dark:bg-stone-950">
      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-stone-700 dark:text-stone-300">Stats</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className={`p-1 rounded-md transition-colors ${accent.text} ${accent.bgHover}`}
          title="New Stat"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Filter pills */}
      <div className="px-3 py-2 border-b border-stone-200 dark:border-stone-800 flex flex-wrap gap-1">
        {(
          [
            { key: "all", label: "All" },
            { key: "gds", label: "GDS" },
            { key: "up", label: "\u2191 Up" },
            { key: "down", label: "\u2193 Down" },
            { key: "down3", label: "\u2193 3+" },
          ] as { key: StatsFilter; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveFilter(key)}
            className={`px-2 py-0.5 text-[10px] font-medium rounded-full transition-colors ${
              activeFilter === key
                ? `${accent.bgSubtle} ${accent.text}`
                : "text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Stats list */}
      <div className="flex-1 overflow-y-auto p-2">
        {sections.length === 0 ? (
          <div className="text-center py-8">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="mx-auto text-stone-300 dark:text-stone-600 mb-2"
            >
              <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M7 16l4-8 4 4 5-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-xs text-stone-400 dark:text-stone-500">
              Create your first stat
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className={`mt-2 px-3 py-1 text-xs rounded-md font-medium ${accent.text} ${accent.bgSubtle} ${accent.bgHover}`}
            >
              + New Stat
            </button>
          </div>
        ) : (
          sections.map((section) => {
            const isCollapsed = collapsedSections[section.key];
            return (
              <div key={section.key} className="mb-3">
                {/* Collapsible section header */}
                <button
                  onClick={() => toggleSection(section.key)}
                  className="flex items-center gap-1 px-2 py-1 w-full text-left group"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`shrink-0 text-stone-400 dark:text-stone-500 transition-transform ${
                      isCollapsed ? "" : "rotate-90"
                    }`}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                    {section.label}
                  </span>
                  <span className="text-[10px] text-stone-400 dark:text-stone-500 ml-auto">
                    {section.stats.length}
                  </span>
                </button>

                {/* Stats in this section */}
                {!isCollapsed &&
                  section.stats.map((stat) => {
                    const isSelected = state.selectedStatId === stat.id;
                    return (
                      <div key={stat.id}>
                        <div
                          className={`group relative flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors text-sm ${
                            isSelected
                              ? `${accent.bgSubtle} ${accent.text} font-medium`
                              : "text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800/50"
                          }`}
                          onClick={() => selectStat(stat.id)}
                        >
                          {stat.linkedStatIds?.length ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                              <path d="M3 3v18h18" />
                              <path d="M7 16l4-8 4 4 5-6" />
                              <path d="M7 12l4-2 4 6 5-8" strokeDasharray="3 2" />
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                              <path d="M3 3v18h18" />
                              <path d="M7 16l4-8 4 4 5-6" />
                            </svg>
                          )}
                          <span className="truncate flex-1">{stat.name}</span>

                          {/* GDS badge */}
                          {stat.gds && (
                            <span className="shrink-0 px-1 py-0.5 text-[9px] font-semibold rounded bg-gray-100 text-gray-600 dark:bg-stone-700 dark:text-stone-400">
                              GDS
                            </span>
                          )}

                          {/* Trend indicator */}
                          {stat.trend === "up" && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-stone-800 dark:text-stone-200">
                              <polyline points="18 15 12 9 6 15" />
                            </svg>
                          )}
                          {stat.trend === "down" && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          )}
                          {stat.trend === "flat" && (
                            <span className="shrink-0 text-xs font-bold leading-none text-stone-800 dark:text-stone-200">&ndash;</span>
                          )}

                          {/* Three-dot menu */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuStatId(menuStatId === stat.id ? null : stat.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-stone-200 dark:hover:bg-stone-700 transition-opacity"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <circle cx="12" cy="6" r="1.5" />
                              <circle cx="12" cy="12" r="1.5" />
                              <circle cx="12" cy="18" r="1.5" />
                            </svg>
                          </button>

                          {/* Context menu */}
                          {menuStatId === stat.id && (
                            <div
                              ref={menuRef}
                              className="absolute right-0 top-full z-10 mt-1 w-32 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg shadow-lg py-1"
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingStat(stat);
                                  setMenuStatId(null);
                                }}
                                className="w-full text-left px-3 py-1.5 text-xs text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700"
                              >
                                Edit
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  requestDelete(stat);
                                }}
                                className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                        {/* Div/Dept label for other users' stats */}
                        {section.showOrgLabel && <StatOrgLabel stat={stat} />}
                      </div>
                    );
                  })}
              </div>
            );
          })
        )}
      </div>

      {/* Enter Data button at bottom */}
      {state.selectedStatId && (
        <div className="px-3 py-3 border-t border-stone-200 dark:border-stone-800">
          <button
            onClick={onEnterData}
            className={`w-full py-2 text-sm font-medium rounded-lg text-white transition-colors ${accent.bg}`}
          >
            Enter Data
          </button>
        </div>
      )}

      {showCreateModal && (
        <StatDefinitionModal onClose={() => setShowCreateModal(false)} />
      )}
      {editingStat && (
        <StatDefinitionModal
          onClose={async () => {
            setEditingStat(null);
            // Refresh stat definitions (trend data may have changed from quick entry)
            try {
              const data = await statsApi.getAll(state.statsViewConfig.periodType);
              if (data?.stats) {
                dispatch({ type: "SET_STAT_DEFINITIONS", payload: data.stats });
              }
              // Also refresh entries for the selected stat so the graph updates
              if (state.selectedStatId) {
                const { entries } = await statEntriesApi.getByStatId(state.selectedStatId);
                dispatch({ type: "SET_STAT_ENTRIES", payload: { statId: state.selectedStatId, entries: entries || [] } });
              }
            } catch { /* ignore */ }
          }}
          editingStat={editingStat}
        />
      )}

      {/* Delete confirmation modal */}
      {deleteConfirmStat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-stone-900 rounded-xl shadow-xl border border-stone-200 dark:border-stone-700 w-full max-w-sm mx-4 p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" />
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
                  <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-200">Delete Stat</h3>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-400 mb-1">
              This will permanently delete <span className="font-semibold text-stone-800 dark:text-stone-200">{deleteConfirmStat.name}</span> and all its entries. This action cannot be undone.
            </p>
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-3">
              Type <span className="font-mono font-semibold text-stone-800 dark:text-stone-200">{deleteConfirmStat.name}</span> to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirmInput}
              onChange={(e) => setDeleteConfirmInput(e.target.value)}
              placeholder={deleteConfirmStat.name}
              className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 placeholder:text-stone-400 dark:placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-red-500/50 mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && deleteConfirmInput === deleteConfirmStat.name && !deleting) {
                  handleConfirmDelete();
                }
                if (e.key === "Escape") {
                  setDeleteConfirmStat(null);
                  setDeleteConfirmInput("");
                }
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setDeleteConfirmStat(null);
                  setDeleteConfirmInput("");
                }}
                className="flex-1 px-3 py-2 text-xs font-medium rounded-lg border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteConfirmInput !== deleteConfirmStat.name || !!deleting}
                className="flex-1 px-3 py-2 text-xs font-medium rounded-lg text-white transition-colors bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
