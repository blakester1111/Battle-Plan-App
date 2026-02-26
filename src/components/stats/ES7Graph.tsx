"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useAppContext, useAccentColor } from "@/context/AppContext";
import { useTheme } from "next-themes";
import { statEntriesApi, statQuotasApi } from "@/lib/api";
import { generateId, getDisplayName } from "@/lib/utils";
import {
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from "recharts";
import {
  getWeekEndingDateForDate,
  formatDate,
  SPLIT_HALF_SUFFIX,
} from "@/lib/dateUtils";
import type { WeekSettings, StatQuota, StatEntry } from "@/lib/types";

// Day slots for each org type
// Foundation: Thu PM, Fri, Sat, Sun, Mon, Tue, Wed, Thu AM (8 slots)
// Day: Thu PM, Fri, Mon, Tue, Wed, Thu AM (6 slots)
interface ES7Slot {
  dayOfWeek: number; // 0-6
  label: string;
  isSecondHalf: boolean; // true = PM half of boundary day
  isFirstHalf: boolean; // true = AM half of boundary day
}

function getES7Slots(org: "Day" | "Foundation", weekSettings: WeekSettings): ES7Slot[] {
  const boundaryDay = weekSettings.weekStartDay; // e.g. 4 (Thursday)
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  if (org === "Foundation") {
    // Thu PM, Fri, Sat, Sun, Mon, Tue, Wed, Thu AM
    return [
      { dayOfWeek: boundaryDay, label: `${dayNames[boundaryDay]} PM`, isSecondHalf: true, isFirstHalf: false },
      { dayOfWeek: (boundaryDay + 1) % 7, label: dayNames[(boundaryDay + 1) % 7], isSecondHalf: false, isFirstHalf: false },
      { dayOfWeek: (boundaryDay + 2) % 7, label: dayNames[(boundaryDay + 2) % 7], isSecondHalf: false, isFirstHalf: false },
      { dayOfWeek: (boundaryDay + 3) % 7, label: dayNames[(boundaryDay + 3) % 7], isSecondHalf: false, isFirstHalf: false },
      { dayOfWeek: (boundaryDay + 4) % 7, label: dayNames[(boundaryDay + 4) % 7], isSecondHalf: false, isFirstHalf: false },
      { dayOfWeek: (boundaryDay + 5) % 7, label: dayNames[(boundaryDay + 5) % 7], isSecondHalf: false, isFirstHalf: false },
      { dayOfWeek: (boundaryDay + 6) % 7, label: dayNames[(boundaryDay + 6) % 7], isSecondHalf: false, isFirstHalf: false },
      { dayOfWeek: boundaryDay, label: `${dayNames[boundaryDay]} AM`, isSecondHalf: false, isFirstHalf: true },
    ];
  }

  // Day org: Thu PM, Fri, Mon, Tue, Wed, Thu AM (skip Sat, Sun)
  return [
    { dayOfWeek: boundaryDay, label: `${dayNames[boundaryDay]} PM`, isSecondHalf: true, isFirstHalf: false },
    { dayOfWeek: (boundaryDay + 1) % 7, label: dayNames[(boundaryDay + 1) % 7], isSecondHalf: false, isFirstHalf: false },
    { dayOfWeek: (boundaryDay + 4) % 7, label: dayNames[(boundaryDay + 4) % 7], isSecondHalf: false, isFirstHalf: false },
    { dayOfWeek: (boundaryDay + 5) % 7, label: dayNames[(boundaryDay + 5) % 7], isSecondHalf: false, isFirstHalf: false },
    { dayOfWeek: (boundaryDay + 6) % 7, label: dayNames[(boundaryDay + 6) % 7], isSecondHalf: false, isFirstHalf: false },
    { dayOfWeek: boundaryDay, label: `${dayNames[boundaryDay]} AM`, isSecondHalf: false, isFirstHalf: true },
  ];
}

// Get the actual date string for each slot in a given week
function getSlotDates(weekEndingDate: Date, slots: ES7Slot[], weekSettings: WeekSettings): string[] {
  // The week ending date is the boundary day (e.g., Thursday).
  // The week starts at boundary day PM of the PREVIOUS week.
  // So slot[0] (Thu PM) is 7 days before weekEndingDate
  // slot[last] (Thu AM) is weekEndingDate itself
  const endDate = new Date(weekEndingDate);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 7);

  return slots.map((slot) => {
    // Calculate date for this slot
    if (slot.isSecondHalf) {
      // This is the boundary day PM = start of the week
      const d = new Date(startDate);
      return formatISODate(d) + SPLIT_HALF_SUFFIX;
    }
    if (slot.isFirstHalf) {
      // This is the boundary day AM = end of the week (same day as weekEndingDate)
      const d = new Date(endDate);
      return formatISODate(d);
    }
    // Regular day — calculate from start
    const dayDiff = (slot.dayOfWeek - weekSettings.weekStartDay + 7) % 7;
    const d = new Date(startDate);
    d.setDate(d.getDate() + (dayDiff === 0 ? 7 : dayDiff));
    return formatISODate(d);
  });
}

function formatISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatValue(value: number, isMoney: boolean, isPercentage: boolean): string {
  const formatted = value.toLocaleString();
  if (isMoney && isPercentage) return `$${formatted}%`;
  if (isMoney) return `$${formatted}`;
  if (isPercentage) return `${formatted}%`;
  return formatted;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ES7Tooltip({ active, payload, label, isMoney, isPercentage, slots }: any) {
  if (!active || !payload || !payload.length) return null;

  const slotIndex = typeof label === "number" ? label : 0;
  const slot = slots?.[slotIndex];
  const slotLabel = slot?.label || `Slot ${slotIndex}`;

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg shadow-lg px-3 py-2">
      <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">{slotLabel}</p>
      {payload.map((p: { dataKey: string; value: number | null; color: string; name: string }, i: number) => {
        if (p.value == null) return null;
        const seriesLabel = p.dataKey === "cumulative" ? "Cumulative" :
          p.dataKey === "quota" ? "Quota" :
          p.dataKey === "prevCumulative" ? "Prev Week" :
          p.dataKey === "daily" ? "Daily" : p.name;
        return (
          <div key={i} className={`${i > 0 ? "mt-1 pt-1 border-t border-stone-200 dark:border-stone-700" : "mt-0.5"}`}>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="text-[10px] text-stone-500 dark:text-stone-400">{seriesLabel}</span>
            </div>
            <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">
              {formatValue(Number(p.value), !!isMoney, !!isPercentage)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export default function ES7Graph() {
  const { state, dispatch } = useAppContext();
  const accent = useAccentColor();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const weekSettings = state.weekSettings;
  const es7Config = state.es7Config;
  const selectedStat = state.statDefinitions.find((s) => s.id === state.selectedStatId);
  const isMoney = selectedStat?.isMoney ?? false;
  const isPercentage = selectedStat?.isPercentage ?? false;

  // Determine org from the stat's assigned user
  // If viewing own stat, use own org; otherwise use the userOrg from the stat definition
  const org: "Day" | "Foundation" =
    (selectedStat?.userId === state.user?.id ? state.user?.org : selectedStat?.userOrg) || "Foundation";

  const slots = useMemo(() => getES7Slots(org, weekSettings), [org, weekSettings]);

  // Calculate the current week's ending date, then apply offset
  // getWeekEndingDateForDate gives the NEXT occurrence of weekEndDay on or after today,
  // which is the current week's ending date (the week we're in right now)
  const weekEndingDate = useMemo(() => {
    const now = new Date();
    const baseEnd = getWeekEndingDateForDate(now, weekSettings.weekEndDay);
    const endWithOffset = new Date(baseEnd);
    endWithOffset.setDate(endWithOffset.getDate() + es7Config.weekOffset * 7);
    return endWithOffset;
  }, [weekSettings.weekEndDay, es7Config.weekOffset]);

  const prevWeekEndingDate = useMemo(() => {
    const d = new Date(weekEndingDate);
    d.setDate(d.getDate() - 7);
    return d;
  }, [weekEndingDate]);

  const weekEndStr = formatISODate(weekEndingDate);

  // Current and previous week slot dates
  const slotDates = useMemo(
    () => getSlotDates(weekEndingDate, slots, weekSettings),
    [weekEndingDate, slots, weekSettings]
  );
  const prevSlotDates = useMemo(
    () => getSlotDates(prevWeekEndingDate, slots, weekSettings),
    [prevWeekEndingDate, slots, weekSettings]
  );

  // Fetch entries for the stat covering both current and previous weeks
  const [entries, setEntries] = useState<StatEntry[]>([]);
  const [quota, setQuota] = useState<StatQuota | null>(null);
  const [editing, setEditing] = useState(false);
  const [quotaInputs, setQuotaInputs] = useState<string[]>([]);
  const [valueInputs, setValueInputs] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    if (!state.selectedStatId) return;

    // Fetch entries covering both current and previous weeks (2 weeks back from end date)
    const rangeStart = new Date(weekEndingDate);
    rangeStart.setDate(rangeStart.getDate() - 21); // 3 weeks to be safe
    const startDate = formatISODate(rangeStart);
    const endDate = weekEndStr;

    try {
      const { entries: fetched } = await statEntriesApi.getByStatId(state.selectedStatId, startDate, endDate);
      setEntries(fetched || []);
    } catch (e) {
      console.error("Failed to fetch ES7 entries:", e);
    }

    // Fetch quota
    try {
      const { quota: q } = await statQuotasApi.getForWeek(state.selectedStatId, weekEndStr);
      setQuota(q || null);
      if (q) {
        dispatch({ type: "SET_STAT_QUOTA", payload: q });
      }
    } catch (e) {
      console.error("Failed to fetch ES7 quota:", e);
    }
  }, [state.selectedStatId, weekEndStr, weekEndingDate, dispatch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build chart data — uses live inputs when editing for real-time graph updates
  const chartData = useMemo(() => {
    if (!selectedStat) return [];

    // Build entry map from saved entries
    const entryMap = new Map<string, number>();
    for (const e of entries) {
      entryMap.set(e.date, e.value);
    }

    // When editing, override with live input values
    const liveEntryMap = new Map(entryMap);
    if (editing) {
      for (let i = 0; i < slotDates.length; i++) {
        const raw = valueInputs[i];
        if (raw !== "" && !isNaN(parseFloat(raw))) {
          liveEntryMap.set(slotDates[i], parseFloat(raw));
        } else if (raw === "") {
          liveEntryMap.delete(slotDates[i]);
        }
      }
    }

    // Use live quota inputs when editing, otherwise saved quota
    const quotaValues = editing
      ? quotaInputs.map((v) => parseFloat(v) || 0)
      : (quota?.quotas || []);
    const hasAnyQuota = quotaValues.length > 0 && quotaValues.some((v) => v !== 0);

    let cumulative = 0;
    let prevCumulative = 0;
    let cumulativeQuota = 0;

    // Previous week entries for overlay
    const prevEntryMap = new Map<string, number>();
    if (es7Config.showPrevWeek) {
      for (const e of entries) {
        prevEntryMap.set(e.date, e.value);
      }
    }

    return slots.map((slot, idx) => {
      const dateKey = slotDates[idx];
      const dailyValue = liveEntryMap.get(dateKey) ?? null;
      const quotaVal = quotaValues[idx] ?? 0;
      cumulativeQuota += quotaVal;

      if (dailyValue != null) {
        cumulative += dailyValue;
      }

      // Previous week cumulative
      let prevCumulativeVal: number | null = null;
      if (es7Config.showPrevWeek) {
        const prevDateKey = prevSlotDates[idx];
        const prevDaily = prevEntryMap.get(prevDateKey) ?? null;
        if (prevDaily != null) {
          prevCumulative += prevDaily;
        }
        prevCumulativeVal = prevCumulative > 0 || prevDaily != null ? prevCumulative : null;
      }

      return {
        slotIndex: idx,
        label: slot.label,
        cumulative: dailyValue != null ? cumulative : null,
        quota: hasAnyQuota ? cumulativeQuota : null,
        daily: es7Config.showDailyValues && dailyValue != null ? dailyValue : null,
        prevCumulative: prevCumulativeVal,
      };
    });
  }, [selectedStat, entries, quota, slots, slotDates, prevSlotDates, es7Config, editing, valueInputs, quotaInputs]);

  // Y-axis domain
  const yDomain = useMemo(() => {
    const allVals = chartData.flatMap((d) =>
      [d.cumulative, d.quota, d.daily, d.prevCumulative].filter((v): v is number => v != null)
    );
    if (allVals.length === 0) return [0, 10];
    const max = Math.max(...allVals);
    return [0, Math.ceil(max * 1.1) || 10];
  }, [chartData]);

  // Week navigation
  const goToPrevWeek = () => dispatch({ type: "SET_ES7_CONFIG", payload: { weekOffset: es7Config.weekOffset - 1 } });
  const goToNextWeek = () => dispatch({ type: "SET_ES7_CONFIG", payload: { weekOffset: es7Config.weekOffset + 1 } });
  const goToCurrentWeek = () => dispatch({ type: "SET_ES7_CONFIG", payload: { weekOffset: 0 } });

  // Editing (quotas + daily values)
  const startEditing = () => {
    const existingQuotas = quota?.quotas || [];
    setQuotaInputs(slots.map((_, i) => String(existingQuotas[i] ?? "")));
    // Populate daily value inputs from current entries
    const entryMap = new Map<string, number>();
    for (const e of entries) entryMap.set(e.date, e.value);
    setValueInputs(slotDates.map((dateKey) => {
      const val = entryMap.get(dateKey);
      return val != null ? String(val) : "";
    }));
    setEditing(true);
  };

  const saveAll = async () => {
    if (!state.selectedStatId) return;

    // Save quotas
    const quotaValues = quotaInputs.map((v) => parseFloat(v) || 0);
    try {
      const id = quota?.id || generateId();
      const { quota: saved } = await statQuotasApi.upsert({
        id,
        statId: state.selectedStatId,
        weekEndingDate: weekEndStr,
        quotas: quotaValues,
      });
      setQuota(saved);
      dispatch({ type: "SET_STAT_QUOTA", payload: saved });
    } catch (e) {
      console.error("Failed to save quotas:", e);
    }

    // Save daily values via upsert
    for (let i = 0; i < slotDates.length; i++) {
      const raw = valueInputs[i];
      if (raw === "") continue; // skip empty — don't overwrite with 0
      const val = parseFloat(raw);
      if (isNaN(val)) continue;
      try {
        await statEntriesApi.upsert({
          id: generateId(),
          statId: state.selectedStatId,
          value: val,
          date: slotDates[i],
          periodType: "daily",
        });
      } catch (e) {
        console.error("Failed to save entry:", e);
      }
    }

    setEditing(false);
    // Refresh data
    fetchData();
  };

  // Week label
  const weekLabel = useMemo(() => {
    return `W/E ${formatDate(weekEndingDate, state.dateFormat)}`;
  }, [weekEndingDate, state.dateFormat]);

  const chartRef = useRef<HTMLDivElement>(null);

  const accentFill = accent.swatch;
  const gridColor = isDark ? "#44403c" : "#e7e5e4";
  const labelColor = isDark ? "#d6d3d1" : "#44403c";
  const blackLine = isDark ? "#e7e5e4" : "#1c1917";

  const handlePrint = useCallback(() => {
    const svgElement = chartRef.current?.querySelector("svg");
    if (!svgElement || !selectedStat) return;

    // Clone SVG and make it scalable to fill the page
    const svgClone = svgElement.cloneNode(true) as SVGElement;
    const rect = svgElement.getBoundingClientRect();
    if (!svgClone.getAttribute("viewBox")) {
      svgClone.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
    }
    svgClone.setAttribute("width", "100%");
    svgClone.setAttribute("height", "100%");
    svgClone.removeAttribute("style");

    // Landscape for ES7
    svgClone.setAttribute("preserveAspectRatio", "xMidYMid meet");

    // Increase axis font sizes for print
    svgClone.querySelectorAll("text").forEach((textEl) => {
      const fontSize = parseFloat(textEl.getAttribute("font-size") || textEl.style.fontSize || "0");
      if (fontSize > 0 && fontSize <= 12) {
        textEl.setAttribute("font-size", "14");
      }
    });

    let svgData = new XMLSerializer().serializeToString(svgClone);

    // Force light-mode colors for printing
    if (isDark) {
      const darkToLight: [string, string][] = [
        ["#e7e5e4", "#1c1917"],
        ["#d6d3d1", "#44403c"],
        ["#a8a29e", "#78716c"],
        ["#44403c", "#e7e5e4"],
        ["#1c1917", "#ffffff"],
      ];
      darkToLight.forEach(([dark], i) => {
        svgData = svgData.replaceAll(dark, `__CLR${i}__`);
      });
      darkToLight.forEach(([, light], i) => {
        svgData = svgData.replaceAll(`__CLR${i}__`, light);
      });
    }

    const statName = selectedStat.name;

    // Build subtitle
    const parts: string[] = [];
    if (selectedStat.userDivision != null) parts.push(`Div ${selectedStat.userDivision}`);
    if (selectedStat.userDepartment != null) parts.push(`Dept ${selectedStat.userDepartment}`);
    if (selectedStat.userPostTitle) parts.push(selectedStat.userPostTitle);
    const userName = getDisplayName({
      username: selectedStat.userName || "Unknown",
      firstName: selectedStat.userFirstName,
      lastName: selectedStat.userLastName,
    });
    parts.push(userName);
    const subtitle = parts.join(" \u00B7 ");

    const weekInfo = weekLabel;

    // Build legend with inline SVGs for reliable line rendering
    const legendSvg = (stroke: string, width: number, dash: string, dots = false) =>
      `<svg width="${width}" height="12" style="vertical-align:middle;margin-right:4px;"><line x1="0" y1="6" x2="${width}" y2="6" stroke="${stroke}" stroke-width="2.5" stroke-dasharray="${dash}" />${dots ? `<circle cx="4" cy="6" r="3" fill="${stroke}" /><circle cx="14" cy="6" r="3" fill="${stroke}" /><circle cx="24" cy="6" r="3" fill="${stroke}" />` : ""}</svg>`;
    const legendItems: string[] = [
      `<span style="margin-right:14px;white-space:nowrap;">${legendSvg("#1c1917", 28, "", true)}Cumulative</span>`,
      `<span style="margin-right:14px;white-space:nowrap;">${legendSvg("#1c1917", 28, "0")}Quota</span>`,
    ];
    if (es7Config.showPrevWeek) {
      legendItems.push(`<span style="margin-right:14px;white-space:nowrap;">${legendSvg("#1c1917", 28, "3 4")}Prev Week</span>`);
    }
    if (es7Config.showDailyValues) {
      legendItems.push(`<span style="margin-right:14px;white-space:nowrap;">${legendSvg(accentFill, 28, "8 4")}Daily</span>`);
    }
    const legendHtml = legendItems.join("");

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "-9999px";
    iframe.style.top = "-9999px";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }

    doc.open();
    doc.write(`<!DOCTYPE html><html><head><title>${statName} — ES7</title>
<style>
  @page { size: letter landscape; margin: 0; }
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; font-family: system-ui, sans-serif; }
  .container { width: 100%; height: 100%; padding: 0.4in 0.5in; box-sizing: border-box; display: flex; flex-direction: column; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; flex-shrink: 0; margin-bottom: 6px; }
  .header-left { flex: 1; }
  h1 { font-size: 20px; margin: 0 0 2px 0; color: #1c1917; }
  .subtitle { font-size: 12px; color: #78716c; margin: 0 0 2px 0; }
  .week-info { font-size: 12px; color: #44403c; font-weight: 500; margin: 0; }
  .legend { font-size: 11px; color: #44403c; padding-top: 3px; white-space: nowrap; }
  .chart { flex: 1; min-height: 0; }
  .chart svg { width: 100%; height: 100%; display: block; }
</style></head><body>
<div class="container">
  <div class="header">
    <div class="header-left">
      <h1>${statName}</h1>
      ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ""}
      <p class="week-info">${weekInfo} &mdash; ${org} org</p>
    </div>
    <div class="legend">${legendHtml}</div>
  </div>
  <div class="chart">${svgData}</div>
</div>
</body></html>`);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 250);
  }, [selectedStat, weekLabel, org, isDark, accentFill, es7Config.showPrevWeek, es7Config.showDailyValues]);

  if (!selectedStat) {
    return (
      <div className="flex-1 flex items-center justify-center text-stone-400 dark:text-stone-500">
        Select a stat to view the Exec Series 7 graph
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-3 min-h-0">
      {/* Week navigator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevWeek}
            className="px-2 py-1 text-sm rounded border border-stone-300 dark:border-stone-600 hover:bg-stone-100 dark:hover:bg-stone-700"
          >
            &larr; Prev
          </button>
          <button
            onClick={goToCurrentWeek}
            className={`px-2 py-1 text-sm rounded border ${
              es7Config.weekOffset === 0
                ? `${accent.bg} text-white border-transparent`
                : "border-stone-300 dark:border-stone-600 hover:bg-stone-100 dark:hover:bg-stone-700"
            }`}
          >
            Current
          </button>
          <button
            onClick={goToNextWeek}
            className="px-2 py-1 text-sm rounded border border-stone-300 dark:border-stone-600 hover:bg-stone-100 dark:hover:bg-stone-700"
          >
            Next &rarr;
          </button>
          <span className="text-sm font-medium text-stone-600 dark:text-stone-300 ml-2">
            {weekLabel}
          </span>
          <span className="text-xs text-stone-400 dark:text-stone-500">
            ({org} org &middot; {slots.length} slots)
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Toggle options */}
          <label className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400 cursor-pointer">
            <input
              type="checkbox"
              checked={es7Config.showPrevWeek}
              onChange={(e) => dispatch({ type: "SET_ES7_CONFIG", payload: { showPrevWeek: e.target.checked } })}
              className="rounded"
            />
            Prev week
          </label>
          <label className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400 cursor-pointer">
            <input
              type="checkbox"
              checked={es7Config.showDailyValues}
              onChange={(e) => dispatch({ type: "SET_ES7_CONFIG", payload: { showDailyValues: e.target.checked } })}
              className="rounded"
            />
            Daily values
          </label>
          <button
            onClick={editing ? saveAll : startEditing}
            className={`px-2 py-1 text-xs rounded border ${
              editing
                ? "bg-emerald-500 text-white border-transparent"
                : "border-stone-300 dark:border-stone-600 hover:bg-stone-100 dark:hover:bg-stone-700"
            }`}
          >
            {editing ? "Save Data" : "Edit"}
          </button>
          {editing && (
            <button
              onClick={() => setEditing(false)}
              className="px-2 py-1 text-xs rounded border border-stone-300 dark:border-stone-600 hover:bg-stone-100 dark:hover:bg-stone-700"
            >
              Cancel
            </button>
          )}

          {/* Print */}
          <button
            onClick={handlePrint}
            className="p-1.5 rounded text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            title="Print graph"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
          </button>

          {/* View mode toggle */}
          <div className="flex items-center border border-stone-300 dark:border-stone-600 rounded overflow-hidden text-xs ml-1">
            <button
              onClick={() => dispatch({ type: "SET_ES7_VIEW_MODE", payload: "standard" })}
              className={`px-2 py-1 ${
                state.es7ViewMode !== "es7"
                  ? `${accent.bg} text-white`
                  : "text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700"
              }`}
              title="Standard graph"
            >
              Std
            </button>
            <button
              onClick={() => dispatch({ type: "SET_ES7_VIEW_MODE", payload: "es7" })}
              className={`px-2 py-1 ${
                state.es7ViewMode === "es7"
                  ? `${accent.bg} text-white`
                  : "text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700"
              }`}
              title="Exec Series 7 graph"
            >
              ES7
            </button>
          </div>
        </div>
      </div>

      {/* Editor rows: column headers + quota row + daily values row */}
      {editing && (
        <div className="flex flex-col gap-1 px-2">
          {/* Column headers */}
          <div className="flex items-center gap-1">
            <span className="w-16 shrink-0" />
            {slots.map((slot, idx) => (
              <div key={idx} className="flex-1 min-w-0 text-center">
                <span className="text-[10px] font-medium text-stone-400 dark:text-stone-500 truncate">{slot.label}</span>
              </div>
            ))}
          </div>
          {/* Quota row */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-stone-500 dark:text-stone-400 w-16 shrink-0">Quotas:</span>
            {slots.map((_, idx) => (
              <input
                key={idx}
                type="number"
                value={quotaInputs[idx] || ""}
                onChange={(e) => {
                  const next = [...quotaInputs];
                  next[idx] = e.target.value;
                  setQuotaInputs(next);
                }}
                className="flex-1 min-w-0 text-center text-xs py-1 rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200"
                placeholder="0"
              />
            ))}
          </div>
          {/* Daily values row */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-stone-500 dark:text-stone-400 w-16 shrink-0">Values:</span>
            {slots.map((_, idx) => (
              <input
                key={idx}
                type="number"
                value={valueInputs[idx] || ""}
                onChange={(e) => {
                  const next = [...valueInputs];
                  next[idx] = e.target.value;
                  setValueInputs(next);
                }}
                className="flex-1 min-w-0 text-center text-xs py-1 rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200"
                placeholder="—"
              />
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 px-2 text-xs text-stone-500 dark:text-stone-400">
        <div className="flex items-center gap-1.5">
          <svg width="20" height="6">
            <line x1="0" y1="3" x2="20" y2="3" stroke={blackLine} strokeWidth="2" />
          </svg>
          <span>Cumulative</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="20" height="10">
            <rect x="0" y="0" width="20" height="10" fill={accentFill} opacity="0.3" rx="2" />
            <line x1="0" y1="5" x2="20" y2="5" stroke={blackLine} strokeWidth="1.5" />
          </svg>
          <span>Quota</span>
        </div>
        {es7Config.showPrevWeek && (
          <div className="flex items-center gap-1.5">
            <svg width="20" height="6">
              <line x1="0" y1="3" x2="20" y2="3" stroke={blackLine} strokeWidth="1.5" strokeDasharray="2 3" />
            </svg>
            <span>Prev Week</span>
          </div>
        )}
        {es7Config.showDailyValues && (
          <div className="flex items-center gap-1.5">
            <svg width="20" height="6">
              <line x1="0" y1="3" x2="20" y2="3" stroke={blackLine} strokeWidth="1.5" strokeDasharray="8 4" />
            </svg>
            <span>Daily</span>
          </div>
        )}
      </div>

      {/* Chart */}
      <div ref={chartRef} className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 20, bottom: 10, left: 10 }}
          >
            <defs>
              <linearGradient id="es7QuotaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accentFill} stopOpacity={0.35} />
                <stop offset="100%" stopColor={accentFill} stopOpacity={0.08} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke={gridColor}
              vertical={false}
            />

            <XAxis
              dataKey="slotIndex"
              tickFormatter={(idx: number) => slots[idx]?.label || ""}
              tick={{ fontSize: 11, fill: labelColor }}
              stroke={gridColor}
              interval={0}
            />

            <YAxis
              domain={yDomain}
              tick={{ fontSize: 11, fill: labelColor }}
              stroke={gridColor}
              width={50}
              tickFormatter={(v: number) =>
                isMoney ? `$${v.toLocaleString()}` : isPercentage ? `${v}%` : v.toLocaleString()
              }
            />

            <Tooltip
              content={
                <ES7Tooltip
                  isMoney={isMoney}
                  isPercentage={isPercentage}
                  slots={slots}
                />
              }
            />

            {/* Quota area — shaded fill under the quota line */}
            <Area
              type="monotone"
              dataKey="quota"
              fill="url(#es7QuotaGradient)"
              stroke={blackLine}
              strokeWidth={1.5}
              dot={false}
              activeDot={false}
              connectNulls
              name="Quota"
            />

            {/* Previous week overlay — dotted line */}
            {es7Config.showPrevWeek && (
              <Line
                type="monotone"
                dataKey="prevCumulative"
                stroke={blackLine}
                strokeWidth={1.5}
                strokeDasharray="2 3"
                dot={false}
                activeDot={false}
                connectNulls
                name="Prev Week"
              />
            )}

            {/* Daily values — dashed line */}
            {es7Config.showDailyValues && (
              <Line
                type="monotone"
                dataKey="daily"
                stroke={accentFill}
                strokeWidth={1.5}
                strokeDasharray="8 4"
                dot={{ r: 3, fill: accentFill, stroke: accentFill }}
                activeDot={{ r: 5 }}
                connectNulls
                name="Daily"
              />
            )}

            {/* Cumulative stat line — solid black, on top */}
            <Line
              type="monotone"
              dataKey="cumulative"
              stroke={blackLine}
              strokeWidth={2.5}
              dot={{ r: 4, fill: blackLine, stroke: blackLine }}
              activeDot={{ r: 6 }}
              connectNulls
              name="Cumulative"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
