"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useAppContext, useAccentColor } from "@/context/AppContext";
import { useTheme } from "next-themes";
import { getDisplayName } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { getWeekEndingDateForDate, parseDateKey, isSplitBoundaryDay, formatBoundaryHour } from "@/lib/dateUtils";
import type { StatPeriodType, WeekSettings, StatsViewConfig } from "@/lib/types";

function formatValue(value: number, isMoney: boolean, isPercentage: boolean): string {
  const formatted = value.toLocaleString();
  if (isMoney && isPercentage) return `$${formatted}%`;
  if (isMoney) return `$${formatted}`;
  if (isPercentage) return `${formatted}%`;
  return formatted;
}

function getDateRange(config: StatsViewConfig): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().split("T")[0];

  if (config.rangePreset === "custom") {
    if (config.customStart && config.customEnd) {
      return { start: config.customStart, end: config.customEnd };
    }
    // Custom selected but dates not yet chosen — show last 30 days
    const fallback = new Date(now);
    fallback.setDate(fallback.getDate() - 30);
    return { start: fallback.toISOString().split("T")[0], end };
  }

  const preset = config.rangePreset;
  let start = new Date(now);
  if (preset.endsWith("d")) {
    start.setDate(start.getDate() - parseInt(preset));
  } else if (preset.endsWith("w")) {
    start.setDate(start.getDate() - parseInt(preset) * 7);
  } else if (preset.endsWith("m")) {
    start.setMonth(start.getMonth() - parseInt(preset));
  } else {
    start.setDate(start.getDate() - 30);
  }

  return {
    start: start.toISOString().split("T")[0],
    end,
  };
}

