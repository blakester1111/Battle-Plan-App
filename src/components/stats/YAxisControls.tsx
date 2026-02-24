"use client";

import { useAppContext, useAccentColor } from "@/context/AppContext";

export default function YAxisControls() {
  const { state, dispatch } = useAppContext();
  const accent = useAccentColor();
  const config = state.statsViewConfig;

  // Detect if right axis is active (overlay or composite stat)
  const selectedStat = state.statDefinitions.find(s => s.id === state.selectedStatId);
  const isComposite = !!selectedStat?.linkedStatIds?.length;
  const hasRightAxis = !!state.overlayConfig || isComposite;

  const yAxisRightAuto = config.yAxisRightAuto ?? true;

  return (
    <div className="flex flex-col gap-1.5 text-xs">
      {/* Left axis controls */}
      <div className="flex items-center gap-2">
        {hasRightAxis && (
          <span className="w-10 text-right text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500 shrink-0">
            Left
          </span>
        )}
        <label className="flex items-center gap-1.5 text-stone-500 dark:text-stone-400">
          <input
            type="checkbox"
            checked={config.yAxisAuto}
            onChange={(e) =>
              dispatch({
                type: "SET_STATS_VIEW_CONFIG",
                payload: { yAxisAuto: e.target.checked },
              })
            }
            className="rounded"
          />
          Auto Y-Axis
        </label>
        {!config.yAxisAuto && (
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-stone-500 dark:text-stone-400">
              Min
              <input
                type="number"
                value={config.yAxisMin ?? ""}
                onChange={(e) =>
                  dispatch({
                    type: "SET_STATS_VIEW_CONFIG",
                    payload: { yAxisMin: e.target.value ? Number(e.target.value) : undefined },
                  })
                }
                className={`w-16 px-1.5 py-0.5 rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs focus:outline-none focus:ring-1 ${accent.ring}`}
                placeholder="0"
              />
            </label>
            <label className="flex items-center gap-1 text-stone-500 dark:text-stone-400">
              Max
              <input
                type="number"
                value={config.yAxisMax ?? ""}
                onChange={(e) =>
                  dispatch({
                    type: "SET_STATS_VIEW_CONFIG",
                    payload: { yAxisMax: e.target.value ? Number(e.target.value) : undefined },
                  })
                }
                className={`w-16 px-1.5 py-0.5 rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs focus:outline-none focus:ring-1 ${accent.ring}`}
                placeholder="auto"
              />
            </label>
          </div>
        )}
      </div>

      {/* Right axis controls (only when overlay or composite is active) */}
      {hasRightAxis && (
        <div className="flex items-center gap-2">
          <span className="w-10 text-right text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500 shrink-0">
            Right
          </span>
          <label className="flex items-center gap-1.5 text-stone-500 dark:text-stone-400">
            <input
              type="checkbox"
              checked={yAxisRightAuto}
              onChange={(e) =>
                dispatch({
                  type: "SET_STATS_VIEW_CONFIG",
                  payload: { yAxisRightAuto: e.target.checked },
                })
              }
              className="rounded"
            />
            Auto Y-Axis
          </label>
          {!yAxisRightAuto && (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-stone-500 dark:text-stone-400">
                Min
                <input
                  type="number"
                  value={config.yAxisRightMin ?? ""}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_STATS_VIEW_CONFIG",
                      payload: { yAxisRightMin: e.target.value ? Number(e.target.value) : undefined },
                    })
                  }
                  className={`w-16 px-1.5 py-0.5 rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs focus:outline-none focus:ring-1 ${accent.ring}`}
                  placeholder="0"
                />
              </label>
              <label className="flex items-center gap-1 text-stone-500 dark:text-stone-400">
                Max
                <input
                  type="number"
                  value={config.yAxisRightMax ?? ""}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_STATS_VIEW_CONFIG",
                      payload: { yAxisRightMax: e.target.value ? Number(e.target.value) : undefined },
                    })
                  }
                  className={`w-16 px-1.5 py-0.5 rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs focus:outline-none focus:ring-1 ${accent.ring}`}
                  placeholder="auto"
                />
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
