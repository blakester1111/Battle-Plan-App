// Auth types
export interface User {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  org?: "Day" | "Foundation";
  division?: number;
  department?: number;
  postTitle?: string;
  role: "admin" | "user";
  createdAt: string;
}

export interface UserRelationship {
  id: number;
  seniorId: string;
  juniorId: string;
  seniorUsername: string;
  seniorFirstName?: string;
  seniorLastName?: string;
  juniorUsername: string;
  juniorFirstName?: string;
  juniorLastName?: string;
}

export interface InfoTerminalRelationship {
  id: number;
  ownerId: string;
  viewerId: string;
  ownerUsername: string;
  ownerFirstName?: string;
  ownerLastName?: string;
  viewerUsername: string;
  viewerFirstName?: string;
  viewerLastName?: string;
}

export type NoteType = "senior" | "info";

export interface TaskNote {
  id: string;
  taskId: string;
  authorId: string;
  authorUsername: string;
  authorFirstName?: string;
  authorLastName?: string;
  content: string;
  createdAt: string;
  readAt?: string;
  taskTitle?: string; // For notifications
  noteType?: NoteType; // "senior" or "info"
}

export interface BPNote {
  id: string;
  bpId: string;
  authorId: string;
  authorUsername: string;
  authorFirstName?: string;
  authorLastName?: string;
  content: string;
  createdAt: string;
  readAt?: string;
  bpTitle?: string; // For notifications
  noteType?: NoteType; // "senior" or "info"
}

export type ColumnStatus = "todo" | "in-progress" | "complete";

export type CardLabel = "none" | "red" | "orange" | "yellow" | "green" | "blue" | "purple";

export type Priority = "none" | "low" | "medium" | "high";

// Board sorting
export type BoardSortMode = "priority-formula" | "formula" | "manual" | "overdue";

// Week settings
export interface WeekSettings {
  weekStartDay: number;   // 0-6 (Sunday-Saturday), default 4 (Thursday)
  weekStartHour: number;  // 0-23, default 14 (2pm)
  weekEndDay: number;     // 0-6, default 4 (Thursday)
  weekEndHour: number;    // 0-23, default 14 (2pm)
  timezone?: string;      // IANA timezone string, e.g., "America/New_York". If undefined, use browser local.
}

// Date format
export type DateFormatType = "dd-MMM-yy" | "MMM dd, yyyy" | "dd/MM/yy" | "yyyy-MM-dd";

// Accent color theme
export type AccentColor = "amber" | "blue" | "emerald" | "violet" | "rose" | "cyan";

// Sidebar sections
export type SidebarSectionId = "todos" | "notes" | "weeklyBPs" | "juniors" | "infoTerminals";
export const DEFAULT_SIDEBAR_ORDER: SidebarSectionId[] = ["todos", "notes", "weeklyBPs", "juniors", "infoTerminals"];

export const DEFAULT_CATEGORIES = [
  "Program",
  "Promotion",
  "Production",
  "Organize",
  "Coordinate",
  "Inspect",
] as const;

export interface PriorityShortcuts {
  high: string;
  medium: string;
  low: string;
  bugged: string;
}

export const DEFAULT_PRIORITY_SHORTCUTS: PriorityShortcuts = {
  high: "-h",
  medium: "-m",
  low: "-l",
  bugged: "-b",
};

export type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  startDate: string;
}

export interface KanbanTask {
  id: string;
  title: string;
  description: string;
  status: ColumnStatus;
  order: number;
  createdAt: string;
  label?: CardLabel;
  priority?: Priority;
  category?: string | null;
  bugged?: boolean;
  weeklyBpId?: string | null;
  formulaStepId?: string | null;
  archivedAt?: string;
  forwardedFromTaskId?: string;
  forwardedToTaskId?: string;
  dueAt?: string | null;
  reminderAt?: string | null;
  recurrenceRule?: RecurrenceRule | null;
  recurrenceSourceId?: string;
}

