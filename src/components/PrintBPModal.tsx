"use client";

import { useState, useMemo, useCallback } from "react";
import { useAppContext, useAccentColor } from "@/context/AppContext";
import { cn } from "@/lib/utils";
import { PRIORITY_LABELS } from "@/lib/utils";
import { formatDate } from "@/lib/dateUtils";
import {
  getFormulaById,
  getStepById,
  getStepLabel,
  getFormulaSortKey,
  CONDITION_FORMULAS,
} from "@/lib/conditionFormulas";
import type { KanbanTask, Priority } from "@/lib/types";
import type { ConditionFormula } from "@/lib/conditionFormulas";

interface PrintBPModalProps {
  onClose: () => void;
  viewMode: "own" | "junior" | "info";
  bpId?: string; // Override — for junior/info views where selectedBpId is local state
}

type LayoutMode = "manual" | "formula" | "priority";
type FontSize = "small" | "medium" | "large";

const FONT_SIZE_MAP: Record<FontSize, string> = { small: "12px", medium: "14px", large: "16px" };
const TITLE_SIZE_MAP: Record<FontSize, string> = { small: "18px", medium: "22px", large: "26px" };
const HEADING_SIZE_MAP: Record<FontSize, string> = { small: "13px", medium: "15px", large: "17px" };
const PREVIEW_FONT_SIZE_MAP: Record<FontSize, string> = { small: "11px", medium: "13px", large: "15px" };

const PRIORITY_ORDER: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
  none: 3,
};

const PRIORITY_SECTION_LABELS: Record<string, string> = {
  high: "High Priority",
  medium: "Medium Priority",
  low: "Low Priority",
  none: "No Priority",
};

const PRIORITY_COLORS: Record<string, string> = {
  High: "#ef4444",
  Medium: "#22c55e",
  Low: "#3b82f6",
};

interface PrintVisibility {
  formulaBadge: boolean;
  targetDescription: boolean;
  priority: boolean;
  category: boolean;
  doneLine: boolean;
  bugged: boolean;
  forwardedTags: boolean;
}

const DEFAULT_VISIBILITY: PrintVisibility = {
  formulaBadge: true,
  targetDescription: true,
  priority: true,
  category: true,
  doneLine: true,
  bugged: true,
  forwardedTags: true,
};

const VISIBILITY_LABELS: Record<keyof PrintVisibility, string> = {
  formulaBadge: "Formula badge",
  targetDescription: "Target description",
  priority: "Priority indicator",
  category: "Category tag",
  doneLine: '"Done: ____" line',
  bugged: "Bugged indicator",
  forwardedTags: "Forwarded/prev-week tags",
};

