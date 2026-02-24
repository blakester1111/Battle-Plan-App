"use client";

import { useAppContext, useAccentColor } from "@/context/AppContext";
import type { StatPeriodType } from "@/lib/types";

const PERIOD_PRESETS: Record<StatPeriodType, { value: string; label: string }[]> = {
  daily: [
    { value: "7d", label: "7d" },
    { value: "14d", label: "14d" },
    { value: "30d", label: "30d" },
    { value: "custom", label: "Custom" },
  ],
  weekly: [
    { value: "12w", label: "12w" },
    { value: "36w", label: "36w" },
    { value: "52w", label: "52w" },
    { value: "custom", label: "Custom" },
  ],
  monthly: [
    { value: "12m", label: "12m" },
    { value: "36m", label: "36m" },
    { value: "custom", label: "Custom" },
  ],
};

const PERIODS: { value: StatPeriodType; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export default function TimeRangeSelector() {
  const { state, dispatch } = useAppContext();
  const accent = useAccentColor();
  const config = state.statsViewConfig;

  function setPeriod(periodType: StatPeriodType) {
    const defaultPreset = PERIOD_PRESETS[periodType][0].value;
    dispatch({
      type: "SET_STATS_VIEW_CONFIG",
      payload: { periodType, rangePreset: defaultPreset, customStart: undefined, customEnd: undefined },
    });
  }

  function setPreset(preset: string) {
    dispatch({
      type: "SET_STATS_VIEW_CONFIG",
      payload: { rangePreset: preset },
    });
  }

  const presets = PERIOD_PRESETS[config.periodType];

  return (
    <div className="flex flex-col gap-2">
      {/* Period type tabs */}
      <div className="flex gap-1 p-0.5 bg-stone-100 dark:bg-stone-800 rounded-lg w-fit">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              config.periodType === p.value
                ? `${accent.bg} text-white`
                : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Range presets */}
      <div className="flex items-center gap-1.5">
        {presets.map((p) => (
          <button
            key={p.value}
            onClick={() => setPreset(p.value)}
            className={`px-2.5 py-0.5 text-xs rounded-full transition-colors ${
              config.rangePreset === p.value
                ? `${accent.bgSubtle} ${accent.text} font-medium`
                : "text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date pickers */}
      {config.rangePreset === "custom" && (
        <div className="flex items-center gap-2 mt-1">
          <input
            type="date"
            value={config.customStart || ""}
            onChange={(e) =>
              dispatch({
                type: "SET_STATS_VIEW_CONFIG",
                payload: { customStart: e.target.value },
              })
            }
            className="px-2 py-1 text-xs rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300"
          />
          <span className="text-xs text-stone-400">to</span>
          <input
            type="date"
            value={config.customEnd || ""}
            onChange={(e) =>
              dispatch({
                type: "SET_STATS_VIEW_CONFIG",
                payload: { customEnd: e.target.value },
              })
            }
            className="px-2 py-1 text-xs rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300"
          />
        </div>
      )}
    </div>
  );
}
