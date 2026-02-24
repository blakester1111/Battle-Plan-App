"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppContext, useAccentColor } from "@/context/AppContext";
import { statsApi, statEntriesApi } from "@/lib/api";
import { getDisplayName } from "@/lib/utils";
import StatsList from "./StatsList";
import StatGraph from "./StatGraph";
import TimeRangeSelector from "./TimeRangeSelector";
import YAxisControls from "./YAxisControls";
import StatEntryModal from "./StatEntryModal";

export default function StatsView() {
  const { state, dispatch } = useAppContext();
  const accent = useAccentColor();
  const [showEntryModal, setShowEntryModal] = useState(false);

  const selectedStat = state.statDefinitions.find((sd) => sd.id === state.selectedStatId);
  const config = state.statsViewConfig;
  const isComposite = !!selectedStat?.linkedStatIds?.length;
  const linkedStatIds = selectedStat?.linkedStatIds || [];
  const linkedStatNames = linkedStatIds.map(id => state.statDefinitions.find(s => s.id === id)?.name || "Unknown");

  // Re-fetch stat definitions when periodType changes (for updated trend data)
  useEffect(() => {
    let cancelled = false;
    async function refetch() {
      try {
        const data = await statsApi.getAll(config.periodType);
        if (!cancelled && data?.stats) {
          dispatch({ type: "SET_STAT_DEFINITIONS", payload: data.stats });
        }
      } catch (error) {
        console.error("Failed to refresh stat definitions:", error);
      }
    }
    refetch();
    return () => { cancelled = true; };
  }, [config.periodType, dispatch]);

  // Fetch entries when selected stat or date range changes
  const fetchEntries = useCallback(async () => {
    if (!state.selectedStatId) return;

    const now = new Date();
    let startDate: string;
    let endDate = now.toISOString().split("T")[0];

    if (config.rangePreset === "custom") {
      if (config.customStart && config.customEnd) {
        startDate = config.customStart;
        endDate = config.customEnd;
      } else {
        // Custom selected but dates not yet chosen — show last 30 days
        const fallback = new Date(now);
        fallback.setDate(fallback.getDate() - 30);
        startDate = fallback.toISOString().split("T")[0];
      }
    } else {
      const preset = config.rangePreset;
      const start = new Date(now);
      if (preset.endsWith("d")) {
        start.setDate(start.getDate() - parseInt(preset));
      } else if (preset.endsWith("w")) {
        start.setDate(start.getDate() - parseInt(preset) * 7);
      } else if (preset.endsWith("m")) {
        start.setMonth(start.getMonth() - parseInt(preset));
      } else {
        start.setDate(start.getDate() - 30);
      }
      startDate = start.toISOString().split("T")[0];
    }

    try {
      const { entries } = await statEntriesApi.getByStatId(state.selectedStatId, startDate, endDate);
      dispatch({ type: "SET_STAT_ENTRIES", payload: { statId: state.selectedStatId, entries: entries || [] } });
    } catch (error) {
      console.error("Failed to fetch entries:", error);
    }
  }, [state.selectedStatId, config.rangePreset, config.periodType, config.customStart, config.customEnd, dispatch]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Fetch entries for all linked stats when a composite stat is selected
  useEffect(() => {
    if (!isComposite || linkedStatIds.length === 0) return;
    let cancelled = false;

    async function fetchLinked() {
      const now = new Date();
      let startDate: string;
      let endDate = now.toISOString().split("T")[0];

      if (config.rangePreset === "custom") {
        if (config.customStart && config.customEnd) {
          startDate = config.customStart;
          endDate = config.customEnd;
        } else {
          const fallback = new Date(now);
          fallback.setDate(fallback.getDate() - 30);
          startDate = fallback.toISOString().split("T")[0];
        }
      } else {
        const preset = config.rangePreset;
        const start = new Date(now);
        if (preset.endsWith("d")) {
          start.setDate(start.getDate() - parseInt(preset));
        } else if (preset.endsWith("w")) {
          start.setDate(start.getDate() - parseInt(preset) * 7);
        } else if (preset.endsWith("m")) {
          start.setMonth(start.getMonth() - parseInt(preset));
        } else {
          start.setDate(start.getDate() - 30);
        }
        startDate = start.toISOString().split("T")[0];
      }

      for (const linkedId of linkedStatIds) {
        if (cancelled) break;
        try {
          const { entries } = await statEntriesApi.getByStatId(linkedId, startDate, endDate);
          if (!cancelled) {
            dispatch({ type: "SET_STAT_ENTRIES", payload: { statId: linkedId, entries: entries || [] } });
          }
        } catch (error) {
          console.error("Failed to fetch linked stat entries:", error);
        }
      }
    }
    fetchLinked();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComposite, linkedStatIds.join(","), config.rangePreset, config.periodType, config.customStart, config.customEnd, dispatch]);

  // Fetch overlay stat entries when overlay config changes (skip for composites)
  useEffect(() => {
    if (isComposite) return;
    const overlayStatId = state.overlayConfig?.statId;
    if (!overlayStatId) return;

    let cancelled = false;
    async function fetchOverlay() {
      const now = new Date();
      let startDate: string;
      let endDate = now.toISOString().split("T")[0];

      if (config.rangePreset === "custom") {
        if (config.customStart && config.customEnd) {
          startDate = config.customStart;
          endDate = config.customEnd;
        } else {
          const fallback = new Date(now);
          fallback.setDate(fallback.getDate() - 30);
          startDate = fallback.toISOString().split("T")[0];
        }
      } else {
        const preset = config.rangePreset;
        const start = new Date(now);
        if (preset.endsWith("d")) {
          start.setDate(start.getDate() - parseInt(preset));
        } else if (preset.endsWith("w")) {
          start.setDate(start.getDate() - parseInt(preset) * 7);
        } else if (preset.endsWith("m")) {
          start.setMonth(start.getMonth() - parseInt(preset));
        } else {
          start.setDate(start.getDate() - 30);
        }
        startDate = start.toISOString().split("T")[0];
      }

      // Extend range by offset amount to ensure shifted data is fetched
      const offset = state.overlayConfig?.offsetPeriods || 0;
      if (offset !== 0) {
        const absOffset = Math.abs(offset);
        const startD = new Date(startDate + "T00:00:00");
        const endD = new Date(endDate + "T00:00:00");
        if (config.periodType === "daily") {
          startD.setDate(startD.getDate() - absOffset);
          endD.setDate(endD.getDate() + absOffset);
        } else if (config.periodType === "weekly") {
          startD.setDate(startD.getDate() - absOffset * 7);
          endD.setDate(endD.getDate() + absOffset * 7);
        } else {
          startD.setMonth(startD.getMonth() - absOffset);
          endD.setMonth(endD.getMonth() + absOffset);
        }
        startDate = startD.toISOString().split("T")[0];
        endDate = endD.toISOString().split("T")[0];
      }

      try {
        const { entries } = await statEntriesApi.getByStatId(overlayStatId!, startDate, endDate);
        if (!cancelled) {
          dispatch({ type: "SET_STAT_ENTRIES", payload: { statId: overlayStatId!, entries: entries || [] } });
        }
      } catch (error) {
        console.error("Failed to fetch overlay entries:", error);
      }
    }
    fetchOverlay();
    return () => { cancelled = true; };
  }, [isComposite, state.overlayConfig?.statId, state.overlayConfig?.offsetPeriods, config.rangePreset, config.periodType, config.customStart, config.customEnd, dispatch]);

  return (
    <div className="flex h-full -m-6">
      {/* Left: Stats list */}
      {state.statsSidebarOpen && (
        <StatsList onEnterData={() => setShowEntryModal(true)} />
      )}

      {/* Right: Graph area */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        {/* Toolbar row */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex flex-col gap-2">
            {selectedStat && (
              <>
                <h3 className={`text-lg font-semibold ${accent.text}`}>
                  {selectedStat.name}
                </h3>
                {selectedStat.userId !== state.user?.id && (() => {
                  const parts: string[] = [];
                  if (selectedStat.userDivision != null) parts.push(`Div ${selectedStat.userDivision}`);
                  if (selectedStat.userDepartment != null) parts.push(`Dept ${selectedStat.userDepartment}`);
                  const orgStr = parts.join(" \u00B7 ");
                  const userName = getDisplayName({
                    username: selectedStat.userName || "Unknown",
                    firstName: selectedStat.userFirstName,
                    lastName: selectedStat.userLastName,
                  });
                  const label = orgStr ? `${orgStr} \u2014 ${userName}` : userName;
                  return (
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      {label}
                    </p>
                  );
                })()}
              </>
            )}
            <TimeRangeSelector />
          </div>
          <YAxisControls />
        </div>

        {/* Graph */}
        <StatGraph />
      </div>

      {/* Entry modal */}
      {showEntryModal && state.selectedStatId && selectedStat && (
        <StatEntryModal
          onClose={async () => {
            setShowEntryModal(false);
            // Refresh entries after data entry
            fetchEntries();
            // Also refresh stat definitions so trend arrows update immediately
            try {
              const data = await statsApi.getAll(config.periodType);
              if (data?.stats) {
                dispatch({ type: "SET_STAT_DEFINITIONS", payload: data.stats });
              }
            } catch { /* ignore */ }
          }}
          statId={isComposite && linkedStatIds.length > 0 ? linkedStatIds[0] : state.selectedStatId}
          statName={selectedStat.name}
          linkedStatIds={isComposite ? linkedStatIds : undefined}
          linkedStatNames={isComposite ? linkedStatNames : undefined}
        />
      )}
    </div>
  );
}
