"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAppContext, useAccentColor } from "@/context/AppContext";
import { statEntriesApi } from "@/lib/api";
import { generateId } from "@/lib/utils";
import type { StatPeriodType } from "@/lib/types";

interface Props {
  onClose: () => void;
  statId: string;
  statName: string;
  linkedStatIds?: string[];
  linkedStatNames?: string[];
}

type Tab = "enter" | "import";

// Generate dates between start and end for the given period type
function getDatesBetween(startStr: string, endStr: string, periodType: StatPeriodType): string[] {
  const dates: string[] = [];
  const start = new Date(startStr + "T00:00:00");
  const end = new Date(endStr + "T00:00:00");

  if (periodType === "daily") {
    const d = new Date(end);
    while (d >= start) {
      dates.push(toDateStr(d));
      d.setDate(d.getDate() - 1);
    }
  } else if (periodType === "weekly") {
    // Start from end, snap to Monday, go backwards
    const d = new Date(end);
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - diff); // snap to Monday
    while (d >= start) {
      dates.push(toDateStr(d));
      d.setDate(d.getDate() - 7);
    }
  } else {
    // Monthly: first of each month
    const d = new Date(end.getFullYear(), end.getMonth(), 1);
    const startMonth = new Date(start.getFullYear(), start.getMonth(), 1);
    while (d >= startMonth) {
      dates.push(toDateStr(d));
      d.setMonth(d.getMonth() - 1);
    }
  }
  return dates;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateLabel(date: string, periodType: StatPeriodType): string {
  const d = new Date(date + "T00:00:00");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  if (periodType === "daily") {
    return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } else if (periodType === "weekly") {
    return `W/E ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } else {
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  }
}

// Default range: 30 days back for daily, 12 weeks for weekly, 12 months for monthly
function getDefaultFrom(periodType: StatPeriodType): string {
  const d = new Date();
  if (periodType === "daily") d.setDate(d.getDate() - 30);
  else if (periodType === "weekly") d.setDate(d.getDate() - 12 * 7);
  else d.setMonth(d.getMonth() - 12);
  return toDateStr(d);
}

function parseCSV(text: string): { date: string; value: number }[] {
  const rows: { date: string; value: number }[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim());

  // Try to detect header
  const first = lines[0].toLowerCase();
  const hasHeader = first.includes("date") || first.includes("value") || isNaN(Number(first.split(/[,;\t]/)[1]?.trim()));
  const startIdx = hasHeader ? 1 : 0;

  for (let i = startIdx; i < lines.length; i++) {
    // Support comma, semicolon, and tab separators
    const parts = lines[i].split(/[,;\t]/).map((p) => p.trim().replace(/^["']|["']$/g, ""));
    if (parts.length < 2) continue;

    const rawDate = parts[0];
    const rawValue = parts[1];

    const value = Number(rawValue);
    if (isNaN(value)) continue;

    // Try to parse the date in multiple formats
    const date = parseFlexibleDate(rawDate);
    if (!date) continue;

    rows.push({ date, value });
  }

  return rows;
}

function parseFlexibleDate(raw: string): string | null {
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  let m = raw.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (m) {
    const day = m[1].padStart(2, "0");
    const month = m[2].padStart(2, "0");
    return `${m[3]}-${month}-${day}`;
  }

  // MM/DD/YYYY (US format) — ambiguous, we'll try if day > 12
  // Skip this since DD/MM is more common globally

  // DD/MM/YY or DD-MM-YY
  m = raw.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})$/);
  if (m) {
    const day = m[1].padStart(2, "0");
    const month = m[2].padStart(2, "0");
    const year = Number(m[3]) > 50 ? `19${m[3]}` : `20${m[3]}`;
    return `${year}-${month}-${day}`;
  }

  // YYYY/MM/DD
  m = raw.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }

  // Try native Date parse as last resort
  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    return toDateStr(d);
  }

  return null;
}

export default function StatEntryModal({ onClose, statId: initialStatId, statName, linkedStatIds, linkedStatNames }: Props) {
  const { state, dispatch } = useAppContext();
  const accent = useAccentColor();
  const config = state.statsViewConfig;
  const isCompositeEntry = !!linkedStatIds?.length;

  // For composite stats, allow switching between linked stats via tabs
  const [activeLinkedIdx, setActiveLinkedIdx] = useState(0);
  const statId = isCompositeEntry ? (linkedStatIds[activeLinkedIdx] || initialStatId) : initialStatId;
  const entries = state.statEntries[statId] || [];

  const [tab, setTab] = useState<Tab>("enter");

  // === ENTER DATA tab state ===
  const today = toDateStr(new Date());
  const [fromDate, setFromDate] = useState(() => getDefaultFrom(config.periodType));
  const [toDate, setToDate] = useState(today);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dates = getDatesBetween(fromDate, toDate, config.periodType);

  // Initialize values from existing entries (re-run when statId changes for composite tab switching)
  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const date of dates) {
      const entry = entries.find((e) => e.date === date && e.periodType === config.periodType);
      if (entry) initial[date] = String(entry.value);
    }
    setValues(initial);
  }, [entries, config.periodType, fromDate, toDate, statId]); // eslint-disable-line react-hooks/exhaustive-deps

  // === IMPORT tab state ===
  const [csvText, setCsvText] = useState("");
  const [parsedRows, setParsedRows] = useState<{ date: string; value: number }[] | null>(null);
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const saveEntry = useCallback(
    async (date: string, valueStr: string) => {
      const numValue = Number(valueStr);
      if (isNaN(numValue) || valueStr.trim() === "") return;

      setSaving((s) => ({ ...s, [date]: true }));
      try {
        const id = generateId();
        const { entry } = await statEntriesApi.upsert({
          id,
          statId,
          value: numValue,
          date,
          periodType: config.periodType,
        });
        if (entry) {
          dispatch({ type: "ADD_STAT_ENTRY", payload: entry });
        }
      } catch (error) {
        console.error("Failed to save entry:", error);
      } finally {
        setSaving((s) => ({ ...s, [date]: false }));
      }
    },
    [statId, config.periodType, dispatch]
  );

  function handleChange(date: string, value: string) {
    setValues((v) => ({ ...v, [date]: value }));
    if (saveTimers.current[date]) clearTimeout(saveTimers.current[date]);
    if (value.trim() !== "" && !isNaN(Number(value))) {
      saveTimers.current[date] = setTimeout(() => saveEntry(date, value), 800);
    }
  }

  function handleBlur(date: string) {
    const value = values[date];
    if (saveTimers.current[date]) clearTimeout(saveTimers.current[date]);
    if (value?.trim() !== "" && !isNaN(Number(value))) {
      saveEntry(date, value);
    }
  }

  // CSV parsing
  function handleParseCSV() {
    setImportError("");
    setImportDone(false);
    const rows = parseCSV(csvText);
    if (rows.length === 0) {
      setImportError("No valid rows found. Expected format: date, value (one per line).");
      setParsedRows(null);
      return;
    }
    setParsedRows(rows);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);
      // Auto-parse
      setImportError("");
      setImportDone(false);
      const rows = parseCSV(text);
      if (rows.length === 0) {
        setImportError("No valid rows found in file.");
        setParsedRows(null);
      } else {
        setParsedRows(rows);
      }
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!parsedRows || parsedRows.length === 0) return;
    setImporting(true);
    setImportError("");
    try {
      await statEntriesApi.bulkImport(
        statId,
        parsedRows.map((r) => ({ date: r.date, value: r.value, periodType: config.periodType }))
      );
      // Refresh entries from server
      const { entries: fresh } = await statEntriesApi.getByStatId(statId);
      dispatch({ type: "SET_STAT_ENTRIES", payload: { statId, entries: fresh || [] } });
      setImportDone(true);
      setParsedRows(null);
      setCsvText("");
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-stone-900 rounded-xl shadow-xl w-full max-w-lg mx-4 animate-slide-up border border-stone-200 dark:border-stone-700 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 dark:border-stone-700 shrink-0">
          <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-200">Enter Data</h2>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">
            {statName} &middot; {config.periodType}
          </p>
          {/* Linked stat tabs for composite stats */}
          {isCompositeEntry && linkedStatNames && (
            <div className="flex gap-1 mt-3 p-0.5 bg-stone-100 dark:bg-stone-800 rounded-lg w-fit">
              {linkedStatNames.map((name, idx) => (
                <button
                  key={linkedStatIds![idx]}
                  onClick={() => setActiveLinkedIdx(idx)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    activeLinkedIdx === idx
                      ? `${accent.bg} text-white`
                      : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
          {/* Entry mode tabs */}
          <div className="flex gap-1 mt-3 p-0.5 bg-stone-100 dark:bg-stone-800 rounded-lg w-fit">
            <button
              onClick={() => setTab("enter")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                tab === "enter"
                  ? `${accent.bg} text-white`
                  : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300"
              }`}
            >
              Manual Entry
            </button>
            <button
              onClick={() => setTab("import")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                tab === "import"
                  ? `${accent.bg} text-white`
                  : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300"
              }`}
            >
              Import CSV
            </button>
          </div>
        </div>

        {/* ENTER DATA tab */}
        {tab === "enter" && (
          <>
            {/* Date range picker */}
            <div className="px-5 py-3 border-b border-stone-200 dark:border-stone-700 shrink-0">
              <div className="flex items-center gap-2">
                <label className="text-xs text-stone-500 dark:text-stone-400">From</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="px-2 py-1 text-xs rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300"
                />
                <label className="text-xs text-stone-500 dark:text-stone-400">To</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="px-2 py-1 text-xs rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300"
                />
                <span className="text-xs text-stone-400 dark:text-stone-500 ml-1">
                  {dates.length} {config.periodType === "daily" ? "days" : config.periodType === "weekly" ? "weeks" : "months"}
                </span>
              </div>
            </div>

            {/* Scrollable entries */}
            <div className="p-5 overflow-y-auto flex-1">
              <div className="space-y-1.5">
                {dates.map((date) => {
                  const isToday = date === today;
                  return (
                    <div key={date} className="flex items-center gap-3">
                      <span
                        className={`w-36 text-xs shrink-0 ${
                          isToday
                            ? `font-semibold ${accent.text}`
                            : "text-stone-500 dark:text-stone-400"
                        }`}
                      >
                        {formatDateLabel(date, config.periodType)}
                        {isToday && " (today)"}
                      </span>
                      <div className="relative flex-1">
                        <input
                          type="number"
                          value={values[date] ?? ""}
                          onChange={(e) => handleChange(date, e.target.value)}
                          onBlur={() => handleBlur(date)}
                          placeholder="—"
                          step="any"
                          className={`w-full px-2.5 py-1.5 text-sm rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 ${accent.ring} ${
                            saving[date] ? "opacity-60" : ""
                          }`}
                        />
                        {saving[date] && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-stone-400">
                            ...
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* IMPORT CSV tab */}
        {tab === "import" && (
          <div className="p-5 overflow-y-auto flex-1 space-y-4">
            <div className="text-xs text-stone-500 dark:text-stone-400 space-y-1">
              <p>
                Upload a CSV file or paste data below. Expected format:
              </p>
              <div className="bg-stone-100 dark:bg-stone-800 rounded-lg p-2.5 font-mono text-[11px] text-stone-600 dark:text-stone-300">
                date, value<br />
                2025-01-15, 42<br />
                2025-01-16, 55<br />
                2025-01-17, 38
              </div>
              <p className="text-stone-400 dark:text-stone-500">
                Supports date formats: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD/MM/YY, and more.
                Comma, semicolon, or tab separators all work. Existing entries for matching dates will be updated.
              </p>
            </div>

            {/* File upload */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-dashed border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors w-full justify-center"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Choose CSV file
              </button>
            </div>

            {/* Or paste */}
            <div>
              <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">
                Or paste data directly
              </label>
              <textarea
                value={csvText}
                onChange={(e) => {
                  setCsvText(e.target.value);
                  setParsedRows(null);
                  setImportDone(false);
                  setImportError("");
                }}
                placeholder={"date, value\n2025-01-01, 100\n2025-01-02, 120"}
                rows={6}
                className={`w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 font-mono focus:outline-none focus:ring-1 ${accent.ring}`}
              />
            </div>

            {/* Parse button */}
            {csvText && !parsedRows && (
              <button
                onClick={handleParseCSV}
                className={`px-4 py-1.5 text-sm rounded-lg font-medium text-white ${accent.bg}`}
              >
                Preview Import
              </button>
            )}

            {/* Error */}
            {importError && (
              <p className="text-xs text-red-500">{importError}</p>
            )}

            {/* Preview */}
            {parsedRows && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-stone-700 dark:text-stone-300">
                    Preview: {parsedRows.length} row{parsedRows.length !== 1 ? "s" : ""} found
                  </p>
                  {parsedRows.length > 0 && (
                    <p className="text-xs text-stone-400 dark:text-stone-500">
                      {parsedRows[0].date} &mdash; {parsedRows[parsedRows.length - 1].date}
                    </p>
                  )}
                </div>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-stone-200 dark:border-stone-700">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-stone-50 dark:bg-stone-800 text-stone-500 dark:text-stone-400">
                        <th className="text-left px-3 py-1.5 font-medium">Date</th>
                        <th className="text-right px-3 py-1.5 font-medium">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.slice(0, 50).map((row, i) => (
                        <tr key={i} className="border-t border-stone-100 dark:border-stone-800">
                          <td className="px-3 py-1 text-stone-600 dark:text-stone-300">{row.date}</td>
                          <td className="px-3 py-1 text-right text-stone-800 dark:text-stone-200 font-medium">{row.value}</td>
                        </tr>
                      ))}
                      {parsedRows.length > 50 && (
                        <tr className="border-t border-stone-100 dark:border-stone-800">
                          <td colSpan={2} className="px-3 py-1.5 text-center text-stone-400 italic">
                            ... and {parsedRows.length - 50} more rows
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <button
                  onClick={handleImport}
                  disabled={importing}
                  className={`w-full py-2 text-sm font-medium rounded-lg text-white transition-colors disabled:opacity-50 ${accent.bg}`}
                >
                  {importing ? "Importing..." : `Import ${parsedRows.length} Entries`}
                </button>
              </div>
            )}

            {/* Success */}
            {importDone && (
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                Import complete! Data is now on the graph.
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-stone-200 dark:border-stone-700 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm rounded-lg text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
