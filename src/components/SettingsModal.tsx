"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAppContext, useAccentColor } from "@/context/AppContext";
import type { PriorityShortcuts, WeekSettings, DateFormatType, AccentColor, User } from "@/lib/types";
import { DEFAULT_PRIORITY_SHORTCUTS } from "@/lib/types";
import { cn, ACCENT_COLORS, getDisplayName } from "@/lib/utils";
import Select from "@/components/ui/Select";
import {
  DAYS_OF_WEEK,
  HOURS_OF_DAY,
  COMMON_TIMEZONES,
  DATE_FORMAT_OPTIONS,
  DEFAULT_WEEK_SETTINGS,
  getBrowserTimezone,
  generateWeeklyBPTitle,
} from "@/lib/dateUtils";

interface Props {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: Props) {
  const { state, dispatch, refreshInfoTerminals } = useAppContext();
  const accent = useAccentColor();
  const [shortcuts, setShortcuts] = useState<PriorityShortcuts>({
    ...DEFAULT_PRIORITY_SHORTCUTS,
    ...state.priorityShortcuts,
  });
  const [weekSettings, setWeekSettings] = useState<WeekSettings>({
    ...DEFAULT_WEEK_SETTINGS,
    ...state.weekSettings,
  });
  const [dateFormat, setDateFormat] = useState<DateFormatType>(state.dateFormat || "dd-MMM-yy");
  const [accentColor, setAccentColor] = useState<AccentColor>(state.accentColor || "amber");
  const [graphUseAccent, setGraphUseAccent] = useState(state.statGraphUseAccentColor);
  const [graphUpColor, setGraphUpColor] = useState(state.statGraphUpColor || "");
  const [graphDownColor, setGraphDownColor] = useState(state.statGraphDownColor || "");
  const backdropRef = useRef<HTMLDivElement>(null);

  // Info Terminals state
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [myInfoTerminals, setMyInfoTerminals] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [infoTerminalsLoading, setInfoTerminalsLoading] = useState(false);

  const browserTimezone = getBrowserTimezone();
  const effectiveTimezone = weekSettings.timezone || browserTimezone;
  const previewTitle = generateWeeklyBPTitle(weekSettings, dateFormat);

  // Load info terminals and all users
  const loadInfoTerminals = useCallback(async () => {
    try {
      const [viewersRes, usersRes] = await Promise.all([
        fetch("/api/info-terminals/my-viewers"),
        fetch("/api/users"),
      ]);
      if (viewersRes.ok) {
        const data = await viewersRes.json();
        setMyInfoTerminals(data.viewers || []);
      }
      if (usersRes.ok) {
        const data = await usersRes.json();
        setAllUsers(data.users || []);
      }
    } catch (error) {
      console.error("Failed to load info terminals:", error);
    }
  }, []);

  useEffect(() => {
    loadInfoTerminals();
  }, [loadInfoTerminals]);