function formatXLabel(date: string, periodType: StatPeriodType, weekSettings?: WeekSettings): string {
  const { baseDate, isSecondHalf } = parseDateKey(date);
  const d = new Date(baseDate + "T00:00:00");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  if (periodType === "daily") {
    const label = `${d.getDate()} ${months[d.getMonth()]}`;
    // For split boundary days, add a subtle marker on the second half
    if (isSecondHalf) return `${label}'`;
    return label;
  } else if (periodType === "weekly") {
    return `${d.getDate()} ${months[d.getMonth()]}`;
  } else {
    return `${months[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
  }
}

function shiftDate(dateStr: string, offsetPeriods: number, periodType: StatPeriodType): string {
  const d = new Date(dateStr + "T00:00:00");
  if (periodType === "daily") d.setDate(d.getDate() + offsetPeriods);
  else if (periodType === "weekly") d.setDate(d.getDate() + offsetPeriods * 7);
  else d.setMonth(d.getMonth() + offsetPeriods);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label, isMoney, isPercentage, overlayStatName, overlayIsMoney, overlayIsPercentage, overlayColor, overlayOffset, periodType, weekSettings }: any) {
  if (!active || !payload || !payload.length) return null;

  const { baseDate, isSecondHalf } = parseDateKey(label);
  const d = new Date(baseDate + "T00:00:00");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Split-day boundary label
  let splitLabel = "";
  if (weekSettings && periodType === "daily") {
    if (isSecondHalf) {
      splitLabel = ` (from ${formatBoundaryHour(weekSettings.weekStartHour)})`;
    } else if (isSplitBoundaryDay(d.getDay(), weekSettings)) {
      splitLabel = ` (to ${formatBoundaryHour(weekSettings.weekStartHour)})`;
    }
  }

  // Find primary value (from "value" or "currentValue")
  const primaryEntry = payload.find((p: { dataKey: string }) => p.dataKey === "value" || p.dataKey === "currentValue");
  const rawValue = primaryEntry?.value;

  // Find overlay value
  const overlayEntry = payload.find((p: { dataKey: string }) => p.dataKey === "overlayValue");
  const overlayValue = overlayEntry?.value;

  // Compute the overlay's original (un-shifted) date when offset ≠ 0
  let overlayOriginalDate = "";
  if (overlayValue != null && overlayOffset && overlayOffset !== 0 && periodType) {
    const origDateStr = shiftDate(baseDate, overlayOffset, periodType);
    const od = new Date(origDateStr + "T00:00:00");
    overlayOriginalDate = `${od.getDate()} ${months[od.getMonth()]} ${od.getFullYear()}`;
  }

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg shadow-lg px-3 py-2">
      <p className="text-xs text-stone-500 dark:text-stone-400">
        {days[d.getDay()]} {d.getDate()} {months[d.getMonth()]} {d.getFullYear()}{splitLabel}
      </p>
      <p className="text-sm font-semibold text-stone-800 dark:text-stone-200 mt-0.5">
        {rawValue != null ? formatValue(Number(rawValue), !!isMoney, !!isPercentage) : "—"}
      </p>
      {overlayValue != null && overlayStatName && (
        <div className="mt-1.5 pt-1.5 border-t border-stone-200 dark:border-stone-700">
          <p className="text-xs font-medium" style={{ color: overlayColor }}>
            {overlayStatName}
          </p>
          <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">
            {formatValue(Number(overlayValue), !!overlayIsMoney, !!overlayIsPercentage)}
          </p>
          {overlayOriginalDate && (
            <p className="text-xs text-stone-400 dark:text-stone-500">
              (actual: {overlayOriginalDate})
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CompositeTooltip({ active, payload, label, linkedStats, isDark, weekSettings, periodType }: any) {
  if (!active || !payload || !payload.length) return null;

  const { baseDate, isSecondHalf } = parseDateKey(label);
  const d = new Date(baseDate + "T00:00:00");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dashArrays = ["none", "6 3", "2 2"];

  let splitLabel = "";
  if (weekSettings && periodType === "daily") {
    if (isSecondHalf) {
      splitLabel = ` (from ${formatBoundaryHour(weekSettings.weekStartHour)})`;
    } else if (isSplitBoundaryDay(d.getDay(), weekSettings)) {
      splitLabel = ` (to ${formatBoundaryHour(weekSettings.weekStartHour)})`;
    }
  }

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg shadow-lg px-3 py-2">
      <p className="text-xs text-stone-500 dark:text-stone-400">
        {days[d.getDay()]} {d.getDate()} {months[d.getMonth()]} {d.getFullYear()}{splitLabel}
      </p>
      {(linkedStats || []).map((ls: { id: string; name: string; isMoney?: boolean; isPercentage?: boolean }, i: number) => {
        const entry = payload.find((p: { dataKey: string }) => p.dataKey === `line${i + 1}Value`);
        const value = entry?.value;
        if (value == null) return null;
        return (
          <div key={ls.id} className={`${i > 0 ? "mt-1 pt-1 border-t border-stone-200 dark:border-stone-700" : "mt-1"}`}>
            <div className="flex items-center gap-1.5">
              <svg width="14" height="6">
                <line x1="0" y1="3" x2="14" y2="3"
                  stroke={isDark ? "#e7e5e4" : "#1c1917"} strokeWidth="1.5"
                  strokeDasharray={dashArrays[i]} />
              </svg>
              <span className="text-[10px] text-stone-500 dark:text-stone-400">{ls.name}</span>
            </div>
            <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">
              {formatValue(Number(value), !!ls.isMoney, !!ls.isPercentage)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export default function StatGraph() {
  const { state, dispatch } = useAppContext();
  const accent = useAccentColor();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const chartRef = useRef<HTMLDivElement>(null);

  const config = state.statsViewConfig;
  const showLabels = config.showLabels ?? false;
  const [lineThickness, setLineThickness] = useState<0 | 1 | 2>(0); // 0=normal, 1=thick, 2=thickest
  const [isPrinting, setIsPrinting] = useState(false);
  const printCallbackRef = useRef<(() => void) | null>(null);
  const labelColor = isDark ? "#d6d3d1" : "#44403c";
  const entries = state.selectedStatId ? state.statEntries[state.selectedStatId] || [] : [];

  // Formatting flags for selected stat
  const selectedStat = state.statDefinitions.find(s => s.id === state.selectedStatId);
  const isMoney = selectedStat?.isMoney ?? false;
  const isPercentage = selectedStat?.isPercentage ?? false;
  const isInverted = selectedStat?.isInverted ?? false;

  // Overlay state
  const overlayConfig = state.overlayConfig;
  const overlayStat = overlayConfig ? state.statDefinitions.find(s => s.id === overlayConfig.statId) : null;
  const overlayEntries = overlayConfig ? state.statEntries[overlayConfig.statId] || [] : [];
  const overlayIsMoney = overlayStat?.isMoney ?? false;
  const overlayIsPercentage = overlayStat?.isPercentage ?? false;
  const overlayIsInverted = overlayStat?.isInverted ?? false;
  const overlayLineColor = accent.swatch;

  // Composite stat detection
  const isComposite = !!selectedStat?.linkedStatIds?.length;
  const linkedStatIds = selectedStat?.linkedStatIds || [];
  const linkedStats = linkedStatIds.map(id => state.statDefinitions.find(s => s.id === id)).filter(Boolean) as typeof state.statDefinitions;

  // Line/dot sizing (3 levels)
  const lineWidth = [2, 3.5, 5.5][lineThickness];
  const dotRadius = [4, 6, 8][lineThickness];
  const activeDotRadius = [6, 8, 10][lineThickness];
  const currentDotRadius = [6, 8, 10][lineThickness];
  const currentActiveDotRadius = [8, 10, 12][lineThickness];

  // When isPrinting becomes true, wait for Recharts to re-render without current point, then execute print
  useEffect(() => {
    if (isPrinting && printCallbackRef.current) {
      const fn = printCallbackRef.current;
      printCallbackRef.current = null;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          fn();
          setIsPrinting(false);
        });
      });
    }
  }, [isPrinting]);

  // Graph color mode
  const useAccentForLines = state.statGraphUseAccentColor;
  const upColor = useAccentForLines ? accent.swatch : (state.statGraphUpColor || (isDark ? "#e7e5e4" : "#1c1917"));
  const downColor = useAccentForLines ? accent.swatch : (state.statGraphDownColor || "#ef4444");

  const { start, end } = useMemo(() => getDateRange(config), [config]);

  const weekEndDay = state.weekSettings.weekEndDay;
  const weekSettings = state.weekSettings;

  const { completedData, currentPoint, rangeKey } = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    // Use base date (strip .2 suffix) for range comparison so split-day entries are included
    const filtered = entries.filter(
      (e) => {
        const base = parseDateKey(e.date).baseDate;
        return base >= start && base <= end && e.periodType === config.periodType;
      }
    );

    // Sort by date (the .2 suffix sorts correctly between base date and next day)
    const sorted = [...filtered].sort((a, b) => a.date.localeCompare(b.date));

    // Split: current period is the last data point if it matches today (or current week/month)
    let completed = sorted;
    let current = null;

    if (sorted.length > 0) {
      const last = sorted[sorted.length - 1];
      const { baseDate: lastBaseDate } = parseDateKey(last.date);
      const lastDate = new Date(lastBaseDate + "T00:00:00");
      const todayDate = new Date(today + "T00:00:00");
      let isCurrent = false;

      if (config.periodType === "daily") {
        isCurrent = lastBaseDate === today;
      } else if (config.periodType === "weekly") {
        // Normalize both dates to their week-ending date, then compare
        const lastWeekEnd = getWeekEndingDateForDate(lastDate, weekEndDay);
        const todayWeekEnd = getWeekEndingDateForDate(todayDate, weekEndDay);
        isCurrent = lastWeekEnd.getTime() === todayWeekEnd.getTime();
      } else {
        isCurrent =
          lastDate.getFullYear() === todayDate.getFullYear() &&
          lastDate.getMonth() === todayDate.getMonth();
      }

      if (isCurrent) {
        // Only show current-period dot if value is entered and non-zero
        if (last.value && last.value !== 0) {
          current = { date: last.date, value: last.value };
        }
        completed = sorted.slice(0, -1);
      }
    }

    const key = `${start}-${end}-${config.periodType}-${sorted.length}`;
    return { completedData: completed, currentPoint: current, rangeKey: key };
  }, [entries, start, end, config.periodType, weekEndDay]);

  // Build chart data: completed entries have "value", current point has "currentValue"
  const chartData = useMemo(() => {
    const data = completedData.map((e) => ({
      date: e.date,
      value: e.value,
      currentValue: undefined as number | undefined,
    }));
    if (currentPoint && !isPrinting) {
      data.push({
        date: currentPoint.date,
        value: undefined as unknown as number,
        currentValue: currentPoint.value,
      });
    }
    return data;
  }, [completedData, currentPoint, isPrinting]);

  // Build overlay chart data: filter, shift dates, and clip to visible range
  const overlayChartData = useMemo(() => {
    if (!overlayConfig || overlayEntries.length === 0) return [];
    const filtered = overlayEntries.filter((e) => e.periodType === config.periodType);
    // Shift each date by -offset (positive offset shifts overlay forward visually)
    const shifted = filtered.map((e) => ({
      date: shiftDate(parseDateKey(e.date).baseDate, -overlayConfig.offsetPeriods, config.periodType),
      value: e.value,
    }));
    // Filter to visible range
    return shifted
      .filter((e) => e.date >= start && e.date <= end)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [overlayConfig, overlayEntries, config.periodType, start, end]);

  // Merge primary and overlay data into a single array keyed by date
  const mergedChartData = useMemo(() => {
    if (overlayChartData.length === 0) return chartData;

    const dateMap = new Map<string, { date: string; value?: number; currentValue?: number; overlayValue?: number }>();

    for (const d of chartData) {
      dateMap.set(d.date, { ...d });
    }

    for (const d of overlayChartData) {
      const existing = dateMap.get(d.date);
      if (existing) {
        existing.overlayValue = d.value;
      } else {
        dateMap.set(d.date, { date: d.date, value: undefined, currentValue: undefined, overlayValue: d.value });
      }
    }

    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [chartData, overlayChartData]);

  // Build composite chart data: merge entries from all linked stats into { date, line1Value, line2Value, line3Value }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const compositeChartData = useMemo((): Record<string, any>[] => {
    if (!isComposite || linkedStats.length === 0) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dateMap = new Map<string, Record<string, any>>();

    for (let i = 0; i < linkedStats.length; i++) {
      const ls = linkedStats[i];
      const lsEntries = state.statEntries[ls.id] || [];
      const filtered = lsEntries.filter(
        (e) => {
          const base = parseDateKey(e.date).baseDate;
          return base >= start && base <= end && e.periodType === config.periodType;
        }
      );
      for (const e of filtered) {
        const existing = dateMap.get(e.date) || { date: e.date };
        existing[`line${i + 1}Value`] = e.value;
        dateMap.set(e.date, existing);
      }
    }

    return Array.from(dateMap.values()).sort((a, b) =>
      String(a.date).localeCompare(String(b.date))
    );
  }, [isComposite, linkedStats, state.statEntries, start, end, config.periodType]);

  // Build segmented stroke gradients for composite lines
  const compositeGradients = useMemo(() => {
    if (!isComposite || compositeChartData.length < 2) return [];
    return linkedStats.map((ls, lineIdx) => {
      const key = `line${lineIdx + 1}Value`;
      const lineInverted = !!ls.isInverted;
      const n = compositeChartData.length;
      const stops: { offset: number; color: string }[] = [];
      for (let i = 0; i < n - 1; i++) {
        const curr = compositeChartData[i]?.[key] as number | undefined;
        const next = compositeChartData[i + 1]?.[key] as number | undefined;
        if (curr == null || next == null) {
          const startOffset = i / (n - 1);
          const endOffset = (i + 1) / (n - 1);
          stops.push({ offset: startOffset, color: upColor });
          stops.push({ offset: endOffset, color: upColor });
          continue;
        }
        const isGood = lineInverted ? next <= curr : next >= curr;
        const color = isGood ? upColor : downColor;
        const startOffset = i / (n - 1);
        const endOffset = (i + 1) / (n - 1);
        stops.push({ offset: startOffset, color });
        stops.push({ offset: endOffset, color });
      }
      return { id: `compositeGradient${lineIdx}`, stops };
    });
  }, [isComposite, compositeChartData, linkedStats, upColor, downColor]);

  // Build segmented stroke gradient (only when NOT using accent color — i.e. up/down mode)
  const strokeGradientId = "statStrokeGradient";
  const strokeGradientStops = useMemo(() => {
    if (useAccentForLines) return null; // accent mode uses uniform color
    if (completedData.length < 2) return null;
    const n = completedData.length;
    const stops: { offset: number; color: string }[] = [];
    for (let i = 0; i < n - 1; i++) {
      const color = completedData[i + 1].value >= completedData[i].value ? upColor : downColor;
      const startOffset = i / (n - 1);
      const endOffset = (i + 1) / (n - 1);
      stops.push({ offset: startOffset, color });
      stops.push({ offset: endOffset, color });
    }
    return stops;
  }, [completedData, upColor, downColor, useAccentForLines]);

  // Compute Y-axis domain
  const yDomain = useMemo(() => {
    if (!config.yAxisAuto) {
      return [config.yAxisMin ?? 0, config.yAxisMax ?? "auto"] as [number | string, number | string];
    }
    return ["auto", "auto"] as [string, string];
  }, [config.yAxisAuto, config.yAxisMin, config.yAxisMax]);

  // Compute right Y-axis domain
  const yDomainRight = useMemo(() => {
    const rightAuto = config.yAxisRightAuto ?? true;
    if (!rightAuto) {
      return [config.yAxisRightMin ?? 0, config.yAxisRightMax ?? "auto"] as [number | string, number | string];
    }
    return ["auto", "auto"] as [string, string];
  }, [config.yAxisRightAuto, config.yAxisRightMin, config.yAxisRightMax]);

  const gridColor = isDark ? "#44403c" : "#e7e5e4";
  const fillGradientId = "statFillGradient";

  // Rotate x-axis labels when there are too many data points
  const shouldRotateXLabels = mergedChartData.length > 15;

  // Dot fill color — accent.swatch in accent mode, upColor in up/down mode
  const dotColor = useAccentForLines ? accent.swatch : upColor;

  // Custom dot renderer — hides dots at zero / undefined / NaN
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderDot = useCallback((props: any) => {
    const { cx, cy, value, key } = props;
    if (!value || value === 0 || typeof value !== "number" || isNaN(value)) return <g key={key} />;
    return (
      <circle
        key={key}
        cx={cx}
        cy={cy}
        r={dotRadius}
        fill={dotColor}
        stroke={isDark ? "#1c1917" : "#ffffff"}
        strokeWidth={2}
      />
    );
  }, [dotColor, isDark, dotRadius]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderActiveDot = useCallback((props: any) => {
    const { cx, cy, value, key } = props;
    if (!value || value === 0 || typeof value !== "number" || isNaN(value)) return <g key={key} />;
    return (
      <circle
        key={key}
        cx={cx}
        cy={cy}
        r={activeDotRadius}
        fill={dotColor}
        stroke={isDark ? "#1c1917" : "#ffffff"}
        strokeWidth={2}
      />
    );
  }, [dotColor, isDark, activeDotRadius]);

  // Compute the chart's top margin (in pixels) to detect when labels are near the top edge
  const chartTopMargin = showLabels ? 50 : 10;

  // Custom label renderer for data point values
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderLabel = useCallback((props: any) => {
    const { x, y, value } = props;
    if (!value || value === 0 || typeof value !== "number" || isNaN(value)) return null;
    const text = formatValue(Number(value), isMoney, isPercentage);
    const digitCount = String(Math.abs(Math.round(Number(value)))).length + (isMoney ? 1 : 0) + (isPercentage ? 1 : 0);
    const needsRotation = digitCount > 2;

    // Determine if the label is near the top of the chart area
    const nearTop = y < chartTopMargin + 30;

    if (needsRotation) {
      if (nearTop) {
        // Place below the dot — text extends downward (textAnchor="end" after -90° rotation)
        return (
          <g transform={`translate(${x}, ${y + 18}) rotate(-90)`}>
            <text
              textAnchor="end"
              fill={labelColor}
              fontSize={10}
              fontFamily="system-ui, sans-serif"
              dy={4}
            >
              {text}
            </text>
          </g>
        );
      }
      // Place above the dot — text extends upward (textAnchor="start" after -90° rotation)
      return (
        <g transform={`translate(${x}, ${y - 18}) rotate(-90)`}>
          <text
            textAnchor="start"
            fill={labelColor}
            fontSize={10}
            fontFamily="system-ui, sans-serif"
            dy={4}
          >
            {text}
          </text>
        </g>
      );
    }

    // 1-2 digit numbers — horizontal, above or below depending on position
    if (nearTop) {
      return (
        <text
          x={x}
          y={y + 20}
          textAnchor="middle"
          fill={labelColor}
          fontSize={10}
          fontFamily="system-ui, sans-serif"
        >
          {text}
        </text>
      );
    }
    return (
      <text
        x={x}
        y={y - 12}
        textAnchor="middle"
        fill={labelColor}
        fontSize={10}
        fontFamily="system-ui, sans-serif"
      >
        {text}
      </text>
    );
  }, [labelColor, chartTopMargin, isMoney, isPercentage]);

  // Build print-only chart data: exclude the current period point, include overlay
  const printChartData = useMemo(() => {
    const base = completedData.map((e) => ({
      date: e.date,
      value: e.value,
      currentValue: undefined as number | undefined,
      overlayValue: undefined as number | undefined,
    }));
    if (overlayChartData.length === 0) return base;

    // Merge overlay into print data
    const dateMap = new Map<string, { date: string; value?: number; currentValue?: number; overlayValue?: number }>();
    for (const d of base) dateMap.set(d.date, { ...d });
    for (const d of overlayChartData) {
      const existing = dateMap.get(d.date);
      if (existing) {
        existing.overlayValue = d.value;
      } else {
        dateMap.set(d.date, { date: d.date, value: undefined, currentValue: undefined, overlayValue: d.value });
      }
    }
    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [completedData, overlayChartData]);

  // Core print logic — captures the current SVG and opens print dialog
  const executePrint = useCallback(() => {
    const svgElement = chartRef.current?.querySelector("svg");
    if (!svgElement) return;

    // Clone SVG and make it scalable to fill the page
    const svgClone = svgElement.cloneNode(true) as SVGElement;
    const rect = svgElement.getBoundingClientRect();
    if (!svgClone.getAttribute("viewBox")) {
      svgClone.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
    }
    svgClone.setAttribute("width", "100%");
    svgClone.setAttribute("height", "100%");
    svgClone.removeAttribute("style");

    const isPortrait = printChartData.length <= 12;
    const orientation = isPortrait ? "portrait" : "landscape";

    if (isPortrait) {
      // Stretch SVG to fill the full portrait page
      svgClone.setAttribute("preserveAspectRatio", "none");

      // Counter-scale text so axis labels/numbers don't distort.
      const yFactor = (7.5 / 9.5) * (rect.height / rect.width);

      svgClone.querySelectorAll("text").forEach((textEl) => {
        const x = parseFloat(textEl.getAttribute("x") || "0");
        const y = parseFloat(textEl.getAttribute("y") || "0");
        const existing = textEl.getAttribute("transform") || "";
        const fix = `translate(${x},${y}) scale(1,${yFactor.toFixed(4)}) translate(${-x},${-y})`;
        textEl.setAttribute("transform", existing ? `${fix} ${existing}` : fix);
      });
    } else {
      svgClone.setAttribute("preserveAspectRatio", "xMidYMid meet");
    }

    let svgData = new XMLSerializer().serializeToString(svgClone);

    // Force light-mode colors for printing (dark colors look bad on white paper)
    if (isDark) {
      // Two-pass replacement to avoid collisions (some dark values equal other light targets)
      const darkToLight: [string, string][] = [
        ["#e7e5e4", "#1c1917"],  // line strokes / default up color
        ["#d6d3d1", "#44403c"],  // label color
        ["#a8a29e", "#78716c"],  // tick fills
        ["#44403c", "#e7e5e4"],  // grid lines
        ["#1c1917", "#ffffff"],  // dot outline strokes
      ];
      darkToLight.forEach(([dark], i) => {
        svgData = svgData.replaceAll(dark, `__CLR${i}__`);
      });
      darkToLight.forEach(([, light], i) => {
        svgData = svgData.replaceAll(`__CLR${i}__`, light);
      });
    }

    const stat = state.statDefinitions.find(s => s.id === state.selectedStatId);
    const statName = stat?.name || "Stat Graph";

    // Build subtitle with div/dept/post title/user info
    let subtitle = "";
    if (stat) {
      const parts: string[] = [];
      if (stat.userDivision != null) parts.push(`Div ${stat.userDivision}`);
      if (stat.userDepartment != null) parts.push(`Dept ${stat.userDepartment}`);
      if (stat.userPostTitle) parts.push(stat.userPostTitle);
      const userName = getDisplayName({
        username: stat.userName || "Unknown",
        firstName: stat.userFirstName,
        lastName: stat.userLastName,
      });
      parts.push(userName);
      subtitle = parts.join(" \u00B7 ");
    }

    // Append overlay or composite info to subtitle
    if (isComposite && linkedStats.length > 0) {
      subtitle += ` | Lines: ${linkedStats.map(ls => ls.name).join(", ")}`;
    } else if (overlayStat && overlayConfig) {
      const offsetVal = overlayConfig.offsetPeriods;
      const unit = config.periodType === "daily" ? "d" : config.periodType === "weekly" ? "w" : "m";
      const offsetStr = offsetVal !== 0 ? ` (${offsetVal > 0 ? "+" : ""}${offsetVal}${unit})` : "";
      subtitle += ` | Overlay: ${overlayStat.name}${offsetStr}`;
    }

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "-9999px";
    iframe.style.top = "-9999px";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }

    doc.open();
    doc.write(`<!DOCTYPE html><html><head><title>${statName}</title>
<style>
  @page { size: letter ${orientation}; margin: 0; }
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; font-family: system-ui, sans-serif; }
  .container { width: 100%; height: 100%; padding: 0.5in; box-sizing: border-box; display: flex; flex-direction: column; }
  h1 { font-size: 20px; margin: 0 0 2px 0; color: #1c1917; flex-shrink: 0; }
  .subtitle { font-size: 13px; color: #78716c; margin: 0 0 10px 0; flex-shrink: 0; }
  .chart { flex: 1; min-height: 0; }
  .chart svg { width: 100%; height: 100%; display: block; }
</style></head><body>
<div class="container">
  <h1>${statName}</h1>
  ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ""}
  <div class="chart">${svgData}</div>
</div>
</body></html>`);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 250);
  }, [state.selectedStatId, state.statDefinitions, printChartData.length, overlayStat, overlayConfig, config.periodType]);

  // Print handler — temporarily removes current-period dot, captures SVG, then restores
  const handlePrint = useCallback(() => {
    if (!chartRef.current) return;

    if (currentPoint) {
      // Set isPrinting=true to trigger re-render without current point.
      // The useEffect above will fire after re-render, wait for paint, then call executePrint.
      printCallbackRef.current = executePrint;
      setIsPrinting(true);
    } else {
      // No current point to remove — print directly
      executePrint();
    }
  }, [currentPoint, executePrint]);

  if (!state.selectedStatId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-stone-400 dark:text-stone-500 text-sm">Select a stat to view its graph</p>
      </div>
    );
  }

  // No data check — for composites, check compositeChartData; for normal, check chartData
  const hasNoData = isComposite ? compositeChartData.length === 0 : (chartData.length === 0 && !currentPoint);
  if (hasNoData) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            className="mx-auto text-stone-300 dark:text-stone-600 mb-3"
          >
            <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M7 16l4-8 4 4 5-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-stone-400 dark:text-stone-500 text-sm">No data yet</p>
          <p className="text-stone-400 dark:text-stone-600 text-xs mt-1">
            Enter data to see your graph
          </p>
        </div>
      </div>
    );
  }

  // Determine current point dot color
  const currentDotColor = (() => {
    if (useAccentForLines) return accent.swatch;
    if (!currentPoint) return upColor;
    if (completedData.length === 0) return upColor;
    const lastVal = completedData[completedData.length - 1].value;
    return currentPoint.value >= lastVal ? upColor : downColor;
  })();

  // For composite, compute rotate based on compositeChartData length
  const compositeRotateXLabels = compositeChartData.length > 15;
  const effectiveRotateXLabels = isComposite ? compositeRotateXLabels : shouldRotateXLabels;

  // Composite: formatting for left axis (line 1) and right axis (line 2)
  const compositeLine1Stat = linkedStats[0];
  const compositeLine2Stat = linkedStats[1];
  const line1IsMoney = compositeLine1Stat?.isMoney ?? false;
  const line1IsPercentage = compositeLine1Stat?.isPercentage ?? false;
  const line1IsInverted = compositeLine1Stat?.isInverted ?? false;
  const line2IsMoney = compositeLine2Stat?.isMoney ?? false;
  const line2IsPercentage = compositeLine2Stat?.isPercentage ?? false;
  const line2IsInverted = compositeLine2Stat?.isInverted ?? false;

  const compositeDashArrays = ["0", "8 4", "2 3"];
  const compositeLineStrokeColor = isDark ? "#e7e5e4" : "#1c1917";

  return (
    <div className="flex-1 animate-fade-in flex flex-col min-h-0" key={rangeKey}>
      {/* Graph toolbar buttons — above the chart */}
      <div className="flex items-center gap-0.5 mb-1 shrink-0">
        {/* Left side: composite legend OR overlay controls */}
        <div className="flex items-center gap-1.5 mr-auto">
          {isComposite ? (
            /* Composite legend */
            <div className="flex items-center gap-3 text-xs text-stone-600 dark:text-stone-300">
              {linkedStats.map((ls, i) => (
                <span key={ls.id} className="flex items-center gap-1.5">
                  <svg width="20" height="8">
                    <line x1="0" y1="4" x2="20" y2="4"
                      stroke={compositeLineStrokeColor} strokeWidth="2"
                      strokeDasharray={compositeDashArrays[i]} />
                  </svg>
                  <span>{ls.name}</span>
                </span>
              ))}
            </div>
          ) : (
            /* Overlay controls */
            <>
              <select
                value={overlayConfig?.statId || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    dispatch({ type: "SET_OVERLAY_CONFIG", payload: null });
                  } else {
                    dispatch({ type: "SET_OVERLAY_CONFIG", payload: { statId: val, offsetPeriods: 0 } });
                  }
                }}
                className="text-xs bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded px-1.5 py-1 text-stone-700 dark:text-stone-300 outline-none max-w-[140px]"
                title="Select overlay stat"
              >
                <option value="">No overlay</option>
                {state.statDefinitions
                  .filter((sd) => sd.id !== state.selectedStatId && !sd.linkedStatIds?.length)
                  .map((sd) => (
                    <option key={sd.id} value={sd.id}>{sd.name}</option>
                  ))}
              </select>

              {overlayConfig && (
                <>
                  <button
                    onClick={() => dispatch({ type: "SET_OVERLAY_OFFSET", payload: overlayConfig.offsetPeriods - 1 })}
                    className="p-0.5 rounded text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                    title="Shift overlay earlier"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                  <button
                    onClick={() => dispatch({ type: "SET_OVERLAY_OFFSET", payload: 0 })}
                    className="text-xs font-mono px-1 py-0.5 rounded hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-stone-600 dark:text-stone-400 min-w-[32px] text-center"
                    title="Reset offset to 0"
                  >
                    {overlayConfig.offsetPeriods > 0 ? "+" : ""}{overlayConfig.offsetPeriods}{config.periodType === "daily" ? "d" : config.periodType === "weekly" ? "w" : "m"}
                  </button>
                  <button
                    onClick={() => dispatch({ type: "SET_OVERLAY_OFFSET", payload: overlayConfig.offsetPeriods + 1 })}
                    className="p-0.5 rounded text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                    title="Shift overlay later"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                  <span className="text-xs font-medium ml-1" style={{ color: overlayLineColor }}>
                    {overlayStat?.name}
                  </span>
                </>
              )}
            </>
          )}
        </div>

        {/* Toggle data labels */}
        <button
          onClick={() => dispatch({ type: "SET_STATS_VIEW_CONFIG", payload: { showLabels: !showLabels } })}
          className={`p-1.5 rounded transition-colors ${
            showLabels
              ? "text-stone-700 dark:text-stone-200 bg-stone-100 dark:bg-stone-800"
              : "text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
          }`}
          title={showLabels ? "Hide data labels" : "Show data labels"}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7V4h16v3" />
            <path d="M9 20h6" />
            <path d="M12 4v16" />
          </svg>
        </button>
        {/* Cycle line thickness */}
        <button
          onClick={() => setLineThickness(((lineThickness + 1) % 3) as 0 | 1 | 2)}
          className={`p-1.5 rounded transition-colors ${
            lineThickness > 0
              ? "text-stone-700 dark:text-stone-200 bg-stone-100 dark:bg-stone-800"
              : "text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
          }`}
          title={["Normal lines", "Thick lines", "Thickest lines"][lineThickness]}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" strokeWidth="1.5" />
            <line x1="3" y1="13" x2="21" y2="13" strokeWidth={lineThickness >= 1 ? 3.5 : 2.5} />
            <line x1="3" y1="20" x2="21" y2="20" strokeWidth={lineThickness >= 2 ? 5.5 : 4} />
          </svg>
        </button>
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
      </div>

      <div ref={chartRef} className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          {isComposite ? (
            /* ===== COMPOSITE CHART ===== */
            <AreaChart
              data={compositeChartData}
              margin={{ top: showLabels ? 50 : 10, right: 10, left: 0, bottom: effectiveRotateXLabels ? 40 : 0 }}
            >
              <defs>
                {compositeGradients.map((g) => (
                  <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="1" y2="0">
                    {g.stops.map((stop, i) => (
                      <stop key={i} offset={stop.offset} stopColor={stop.color} />
                    ))}
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                dataKey="date"
                tickFormatter={(d) => formatXLabel(d, config.periodType, weekSettings)}
                tick={{
                  fontSize: 11,
                  fill: isDark ? "#a8a29e" : "#78716c",
                  ...(effectiveRotateXLabels ? { angle: -45, textAnchor: "end", dy: 8 } : {}),
                }}
                tickLine={false}
                axisLine={{ stroke: gridColor }}
                height={effectiveRotateXLabels ? 60 : 30}
              />
              {/* Left Y-axis: Line 1 */}
              <YAxis
                yAxisId="left"
                domain={yDomain}
                reversed={line1IsInverted}
                tickFormatter={(v) => formatValue(v, line1IsMoney, line1IsPercentage)}
                tick={{ fontSize: 11, fill: isDark ? "#a8a29e" : "#78716c" }}
                tickLine={false}
                axisLine={{ stroke: gridColor }}
                width={line1IsMoney || line1IsPercentage ? 65 : 50}
              />
              {/* Right Y-axis: Lines 2-3 */}
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={yDomainRight}
                reversed={line2IsInverted}
                tickFormatter={(v: number) => formatValue(v, line2IsMoney, line2IsPercentage)}
                tick={{ fontSize: 11, fill: isDark ? "#a8a29e" : "#78716c" }}
                tickLine={false}
                axisLine={{ stroke: gridColor, strokeDasharray: "4 3" }}
                width={line2IsMoney || line2IsPercentage ? 65 : 50}
              />
              <Tooltip content={<CompositeTooltip linkedStats={linkedStats} isDark={isDark} weekSettings={weekSettings} periodType={config.periodType} />} />
              {/* Line 1: solid, left axis */}
              <Area
                yAxisId="left"
                type="linear"
                dataKey="line1Value"
                stroke={useAccentForLines ? accent.swatch : (compositeGradients[0] ? `url(#${compositeGradients[0].id})` : upColor)}
                strokeWidth={lineWidth}
                fill="none"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                dot={(props: any) => {
                  const { cx, cy, value, key, index } = props;
                  if (!value || value === 0 || typeof value !== "number" || isNaN(value)) return <g key={key} />;
                  const prev = index > 0 ? compositeChartData[index - 1]?.line1Value as number | undefined : undefined;
                  const dotFill = useAccentForLines ? accent.swatch : (prev != null ? (line1IsInverted ? (value <= prev ? upColor : downColor) : (value >= prev ? upColor : downColor)) : upColor);
                  return <circle key={key} cx={cx} cy={cy} r={dotRadius} fill={dotFill} stroke={isDark ? "#1c1917" : "#ffffff"} strokeWidth={2} />;
                }}
                activeDot={false}
                isAnimationActive={!isPrinting}
                animationDuration={800}
                connectNulls={false}
              />
              {/* Line 2: dashed, right axis */}
              {linkedStats.length >= 2 && (
                <Area
                  yAxisId="right"
                  type="linear"
                  dataKey="line2Value"
                  stroke={useAccentForLines ? accent.swatch : (compositeGradients[1] ? `url(#${compositeGradients[1].id})` : upColor)}
                  strokeWidth={lineWidth}
                  strokeDasharray="8 4"
                  fill="none"
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  dot={(props: any) => {
                    const { cx, cy, value, key, index } = props;
                    if (!value || value === 0 || typeof value !== "number" || isNaN(value)) return <g key={key} />;
                    const prev = index > 0 ? compositeChartData[index - 1]?.line2Value as number | undefined : undefined;
                    const dotFill = useAccentForLines ? accent.swatch : (prev != null ? (line2IsInverted ? (value <= prev ? upColor : downColor) : (value >= prev ? upColor : downColor)) : upColor);
                    return <circle key={key} cx={cx} cy={cy} r={Math.max(dotRadius - 1, 3)} fill={dotFill} stroke={isDark ? "#1c1917" : "#ffffff"} strokeWidth={2} />;
                  }}
                  activeDot={false}
                  isAnimationActive={!isPrinting}
                  animationDuration={800}
                  connectNulls={false}
                />
              )}
              {/* Line 3: dotted, right axis */}
              {linkedStats.length >= 3 && (
                <Area
                  yAxisId="right"
                  type="linear"
                  dataKey="line3Value"
                  stroke={useAccentForLines ? accent.swatch : (compositeGradients[2] ? `url(#${compositeGradients[2].id})` : upColor)}
                  strokeWidth={lineWidth}
                  strokeDasharray="2 3"
                  fill="none"
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  dot={(props: any) => {
                    const { cx, cy, value, key, index } = props;
                    if (!value || value === 0 || typeof value !== "number" || isNaN(value)) return <g key={key} />;
                    const line3Inverted = linkedStats[2]?.isInverted ?? false;
                    const prev = index > 0 ? compositeChartData[index - 1]?.line3Value as number | undefined : undefined;
                    const dotFill = useAccentForLines ? accent.swatch : (prev != null ? (line3Inverted ? (value <= prev ? upColor : downColor) : (value >= prev ? upColor : downColor)) : upColor);
                    return <circle key={key} cx={cx} cy={cy} r={Math.max(dotRadius - 1, 3)} fill={dotFill} stroke={isDark ? "#1c1917" : "#ffffff"} strokeWidth={2} />;
                  }}
                  activeDot={false}
                  isAnimationActive={!isPrinting}
                  animationDuration={800}
                  connectNulls={false}
                />
              )}
            </AreaChart>
          ) : (
            /* ===== NORMAL (NON-COMPOSITE) CHART ===== */
            <AreaChart
              data={mergedChartData}
              margin={{ top: showLabels ? 50 : 10, right: overlayChartData.length > 0 ? 10 : 30, left: 0, bottom: shouldRotateXLabels ? 40 : 0 }}
            >
              <defs>
                {strokeGradientStops && (
                  <linearGradient id={strokeGradientId} x1="0" y1="0" x2="1" y2="0">
                    {strokeGradientStops.map((stop, i) => (
                      <stop key={i} offset={stop.offset} stopColor={stop.color} />
                    ))}
                  </linearGradient>
                )}
                <linearGradient id={fillGradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={accent.swatch} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={accent.swatch} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                dataKey="date"
                tickFormatter={(d) => formatXLabel(d, config.periodType, weekSettings)}
                tick={{
                  fontSize: 11,
                  fill: isDark ? "#a8a29e" : "#78716c",
                  ...(shouldRotateXLabels ? { angle: -45, textAnchor: "end", dy: 8 } : {}),
                }}
                tickLine={false}
                axisLine={{ stroke: gridColor }}
                height={shouldRotateXLabels ? 60 : 30}
              />
              <YAxis
                yAxisId="left"
                domain={yDomain}
                reversed={isInverted}
                tickFormatter={(v) => formatValue(v, isMoney, isPercentage)}
                tick={{ fontSize: 11, fill: isDark ? "#a8a29e" : "#78716c" }}
                tickLine={false}
                axisLine={{ stroke: gridColor }}
                width={isMoney || isPercentage ? 65 : 50}
              />
              {overlayChartData.length > 0 && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={yDomainRight}
                  reversed={overlayIsInverted}
                  tickFormatter={(v: number) => formatValue(v, overlayIsMoney, overlayIsPercentage)}
                  tick={{ fontSize: 11, fill: overlayLineColor }}
                  tickLine={false}
                  axisLine={{ stroke: overlayLineColor, strokeDasharray: "4 3" }}
                  width={overlayIsMoney || overlayIsPercentage ? 65 : 50}
                />
              )}
              <Tooltip content={<CustomTooltip isMoney={isMoney} isPercentage={isPercentage} overlayStatName={overlayStat?.name} overlayIsMoney={overlayIsMoney} overlayIsPercentage={overlayIsPercentage} overlayColor={overlayLineColor} overlayOffset={overlayConfig?.offsetPeriods} periodType={config.periodType} weekSettings={weekSettings} />} />
              <Area
                yAxisId="left"
                type="linear"
                dataKey="value"
                stroke={useAccentForLines ? accent.swatch : (strokeGradientStops ? `url(#${strokeGradientId})` : upColor)}
                strokeWidth={lineWidth}
                fill={useAccentForLines ? `url(#${fillGradientId})` : "none"}
                dot={renderDot}
                activeDot={renderActiveDot}
                isAnimationActive={!isPrinting}
                animationDuration={800}
                animationEasing="ease-out"
                connectNulls={false}
              >
                {showLabels && (
                  <LabelList dataKey="value" content={renderLabel} />
                )}
              </Area>
              {currentPoint && !isPrinting && (
                <Area
                  yAxisId="left"
                  type="linear"
                  dataKey="currentValue"
                  stroke="none"
                  fill="none"
                  dot={(props: { cx?: number; cy?: number; value?: number; payload?: { currentValue?: number } }) => {
                    const cx = props.cx;
                    const cy = props.cy;
                    const v = props.value ?? props.payload?.currentValue;
                    if (!cx || !cy || v === 0 || v === undefined || v === null) return <g />;
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={currentDotRadius}
                        fill={currentDotColor}
                        stroke={isDark ? "#1c1917" : "#ffffff"}
                        strokeWidth={2}
                      />
                    );
                  }}
                  activeDot={(props: { cx?: number; cy?: number; value?: number; payload?: { currentValue?: number } }) => {
                    const cx = props.cx;
                    const cy = props.cy;
                    const v = props.value ?? props.payload?.currentValue;
                    if (!cx || !cy || v === 0 || v === undefined || v === null) return <g />;
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={currentActiveDotRadius}
                        fill={currentDotColor}
                        stroke={isDark ? "#1c1917" : "#ffffff"}
                        strokeWidth={2}
                      />
                    );
                  }}
                  animationDuration={800}
                  animationEasing="ease-out"
                  connectNulls={false}
                />
              )}
              {overlayChartData.length > 0 && (
                <Area
                  yAxisId="right"
                  type="linear"
                  dataKey="overlayValue"
                  stroke={overlayLineColor}
                  strokeWidth={lineWidth}
                  strokeDasharray="8 4"
                  fill="none"
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  dot={(props: any) => {
                    const { cx, cy, value, key } = props;
                    if (!value || value === 0 || typeof value !== "number" || isNaN(value)) return <g key={key} />;
                    return (
                      <circle
                        key={key}
                        cx={cx}
                        cy={cy}
                        r={Math.max(dotRadius - 1, 3)}
                        fill={overlayLineColor}
                        stroke={isDark ? "#1c1917" : "#ffffff"}
                        strokeWidth={2}
                      />
                    );
                  }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  activeDot={(props: any) => {
                    const { cx, cy, value, key } = props;
                    if (!value || value === 0 || typeof value !== "number" || isNaN(value)) return <g key={key} />;
                    return (
                      <circle
                        key={key}
                        cx={cx}
                        cy={cy}
                        r={Math.max(activeDotRadius - 1, 5)}
                        fill={overlayLineColor}
                        stroke={isDark ? "#1c1917" : "#ffffff"}
                        strokeWidth={2}
                      />
                    );
                  }}
                  isAnimationActive={!isPrinting}
                  animationDuration={800}
                  animationEasing="ease-out"
                  connectNulls={false}
                />
              )}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