function createSortByPriorityFormula(
  bpList?: { id: string; weekStart: string }[]
): (a: KanbanTask, b: KanbanTask) => number {
  const weekLookup = new Map<string, number>();
  if (bpList) {
    for (const bp of bpList) {
      weekLookup.set(bp.id, new Date(bp.weekStart).getTime());
    }
  }
  return (a: KanbanTask, b: KanbanTask): number => {
    const aPriority = PRIORITY_ORDER[a.priority || "none"];
    const bPriority = PRIORITY_ORDER[b.priority || "none"];
    if (aPriority !== bPriority) return aPriority - bPriority;
    const aKey = a.formulaStepId ? getFormulaSortKey(a.formulaStepId) : -1;
    const bKey = b.formulaStepId ? getFormulaSortKey(b.formulaStepId) : -1;
    if (aKey !== bKey) return bKey - aKey;
    // Chronological tiebreaker: earlier weeks first
    if (weekLookup.size > 0) {
      const aWeek = a.weeklyBpId ? weekLookup.get(a.weeklyBpId) || 0 : 0;
      const bWeek = b.weeklyBpId ? weekLookup.get(b.weeklyBpId) || 0 : 0;
      if (aWeek !== bWeek) return aWeek - bWeek;
    }
    return a.order - b.order;
  };
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default function PrintBPModal({ onClose, viewMode, bpId }: PrintBPModalProps) {
  const { state } = useAppContext();
  const accent = useAccentColor();

  const [layoutMode, setLayoutMode] = useState<LayoutMode>("manual");
  const [fontSize, setFontSize] = useState<FontSize>("medium");
  const [showCompleted, setShowCompleted] = useState(false);
  const [visibility, setVisibility] = useState<PrintVisibility>(DEFAULT_VISIBILITY);
  const [showCustomize, setShowCustomize] = useState(false);
  const [includeLatestBPWriteups, setIncludeLatestBPWriteups] = useState(false);

  // Resolve data source based on viewMode
  const { tasks, bps, person } = useMemo(() => {
    if (viewMode === "junior") {
      return {
        tasks: state.juniorTasks,
        bps: state.juniorWeeklyBPs,
        person: state.viewingJunior,
      };
    }
    if (viewMode === "info") {
      return {
        tasks: state.infoTerminalTasks,
        bps: state.infoTerminalWeeklyBPs,
        person: state.viewingInfoTerminal,
      };
    }
    return {
      tasks: state.tasks,
      bps: state.weeklyBattlePlans,
      person: state.user,
    };
  }, [viewMode, state]);

  // Find the active BP (use bpId prop if provided, otherwise activeWeeklyBpId from state)
  const resolvedBpId = bpId || state.activeWeeklyBpId;
  const activeBp = bps.find((bp) => bp.id === resolvedBpId);

  // Get display name
  const displayName = useMemo(() => {
    if (!person) return "Unknown";
    if (person.postTitle) return person.postTitle;
    if (person.firstName || person.lastName) {
      return `${person.firstName || ""} ${person.lastName || ""}`.trim();
    }
    return person.username;
  }, [person]);

  // Are we in "main board" mode (no BP selected)?
  const isMainBoard = !activeBp;

  // Memoized sort comparator with chronological tiebreaker
  const sortByPriorityFormula = useMemo(
    () => createSortByPriorityFormula(isMainBoard ? bps : undefined),
    [isMainBoard, bps]
  );

  // Filter and sort tasks
  const bpTasks = useMemo(() => {
    let filtered: KanbanTask[];
    if (activeBp) {
      filtered = tasks.filter((t) => t.weeklyBpId === activeBp.id);
    } else {
      // Main board: all tasks excluding forwarded-away and archived
      filtered = tasks.filter((t) => !t.forwardedToTaskId && !t.archivedAt);
    }
    if (!showCompleted) {
      filtered = filtered.filter((t) => t.status !== "complete");
    }
    return filtered;
  }, [tasks, activeBp, showCompleted]);

  // Get formula info for the BP (single-BP mode)
  const formula = activeBp ? getFormulaById(activeBp.formulaId) : undefined;

  // For main board formula view: map bpId → formula
  const bpFormulaMap = useMemo(() => {
    const m = new Map<string, ConditionFormula>();
    for (const bp of bps) {
      const f = getFormulaById(bp.formulaId);
      if (f) m.set(bp.id, f);
    }
    return m;
  }, [bps]);

  // For main board: latest BP writeups per formula step (most recent BP by weekStart per formula)
  const latestBPWriteupsByStep = useMemo(() => {
    if (!isMainBoard) return new Map<string, string>();
    const m = new Map<string, string>();
    // Group BPs by formulaId, pick the latest by weekStart for each
    const latestByFormula = new Map<string, typeof bps[0]>();
    for (const bp of bps) {
      const existing = latestByFormula.get(bp.formulaId);
      if (!existing || bp.weekStart > existing.weekStart) {
        latestByFormula.set(bp.formulaId, bp);
      }
    }
    // Collect all stepWriteups from each latest BP
    for (const bp of latestByFormula.values()) {
      if (bp.stepWriteups) {
        for (const [stepId, writeup] of Object.entries(bp.stepWriteups)) {
          if (writeup) m.set(stepId, writeup);
        }
      }
    }
    return m;
  }, [isMainBoard, bps]);

  // Build print HTML
  const buildPrintHTML = useCallback(() => {
    const baseFontSize = FONT_SIZE_MAP[fontSize];
    const titleFontSize = TITLE_SIZE_MAP[fontSize];
    const headingFontSize = HEADING_SIZE_MAP[fontSize];
    const today = formatDate(new Date(), state.dateFormat);

    function renderTask(task: KanbanTask, layout: LayoutMode): string {
      const stepLabel = task.formulaStepId ? getStepLabel(task.formulaStepId) : "";
      const priorityLabel =
        task.priority && task.priority !== "none"
          ? PRIORITY_LABELS[task.priority]
          : "";
      const isForwardedIn = !!task.forwardedFromTaskId;
      const isForwardedAway = !!task.forwardedToTaskId;

      // Get formula code for priority/manual views
      const taskBp = task.weeklyBpId ? bps.find((b) => b.id === task.weeklyBpId) : null;
      const taskFormulaCode = taskBp?.formulaCode || "";

      let meta = "";
      // Show formula step label in manual and priority views (not formula view — step is in the header)
      if (visibility.formulaBadge && stepLabel && layout !== "formula") {
        meta += `<span style="display:inline-block;background:#f0f0f0;padding:1px 6px;border-radius:3px;font-size:0.85em;margin-right:6px;">${escHtml(stepLabel)}</span>`;
      }
      // Show formula code badge in priority view
      if (visibility.formulaBadge && taskFormulaCode && layout === "priority") {
        meta += `<span style="display:inline-block;background:#e8e8e8;padding:1px 6px;border-radius:3px;font-size:0.85em;margin-right:6px;color:#555;">${escHtml(taskFormulaCode)}</span>`;
      }
      // Show priority in manual and formula views (not priority view — priority is in the header)
      if (visibility.priority && priorityLabel && layout !== "priority") {
        const pColor = PRIORITY_COLORS[priorityLabel] || "#888";
        meta += `<span style="color:${pColor};font-size:0.85em;font-weight:500;">${priorityLabel}</span> `;
      }
      if (visibility.category && task.category) {
        meta += `<span style="display:inline-block;background:#f5f5f5;color:#666;padding:1px 6px;border-radius:3px;font-size:0.8em;">${escHtml(task.category)}</span> `;
      }
      if (visibility.forwardedTags && isForwardedIn) {
        meta += `<span style="display:inline-block;background:#f0f7ff;color:#3b82f6;padding:1px 6px;border-radius:3px;font-size:0.8em;">From prev. week</span> `;
      }
      if (visibility.forwardedTags && isForwardedAway) {
        meta += `<span style="display:inline-block;background:#f5f5f5;color:#999;padding:1px 6px;border-radius:3px;font-size:0.8em;">Forwarded</span> `;
      }
      if (visibility.bugged && task.bugged) {
        meta += `<span style="color:#ef4444;font-size:0.8em;font-weight:500;">Bugged</span> `;
      }

      // Derive description: use task.description if present, otherwise build from formula step
      // In formula view, skip step-derived descriptions since the step is already the section header
      let descText = task.description || "";
      if (!descText && task.formulaStepId && layout !== "formula") {
        const stepInfo = getStepById(task.formulaStepId);
        if (stepInfo) descText = `Step ${stepInfo.stepNumber}: ${stepInfo.description}`;
      }
      // In formula view, suppress description if it matches the step text (redundant with header)
      if (layout === "formula" && descText && task.formulaStepId) {
        const stepInfo = getStepById(task.formulaStepId);
        if (stepInfo && descText === `Step ${stepInfo.stepNumber}: ${stepInfo.description}`) {
          descText = "";
        }
      }
      const descLine =
        visibility.targetDescription && descText
          ? `<div style="color:#444;font-size:0.9em;margin-top:2px;">${escHtml(descText)}</div>`
          : "";

      const doneLine = visibility.doneLine
        ? `<div style="white-space:nowrap;color:#333;font-size:0.85em;border-bottom:1.5px solid #333;padding-bottom:3px;min-width:140px;flex-shrink:0;margin-top:2px;">
              Done: <span style="color:transparent;">__________</span>
            </div>`
        : "";

      return `
        <div style="margin-bottom:14px;${isForwardedAway ? "opacity:0.5;" : ""}">
          <div style="display:flex;align-items:flex-start;gap:16px;">
            <div style="flex:1;min-width:0;">
              <span style="font-weight:600;color:#000;">${escHtml(task.title)}</span>
              ${meta ? `<div style="margin-top:3px;">${meta}</div>` : ""}
              ${descLine}
            </div>
            ${doneLine}
          </div>
        </div>
      `;
    }

    function renderSectionHeader(title: string): string {
      return `
        <div style="margin:24px 0 12px 0;page-break-inside:avoid;">
          <div style="font-size:${headingFontSize};font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:#000;padding-bottom:6px;">
            ${escHtml(title)}
          </div>
        </div>
      `;
    }

    let bodyContent = "";

    if (layoutMode === "manual") {
      // Group by status: todo first, then in-progress, then optionally complete
      const statuses: { key: string; label: string }[] = [
        { key: "todo", label: "To Do" },
        { key: "in-progress", label: "In Progress" },
      ];
      if (showCompleted) {
        statuses.push({ key: "complete", label: "Complete" });
      }
      for (const { key, label } of statuses) {
        const statusTasks = bpTasks
          .filter((t) => t.status === key)
          .sort(sortByPriorityFormula);
        if (statusTasks.length === 0) continue;
        bodyContent += renderSectionHeader(label);
        for (const task of statusTasks) {
          bodyContent += renderTask(task, "manual");
        }
      }
    } else if (layoutMode === "formula") {
      if (activeBp && formula) {
        // Single BP formula view
        for (const step of formula.steps) {
          const stepTasks = bpTasks
            .filter((t) => t.formulaStepId === step.id && !t.forwardedFromTaskId)
            .sort((a, b) => {
              const ap = PRIORITY_ORDER[a.priority || "none"];
              const bp2 = PRIORITY_ORDER[b.priority || "none"];
              if (ap !== bp2) return ap - bp2;
              return a.order - b.order;
            });
          if (stepTasks.length === 0) continue;
          bodyContent += renderSectionHeader(
            `Step ${step.stepNumber}: ${step.description}`
          );
          // Write-up text under step heading
          const writeup = activeBp.stepWriteups?.[step.id];
          if (writeup) {
            bodyContent += `<div style="margin:-4px 0 12px 0;color:#444;font-size:0.95em;font-style:italic;line-height:1.6;">${escHtml(writeup)}</div>`;
          }
          for (const task of stepTasks) {
            bodyContent += renderTask(task, "formula");
          }
        }
      } else {
        // Main board formula view — group by formula, then by step
        const formulaTaskMap = new Map<string, { formula: ConditionFormula; tasks: KanbanTask[] }>();
        const unassigned: KanbanTask[] = [];

        for (const task of bpTasks) {
          if (task.forwardedFromTaskId) continue; // handled separately
          const f = task.weeklyBpId ? bpFormulaMap.get(task.weeklyBpId) : undefined;
          if (f && task.formulaStepId) {
            if (!formulaTaskMap.has(f.id)) formulaTaskMap.set(f.id, { formula: f, tasks: [] });
            formulaTaskMap.get(f.id)!.tasks.push(task);
          } else {
            unassigned.push(task);
          }
        }

        // Sort formulas by displayOrder descending (highest condition first)
        const sortedFormulas = [...formulaTaskMap.values()].sort(
          (a, b) => b.formula.displayOrder - a.formula.displayOrder
        );

        for (const { formula: f, tasks: fTasks } of sortedFormulas) {
          bodyContent += renderSectionHeader(`${f.name} (${f.code})`);
          for (const step of f.steps) {
            const stepTasks = fTasks
              .filter((t) => t.formulaStepId === step.id)
              .sort((a, b) => {
                const ap = PRIORITY_ORDER[a.priority || "none"];
                const bp2 = PRIORITY_ORDER[b.priority || "none"];
                if (ap !== bp2) return ap - bp2;
                return a.order - b.order;
              });
            if (stepTasks.length === 0) continue;
            bodyContent += `
              <div style="margin:12px 0 8px 0;">
                <div style="font-size:0.9em;font-weight:500;color:#555;margin-bottom:6px;">
                  Step ${step.stepNumber}: ${escHtml(step.description)}
                </div>
              </div>
            `;
            if (includeLatestBPWriteups) {
              const stepWriteup = latestBPWriteupsByStep.get(step.id);
              if (stepWriteup) {
                bodyContent += `<div style="margin:-4px 0 12px 0;color:#444;font-size:0.9em;font-style:italic;line-height:1.6;padding-left:8px;">${escHtml(stepWriteup)}</div>`;
              }
            }
            for (const task of stepTasks) {
              bodyContent += renderTask(task, "formula");
            }
          }
        }

        if (unassigned.length > 0) {
          bodyContent += renderSectionHeader("Additional Targets");
          for (const task of unassigned.sort(sortByPriorityFormula)) {
            bodyContent += renderTask(task, "formula");
          }
        }
      }

      // Additional targets (no formulaStepId and not forwarded-in) — only for single BP
      if (activeBp) {
        const additionalTasks = bpTasks
          .filter((t) => !t.formulaStepId && !t.forwardedFromTaskId)
          .sort(sortByPriorityFormula);
        if (additionalTasks.length > 0) {
          bodyContent += renderSectionHeader("Additional Targets");
          for (const task of additionalTasks) {
            bodyContent += renderTask(task, "formula");
          }
        }
      }

      // Forwarded-in tasks
      const forwardedTasks = bpTasks
        .filter((t) => !!t.forwardedFromTaskId)
        .sort(sortByPriorityFormula);
      if (forwardedTasks.length > 0) {
        bodyContent += renderSectionHeader("From Previous Weeks");
        for (const task of forwardedTasks) {
          bodyContent += renderTask(task, "formula");
        }
      }
    } else if (layoutMode === "priority") {
      // Group by priority level
      const levels: Priority[] = ["high", "medium", "low", "none"];
      for (const level of levels) {
        const levelTasks = bpTasks
          .filter((t) => (t.priority || "none") === level)
          .sort((a, b) => {
            const aKey = a.formulaStepId ? getFormulaSortKey(a.formulaStepId) : -1;
            const bKey = b.formulaStepId ? getFormulaSortKey(b.formulaStepId) : -1;
            if (aKey !== bKey) return bKey - aKey;
            return a.order - b.order;
          });
        if (levelTasks.length === 0) continue;
        bodyContent += renderSectionHeader(PRIORITY_SECTION_LABELS[level]);
        for (const task of levelTasks) {
          bodyContent += renderTask(task, "priority");
        }
      }
    }

    if (!bodyContent) {
      bodyContent = `<p style="color:#999;text-align:center;margin-top:40px;">No targets to print.</p>`;
    }

    const formulaLabel = activeBp
      ? `${activeBp.formulaName} (${activeBp.formulaCode})`
      : "";

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Admin Basics - ${escHtml(displayName)}</title>
  <style>
    @page {
      margin: 0.6in 0.7in;
      size: letter;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: ${baseFontSize};
      color: #000;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header {
      text-align: center;
      margin-bottom: 28px;
      padding-bottom: 16px;
      border-bottom: 3px solid #222;
    }
    .header h1 {
      font-size: ${titleFontSize};
      font-weight: 700;
      letter-spacing: -0.3px;
      margin-bottom: 4px;
    }
    .header .date {
      font-size: 0.9em;
      color: #666;
      margin-bottom: 2px;
    }
    .header .bp-title {
      font-size: 1.1em;
      font-weight: 600;
    }
    .header .formula-badge {
      display: inline-block;
      background: #f0f0f0;
      padding: 2px 10px;
      border-radius: 4px;
      font-size: 0.85em;
      color: #555;
      margin-left: 8px;
    }
    .footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 0.75em;
      color: #bbb;
      padding: 8px 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escHtml(displayName)} &mdash; Admin Basics</h1>
    <div class="date">${escHtml(today)}</div>
    <div class="bp-title">
      ${activeBp ? escHtml(activeBp.title) : ""}
      ${formulaLabel ? `<span class="formula-badge">${escHtml(formulaLabel)}</span>` : ""}
    </div>
  </div>
  ${bodyContent}
  <div class="footer">Admin Basics</div>
</body>
</html>`;
  }, [bpTasks, layoutMode, fontSize, showCompleted, activeBp, formula, displayName, state.dateFormat, isMainBoard, bps, bpFormulaMap, visibility, includeLatestBPWriteups, latestBPWriteupsByStep]);

  function handlePrint() {
    const html = buildPrintHTML();
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.top = "-10000px";
    iframe.style.left = "-10000px";
    iframe.style.width = "0";
    iframe.style.height = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(html);
    doc.close();

    // Wait for content to render then print
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.print();
        // Clean up after a delay to let print dialog finish
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 250);
    };
  }

  // Preview data
  const todoTasks = bpTasks.filter((t) => t.status === "todo").sort(sortByPriorityFormula);
  const inProgressTasks = bpTasks.filter((t) => t.status === "in-progress").sort(sortByPriorityFormula);
  const completeTasks = bpTasks.filter((t) => t.status === "complete").sort(sortByPriorityFormula);
  const totalPrintable = showCompleted
    ? bpTasks.length
    : todoTasks.length + inProgressTasks.length;

  // Build formula groups for main board formula preview
  const mainBoardFormulaGroups = useMemo(() => {
    if (!isMainBoard || layoutMode !== "formula") return [];
    const formulaTaskMap = new Map<string, { formula: ConditionFormula; tasks: KanbanTask[] }>();
    const unassigned: KanbanTask[] = [];
    const forwarded: KanbanTask[] = [];

    for (const task of bpTasks) {
      if (task.forwardedFromTaskId) { forwarded.push(task); continue; }
      const f = task.weeklyBpId ? bpFormulaMap.get(task.weeklyBpId) : undefined;
      if (f && task.formulaStepId) {
        if (!formulaTaskMap.has(f.id)) formulaTaskMap.set(f.id, { formula: f, tasks: [] });
        formulaTaskMap.get(f.id)!.tasks.push(task);
      } else {
        unassigned.push(task);
      }
    }

    const groups: { label: string; tasks: KanbanTask[]; substeps?: { label: string; tasks: KanbanTask[]; writeup?: string }[] }[] = [];

    const sortedFormulas = [...formulaTaskMap.values()].sort(
      (a, b) => b.formula.displayOrder - a.formula.displayOrder
    );
    for (const { formula: f, tasks: fTasks } of sortedFormulas) {
      const substeps: { label: string; tasks: KanbanTask[]; writeup?: string }[] = [];
      for (const step of f.steps) {
        const stepTasks = fTasks.filter((t) => t.formulaStepId === step.id).sort(sortByPriorityFormula);
        if (stepTasks.length > 0) {
          const writeup = includeLatestBPWriteups ? latestBPWriteupsByStep.get(step.id) : undefined;
          substeps.push({ label: `Step ${step.stepNumber}: ${step.description}`, tasks: stepTasks, writeup });
        }
      }
      if (substeps.length > 0) {
        groups.push({ label: `${f.name} (${f.code})`, tasks: [], substeps });
      }
    }
    if (unassigned.length > 0) groups.push({ label: "Additional Targets", tasks: unassigned.sort(sortByPriorityFormula) });
    if (forwarded.length > 0) groups.push({ label: "From Previous Weeks", tasks: forwarded.sort(sortByPriorityFormula) });
    return groups;
  }, [isMainBoard, layoutMode, bpTasks, bpFormulaMap, includeLatestBPWriteups, latestBPWriteupsByStep]);

  // Build structured sections for export (reuses same grouping as print HTML)
  const buildExportSections = useCallback(() => {
    const sections: { heading: string; tasks: { title: string; priority?: string; formulaBadge?: string; stepLabel?: string; description?: string; isForwarded?: boolean; isFromPrevWeek?: boolean; bugged?: boolean; showDoneLine?: boolean }[]; writeup?: string }[] = [];

    function mapTask(task: KanbanTask, layout: LayoutMode) {
      const stepLabel = task.formulaStepId ? getStepLabel(task.formulaStepId) : "";
      const priorityLabel = task.priority && task.priority !== "none" ? PRIORITY_LABELS[task.priority] : undefined;
      const taskBp = task.weeklyBpId ? bps.find((b) => b.id === task.weeklyBpId) : null;
      const taskFormulaCode = taskBp ? `${taskBp.formulaName} (${taskBp.formulaCode})` : undefined;

      // Derive description: use task.description if present, otherwise build from formula step
      // In formula view, skip step-derived descriptions since the step is already the section header
      let descText: string | undefined = task.description || undefined;
      if (!descText && task.formulaStepId && layout !== "formula") {
        const stepInfo = getStepById(task.formulaStepId);
        if (stepInfo) descText = `Step ${stepInfo.stepNumber}: ${stepInfo.description}`;
      }
      // In formula view, suppress description if it matches the step text (redundant with header)
      if (layout === "formula" && descText && task.formulaStepId) {
        const stepInfo = getStepById(task.formulaStepId);
        if (stepInfo && descText === `Step ${stepInfo.stepNumber}: ${stepInfo.description}`) {
          descText = undefined;
        }
      }

      return {
        title: task.title,
        priority: visibility.priority && layout !== "priority" ? priorityLabel : undefined,
        formulaBadge: visibility.formulaBadge && layout === "priority" ? taskFormulaCode : undefined,
        stepLabel: visibility.formulaBadge && layout !== "formula" ? stepLabel || undefined : undefined,
        description: visibility.targetDescription ? descText : undefined,
        isForwarded: visibility.forwardedTags ? !!task.forwardedToTaskId : undefined,
        isFromPrevWeek: visibility.forwardedTags ? !!task.forwardedFromTaskId : undefined,
        bugged: visibility.bugged && task.bugged ? true : undefined,
        showDoneLine: visibility.doneLine,
      };
    }

    if (layoutMode === "manual") {
      const statuses: { key: string; label: string }[] = [
        { key: "todo", label: "To Do" },
        { key: "in-progress", label: "In Progress" },
      ];
      if (showCompleted) statuses.push({ key: "complete", label: "Complete" });
      for (const { key, label } of statuses) {
        const statusTasks = bpTasks.filter((t) => t.status === key).sort(sortByPriorityFormula);
        if (statusTasks.length > 0) {
          sections.push({ heading: label, tasks: statusTasks.map((t) => mapTask(t, "manual")) });
        }
      }
    } else if (layoutMode === "formula") {
      if (activeBp && formula) {
        for (const step of formula.steps) {
          const stepTasks = bpTasks.filter((t) => t.formulaStepId === step.id && !t.forwardedFromTaskId).sort(sortByPriorityFormula);
          if (stepTasks.length > 0) {
            sections.push({ heading: `Step ${step.stepNumber}: ${step.description}`, tasks: stepTasks.map((t) => mapTask(t, "formula")), writeup: activeBp.stepWriteups?.[step.id] || undefined });
          }
        }
        const additionalTasks = bpTasks.filter((t) => !t.formulaStepId && !t.forwardedFromTaskId).sort(sortByPriorityFormula);
        if (additionalTasks.length > 0) sections.push({ heading: "Additional Targets", tasks: additionalTasks.map((t) => mapTask(t, "formula")) });
      } else {
        // Main board formula view
        for (const group of mainBoardFormulaGroups) {
          if (group.substeps) {
            for (const sub of group.substeps) {
              sections.push({ heading: `${group.label} — ${sub.label}`, tasks: sub.tasks.map((t) => mapTask(t, "formula")), writeup: sub.writeup });
            }
          } else {
            sections.push({ heading: group.label, tasks: group.tasks.map((t) => mapTask(t, "formula")) });
          }
        }
      }
      const forwardedTasks = bpTasks.filter((t) => !!t.forwardedFromTaskId).sort(sortByPriorityFormula);
      if (forwardedTasks.length > 0) sections.push({ heading: "From Previous Weeks", tasks: forwardedTasks.map((t) => mapTask(t, "formula")) });
    } else if (layoutMode === "priority") {
      const levels: Priority[] = ["high", "medium", "low", "none"];
      for (const level of levels) {
        const levelTasks = bpTasks.filter((t) => (t.priority || "none") === level).sort(sortByPriorityFormula);
        if (levelTasks.length > 0) {
          sections.push({ heading: PRIORITY_SECTION_LABELS[level], tasks: levelTasks.map((t) => mapTask(t, "priority")) });
        }
      }
    }

    return sections;
  }, [bpTasks, layoutMode, showCompleted, activeBp, formula, bps, mainBoardFormulaGroups, visibility]);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleExport(format: "docx" | "pdf") {
    setExporting(true);
    setExportError(null);
    try {
      const today = formatDate(new Date(), state.dateFormat);
      const formulaLabel = activeBp ? `${activeBp.formulaName} (${activeBp.formulaCode})` : undefined;

      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          title: `${displayName} — Admin Basics`,
          date: today,
          bpTitle: activeBp?.title,
          formulaName: formulaLabel,
          fontSize,
          sections: buildExportSections(),
        }),
      });

      if (!res.ok) {
        let msg = "Export failed";
        try {
          const errBody = await res.json();
          if (errBody.error) msg = errBody.error;
        } catch {}
        throw new Error(msg);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `admin-basics.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Export failed";
      setExportError(message);
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }

  // Preview font size
  const previewFontSize = PREVIEW_FONT_SIZE_MAP[fontSize];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-10"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-stone-900 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col animate-slide-up border border-stone-200 dark:border-stone-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 dark:border-stone-800">
          <div className="flex items-center gap-2.5">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-stone-400"
            >
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            <h2 className="text-base font-semibold text-stone-800 dark:text-stone-100">
              Print
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Options Bar */}
        <div className="px-5 py-3 border-b border-stone-200 dark:border-stone-800 flex flex-wrap items-center gap-4">
          {/* Layout Mode */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-stone-500 dark:text-stone-400">Layout:</span>
            <div className="flex gap-1">
              {([
                { key: "manual", label: "Manual" },
                { key: "formula", label: "Formula" },
                { key: "priority", label: "Priority" },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setLayoutMode(opt.key)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded transition-colors",
                    layoutMode === opt.key
                      ? `${accent.bgSubtle} ${accent.text}`
                      : "text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Font Size */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-stone-500 dark:text-stone-400">Size:</span>
            <div className="flex gap-1">
              {([
                { key: "small", label: "S" },
                { key: "medium", label: "M" },
                { key: "large", label: "L" },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setFontSize(opt.key)}
                  className={cn(
                    "w-7 h-7 text-xs font-medium rounded transition-colors flex items-center justify-center",
                    fontSize === opt.key
                      ? `${accent.bgSubtle} ${accent.text}`
                      : "text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Show Completed */}
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              className="rounded border-stone-300 dark:border-stone-600"
            />
            <span className="text-xs text-stone-500 dark:text-stone-400">
              Include completed ({completeTasks.length})
            </span>
          </label>

          {/* Include BP writeups — only on main board formula view */}
          {isMainBoard && layoutMode === "formula" && (
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeLatestBPWriteups}
                onChange={(e) => setIncludeLatestBPWriteups(e.target.checked)}
                className="rounded border-stone-300 dark:border-stone-600"
              />
              <span className="text-xs text-stone-500 dark:text-stone-400">
                Include BP writeups
              </span>
            </label>
          )}
        </div>

        {/* Customize Fields */}
        <div className="px-5 border-b border-stone-200 dark:border-stone-800">
          <button
            onClick={() => setShowCustomize(!showCustomize)}
            className="flex items-center gap-1.5 py-2.5 text-xs font-medium text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 transition-colors w-full"
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
              className={cn("transition-transform", showCustomize && "rotate-90")}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            Customize Fields
          </button>
          {showCustomize && (
            <div className="grid grid-cols-4 gap-x-4 gap-y-1.5 pb-3">
              {(Object.keys(VISIBILITY_LABELS) as (keyof PrintVisibility)[]).map((key) => (
                <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibility[key]}
                    onChange={(e) => setVisibility((v) => ({ ...v, [key]: e.target.checked }))}
                    className="rounded border-stone-300 dark:border-stone-600"
                  />
                  <span className="text-xs text-stone-600 dark:text-stone-400">{VISIBILITY_LABELS[key]}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div
            className="bg-white border border-stone-200 rounded-lg p-6 shadow-sm max-w-xl mx-auto"
            style={{ fontSize: previewFontSize }}
          >
            {/* Print Header Preview */}
            <div className="text-center mb-5 pb-4 border-b-2 border-stone-800">
              <h3 className="font-bold text-stone-900" style={{ fontSize: `calc(${previewFontSize} * 1.4)` }}>
                {displayName} &mdash; Admin Basics
              </h3>
              <p className="text-stone-500 mt-0.5" style={{ fontSize: `calc(${previewFontSize} * 0.9)` }}>
                {formatDate(new Date(), state.dateFormat)}
              </p>
              {activeBp ? (
                <div className="mt-1">
                  <span className="font-semibold text-stone-800">
                    {activeBp.title}
                  </span>
                  <span className="ml-2 px-2 py-0.5 rounded bg-stone-100 text-stone-500" style={{ fontSize: `calc(${previewFontSize} * 0.85)` }}>
                    {activeBp.formulaName} ({activeBp.formulaCode})
                  </span>
                </div>
              ) : null}
            </div>

            {/* Preview Content */}
            {totalPrintable === 0 ? (
              <p className="text-stone-400 text-center py-6">
                No targets to print.
              </p>
            ) : layoutMode === "manual" ? (
              <div className="space-y-4">
                {todoTasks.length > 0 && (
                  <PreviewSection title="To Do" tasks={todoTasks} layout="manual" vis={visibility} />
                )}
                {inProgressTasks.length > 0 && (
                  <PreviewSection title="In Progress" tasks={inProgressTasks} layout="manual" vis={visibility} />
                )}
                {showCompleted && completeTasks.length > 0 && (
                  <PreviewSection title="Complete" tasks={completeTasks} layout="manual" vis={visibility} />
                )}
              </div>
            ) : layoutMode === "formula" ? (
              isMainBoard ? (
                <MainBoardFormulaPreview groups={mainBoardFormulaGroups} vis={visibility} />
              ) : (
                <FormulaStepPreview tasks={bpTasks} formula={formula} stepWriteups={activeBp?.stepWriteups} vis={visibility} />
              )
            ) : (
              <PriorityPreview tasks={bpTasks} bps={bps} vis={visibility} />
            )}
          </div>
        </div>

        {/* Footer */}
        {exportError && (
          <div className="mx-5 mb-0 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-xs text-red-600 dark:text-red-400">{exportError}</p>
          </div>
        )}
        <div className="flex items-center justify-between px-5 py-4 border-t border-stone-200 dark:border-stone-800">
          <span className="text-xs text-stone-400 dark:text-stone-500">
            {totalPrintable} target{totalPrintable !== 1 ? "s" : ""} will print
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 text-sm font-medium text-stone-600 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => handleExport("docx")}
              disabled={totalPrintable === 0 || exporting}
              className={cn(
                "px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5",
                totalPrintable > 0 && !exporting
                  ? "text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700"
                  : "bg-stone-100 dark:bg-stone-800 text-stone-400 cursor-not-allowed"
              )}
              title="Download Word document"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Word
            </button>
            <button
              onClick={() => handleExport("pdf")}
              disabled={totalPrintable === 0 || exporting}
              className={cn(
                "px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5",
                totalPrintable > 0 && !exporting
                  ? "text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700"
                  : "bg-stone-100 dark:bg-stone-800 text-stone-400 cursor-not-allowed"
              )}
              title="Download PDF"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              PDF
            </button>
            <button
              onClick={handlePrint}
              disabled={totalPrintable === 0}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2",
                totalPrintable > 0
                  ? `${accent.bg} text-white hover:brightness-110`
                  : "bg-stone-200 dark:bg-stone-700 text-stone-400 cursor-not-allowed"
              )}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Print
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Preview sub-components ─────────────────────────────────────────────────

function PreviewSection({
  title,
  tasks,
  layout,
  vis,
}: {
  title: string;
  tasks: KanbanTask[];
  layout: LayoutMode;
  vis: PrintVisibility;
}) {
  return (
    <div>
      <div className="font-semibold uppercase tracking-widest text-stone-500 pb-1.5 mb-2" style={{ fontSize: "0.75em" }}>
        {title}
      </div>
      <div className="space-y-2">
        {tasks.map((task) => (
          <PreviewTask key={task.id} task={task} layout={layout} vis={vis} />
        ))}
      </div>
    </div>
  );
}

function FormulaStepPreview({
  tasks,
  formula,
  stepWriteups,
  vis,
}: {
  tasks: KanbanTask[];
  formula: ReturnType<typeof getFormulaById>;
  stepWriteups?: Record<string, string>;
  vis: PrintVisibility;
}) {
  const stepGroups: { label: string; tasks: KanbanTask[]; writeup?: string }[] = [];

  if (formula) {
    for (const step of formula.steps) {
      const stepTasks = tasks.filter(
        (t) => t.formulaStepId === step.id && !t.forwardedFromTaskId && t.status !== "complete"
      );
      if (stepTasks.length > 0) {
        stepGroups.push({
          label: `Step ${step.stepNumber}: ${step.description}`,
          tasks: stepTasks,
          writeup: stepWriteups?.[step.id],
        });
      }
    }
  }

  const additional = tasks.filter(
    (t) => !t.formulaStepId && !t.forwardedFromTaskId && t.status !== "complete"
  );
  if (additional.length > 0) {
    stepGroups.push({ label: "Additional Targets", tasks: additional });
  }

  const forwarded = tasks.filter(
    (t) => !!t.forwardedFromTaskId && t.status !== "complete"
  );
  if (forwarded.length > 0) {
    stepGroups.push({ label: "From Previous Weeks", tasks: forwarded });
  }

  return (
    <div className="space-y-4">
      {stepGroups.map((group, i) => (
        <div key={i}>
          <div className="font-semibold uppercase tracking-widest text-stone-500 pb-1.5 mb-2" style={{ fontSize: "0.75em" }}>
            {group.label}
          </div>
          {group.writeup && (
            <p className="text-stone-500 italic mb-2" style={{ fontSize: "0.85em" }}>
              {group.writeup}
            </p>
          )}
          <div className="space-y-2">
            {group.tasks.map((task) => (
              <PreviewTask key={task.id} task={task} layout="formula" vis={vis} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MainBoardFormulaPreview({
  groups,
  vis,
}: {
  groups: { label: string; tasks: KanbanTask[]; substeps?: { label: string; tasks: KanbanTask[]; writeup?: string }[] }[];
  vis: PrintVisibility;
}) {
  return (
    <div className="space-y-4">
      {groups.map((group, i) =>
        group.substeps ? (
          <div key={i}>
            <div className="font-semibold uppercase tracking-widest text-stone-500 pb-1.5 mb-2" style={{ fontSize: "0.75em" }}>
              {group.label}
            </div>
            <div className="space-y-3 ml-1">
              {group.substeps.map((sub, j) => (
                <div key={j}>
                  <div className="text-stone-500 font-medium mb-1.5" style={{ fontSize: "0.85em" }}>
                    {sub.label}
                  </div>
                  {sub.writeup && (
                    <p className="text-stone-400 italic mb-1.5 ml-1" style={{ fontSize: "0.8em" }}>
                      {sub.writeup}
                    </p>
                  )}
                  <div className="space-y-2">
                    {sub.tasks.map((task) => (
                      <PreviewTask key={task.id} task={task} layout="formula" vis={vis} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <PreviewSection key={i} title={group.label} tasks={group.tasks} layout="formula" vis={vis} />
        )
      )}
    </div>
  );
}

function PriorityPreview({
  tasks,
  bps,
  vis,
}: {
  tasks: KanbanTask[];
  bps: { id: string; formulaCode?: string }[];
  vis: PrintVisibility;
}) {
  const levels: Priority[] = ["high", "medium", "low", "none"];
  const groups = levels
    .map((level) => ({
      label: PRIORITY_SECTION_LABELS[level],
      tasks: tasks
        .filter((t) => (t.priority || "none") === level)
        .sort((a, b) => {
          const aKey = a.formulaStepId ? getFormulaSortKey(a.formulaStepId) : -1;
          const bKey = b.formulaStepId ? getFormulaSortKey(b.formulaStepId) : -1;
          if (aKey !== bKey) return bKey - aKey;
          return a.order - b.order;
        }),
    }))
    .filter((g) => g.tasks.length > 0);

  return (
    <div className="space-y-4">
      {groups.map((group, i) => (
        <PreviewSection key={i} title={group.label} tasks={group.tasks} layout="priority" vis={vis} />
      ))}
    </div>
  );
}

function PreviewTask({ task, layout, vis }: { task: KanbanTask; layout: LayoutMode; vis: PrintVisibility }) {
  const stepLabel = task.formulaStepId ? getStepLabel(task.formulaStepId) : "";
  const hasPriority = task.priority && task.priority !== "none";
  const isForwardedIn = !!task.forwardedFromTaskId;
  const isForwardedAway = !!task.forwardedToTaskId;

  return (
    <div className={cn("flex items-start gap-3", isForwardedAway && "opacity-40")}>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-black leading-snug">{task.title}</p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap" style={{ fontSize: "0.8em" }}>
          {vis.formulaBadge && stepLabel && layout !== "formula" && (
            <span className="px-1 py-0.5 rounded bg-stone-100 text-stone-500">{stepLabel}</span>
          )}
          {vis.priority && hasPriority && layout !== "priority" && (
            <span className="text-stone-400">{PRIORITY_LABELS[task.priority!]}</span>
          )}
          {vis.category && task.category && (
            <span className="px-1 py-0.5 rounded bg-stone-50 text-stone-400">{task.category}</span>
          )}
          {vis.forwardedTags && isForwardedIn && (
            <span className="px-1 py-0.5 rounded bg-blue-50 text-blue-500">Prev. week</span>
          )}
          {vis.forwardedTags && isForwardedAway && (
            <span className="px-1 py-0.5 rounded bg-stone-100 text-stone-400">Forwarded</span>
          )}
          {vis.bugged && task.bugged && (
            <span className="text-red-400 font-medium">Bugged</span>
          )}
        </div>
        {vis.targetDescription && (() => {
          let desc = task.description || "";
          // In non-formula views, derive description from step if missing
          if (!desc && task.formulaStepId && layout !== "formula") {
            const s = getStepById(task.formulaStepId);
            if (s) desc = `Step ${s.stepNumber}: ${s.description}`;
          }
          // In formula view, suppress if it matches the step text (redundant with header)
          if (layout === "formula" && desc && task.formulaStepId) {
            const s = getStepById(task.formulaStepId);
            if (s && desc === `Step ${s.stepNumber}: ${s.description}`) desc = "";
          }
          return desc ? (
            <p className="text-stone-500 mt-0.5 leading-relaxed" style={{ fontSize: "0.9em" }}>
              {desc}
            </p>
          ) : null;
        })()}
      </div>
      {vis.doneLine && (
        <div className="shrink-0 text-stone-700 border-b-2 border-stone-500 pb-0.5 mt-0.5" style={{ fontSize: "0.75em", minWidth: "90px" }}>
          Done:
        </div>
      )}
    </div>
  );
}
