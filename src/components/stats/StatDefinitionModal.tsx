"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useAppContext, useAccentColor } from "@/context/AppContext";
import { statsApi, statEntriesApi } from "@/lib/api";
import { generateId, getDisplayName } from "@/lib/utils";
import type { StatDefinition, StatPeriodType, User } from "@/lib/types";

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getRecentDates(periodType: StatPeriodType, count: number): string[] {
  const dates: string[] = [];
  const now = new Date();
  if (periodType === "daily") {
    for (let i = 0; i < count; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dates.push(toDateStr(d));
    }
  } else if (periodType === "weekly") {
    const d = new Date(now);
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - diff); // snap to Monday
    for (let i = 0; i < count; i++) {
      dates.push(toDateStr(d));
      d.setDate(d.getDate() - 7);
    }
  } else {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    for (let i = 0; i < count; i++) {
      dates.push(toDateStr(d));
      d.setMonth(d.getMonth() - 1);
    }
  }
  return dates;
}

function formatEntryLabel(date: string, periodType: StatPeriodType): string {
  const d = new Date(date + "T00:00:00");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  if (periodType === "daily") return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
  if (periodType === "weekly") return `W/E ${d.getDate()} ${months[d.getMonth()]}`;
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

interface Props {
  onClose: () => void;
  editingStat?: StatDefinition | null;
}

export default function StatDefinitionModal({ onClose, editingStat }: Props) {
  const { state, dispatch } = useAppContext();
  const accent = useAccentColor();

  const [name, setName] = useState(editingStat?.name || "");
  const [assignedUserId, setAssignedUserId] = useState(editingStat?.userId || state.user?.id || "");
  const [division, setDivision] = useState<string>(editingStat?.division?.toString() || "");
  const [department, setDepartment] = useState<string>(editingStat?.department?.toString() || "");
  const [gds, setGds] = useState(editingStat?.gds || false);
  const [isMoney, setIsMoney] = useState(editingStat?.isMoney || false);
  const [isPercentage, setIsPercentage] = useState(editingStat?.isPercentage || false);
  const [isInverted, setIsInverted] = useState(editingStat?.isInverted || false);
  const [saving, setSaving] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState<User[]>([]);

  // Composite stat state
  const [isComposite, setIsComposite] = useState(() => !!editingStat?.linkedStatIds?.length);
  const [linkedIds, setLinkedIds] = useState<string[]>(() => editingStat?.linkedStatIds || []);

  // Non-composite stats available for linking (exclude other composites, but include self for editing)
  const linkableStats = useMemo(() =>
    state.statDefinitions.filter(s => !s.linkedStatIds?.length),
    [state.statDefinitions]
  );

  // Quick data entry state (edit mode only)
  const periodType = state.statsViewConfig.periodType;
  const recentDates = useMemo(() => editingStat ? getRecentDates(periodType, 8) : [], [editingStat, periodType]);
  const [entryValues, setEntryValues] = useState<Record<string, string>>({});
  const [entrySaving, setEntrySaving] = useState<Record<string, boolean>>({});
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const today = useMemo(() => toDateStr(new Date()), []);

  // Load existing entries for quick entry
  useEffect(() => {
    if (!editingStat) return;
    let cancelled = false;
    async function load() {
      try {
        const { entries } = await statEntriesApi.getByStatId(editingStat!.id);
        if (cancelled || !entries) return;
        const vals: Record<string, string> = {};
        for (const e of entries) {
          if (e.periodType === periodType) {
            vals[e.date] = String(e.value);
          }
        }
        setEntryValues(vals);
      } catch { /* ignore */ }
    }
    load();
    return () => { cancelled = true; };
  }, [editingStat, periodType]);

  const saveEntry = useCallback(
    async (date: string, valueStr: string) => {
      if (!editingStat) return;
      const numValue = Number(valueStr);
      if (isNaN(numValue) || valueStr.trim() === "") return;
      setEntrySaving((s) => ({ ...s, [date]: true }));
      try {
        const { entry } = await statEntriesApi.upsert({
          id: generateId(),
          statId: editingStat.id,
          value: numValue,
          date,
          periodType,
        });
        if (entry) {
          dispatch({ type: "ADD_STAT_ENTRY", payload: entry });
        }
      } catch (error) {
        console.error("Failed to save entry:", error);
      } finally {
        setEntrySaving((s) => ({ ...s, [date]: false }));
      }
    },
    [editingStat, periodType, dispatch]
  );

  function handleEntryChange(date: string, value: string) {
    setEntryValues((v) => ({ ...v, [date]: value }));
    if (saveTimers.current[date]) clearTimeout(saveTimers.current[date]);
    if (value.trim() !== "" && !isNaN(Number(value))) {
      saveTimers.current[date] = setTimeout(() => saveEntry(date, value), 800);
    }
  }

  function handleEntryBlur(date: string) {
    const value = entryValues[date];
    if (saveTimers.current[date]) clearTimeout(saveTimers.current[date]);
    if (value?.trim() !== "" && !isNaN(Number(value))) {
      saveEntry(date, value);
    }
  }

  const isAdmin = state.user?.role === "admin";

  useEffect(() => {
    // Build base list of users we can assign stats to
    const users: User[] = [];
    if (state.user) {
      users.push(state.user);
    }
    // If editing, ensure the currently assigned user is in the list
    if (editingStat && editingStat.userId !== state.user?.id) {
      users.push({
        id: editingStat.userId,
        username: editingStat.userName || "Unknown",
        firstName: editingStat.userFirstName || null,
        lastName: editingStat.userLastName || null,
        role: "user",
        createdAt: "",
      } as User);
    }
    for (const junior of state.myJuniors) {
      if (!users.some((u) => u.id === junior.id)) {
        users.push(junior);
      }
    }
    for (const viewer of state.viewableAsInfoTerminal) {
      if (!users.some((u) => u.id === viewer.id)) {
        users.push(viewer);
      }
    }

    // Set immediately so dropdown is never empty
    setAssignableUsers(users);

    // If admin, fetch all users (with full org data)
    if (isAdmin) {
      fetch("/api/users")
        .then((r) => r.json())
        .then((data) => {
          const arr = data?.users;
          if (arr && Array.isArray(arr)) {
            const allUsers = arr.map((u: Record<string, unknown>) => ({
              id: u.id as string,
              username: u.username as string,
              firstName: (u.firstName ?? u.first_name ?? null) as string | null,
              lastName: (u.lastName ?? u.last_name ?? null) as string | null,
              org: (u.org ?? null) as string | null,
              division: (u.division ?? null) as number | null,
              department: (u.department ?? null) as number | null,
              postTitle: (u.postTitle ?? u.post_title ?? null) as string | null,
              role: u.role as string,
              createdAt: (u.createdAt ?? u.created_at ?? "") as string,
            })) as User[];
            setAssignableUsers(allUsers);
          }
        })
        .catch(() => {
          // Keep the base list already set above
        });
    }
  }, [state.user, state.myJuniors, state.viewableAsInfoTerminal, isAdmin, editingStat]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Build grouped dropdown options: current user first, then grouped by Div > Dept
  const dropdownGroups = useMemo(() => {
    const currentUserId = state.user?.id;
    const currentUser = assignableUsers.find((u) => u.id === currentUserId);
    const otherUsers = assignableUsers.filter((u) => u.id !== currentUserId);

    // Group others by division
    const divMap = new Map<string, User[]>();
    for (const u of otherUsers) {
      const divLabel = u.division != null ? `Division ${u.division}` : "No Division";
      if (!divMap.has(divLabel)) divMap.set(divLabel, []);
      divMap.get(divLabel)!.push(u);
    }

    // Sort division groups: numbered divisions first (ascending), then "No Division"
    const sortedDivKeys = Array.from(divMap.keys()).sort((a, b) => {
      if (a === "No Division") return 1;
      if (b === "No Division") return -1;
      return a.localeCompare(b, undefined, { numeric: true });
    });

    // Within each division, sort by department (ascending), nulls last
    const groups: { label: string; users: User[] }[] = [];
    for (const divKey of sortedDivKeys) {
      const users = divMap.get(divKey)!;
      users.sort((a, b) => {
        if (a.department == null && b.department == null) return 0;
        if (a.department == null) return 1;
        if (b.department == null) return -1;
        return a.department - b.department;
      });
      groups.push({ label: divKey, users });
    }

    return { currentUser, groups };
  }, [assignableUsers, state.user?.id]);

  // Detect if we're converting a non-composite stat into a composite — in that case
  // we create a NEW composite stat and leave the original untouched.
  const wasComposite = !!editingStat?.linkedStatIds?.length;
  const isConvertingToComposite = editingStat && isComposite && !wasComposite;

  async function handleSave() {
    if (!name.trim()) return;
    if (isComposite && linkedIds.filter(Boolean).length < 2) return;
    setSaving(true);

    const compositeLinkedIds = isComposite ? linkedIds.filter(Boolean) : undefined;

    try {
      if (isConvertingToComposite) {
        // Create a NEW composite stat — the original stat stays untouched
        const { stat } = await statsApi.create({
          id: generateId(),
          name: name.trim(),
          assignedUserId: state.user?.id || undefined,
          linkedStatIds: compositeLinkedIds,
        });
        if (stat) {
          dispatch({ type: "ADD_STAT_DEFINITION", payload: stat });
        }
        // Refresh full list
        const refreshed = await statsApi.getAll();
        if (refreshed?.stats) {
          dispatch({ type: "SET_STAT_DEFINITIONS", payload: refreshed.stats });
        }
      } else if (editingStat) {
        // Normal edit (non-composite or already-composite)
        const { stat } = await statsApi.update(editingStat.id, {
          name: name.trim(),
          division: isComposite ? undefined : (division ? Number(division) : undefined),
          department: isComposite ? undefined : (department ? Number(department) : undefined),
          assignedUserId: isComposite ? (state.user?.id || undefined) : (assignedUserId || undefined),
          gds: isComposite ? false : gds,
          isMoney: isComposite ? false : isMoney,
          isPercentage: isComposite ? false : isPercentage,
          isInverted: isComposite ? false : isInverted,
          linkedStatIds: compositeLinkedIds || null,
        });
        if (stat) {
          dispatch({ type: "UPDATE_STAT_DEFINITION", payload: stat });
        }
        // Refresh full list in case user changed (stat may move sections)
        const refreshed = await statsApi.getAll();
        if (refreshed?.stats) {
          dispatch({ type: "SET_STAT_DEFINITIONS", payload: refreshed.stats });
        }
      } else {
        // Brand new stat
        const { stat } = await statsApi.create({
          id: generateId(),
          name: name.trim(),
          assignedUserId: isComposite ? (state.user?.id || undefined) : (assignedUserId || undefined),
          division: isComposite ? undefined : (division ? Number(division) : undefined),
          department: isComposite ? undefined : (department ? Number(department) : undefined),
          gds: isComposite ? false : gds,
          isMoney: isComposite ? false : isMoney,
          isPercentage: isComposite ? false : isPercentage,
          isInverted: isComposite ? false : isInverted,
          linkedStatIds: compositeLinkedIds,
        });
        if (stat) {
          dispatch({ type: "ADD_STAT_DEFINITION", payload: stat });
        }
      }
      onClose();
    } catch (error) {
      console.error("Failed to save stat:", error);
    } finally {
      setSaving(false);
    }
  }

  function userOptionLabel(u: User): string {
    const name = getDisplayName(u);
    const parts: string[] = [];
    if (u.department != null) parts.push(`Dept ${u.department}`);
    return parts.length > 0 ? `${parts.join(" · ")} — ${name}` : name;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-stone-900 rounded-xl shadow-xl w-full max-w-md mx-4 animate-slide-up border border-stone-200 dark:border-stone-700 max-h-[85vh] flex flex-col">
        <div className="px-5 py-4 border-b border-stone-200 dark:border-stone-700 shrink-0">
          <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-200">
            {editingStat ? "Edit Stat" : "New Stat"}
          </h2>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-stone-600 dark:text-stone-400 mb-1">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isComposite ? "e.g. Revenue vs Expenses" : "e.g. Daily Production Output"}
              className={`w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-sm focus:outline-none focus:ring-2 ${accent.ring}`}
              autoFocus
            />
          </div>

          {/* Composite Stat toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isComposite}
              onChange={(e) => {
                setIsComposite(e.target.checked);
                if (e.target.checked) {
                  // Pre-populate first line with the stat being edited (if editing a non-composite)
                  if (editingStat && !editingStat.linkedStatIds?.length && linkedIds.length === 0) {
                    setLinkedIds([editingStat.id]);
                  }
                } else {
                  setLinkedIds([]);
                }
              }}
              className={`rounded border-stone-300 dark:border-stone-600 ${accent.text}`}
            />
            <span className="text-sm text-stone-600 dark:text-stone-400">
              Composite Stat (multi-line graph)
            </span>
          </label>

          {/* Composite: Linked stat picker */}
          {isComposite && (
            <div className="space-y-2 pl-0.5">
              <label className="block text-sm font-medium text-stone-600 dark:text-stone-400 mb-1">
                Linked Stats <span className="text-red-400">*</span>
              </label>
              {[0, 1, 2].map((idx) => {
                if (idx === 2 && linkedIds.length < 2 && !linkedIds[2]) return null;
                const dashArrays = ["none", "6 3", "2 2"];
                const selectedOthers = linkedIds.filter((_, i) => i !== idx);
                const available = linkableStats.filter(s => !selectedOthers.includes(s.id));
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <svg width="20" height="8" className="shrink-0">
                      <line x1="0" y1="4" x2="20" y2="4"
                        stroke="currentColor" strokeWidth="2"
                        strokeDasharray={dashArrays[idx]}
                        className="text-stone-500 dark:text-stone-400"
                      />
                    </svg>
                    <select
                      value={linkedIds[idx] || ""}
                      onChange={(e) => {
                        const newIds = [...linkedIds];
                        if (e.target.value) {
                          newIds[idx] = e.target.value;
                        } else {
                          newIds.splice(idx, 1);
                        }
                        setLinkedIds(newIds);
                      }}
                      className={`flex-1 px-2 py-1.5 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-sm focus:outline-none focus:ring-1 ${accent.ring}`}
                    >
                      <option value="">{idx < 2 ? `Select stat...` : "Optional 3rd stat..."}</option>
                      {available.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    {idx === 2 && linkedIds[2] && (
                      <button
                        onClick={() => setLinkedIds(linkedIds.slice(0, 2))}
                        className="p-1 rounded text-stone-400 hover:text-red-500 transition-colors"
                        title="Remove 3rd line"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
              {linkedIds.filter(Boolean).length >= 2 && linkedIds.length < 3 && (
                <button
                  onClick={() => setLinkedIds([...linkedIds, ""])}
                  className={`text-xs font-medium ${accent.text} hover:underline mt-1`}
                >
                  + Add 3rd line
                </button>
              )}
              <p className="text-[10px] text-stone-400 dark:text-stone-500">
                Line 1 (solid, left axis) &middot; Line 2 (dashed, right axis){linkedIds.length > 2 ? " · Line 3 (dotted, right axis)" : ""}
              </p>
            </div>
          )}

          {/* Non-composite fields */}
          {!isComposite && (
            <>
              {/* Assigned User */}
              <div>
                <label className="block text-sm font-medium text-stone-600 dark:text-stone-400 mb-1">
                  Assigned To
                </label>
                <select
                  value={assignedUserId}
                  onChange={(e) => setAssignedUserId(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-sm focus:outline-none focus:ring-2 ${accent.ring}`}
                >
                  {/* Current user always first */}
                  {dropdownGroups.currentUser && (
                    <option value={dropdownGroups.currentUser.id}>
                      {getDisplayName(dropdownGroups.currentUser)} (me)
                    </option>
                  )}
                  {/* Other users grouped by Division */}
                  {dropdownGroups.groups.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {userOptionLabel(u)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* GDS flag */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={gds}
                  onChange={(e) => setGds(e.target.checked)}
                  className={`rounded border-stone-300 dark:border-stone-600 ${accent.text}`}
                />
                <span className="text-sm text-stone-600 dark:text-stone-400">
                  Gross Divisional Statistic (GDS)
                </span>
              </label>

              {/* Formatting flags */}
              <div className="space-y-2 pl-0.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isMoney}
                    onChange={(e) => setIsMoney(e.target.checked)}
                    className={`rounded border-stone-300 dark:border-stone-600 ${accent.text}`}
                  />
                  <span className="text-sm text-stone-600 dark:text-stone-400">
                    Dollar ($) stat
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPercentage}
                    onChange={(e) => setIsPercentage(e.target.checked)}
                    className={`rounded border-stone-300 dark:border-stone-600 ${accent.text}`}
                  />
                  <span className="text-sm text-stone-600 dark:text-stone-400">
                    Percentage (%) stat
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isInverted}
                    onChange={(e) => setIsInverted(e.target.checked)}
                    className={`rounded border-stone-300 dark:border-stone-600 ${accent.text}`}
                  />
                  <span className="text-sm text-stone-600 dark:text-stone-400">
                    Upside-down graph (lower is better)
                  </span>
                </label>
              </div>

              {/* Division & Department */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-stone-600 dark:text-stone-400 mb-1">
                    Division
                  </label>
                  <input
                    type="number"
                    value={division}
                    onChange={(e) => setDivision(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-600 dark:text-stone-400 mb-1">
                    Department
                  </label>
                  <input
                    type="number"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-sm focus:outline-none"
                  />
                </div>
              </div>
            </>
          )}

          {/* Quick Data Entry (edit mode only, non-composite only) */}
          {editingStat && !isComposite && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-stone-600 dark:text-stone-400">
                  Quick Entry
                  <span className="font-normal text-stone-400 dark:text-stone-500"> &middot; {periodType}</span>
                </label>
              </div>
              <div className="space-y-1.5 rounded-lg border border-stone-200 dark:border-stone-700 p-3 bg-stone-50 dark:bg-stone-800/50">
                {recentDates.map((date) => {
                  const isToday = date === today;
                  return (
                    <div key={date} className="flex items-center gap-2">
                      <span
                        className={`w-28 text-xs shrink-0 ${
                          isToday
                            ? `font-semibold ${accent.text}`
                            : "text-stone-500 dark:text-stone-400"
                        }`}
                      >
                        {formatEntryLabel(date, periodType)}
                        {isToday && " *"}
                      </span>
                      <div className="relative flex-1">
                        <input
                          type="number"
                          value={entryValues[date] ?? ""}
                          onChange={(e) => handleEntryChange(date, e.target.value)}
                          onBlur={() => handleEntryBlur(date)}
                          placeholder="—"
                          step="any"
                          className={`w-full px-2 py-1 text-sm rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 ${accent.ring} ${
                            entrySaving[date] ? "opacity-60" : ""
                          }`}
                        />
                        {entrySaving[date] && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-stone-400">...</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-stone-200 dark:border-stone-700 flex justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm rounded-lg text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving || (isComposite && linkedIds.filter(Boolean).length < 2)}
            className={`px-4 py-1.5 text-sm rounded-lg font-medium text-white transition-colors disabled:opacity-50 ${accent.bg}`}
          >
            {saving ? "Saving..." : editingStat ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