  // Add info terminal
  async function handleAddInfoTerminal() {
    if (!selectedUserId) return;
    setInfoTerminalsLoading(true);
    try {
      const res = await fetch("/api/info-terminals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewerId: selectedUserId }),
      });
      if (res.ok) {
        await loadInfoTerminals();
        refreshInfoTerminals();
        setSelectedUserId("");
      }
    } catch (error) {
      console.error("Failed to add info terminal:", error);
    } finally {
      setInfoTerminalsLoading(false);
    }
  }

  // Remove info terminal
  async function handleRemoveInfoTerminal(viewerId: string) {
    setInfoTerminalsLoading(true);
    try {
      const res = await fetch(`/api/info-terminals?viewerId=${viewerId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await loadInfoTerminals();
        refreshInfoTerminals();
      }
    } catch (error) {
      console.error("Failed to remove info terminal:", error);
    } finally {
      setInfoTerminalsLoading(false);
    }
  }

  // Filter out users who are already info terminals and the current user
  const availableUsers = allUsers.filter(
    (u) => u.id !== state.user?.id && !myInfoTerminals.some((it) => it.id === u.id)
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleSave() {
    dispatch({ type: "UPDATE_PRIORITY_SHORTCUTS", payload: shortcuts });
    dispatch({ type: "UPDATE_WEEK_SETTINGS", payload: weekSettings });
    dispatch({ type: "SET_DATE_FORMAT", payload: dateFormat });
    dispatch({ type: "SET_ACCENT_COLOR", payload: accentColor });
    dispatch({ type: "SET_STAT_GRAPH_COLORS", payload: { useAccent: graphUseAccent, upColor: graphUpColor, downColor: graphDownColor } });
    onClose();
  }

  function handleReset() {
    setShortcuts(DEFAULT_PRIORITY_SHORTCUTS);
  }

  function handleResetWeekSettings() {
    setWeekSettings(DEFAULT_WEEK_SETTINGS);
    setDateFormat("dd-MMM-yy");
  }

  return (
    <div
      ref={backdropRef}
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-800 p-5 shadow-2xl dark:shadow-black/40 animate-slide-up max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-medium text-stone-900 dark:text-stone-100 mb-4">
          Settings
        </h2>

        <div className="space-y-4">
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-3">
              Quick Add Shortcuts
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-3">
              Type these shortcuts in the quick add field to automatically set priority or mark as bugged. Case insensitive.
            </p>

            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <label className="text-sm text-stone-600 dark:text-stone-300 w-20">
                  High
                </label>
                <input
                  type="text"
                  value={shortcuts.high}
                  onChange={(e) =>
                    setShortcuts({ ...shortcuts, high: e.target.value })
                  }
                  className="flex-1 rounded px-3 py-1.5 text-sm bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-current/30 transition-shadow"
                  placeholder="-h"
                />
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: "#f87171" }}
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm text-stone-600 dark:text-stone-300 w-20">
                  Medium
                </label>
                <input
                  type="text"
                  value={shortcuts.medium}
                  onChange={(e) =>
                    setShortcuts({ ...shortcuts, medium: e.target.value })
                  }
                  className="flex-1 rounded px-3 py-1.5 text-sm bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-current/30 transition-shadow"
                  placeholder="-m"
                />
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: "#4ade80" }}
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm text-stone-600 dark:text-stone-300 w-20">
                  Low
                </label>
                <input
                  type="text"
                  value={shortcuts.low}
                  onChange={(e) =>
                    setShortcuts({ ...shortcuts, low: e.target.value })
                  }
                  className="flex-1 rounded px-3 py-1.5 text-sm bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-current/30 transition-shadow"
                  placeholder="-l"
                />
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: "#60a5fa" }}
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm text-stone-600 dark:text-stone-300 w-20">
                  Bugged
                </label>
                <input
                  type="text"
                  value={shortcuts.bugged}
                  onChange={(e) =>
                    setShortcuts({ ...shortcuts, bugged: e.target.value })
                  }
                  className="flex-1 rounded px-3 py-1.5 text-sm bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-current/30 transition-shadow"
                  placeholder="-b"
                />
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#f87171"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3.003 3.003 0 116 0v1" />
                  <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 014-4h4a4 4 0 014 4v3c0 3.3-2.7 6-6 6" />
                  <path d="M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M20.97 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4" />
                </svg>
              </div>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="mt-3 text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
            >
              Reset to defaults
            </button>
          </div>

          {/* Accent Color */}
          <div className="border-t border-stone-100 dark:border-stone-800/60 pt-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-3">
              Accent Color
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-3">
              Choose the accent color used for highlights, buttons, and interactive elements.
            </p>

            <div className="flex flex-wrap gap-2">
              {(Object.entries(ACCENT_COLORS) as [AccentColor, typeof ACCENT_COLORS[AccentColor]][]).map(
                ([key, config]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAccentColor(key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
                      accentColor === key
                        ? "border-stone-400 dark:border-stone-500 bg-stone-50 dark:bg-stone-800"
                        : "border-transparent hover:border-stone-200 dark:hover:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800/50"
                    }`}
                    title={config.name}
                  >
                    <span
                      className="w-5 h-5 rounded-full ring-1 ring-black/10 dark:ring-white/10"
                      style={{ backgroundColor: config.swatch }}
                    />
                    <span className="text-sm text-stone-600 dark:text-stone-300">
                      {config.name}
                    </span>
                    {accentColor === key && (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-stone-600 dark:text-stone-300"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Graph Line Colors */}
          <div className="border-t border-stone-100 dark:border-stone-800/60 pt-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-3">
              Graph Line Colors
            </h3>

            {/* Use accent color checkbox */}
            <label className="flex items-center justify-between gap-3 cursor-pointer mb-3">
              <div>
                <span className="text-sm text-stone-600 dark:text-stone-300">
                  Use accent color for graph lines
                </span>
                <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                  Lines use your theme color with shading underneath
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={graphUseAccent}
                onClick={() => setGraphUseAccent(!graphUseAccent)}
                className={cn(
                  "relative shrink-0 w-9 h-5 rounded-full transition-colors",
                  graphUseAccent
                    ? "bg-stone-800 dark:bg-stone-200"
                    : "bg-stone-300 dark:bg-stone-600"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white dark:bg-stone-900 transition-transform shadow-sm",
                    graphUseAccent && "translate-x-4"
                  )}
                />
              </button>
            </label>

            {/* Custom up/down color pickers — only shown when accent mode is off */}
            {!graphUseAccent && (
              <>
                <p className="text-xs text-stone-500 dark:text-stone-400 mb-3">
                  The &quot;up&quot; color is used when trending up or even, and &quot;down&quot; when trending down. No shading is shown in this mode.
                </p>

                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-stone-600 dark:text-stone-300 w-20">
                      Up / Even
                    </label>
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="color"
                        value={graphUpColor || "#1c1917"}
                        onChange={(e) => setGraphUpColor(e.target.value)}
                        className="w-8 h-8 rounded border border-stone-200 dark:border-stone-700 cursor-pointer bg-transparent"
                      />
                      <span className="text-xs text-stone-400 dark:text-stone-500">
                        {graphUpColor || "Auto (black / white)"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="text-sm text-stone-600 dark:text-stone-300 w-20">
                      Down
                    </label>
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="color"
                        value={graphDownColor || "#ef4444"}
                        onChange={(e) => setGraphDownColor(e.target.value)}
                        className="w-8 h-8 rounded border border-stone-200 dark:border-stone-700 cursor-pointer bg-transparent"
                      />
                      <span className="text-xs text-stone-400 dark:text-stone-500">
                        {graphDownColor || "Auto (red)"}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => { setGraphUpColor(""); setGraphDownColor(""); }}
                  className="mt-3 text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
                >
                  Reset to defaults
                </button>
              </>
            )}
          </div>

          {/* Week Schedule Settings */}
          <div className="border-t border-stone-100 dark:border-stone-800/60 pt-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-3">
              Week Schedule
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-3">
              Configure when your work week starts and ends. Weekly Battle Plans will be named by week ending date.
            </p>

            <div className="space-y-3">
              {/* Week starts */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-stone-600 dark:text-stone-300 w-24 shrink-0">
                  Week starts:
                </span>
                <div className="flex-1 min-w-[120px]">
                  <Select
                    value={String(weekSettings.weekStartDay)}
                    onChange={(val) => setWeekSettings({ ...weekSettings, weekStartDay: Number(val) })}
                    options={DAYS_OF_WEEK.map((day) => ({ value: String(day.value), label: day.label }))}
                  />
                </div>
                <span className="text-sm text-stone-500 dark:text-stone-400">at</span>
                <div className="w-28">
                  <Select
                    value={String(weekSettings.weekStartHour)}
                    onChange={(val) => setWeekSettings({ ...weekSettings, weekStartHour: Number(val) })}
                    options={HOURS_OF_DAY.map((hour) => ({ value: String(hour.value), label: hour.label }))}
                  />
                </div>
              </div>

              {/* Week ends */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-stone-600 dark:text-stone-300 w-24 shrink-0">
                  Week ends:
                </span>
                <div className="flex-1 min-w-[120px]">
                  <Select
                    value={String(weekSettings.weekEndDay)}
                    onChange={(val) => setWeekSettings({ ...weekSettings, weekEndDay: Number(val) })}
                    options={DAYS_OF_WEEK.map((day) => ({ value: String(day.value), label: day.label }))}
                  />
                </div>
                <span className="text-sm text-stone-500 dark:text-stone-400">at</span>
                <div className="w-28">
                  <Select
                    value={String(weekSettings.weekEndHour)}
                    onChange={(val) => setWeekSettings({ ...weekSettings, weekEndHour: Number(val) })}
                    options={HOURS_OF_DAY.map((hour) => ({ value: String(hour.value), label: hour.label }))}
                  />
                </div>
              </div>

              {/* Timezone */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-stone-600 dark:text-stone-300 w-24 shrink-0">
                  Timezone:
                </span>
                <div className="flex-1 min-w-[180px]">
                  <Select
                    value={weekSettings.timezone || ""}
                    onChange={(val) => setWeekSettings({ ...weekSettings, timezone: val || undefined })}
                    options={COMMON_TIMEZONES.map((tz) => ({ value: tz.value, label: tz.label }))}
                  />
                </div>
              </div>
              <p className="text-xs text-stone-400 dark:text-stone-500 ml-26 pl-24">
                Currently: {effectiveTimezone}
              </p>

              {/* Date Format */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-stone-600 dark:text-stone-300 w-24 shrink-0">
                  Date format:
                </span>
                <div className="flex-1 min-w-[140px]">
                  <Select
                    value={dateFormat}
                    onChange={(val) => setDateFormat(val as DateFormatType)}
                    options={DATE_FORMAT_OPTIONS.map((fmt) => ({ value: fmt.id, label: fmt.label }))}
                  />
                </div>
              </div>

              {/* Preview */}
              <div className="flex items-center gap-2 pt-2">
                <span className="text-sm text-stone-600 dark:text-stone-300 w-24 shrink-0">
                  Preview:
                </span>
                <span className={cn("text-sm font-medium", accent.text)}>
                  {previewTitle}
                </span>
              </div>

              <button
                type="button"
                onClick={handleResetWeekSettings}
                className="text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
              >
                Reset week settings to defaults
              </button>
            </div>
          </div>

          {/* Display Preferences */}
          <div className="border-t border-stone-100 dark:border-stone-800/60 pt-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-3">
              Display
            </h3>
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div>
                <span className="text-sm text-stone-600 dark:text-stone-300">
                  Show formula step descriptions on cards
                </span>
                <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                  When off, cards only show the formula badge (e.g. NO-1) without the step text
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={state.showStepDescriptions}
                onClick={() => dispatch({ type: "SET_SHOW_STEP_DESCRIPTIONS", payload: !state.showStepDescriptions })}
                className={cn(
                  "relative shrink-0 w-9 h-5 rounded-full transition-colors",
                  state.showStepDescriptions
                    ? "bg-stone-800 dark:bg-stone-200"
                    : "bg-stone-300 dark:bg-stone-600"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white dark:bg-stone-900 transition-transform shadow-sm",
                    state.showStepDescriptions && "translate-x-4"
                  )}
                />
              </button>
            </label>

            <label className="flex items-center justify-between gap-3 cursor-pointer mt-3">
              <div>
                <span className="text-sm text-stone-600 dark:text-stone-300">
                  Show formula badge on cards
                </span>
                <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                  When off, the formula code badge (e.g. NO-1) is hidden from cards
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={state.showFormulaBadge}
                onClick={() => dispatch({ type: "SET_SHOW_FORMULA_BADGE", payload: !state.showFormulaBadge })}
                className={cn(
                  "relative shrink-0 w-9 h-5 rounded-full transition-colors",
                  state.showFormulaBadge
                    ? "bg-stone-800 dark:bg-stone-200"
                    : "bg-stone-300 dark:bg-stone-600"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white dark:bg-stone-900 transition-transform shadow-sm",
                    state.showFormulaBadge && "translate-x-4"
                  )}
                />
              </button>
            </label>
          </div>

          {/* Info Terminals */}
          <div className="border-t border-stone-100 dark:border-stone-800/60 pt-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-3">
              Info Terminals
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-3">
              Grant other users access to view your board. They can see your tasks and battle plans, and leave comments in a separate &quot;Info&quot; thread.
            </p>

            {/* Current Info Terminals */}
            {myInfoTerminals.length > 0 && (
              <div className="mb-3 space-y-2">
                {myInfoTerminals.map((viewer) => (
                  <div
                    key={viewer.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0", accent.bgSubtle, accent.text)}>
                        {getDisplayName(viewer).charAt(0).toUpperCase()}
                      </span>
                      <span className="text-sm text-stone-700 dark:text-stone-200 truncate">
                        {getDisplayName(viewer)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveInfoTerminal(viewer.id)}
                      disabled={infoTerminalsLoading}
                      className="p-1 rounded text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0 disabled:opacity-50"
                      title="Remove access"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Info Terminal */}
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Select
                  value={selectedUserId}
                  onChange={setSelectedUserId}
                  options={[
                    { value: "", label: availableUsers.length === 0 ? "No users available" : "Select a user..." },
                    ...availableUsers.map((user) => ({ value: user.id, label: getDisplayName(user) })),
                  ]}
                  placeholder={availableUsers.length === 0 ? "No users available" : "Select a user..."}
                  className={infoTerminalsLoading || availableUsers.length === 0 ? "opacity-60 pointer-events-none" : ""}
                />
              </div>
              <button
                type="button"
                onClick={handleAddInfoTerminal}
                disabled={!selectedUserId || infoTerminalsLoading}
                className={cn(
                  "px-3 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                  accent.bg,
                  "text-white dark:text-stone-900"
                )}
              >
                Add
              </button>
            </div>

            {myInfoTerminals.length === 0 && (
              <p className="text-xs text-stone-400 dark:text-stone-500 mt-2">
                No info terminals yet. Add users to let them view your board.
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-stone-100 dark:border-stone-800/60">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-sm text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded px-4 py-1.5 text-sm font-medium bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 hover:bg-stone-700 dark:hover:bg-stone-300 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
