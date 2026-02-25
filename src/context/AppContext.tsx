"use client";

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type { AppState, AppAction, KanbanTask, PriorityShortcuts, User, TaskNote, BPNote, WeeklyBattlePlanWithProgress, BoardSortMode, WeekSettings, DateFormatType, SidebarSectionId, AccentColor, RecurrenceRule, StatDefinition, StatEntry, StatsViewConfig, ES7ViewMode, ES7Config, StatQuota } from "@/lib/types";
import { DEFAULT_PRIORITY_SHORTCUTS, DEFAULT_SIDEBAR_ORDER } from "@/lib/types";
import { DEFAULT_WEEK_SETTINGS } from "@/lib/dateUtils";
import { generateId, reassignOrder, getAccentClasses, type AccentColorConfig } from "@/lib/utils";
import { tasksApi, notesApi, settingsApi, categoriesApi, authApi, relationshipsApi, taskNotesApi, bpNotesApi, weeklyBPApi, statsApi } from "@/lib/api";

const initialState: AppState = {
  user: null,
  isAuthLoading: true,
  tasks: [],
  notes: [],
  activeNoteId: null,
  sidebarOpen: true,
  customCategories: [],
  categoryFilter: [],
  priorityShortcuts: DEFAULT_PRIORITY_SHORTCUTS,
  tasksCollapsed: false,
  notesCollapsed: false,
  buggedFilter: false,
  formulaStepFilter: [],
  viewingJunior: null,
  juniorTasks: [],
  juniorTaskNotes: {},
  myJuniors: [],
  myTaskNotes: {},
  unreadNoteCount: 0,
  myBPNotes: {},
  unreadBPNoteCount: 0,
  juniorBPNotes: {},
  myInfoTerminals: [],
  viewableAsInfoTerminal: [],
  viewingInfoTerminal: null,
  infoTerminalTasks: [],
  infoTerminalTaskNotes: {},
  infoTerminalBPNotes: {},
  infoTerminalWeeklyBPs: [],
  weeklyBattlePlans: [],
  activeWeeklyBpId: null,
  juniorWeeklyBPs: [],
  sortMode: "priority-formula" as BoardSortMode,
  weekSettings: DEFAULT_WEEK_SETTINGS,
  dateFormat: "dd-MMM-yy" as DateFormatType,
  accentColor: "amber" as AccentColor,
  sidebarOrder: DEFAULT_SIDEBAR_ORDER,
  showStepDescriptions: true,
  viewingStats: false,
  statDefinitions: [],
  statEntries: {},
  selectedStatId: null,
  statsViewConfig: {
    periodType: "daily",
    rangePreset: "30d",
    yAxisAuto: true,
    yAxisRightAuto: true,
  },
  statsSidebarOpen: true,
  statGraphUseAccentColor: false,
  statGraphUpColor: "",
  statGraphDownColor: "",
  overlayConfig: null,
  es7ViewMode: "standard" as ES7ViewMode,
  es7Config: { weekOffset: 0, showPrevWeek: false, showDailyValues: false } as ES7Config,
  statQuotas: {},
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_USER":
      return { ...state, user: action.payload, isAuthLoading: false };

    case "SET_AUTH_LOADING":
      return { ...state, isAuthLoading: action.payload };

    case "HYDRATE":
      return { ...state, ...action.payload };

    // ---- Kanban ----
    case "SET_TASKS": {
      return { ...state, tasks: action.payload };
    }

    case "ADD_TASK": {
      const columnTasks = state.tasks.filter(
        (t) => t.status === action.payload.status
      );
      const newTask: KanbanTask = {
        id: generateId(),
        title: action.payload.title,
        description: action.payload.description,
        status: action.payload.status,
        order: columnTasks.length,
        createdAt: new Date().toISOString(),
        label: action.payload.label || "none",
        priority: action.payload.priority || "none",
        category: action.payload.category,
        bugged: action.payload.bugged,
        weeklyBpId: action.payload.weeklyBpId,
        formulaStepId: action.payload.formulaStepId,
        dueAt: action.payload.dueAt,
        reminderAt: action.payload.reminderAt,
        recurrenceRule: action.payload.recurrenceRule,
      };
      return { ...state, tasks: [...state.tasks, newTask], _pendingTask: newTask } as AppState & { _pendingTask: KanbanTask };
    }

    case "UPDATE_TASK": {
      const { id, ...updates } = action.payload;
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        _pendingUpdate: { id, updates },
      } as AppState & { _pendingUpdate: { id: string; updates: Partial<KanbanTask> } };
    }

    case "DELETE_TASK": {
      const task = state.tasks.find((t) => t.id === action.payload.id);
      if (!task) return state;
      const remaining = state.tasks.filter((t) => t.id !== action.payload.id);
      const columnTasks = remaining
        .filter((t) => t.status === task.status)
        .sort((a, b) => a.order - b.order);
      const reordered = reassignOrder(columnTasks);
      return {
        ...state,
        tasks: remaining.map(
          (t) => reordered.find((r) => r.id === t.id) || t
        ),
        _pendingDelete: action.payload.id,
      } as AppState & { _pendingDelete: string };
    }

    case "MOVE_TASK": {
      const { taskId, toStatus, toIndex } = action.payload;
      const task = state.tasks.find((t) => t.id === taskId);
      if (!task) return state;

      const sourceStatus = task.status;
      const withoutTask = state.tasks.filter((t) => t.id !== taskId);
      const destTasks = withoutTask
        .filter((t) => t.status === toStatus)
        .sort((a, b) => a.order - b.order);

      const movedTask = { ...task, status: toStatus };
      destTasks.splice(toIndex, 0, movedTask);
      const reorderedDest = reassignOrder(destTasks);

      let reorderedSource: KanbanTask[] = [];
      if (sourceStatus !== toStatus) {
        const sourceTasks = withoutTask
          .filter((t) => t.status === sourceStatus)
          .sort((a, b) => a.order - b.order);
        reorderedSource = reassignOrder(sourceTasks);
      }

      const updatedIds = new Set([
        ...reorderedDest.map((t) => t.id),
        ...reorderedSource.map((t) => t.id),
      ]);

      const newTasks = [
        ...withoutTask.filter((t) => !updatedIds.has(t.id)),
        ...reorderedDest,
        ...reorderedSource,
      ];

      return {
        ...state,
        tasks: newTasks,
        _pendingReorder: [...reorderedDest, ...reorderedSource].map((t) => ({
          id: t.id,
          order: t.order,
          status: t.status,
        })),
      } as AppState & { _pendingReorder: { id: string; order: number; status: string }[] };
    }

    case "REORDER_TASK": {
      const { taskId, toIndex } = action.payload;
      const task = state.tasks.find((t) => t.id === taskId);
      if (!task) return state;

      const columnTasks = state.tasks
        .filter((t) => t.status === task.status)
        .sort((a, b) => a.order - b.order);

      const oldIndex = columnTasks.findIndex((t) => t.id === taskId);
      if (oldIndex === toIndex) return state;

      const reordered = [...columnTasks];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(toIndex, 0, moved);
      const withNewOrder = reassignOrder(reordered);

      const updatedIds = new Set(withNewOrder.map((t) => t.id));
      return {
        ...state,
        tasks: [
          ...state.tasks.filter((t) => !updatedIds.has(t.id)),
          ...withNewOrder,
        ],
        _pendingReorder: withNewOrder.map((t) => ({
          id: t.id,
          order: t.order,
          status: t.status,
        })),
      } as AppState & { _pendingReorder: { id: string; order: number; status: string }[] };
    }

    // ---- Notes ----
    case "ADD_NOTE": {
      const now = new Date().toISOString();
      const newNote = {
        id: generateId(),
        title: action.payload.title || "Untitled",
        content: action.payload.content,
        createdAt: now,
        updatedAt: now,
      };
      return {
        ...state,
        notes: [...state.notes, newNote],
        activeNoteId: null,
        _pendingNote: newNote,
      } as AppState & { _pendingNote: typeof newNote };
    }

    case "UPDATE_NOTE": {
      const { id, ...updates } = action.payload;
      const updatedAt = new Date().toISOString();
      return {
        ...state,
        notes: state.notes.map((n) =>
          n.id === id
            ? { ...n, ...updates, updatedAt }
            : n
        ),
        _pendingNoteUpdate: { id, updates: { ...updates, updatedAt } },
      } as AppState & { _pendingNoteUpdate: { id: string; updates: Record<string, unknown> } };
    }

    case "DELETE_NOTE": {
      const filtered = state.notes.filter((n) => n.id !== action.payload.id);
      const newActiveId =
        state.activeNoteId === action.payload.id ? null : state.activeNoteId;
      return {
        ...state,
        notes: filtered,
        activeNoteId: newActiveId,
        _pendingNoteDelete: action.payload.id,
      } as AppState & { _pendingNoteDelete: string };
    }

    case "SET_ACTIVE_NOTE": {
      return { ...state, activeNoteId: action.payload.id };
    }

    // ---- Sidebar ----
    case "TOGGLE_SIDEBAR": {
      const newValue = !state.sidebarOpen;
      return { ...state, sidebarOpen: newValue, _pendingSetting: { key: "sidebarOpen", value: newValue } } as AppState & { _pendingSetting: { key: string; value: unknown } };
    }

    // ---- Categories ----
    case "ADD_CUSTOM_CATEGORY": {
      const name = action.payload.name.trim();
      if (!name || state.customCategories.includes(name)) return state;
      return {
        ...state,
        customCategories: [...state.customCategories, name],
        _pendingCategory: { action: "add", name },
      } as AppState & { _pendingCategory: { action: string; name: string } };
    }

    case "DELETE_CUSTOM_CATEGORY": {
      return {
        ...state,
        customCategories: state.customCategories.filter(
          (c) => c !== action.payload.name
        ),
        categoryFilter: state.categoryFilter.filter(
          (c) => c !== action.payload.name
        ),
        tasks: state.tasks.map((t) =>
          t.category === action.payload.name ? { ...t, category: undefined } : t
        ),
        _pendingCategory: { action: "delete", name: action.payload.name },
      } as AppState & { _pendingCategory: { action: string; name: string } };
    }

    case "SET_CATEGORY_FILTER": {
      return {
        ...state,
        categoryFilter: action.payload.categories,
        _pendingSetting: { key: "categoryFilter", value: action.payload.categories },
      } as AppState & { _pendingSetting: { key: string; value: unknown } };
    }

    // ---- Settings ----
    case "UPDATE_PRIORITY_SHORTCUTS": {
      return {
        ...state,
        priorityShortcuts: action.payload,
        _pendingSetting: { key: "priorityShortcuts", value: action.payload },
      } as AppState & { _pendingSetting: { key: string; value: unknown } };
    }

    // ---- Collapse ----
    case "TOGGLE_TASKS_COLLAPSED": {
      const newValue = !state.tasksCollapsed;
      return {
        ...state,
        tasksCollapsed: newValue,
        _pendingSetting: { key: "tasksCollapsed", value: newValue },
      } as AppState & { _pendingSetting: { key: string; value: unknown } };
    }

    case "TOGGLE_NOTES_COLLAPSED": {
      const newValue = !state.notesCollapsed;
      return {
        ...state,
        notesCollapsed: newValue,
        _pendingSetting: { key: "notesCollapsed", value: newValue },
      } as AppState & { _pendingSetting: { key: string; value: unknown } };
    }

    // ---- Bugged Filter ----
    case "TOGGLE_BUGGED_FILTER": {
      const newValue = !state.buggedFilter;
      return {
        ...state,
        buggedFilter: newValue,
        _pendingSetting: { key: "buggedFilter", value: newValue },
      } as AppState & { _pendingSetting: { key: string; value: unknown } };
    }

    case "SET_FORMULA_STEP_FILTER": {
      return {
        ...state,
        formulaStepFilter: action.payload,
      };
    }

    // ---- Junior Viewing ----
    case "SET_VIEWING_JUNIOR": {
      return {
        ...state,
        viewingJunior: action.payload.junior,
        juniorTasks: action.payload.tasks,
        juniorTaskNotes: action.payload.notes,
        // Clear stats view when switching to junior board
        ...(action.payload.junior ? { viewingStats: false } : {}),
      };
    }

    case "ADD_JUNIOR_TASK_NOTE": {
      const { taskId, note } = action.payload;
      const currentNotes = state.juniorTaskNotes[taskId] || [];
      return {
        ...state,
        juniorTaskNotes: {
          ...state.juniorTaskNotes,
          [taskId]: [...currentNotes, note],
        },
      };
    }

    case "SET_MY_JUNIORS": {
      return {
        ...state,
        myJuniors: action.payload,
      };
    }

    // ---- Profile ----
    case "UPDATE_USER_PROFILE": {
      if (!state.user) return state;
      return {
        ...state,
        user: { ...state.user, ...action.payload },
      };
    }

    // ---- Task Notes on My Tasks ----
    case "SET_MY_TASK_NOTES": {
      return {
        ...state,
        myTaskNotes: action.payload.notes,
        unreadNoteCount: action.payload.unreadCount,
      };
    }

    case "ADD_MY_TASK_NOTE": {
      const { taskId, note } = action.payload;
      const currentNotes = state.myTaskNotes[taskId] || [];
      return {
        ...state,
        myTaskNotes: {
          ...state.myTaskNotes,
          [taskId]: [...currentNotes, note],
        },
      };
    }

    case "MARK_NOTES_READ": {
      const { taskId } = action.payload;
      const taskNotes = state.myTaskNotes[taskId] || [];
      const updatedNotes = taskNotes.map((n) => ({
        ...n,
        readAt: n.readAt || new Date().toISOString(),
      }));
      // Recalculate unread count
      let newUnreadCount = 0;
      const newMyTaskNotes = { ...state.myTaskNotes, [taskId]: updatedNotes };
      for (const notes of Object.values(newMyTaskNotes)) {
        for (const note of notes) {
          if (!note.readAt && note.authorId !== state.user?.id) {
            newUnreadCount++;
          }
        }
      }
      return {
        ...state,
        myTaskNotes: newMyTaskNotes,
        unreadNoteCount: newUnreadCount,
      };
    }

    // ---- BP Notes on My BPs ----
    case "SET_MY_BP_NOTES": {
      return {
        ...state,
        myBPNotes: action.payload.notes,
        unreadBPNoteCount: action.payload.unreadCount,
      };
    }

    case "ADD_MY_BP_NOTE": {
      const { bpId, note } = action.payload;
      const currentNotes = state.myBPNotes[bpId] || [];
      return {
        ...state,
        myBPNotes: {
          ...state.myBPNotes,
          [bpId]: [...currentNotes, note],
        },
      };
    }

    case "MARK_BP_NOTES_READ": {
      const { bpId } = action.payload;
      const bpNotes = state.myBPNotes[bpId] || [];
      const updatedNotes = bpNotes.map((n) => ({
        ...n,
        readAt: n.readAt || new Date().toISOString(),
      }));
      // Recalculate unread count
      let newUnreadCount = 0;
      const newMyBPNotes = { ...state.myBPNotes, [bpId]: updatedNotes };
      for (const notes of Object.values(newMyBPNotes)) {
        for (const note of notes) {
          if (!note.readAt && note.authorId !== state.user?.id) {
            newUnreadCount++;
          }
        }
      }
      return {
        ...state,
        myBPNotes: newMyBPNotes,
        unreadBPNoteCount: newUnreadCount,
      };
    }

    case "SET_JUNIOR_BP_NOTES": {
      return {
        ...state,
        juniorBPNotes: action.payload,
      };
    }

    case "ADD_JUNIOR_BP_NOTE": {
      const { bpId, note } = action.payload;
      const currentNotes = state.juniorBPNotes[bpId] || [];
      return {
        ...state,
        juniorBPNotes: {
          ...state.juniorBPNotes,
          [bpId]: [...currentNotes, note],
        },
      };
    }

    // ---- Weekly Battle Plans ----
    case "SET_WEEKLY_BPS": {
      return {
        ...state,
        weeklyBattlePlans: action.payload,
      };
    }

    case "ADD_WEEKLY_BP": {
      return {
        ...state,
        weeklyBattlePlans: [action.payload, ...state.weeklyBattlePlans],
      };
    }

    case "UPDATE_WEEKLY_BP": {
      return {
        ...state,
        weeklyBattlePlans: state.weeklyBattlePlans.map((bp) =>
          bp.id === action.payload.id ? action.payload : bp
        ),
      };
    }

    case "DELETE_WEEKLY_BP": {
      return {
        ...state,
        weeklyBattlePlans: state.weeklyBattlePlans.filter((bp) => bp.id !== action.payload.id),
        activeWeeklyBpId: state.activeWeeklyBpId === action.payload.id ? null : state.activeWeeklyBpId,
      };
    }

    case "SET_ACTIVE_WEEKLY_BP": {
      return {
        ...state,
        activeWeeklyBpId: action.payload,
      };
    }

    case "SET_JUNIOR_WEEKLY_BPS": {
      return {
        ...state,
        juniorWeeklyBPs: action.payload,
      };
    }

    // ---- Board Sorting & Display Settings ----
    case "SET_SORT_MODE": {
      return {
        ...state,
        sortMode: action.payload,
        _pendingSetting: { key: "sortMode", value: action.payload },
      } as AppState & { _pendingSetting: { key: string; value: unknown } };
    }

    case "UPDATE_WEEK_SETTINGS": {
      return {
        ...state,
        weekSettings: action.payload,
        _pendingSetting: { key: "weekSettings", value: action.payload },
      } as AppState & { _pendingSetting: { key: string; value: unknown } };
    }

    case "SET_DATE_FORMAT": {
      return {
        ...state,
        dateFormat: action.payload,
        _pendingSetting: { key: "dateFormat", value: action.payload },
      } as AppState & { _pendingSetting: { key: string; value: unknown } };
    }

    case "SET_ACCENT_COLOR": {
      return {
        ...state,
        accentColor: action.payload,
        _pendingSetting: { key: "accentColor", value: action.payload },
      } as AppState & { _pendingSetting: { key: string; value: unknown } };
    }

    case "SET_SHOW_STEP_DESCRIPTIONS": {
      return {
        ...state,
        showStepDescriptions: action.payload,
        _pendingSetting: { key: "showStepDescriptions", value: action.payload },
      } as AppState & { _pendingSetting: { key: string; value: unknown } };
    }

    case "SET_SIDEBAR_ORDER": {
      return {
        ...state,
        sidebarOrder: action.payload,
        _pendingSetting: { key: "sidebarOrder", value: action.payload },
      } as AppState & { _pendingSetting: { key: string; value: unknown } };
    }

    // ---- Info Terminals ----
    case "SET_MY_INFO_TERMINALS": {
      return {
        ...state,
        myInfoTerminals: action.payload,
      };
    }

    case "SET_VIEWABLE_AS_INFO_TERMINAL": {
      return {
        ...state,
        viewableAsInfoTerminal: action.payload,
      };
    }

    case "SET_VIEWING_INFO_TERMINAL": {
      return {
        ...state,
        viewingInfoTerminal: action.payload.user,
        infoTerminalTasks: action.payload.tasks,
        infoTerminalTaskNotes: action.payload.taskNotes,
        infoTerminalBPNotes: action.payload.bpNotes,
        infoTerminalWeeklyBPs: action.payload.weeklyBPs,
        // Clear stats view when switching to info terminal board
        ...(action.payload.user ? { viewingStats: false } : {}),
      };
    }

    case "ADD_INFO_TERMINAL_TASK_NOTE": {
      const { taskId, note } = action.payload;
      const currentNotes = state.infoTerminalTaskNotes[taskId] || [];
      return {
        ...state,
        infoTerminalTaskNotes: {
          ...state.infoTerminalTaskNotes,
          [taskId]: [...currentNotes, note],
        },
      };
    }

    case "ADD_INFO_TERMINAL_BP_NOTE": {
      const { bpId, note } = action.payload;
      const currentNotes = state.infoTerminalBPNotes[bpId] || [];
      return {
        ...state,
        infoTerminalBPNotes: {
          ...state.infoTerminalBPNotes,
          [bpId]: [...currentNotes, note],
        },
      };
    }

    // ---- Stats & Graphs ----
    case "SET_VIEWING_STATS": {
      return {
        ...state,
        viewingStats: action.payload,
        _pendingSetting: { key: "viewingStats", value: action.payload },
      } as AppState & { _pendingSetting: { key: string; value: unknown } };
    }

    case "SET_STAT_DEFINITIONS": {
      return { ...state, statDefinitions: action.payload };
    }

    case "ADD_STAT_DEFINITION": {
      return { ...state, statDefinitions: [...state.statDefinitions, action.payload] };
    }

    case "UPDATE_STAT_DEFINITION": {
      return {
        ...state,
        statDefinitions: state.statDefinitions.map((sd) =>
          sd.id === action.payload.id ? action.payload : sd
        ),
      };
    }

    case "DELETE_STAT_DEFINITION": {
      const { id } = action.payload;
      const newEntries = { ...state.statEntries };
      delete newEntries[id];
      return {
        ...state,
        statDefinitions: state.statDefinitions.filter((sd) => sd.id !== id),
        statEntries: newEntries,
        selectedStatId: state.selectedStatId === id ? null : state.selectedStatId,
        overlayConfig: state.overlayConfig?.statId === id ? null : state.overlayConfig,
      };
    }

    case "SET_STAT_ENTRIES": {
      return {
        ...state,
        statEntries: {
          ...state.statEntries,
          [action.payload.statId]: action.payload.entries,
        },
      };
    }

    case "ADD_STAT_ENTRY": {
      const entry = action.payload;
      const existing = state.statEntries[entry.statId] || [];
      // Replace if same date+periodType, otherwise add
      const idx = existing.findIndex((e) => e.date === entry.date && e.periodType === entry.periodType);
      let updated;
      if (idx >= 0) {
        updated = [...existing];
        updated[idx] = entry;
      } else {
        updated = [...existing, entry].sort((a, b) => a.date.localeCompare(b.date));
      }
      return {
        ...state,
        statEntries: { ...state.statEntries, [entry.statId]: updated },
      };
    }

    case "UPDATE_STAT_ENTRY": {
      const entry = action.payload;
      const entries = state.statEntries[entry.statId] || [];
      return {
        ...state,
        statEntries: {
          ...state.statEntries,
          [entry.statId]: entries.map((e) => (e.id === entry.id ? entry : e)),
        },
      };
    }

    case "DELETE_STAT_ENTRY": {
      const { id: entryId, statId } = action.payload;
      const entries = state.statEntries[statId] || [];
      return {
        ...state,
        statEntries: {
          ...state.statEntries,
          [statId]: entries.filter((e) => e.id !== entryId),
        },
      };
    }

    case "SET_SELECTED_STAT": {
      return {
        ...state,
        selectedStatId: action.payload,
        overlayConfig: null,
        _pendingSetting: { key: "selectedStatId", value: action.payload },
      } as AppState & { _pendingSetting: { key: string; value: unknown } };
    }

    case "SET_STATS_VIEW_CONFIG": {
      return {
        ...state,
        statsViewConfig: { ...state.statsViewConfig, ...action.payload },
      };
    }

    case "TOGGLE_STATS_SIDEBAR": {
      const newValue = !state.statsSidebarOpen;
      return {
        ...state,
        statsSidebarOpen: newValue,
        _pendingSetting: { key: "statsSidebarOpen", value: newValue },
      } as AppState & { _pendingSetting: { key: string; value: unknown } };
    }

    case "SET_STAT_GRAPH_COLORS": {
      return {
        ...state,
        statGraphUseAccentColor: action.payload.useAccent,
        statGraphUpColor: action.payload.upColor,
        statGraphDownColor: action.payload.downColor,
        _pendingSetting: { key: "statGraphColors", value: action.payload },
      } as AppState & { _pendingSetting: { key: string; value: unknown } };
    }

    case "SET_OVERLAY_CONFIG": {
      return { ...state, overlayConfig: action.payload };
    }

    case "SET_OVERLAY_OFFSET": {
      if (!state.overlayConfig) return state;
      return {
        ...state,
        overlayConfig: { ...state.overlayConfig, offsetPeriods: action.payload },
      };
    }

    // ---- Exec Series 7 ----
    case "SET_ES7_VIEW_MODE": {
      return {
        ...state,
        es7ViewMode: action.payload,
        _pendingSetting: { key: "es7ViewMode", value: action.payload },
      } as AppState & { _pendingSetting: { key: string; value: unknown } };
    }

    case "SET_ES7_CONFIG": {
      return {
        ...state,
        es7Config: { ...state.es7Config, ...action.payload },
      };
    }

    case "SET_STAT_QUOTA": {
      const q = action.payload;
      const key = `${q.statId}:${q.weekEndingDate}`;
      return {
        ...state,
        statQuotas: { ...state.statQuotas, [key]: q },
      };
    }

    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshJuniors: () => Promise<void>;
  refreshMyNotes: () => Promise<void>;
  refreshMyBPNotes: () => Promise<void>;
  refreshWeeklyBPs: () => Promise<void>;
  refreshTasks: () => Promise<void>;
  refreshInfoTerminals: () => Promise<void>;
  refreshStats: () => Promise<void>;
} | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const hydrated = useRef(false);
  const processedOps = useRef(new Set<string>());

  // Check for existing session on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const { user } = await authApi.getCurrentUser();

        // Load user data (HYDRATE) BEFORE setting user — this ensures
        // viewingStats and other persisted settings are already in state
        // when isAuthLoading becomes false, preventing a flash of BP view
        if (user) {
          await loadUserData();
        }
        dispatch({ type: "SET_USER", payload: user });
      } catch (error) {
        console.error("Error checking auth:", error);
        dispatch({ type: "SET_USER", payload: null });
      }
    }

    checkAuth();
  }, []);

  // Load user data from API
  async function loadUserData() {
    try {
      const [tasks, notes, settings, customCategories, juniorsData, myNotesData, myBPNotesData, weeklyBPsData, myInfoTerminals, viewableInfoTerminals, statsData] = await Promise.all([
        tasksApi.getAll(),
        notesApi.getAll(),
        settingsApi.getAll(),
        categoriesApi.getAll(),
        relationshipsApi.getMyJuniors().catch(() => ({ juniors: [] })),
        taskNotesApi.getMyNotes().catch(() => ({ notes: {}, unreadCount: 0 })),
        bpNotesApi.getMyNotes().catch(() => ({ notes: {}, unreadCount: 0 })),
        weeklyBPApi.getAll().catch(() => ({ weeklyBattlePlans: [] })),
        fetch("/api/info-terminals/my-viewers").then(r => r.json()).catch(() => ({ viewers: [] })),
        fetch("/api/info-terminals/viewable").then(r => r.json()).catch(() => ({ boards: [] })),
        statsApi.getAll().catch(() => ({ stats: [] })),
      ]);

      dispatch({
        type: "HYDRATE",
        payload: {
          tasks: tasks || [],
          notes: notes || [],
          activeNoteId: settings?.activeNoteId ?? null,
          sidebarOpen: settings?.sidebarOpen ?? true,
          customCategories: customCategories || [],
          categoryFilter: settings?.categoryFilter || [],
          priorityShortcuts: {
            ...DEFAULT_PRIORITY_SHORTCUTS,
            ...(settings?.priorityShortcuts || {}),
          },
          tasksCollapsed: settings?.tasksCollapsed ?? false,
          notesCollapsed: settings?.notesCollapsed ?? false,
          buggedFilter: settings?.buggedFilter ?? false,
          viewingJunior: null,
          juniorTasks: [],
          juniorTaskNotes: {},
          myJuniors: juniorsData?.juniors || [],
          myTaskNotes: myNotesData?.notes || {},
          unreadNoteCount: myNotesData?.unreadCount || 0,
          myBPNotes: myBPNotesData?.notes || {},
          unreadBPNoteCount: myBPNotesData?.unreadCount || 0,
          juniorBPNotes: {},
          myInfoTerminals: myInfoTerminals?.viewers || [],
          viewableAsInfoTerminal: viewableInfoTerminals?.boards || [],
          viewingInfoTerminal: null,
          infoTerminalTasks: [],
          infoTerminalTaskNotes: {},
          infoTerminalBPNotes: {},
          infoTerminalWeeklyBPs: [],
          weeklyBattlePlans: weeklyBPsData?.weeklyBattlePlans || [],
          activeWeeklyBpId: null,
          juniorWeeklyBPs: [],
          sortMode: (settings?.sortMode as BoardSortMode) || "priority-formula",
          weekSettings: settings?.weekSettings || DEFAULT_WEEK_SETTINGS,
          dateFormat: (settings?.dateFormat as DateFormatType) || "dd-MMM-yy",
          accentColor: (settings?.accentColor as AccentColor) || "amber",
          sidebarOrder: (settings?.sidebarOrder as SidebarSectionId[]) || DEFAULT_SIDEBAR_ORDER,
          formulaStepFilter: [],
          showStepDescriptions: settings?.showStepDescriptions ?? true,
          viewingStats: settings?.viewingStats ?? false,
          statDefinitions: statsData?.stats || [],
          statEntries: {},
          selectedStatId: (settings?.selectedStatId as string) || null,
          statsViewConfig: {
            periodType: "daily",
            rangePreset: "30d",
            yAxisAuto: true,
            yAxisRightAuto: true,
          },
          statsSidebarOpen: settings?.statsSidebarOpen ?? true,
          statGraphUseAccentColor: (settings?.statGraphColors as { useAccent?: boolean })?.useAccent ?? false,
          statGraphUpColor: (settings?.statGraphColors as { upColor?: string })?.upColor || "",
          statGraphDownColor: (settings?.statGraphColors as { downColor?: string })?.downColor || "",
          overlayConfig: null,
          es7ViewMode: (settings?.es7ViewMode as ES7ViewMode) || "standard",
          es7Config: { weekOffset: 0, showPrevWeek: false, showDailyValues: false },
          statQuotas: {},
        },
      });

      requestAnimationFrame(() => {
        hydrated.current = true;
      });
    } catch (error) {
      console.error("Failed to load data:", error);
      hydrated.current = true;
    }
  }

  // Login function
  async function login(username: string, password: string) {
    const { user } = await authApi.login(username, password);
    await loadUserData();
    dispatch({ type: "SET_USER", payload: user });
  }

  // Register function
  async function register(username: string, password: string) {
    const { user } = await authApi.register(username, password);
    dispatch({ type: "SET_USER", payload: user });
    // New user starts with empty data, no need to load
    hydrated.current = true;
  }

  // Logout function
  async function logout() {
    await authApi.logout();
    dispatch({ type: "SET_USER", payload: null });
    // Reset to initial state
    dispatch({
      type: "HYDRATE",
      payload: {
        tasks: [],
        notes: [],
        activeNoteId: null,
        sidebarOpen: true,
        customCategories: [],
        categoryFilter: [],
        priorityShortcuts: DEFAULT_PRIORITY_SHORTCUTS,
        tasksCollapsed: false,
        notesCollapsed: false,
        buggedFilter: false,
  formulaStepFilter: [],
        viewingJunior: null,
        juniorTasks: [],
        juniorTaskNotes: {},
        myJuniors: [],
        myTaskNotes: {},
        unreadNoteCount: 0,
        myBPNotes: {},
        unreadBPNoteCount: 0,
        juniorBPNotes: {},
        myInfoTerminals: [],
        viewableAsInfoTerminal: [],
        viewingInfoTerminal: null,
        infoTerminalTasks: [],
        infoTerminalTaskNotes: {},
        infoTerminalBPNotes: {},
        infoTerminalWeeklyBPs: [],
        weeklyBattlePlans: [],
        activeWeeklyBpId: null,
        juniorWeeklyBPs: [],
        sortMode: "priority-formula",
        weekSettings: DEFAULT_WEEK_SETTINGS,
        dateFormat: "dd-MMM-yy",
        accentColor: "amber",
        sidebarOrder: DEFAULT_SIDEBAR_ORDER,
        showStepDescriptions: true,
        viewingStats: false,
        statDefinitions: [],
        statEntries: {},
        selectedStatId: null,
        statsViewConfig: {
          periodType: "daily",
          rangePreset: "30d",
          yAxisAuto: true,
          yAxisRightAuto: true,
        },
        statsSidebarOpen: true,
        statGraphUseAccentColor: false,
        statGraphUpColor: "",
        statGraphDownColor: "",
        overlayConfig: null,
        es7ViewMode: "standard",
        es7Config: { weekOffset: 0, showPrevWeek: false, showDailyValues: false },
        statQuotas: {},
      },
    });
    hydrated.current = false;
  }

  // Refresh juniors list (called after relationship changes)
  async function refreshJuniors() {
    try {
      const juniorsData = await relationshipsApi.getMyJuniors();
      dispatch({ type: "SET_MY_JUNIORS", payload: juniorsData?.juniors || [] });
    } catch (error) {
      console.error("Failed to refresh juniors:", error);
    }
  }

  // Refresh my task notes (notes from seniors on my tasks)
  async function refreshMyNotes() {
    try {
      const myNotesData = await taskNotesApi.getMyNotes();
      dispatch({
        type: "SET_MY_TASK_NOTES",
        payload: {
          notes: myNotesData?.notes || {},
          unreadCount: myNotesData?.unreadCount || 0,
        },
      });
    } catch (error) {
      console.error("Failed to refresh my notes:", error);
    }
  }

  // Refresh my BP notes (notes from seniors on my BPs)
  async function refreshMyBPNotes() {
    try {
      const myBPNotesData = await bpNotesApi.getMyNotes();
      dispatch({
        type: "SET_MY_BP_NOTES",
        payload: {
          notes: myBPNotesData?.notes || {},
          unreadCount: myBPNotesData?.unreadCount || 0,
        },
      });
    } catch (error) {
      console.error("Failed to refresh my BP notes:", error);
    }
  }

  // Refresh weekly battle plans
  async function refreshWeeklyBPs() {
    try {
      const weeklyBPsData = await weeklyBPApi.getAll();
      dispatch({
        type: "SET_WEEKLY_BPS",
        payload: weeklyBPsData?.weeklyBattlePlans || [],
      });
    } catch (error) {
      console.error("Failed to refresh weekly battle plans:", error);
    }
  }

  // Refresh tasks from server
  async function refreshTasks() {
    try {
      const tasks = await tasksApi.getAll();
      dispatch({
        type: "SET_TASKS",
        payload: tasks || [],
      });
    } catch (error) {
      console.error("Failed to refresh tasks:", error);
    }
  }

  // Refresh info terminals (my viewers and boards I can view)
  async function refreshInfoTerminals() {
    try {
      const [myTerminals, viewableBoards] = await Promise.all([
        fetch("/api/info-terminals/my-viewers").then(r => r.json()).catch(() => ({ viewers: [] })),
        fetch("/api/info-terminals/viewable").then(r => r.json()).catch(() => ({ boards: [] })),
      ]);
      dispatch({ type: "SET_MY_INFO_TERMINALS", payload: myTerminals?.viewers || [] });
      dispatch({ type: "SET_VIEWABLE_AS_INFO_TERMINAL", payload: viewableBoards?.boards || [] });
    } catch (error) {
      console.error("Failed to refresh info terminals:", error);
    }
  }

  // Refresh stats definitions from server
  async function refreshStats() {
    try {
      const statsData = await statsApi.getAll();
      dispatch({ type: "SET_STAT_DEFINITIONS", payload: statsData?.stats || [] });
    } catch (error) {
      console.error("Failed to refresh stats:", error);
    }
  }

  // Sync changes to API
  useEffect(() => {
    if (!hydrated.current || !state.user) return;

    const s = state as AppState & {
      _pendingTask?: KanbanTask;
      _pendingUpdate?: { id: string; updates: Partial<KanbanTask> };
      _pendingDelete?: string;
      _pendingReorder?: { id: string; order: number; status: string }[];
      _pendingNote?: { id: string; title: string; content: string; updatedAt: string };
      _pendingNoteUpdate?: { id: string; updates: Record<string, unknown> };
      _pendingNoteDelete?: string;
      _pendingSetting?: { key: string; value: unknown };
      _pendingCategory?: { action: string; name: string };
    };

    // Handle pending API calls (using refs to prevent duplicate calls)
    if (s._pendingTask) {
      const opKey = `task-create-${s._pendingTask.id}`;
      if (!processedOps.current.has(opKey)) {
        processedOps.current.add(opKey);
        tasksApi.create(s._pendingTask).catch(console.error);
      }
    }
    if (s._pendingUpdate) {
      const opKey = `task-update-${s._pendingUpdate.id}-${JSON.stringify(s._pendingUpdate.updates)}`;
      if (!processedOps.current.has(opKey)) {
        processedOps.current.add(opKey);
        tasksApi.update(s._pendingUpdate.id, s._pendingUpdate.updates).then((res) => {
          // If a recurring task was completed, add the new occurrence to state
          if (res?.newRecurringTask) {
            dispatch({ type: "SET_TASKS", payload: [...state.tasks.map(t => t.id === s._pendingUpdate!.id ? { ...t, recurrenceRule: undefined } : t), res.newRecurringTask] });
          }
        }).catch(console.error);
      }
    }
    if (s._pendingDelete) {
      const opKey = `task-delete-${s._pendingDelete}`;
      if (!processedOps.current.has(opKey)) {
        processedOps.current.add(opKey);
        tasksApi.delete(s._pendingDelete).catch(console.error);
      }
    }
    if (s._pendingReorder) {
      const opKey = `task-reorder-${JSON.stringify(s._pendingReorder)}`;
      if (!processedOps.current.has(opKey)) {
        processedOps.current.add(opKey);
        tasksApi.reorder(s._pendingReorder).catch(console.error);
      }
    }
    if (s._pendingNote) {
      const opKey = `note-create-${s._pendingNote.id}`;
      if (!processedOps.current.has(opKey)) {
        processedOps.current.add(opKey);
        notesApi.create(s._pendingNote).catch(console.error);
      }
    }
    if (s._pendingNoteUpdate) {
      const opKey = `note-update-${s._pendingNoteUpdate.id}-${JSON.stringify(s._pendingNoteUpdate.updates)}`;
      if (!processedOps.current.has(opKey)) {
        processedOps.current.add(opKey);
        notesApi.update(s._pendingNoteUpdate.id, s._pendingNoteUpdate.updates).catch(console.error);
      }
    }
    if (s._pendingNoteDelete) {
      const opKey = `note-delete-${s._pendingNoteDelete}`;
      if (!processedOps.current.has(opKey)) {
        processedOps.current.add(opKey);
        notesApi.delete(s._pendingNoteDelete).catch(console.error);
      }
    }
    if (s._pendingSetting) {
      const opKey = `setting-${s._pendingSetting.key}-${JSON.stringify(s._pendingSetting.value)}`;
      if (!processedOps.current.has(opKey)) {
        processedOps.current.add(opKey);
        settingsApi.set(s._pendingSetting.key, s._pendingSetting.value).catch(console.error);
      }
    }
    if (s._pendingCategory) {
      const opKey = `category-${s._pendingCategory.action}-${s._pendingCategory.name}`;
      if (!processedOps.current.has(opKey)) {
        processedOps.current.add(opKey);
        if (s._pendingCategory.action === "add") {
          categoriesApi.add(s._pendingCategory.name).catch(console.error);
        } else if (s._pendingCategory.action === "delete") {
          categoriesApi.delete(s._pendingCategory.name).catch(console.error);
        }
      }
    }

    // Clean up old operation keys to prevent memory leaks (keep last 100)
    if (processedOps.current.size > 100) {
      const keys = Array.from(processedOps.current);
      keys.slice(0, keys.length - 100).forEach((k) => processedOps.current.delete(k));
    }
  }, [state]);

  return (
    <AppContext.Provider value={{ state, dispatch, login, register, logout, refreshJuniors, refreshMyNotes, refreshMyBPNotes, refreshWeeklyBPs, refreshTasks, refreshInfoTerminals, refreshStats }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}

// Convenience hook for accent color
export function useAccentColor(): AccentColorConfig {
  const { state } = useAppContext();
  return getAccentClasses(state.accentColor);
}