// Weekly Battle Plan types
export interface WeeklyBattlePlan {
  id: string;
  userId: string;
  title: string;
  weekStart: string;
  formulaId: string;
  formulaName: string;
  formulaCode: string;
  notes?: string;
  stepWriteups?: Record<string, string>;
  createdAt: string;
}

export interface WeeklyBattlePlanWithProgress extends WeeklyBattlePlan {
  totalTasks: number;
  completedTasks: number;
  progressPercent: number;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// Stats & Graphs types
export type StatPeriodType = "daily" | "weekly" | "monthly";

export interface StatDefinition {
  id: string;
  name: string;
  abbreviation?: string;
  userId: string; // who this stat is assigned to
  createdBy: string; // who created it
  division?: number;
  department?: number;
  gds?: boolean;
  isMoney?: boolean;
  isPercentage?: boolean;
  isInverted?: boolean;
  linkedStatIds?: string[] | null; // null/undefined = normal stat, 2-3 element array = composite
  createdAt: string;
  // Joined fields for display
  userName?: string;
  userFirstName?: string;
  userLastName?: string;
  userDivision?: number;
  userDepartment?: number;
  userPostTitle?: string;
  // Computed trend fields
  trend?: "up" | "down" | "flat" | null;
  downStreak?: number;
}

export interface StatEntry {
  id: string;
  statId: string;
  value: number;
  date: string; // YYYY-MM-DD
  periodType: StatPeriodType;
  createdAt: string;
  updatedAt: string;
}

export interface StatsViewConfig {
  periodType: StatPeriodType;
  rangePreset: string; // e.g. "7d", "14d", "30d", "12w", "custom"
  customStart?: string;
  customEnd?: string;
  yAxisMin?: number;
  yAxisMax?: number;
  yAxisAuto: boolean;
  yAxisRightMin?: number;
  yAxisRightMax?: number;
  yAxisRightAuto?: boolean; // defaults to true (via ?? true)
  showLabels?: boolean;
}

export interface AppState {
  // Auth
  user: User | null;
  isAuthLoading: boolean;
  // Data
  tasks: KanbanTask[];
  notes: Note[];
  activeNoteId: string | null;
  sidebarOpen: boolean;
  customCategories: string[];
  categoryFilter: string[];
  priorityShortcuts: PriorityShortcuts;
  tasksCollapsed: boolean;
  notesCollapsed: boolean;
  buggedFilter: boolean;
  formulaStepFilter: string[];
  // Junior viewing mode
  viewingJunior: User | null;
  juniorTasks: KanbanTask[];
  juniorTaskNotes: Record<string, TaskNote[]>;
  // My juniors list
  myJuniors: User[];
  // Notes on my tasks (from seniors)
  myTaskNotes: Record<string, TaskNote[]>;
  unreadNoteCount: number;
  // Notes on my BPs (from seniors)
  myBPNotes: Record<string, BPNote[]>;
  unreadBPNoteCount: number;
  // Junior BP notes (when viewing junior's board)
  juniorBPNotes: Record<string, BPNote[]>;
  // Info Terminals - users who can view my board
  myInfoTerminals: User[];
  // Boards I can view as Info Terminal
  viewableAsInfoTerminal: User[];
  // Info Terminal viewing mode
  viewingInfoTerminal: User | null;
  infoTerminalTasks: KanbanTask[];
  infoTerminalTaskNotes: Record<string, TaskNote[]>;
  infoTerminalBPNotes: Record<string, BPNote[]>;
  infoTerminalWeeklyBPs: WeeklyBattlePlanWithProgress[];
  // Weekly Battle Plans
  weeklyBattlePlans: WeeklyBattlePlanWithProgress[];
  activeWeeklyBpId: string | null;
  // Junior Weekly Battle Plans (when viewing junior's board)
  juniorWeeklyBPs: WeeklyBattlePlanWithProgress[];
  // Board sorting & display settings
  sortMode: BoardSortMode;
  weekSettings: WeekSettings;
  dateFormat: DateFormatType;
  accentColor: AccentColor;
  // Sidebar customization
  sidebarOrder: SidebarSectionId[];
  // Display preferences
  showStepDescriptions: boolean;
  // Stats & Graphs
  viewingStats: boolean;
  statDefinitions: StatDefinition[];
  statEntries: Record<string, StatEntry[]>; // keyed by statId
  selectedStatId: string | null;
  statsViewConfig: StatsViewConfig;
  statsSidebarOpen: boolean;
  statGraphUseAccentColor: boolean;
  statGraphUpColor: string;
  statGraphDownColor: string;
  overlayConfig: { statId: string; offsetPeriods: number } | null;
}

export type AppAction =
  | { type: "HYDRATE"; payload: Omit<AppState, "user" | "isAuthLoading"> }
  // Auth
  | { type: "SET_USER"; payload: User | null }
  | { type: "SET_AUTH_LOADING"; payload: boolean }
  // Kanban
  | { type: "SET_TASKS"; payload: KanbanTask[] }
  | { type: "ADD_TASK"; payload: { title: string; description: string; status: ColumnStatus; label?: CardLabel; priority?: Priority; category?: string; bugged?: boolean; weeklyBpId?: string; formulaStepId?: string; dueAt?: string; reminderAt?: string; recurrenceRule?: RecurrenceRule } }
  | { type: "UPDATE_TASK"; payload: { id: string; title?: string; description?: string; status?: ColumnStatus; label?: CardLabel; priority?: Priority; category?: string | null; bugged?: boolean; weeklyBpId?: string | null; formulaStepId?: string | null; dueAt?: string | null; reminderAt?: string | null; recurrenceRule?: RecurrenceRule | null } }
  | { type: "DELETE_TASK"; payload: { id: string } }
  | { type: "MOVE_TASK"; payload: { taskId: string; toStatus: ColumnStatus; toIndex: number } }
  | { type: "REORDER_TASK"; payload: { taskId: string; toIndex: number } }
  // Notes
  | { type: "ADD_NOTE"; payload: { title: string; content: string } }
  | { type: "UPDATE_NOTE"; payload: { id: string; title?: string; content?: string } }
  | { type: "DELETE_NOTE"; payload: { id: string } }
  | { type: "SET_ACTIVE_NOTE"; payload: { id: string | null } }
  // Sidebar
  | { type: "TOGGLE_SIDEBAR" }
  // Categories
  | { type: "ADD_CUSTOM_CATEGORY"; payload: { name: string } }
  | { type: "DELETE_CUSTOM_CATEGORY"; payload: { name: string } }
  | { type: "SET_CATEGORY_FILTER"; payload: { categories: string[] } }
  // Settings
  | { type: "UPDATE_PRIORITY_SHORTCUTS"; payload: PriorityShortcuts }
  // Collapse
  | { type: "TOGGLE_TASKS_COLLAPSED" }
  | { type: "TOGGLE_NOTES_COLLAPSED" }
  // Bugged filter
  | { type: "TOGGLE_BUGGED_FILTER" }
  | { type: "SET_FORMULA_STEP_FILTER"; payload: string[] }
  // Junior viewing
  | { type: "SET_VIEWING_JUNIOR"; payload: { junior: User | null; tasks: KanbanTask[]; notes: Record<string, TaskNote[]> } }
  | { type: "ADD_JUNIOR_TASK_NOTE"; payload: { taskId: string; note: TaskNote } }
  | { type: "SET_MY_JUNIORS"; payload: User[] }
  // Profile
  | { type: "UPDATE_USER_PROFILE"; payload: Partial<User> }
  // Task notes on my tasks
  | { type: "SET_MY_TASK_NOTES"; payload: { notes: Record<string, TaskNote[]>; unreadCount: number } }
  | { type: "ADD_MY_TASK_NOTE"; payload: { taskId: string; note: TaskNote } }
  | { type: "MARK_NOTES_READ"; payload: { taskId: string } }
  // BP notes on my BPs
  | { type: "SET_MY_BP_NOTES"; payload: { notes: Record<string, BPNote[]>; unreadCount: number } }
  | { type: "ADD_MY_BP_NOTE"; payload: { bpId: string; note: BPNote } }
  | { type: "MARK_BP_NOTES_READ"; payload: { bpId: string } }
  // Junior BP notes
  | { type: "SET_JUNIOR_BP_NOTES"; payload: Record<string, BPNote[]> }
  | { type: "ADD_JUNIOR_BP_NOTE"; payload: { bpId: string; note: BPNote } }
  // Weekly Battle Plans
  | { type: "SET_WEEKLY_BPS"; payload: WeeklyBattlePlanWithProgress[] }
  | { type: "ADD_WEEKLY_BP"; payload: WeeklyBattlePlanWithProgress }
  | { type: "UPDATE_WEEKLY_BP"; payload: WeeklyBattlePlanWithProgress }
  | { type: "DELETE_WEEKLY_BP"; payload: { id: string } }
  | { type: "SET_ACTIVE_WEEKLY_BP"; payload: string | null }
  // Junior Weekly BPs
  | { type: "SET_JUNIOR_WEEKLY_BPS"; payload: WeeklyBattlePlanWithProgress[] }
  // Board sorting & display settings
  | { type: "SET_SORT_MODE"; payload: BoardSortMode }
  | { type: "UPDATE_WEEK_SETTINGS"; payload: WeekSettings }
  | { type: "SET_DATE_FORMAT"; payload: DateFormatType }
  | { type: "SET_ACCENT_COLOR"; payload: AccentColor }
  // Display preferences
  | { type: "SET_SHOW_STEP_DESCRIPTIONS"; payload: boolean }
  // Sidebar customization
  | { type: "SET_SIDEBAR_ORDER"; payload: SidebarSectionId[] }
  // Info Terminals
  | { type: "SET_MY_INFO_TERMINALS"; payload: User[] }
  | { type: "SET_VIEWABLE_AS_INFO_TERMINAL"; payload: User[] }
  | { type: "SET_VIEWING_INFO_TERMINAL"; payload: { user: User | null; tasks: KanbanTask[]; taskNotes: Record<string, TaskNote[]>; bpNotes: Record<string, BPNote[]>; weeklyBPs: WeeklyBattlePlanWithProgress[] } }
  | { type: "ADD_INFO_TERMINAL_TASK_NOTE"; payload: { taskId: string; note: TaskNote } }
  | { type: "ADD_INFO_TERMINAL_BP_NOTE"; payload: { bpId: string; note: BPNote } }
  // Stats & Graphs
  | { type: "SET_VIEWING_STATS"; payload: boolean }
  | { type: "SET_STAT_DEFINITIONS"; payload: StatDefinition[] }
  | { type: "ADD_STAT_DEFINITION"; payload: StatDefinition }
  | { type: "UPDATE_STAT_DEFINITION"; payload: StatDefinition }
  | { type: "DELETE_STAT_DEFINITION"; payload: { id: string } }
  | { type: "SET_STAT_ENTRIES"; payload: { statId: string; entries: StatEntry[] } }
  | { type: "ADD_STAT_ENTRY"; payload: StatEntry }
  | { type: "UPDATE_STAT_ENTRY"; payload: StatEntry }
  | { type: "DELETE_STAT_ENTRY"; payload: { id: string; statId: string } }
  | { type: "SET_SELECTED_STAT"; payload: string | null }
  | { type: "SET_STATS_VIEW_CONFIG"; payload: Partial<StatsViewConfig> }
  | { type: "TOGGLE_STATS_SIDEBAR" }
  | { type: "SET_STAT_GRAPH_COLORS"; payload: { useAccent: boolean; upColor: string; downColor: string } }
  | { type: "SET_OVERLAY_CONFIG"; payload: { statId: string; offsetPeriods: number } | null }
  | { type: "SET_OVERLAY_OFFSET"; payload: number };
