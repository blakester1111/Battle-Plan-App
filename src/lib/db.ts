import Database, { type Database as DatabaseType } from "better-sqlite3";
import path from "path";
import fs from "fs";

// Database file location - in the project root for easy backup
const dbPath = path.join(process.cwd(), "data", "battleplan.db");

// Singleton database instance
let db: DatabaseType | null = null;

// Run migrations for existing databases
function runMigrations(database: DatabaseType) {
  // Check if users table has the new columns
  const userTableInfo = database.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  const existingColumns = new Set(userTableInfo.map((col) => col.name));

  // Add new user profile columns if they don't exist
  const newUserColumns = [
    { name: "first_name", type: "TEXT" },
    { name: "last_name", type: "TEXT" },
    { name: "org", type: "TEXT" },
    { name: "division", type: "INTEGER" },
    { name: "department", type: "INTEGER" },
    { name: "post_title", type: "TEXT" },
    { name: "role", type: "TEXT DEFAULT 'user'" },
  ];

  for (const col of newUserColumns) {
    if (!existingColumns.has(col.name)) {
      try {
        database.exec(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
      } catch {
        // Column might already exist in a different migration
      }
    }
  }

  // Make first user an admin if no admins exist
  const adminCount = database.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get() as { count: number };
  if (adminCount.count === 0) {
    const firstUser = database.prepare("SELECT id FROM users ORDER BY created_at ASC LIMIT 1").get() as { id: string } | undefined;
    if (firstUser) {
      database.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(firstUser.id);
    }
  }

  // Add read_at column to task_notes if it doesn't exist
  const taskNotesInfo = database.prepare("PRAGMA table_info(task_notes)").all() as { name: string }[];
  const taskNotesColumns = new Set(taskNotesInfo.map((col) => col.name));
  if (!taskNotesColumns.has("read_at")) {
    try {
      database.exec("ALTER TABLE task_notes ADD COLUMN read_at TEXT");
    } catch {
      // Column might already exist
    }
  }

  // Add weekly battle plan columns to tasks if they don't exist
  const tasksTableInfo = database.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];
  const tasksColumns = new Set(tasksTableInfo.map((col) => col.name));

  if (!tasksColumns.has("weekly_bp_id")) {
    try {
      database.exec("ALTER TABLE tasks ADD COLUMN weekly_bp_id TEXT");
    } catch {
      // Column might already exist
    }
  }

  if (!tasksColumns.has("formula_step_id")) {
    try {
      database.exec("ALTER TABLE tasks ADD COLUMN formula_step_id TEXT");
    } catch {
      // Column might already exist
    }
  }

  // Add created_at column to notes if it doesn't exist
  const notesTableInfo = database.prepare("PRAGMA table_info(notes)").all() as { name: string }[];
  const notesColumns = new Set(notesTableInfo.map((col) => col.name));
  if (!notesColumns.has("created_at")) {
    try {
      // Add column and set existing notes' created_at to their updated_at
      database.exec("ALTER TABLE notes ADD COLUMN created_at TEXT");
      database.exec("UPDATE notes SET created_at = updated_at WHERE created_at IS NULL");
    } catch {
      // Column might already exist
    }
  }

  // Add note_type column to task_notes if it doesn't exist (for Info Terminal comments)
  if (!taskNotesColumns.has("note_type")) {
    try {
      database.exec("ALTER TABLE task_notes ADD COLUMN note_type TEXT DEFAULT 'senior'");
    } catch {
      // Column might already exist
    }
  }

  // Add note_type column to bp_notes if it doesn't exist
  const bpNotesTableInfo = database.prepare("PRAGMA table_info(bp_notes)").all() as { name: string }[];
  const bpNotesColumns = new Set(bpNotesTableInfo.map((col) => col.name));
  if (!bpNotesColumns.has("note_type")) {
    try {
      database.exec("ALTER TABLE bp_notes ADD COLUMN note_type TEXT DEFAULT 'senior'");
    } catch {
      // Column might already exist
    }
  }

  // Add deleted_at column to tasks for soft-delete
  if (!tasksColumns.has("deleted_at")) {
    try {
      database.exec("ALTER TABLE tasks ADD COLUMN deleted_at TEXT");
    } catch {
      // Column might already exist
    }
  }

  // Add deleted_at column to weekly_battle_plans for soft-delete
  const wbpTableInfo = database.prepare("PRAGMA table_info(weekly_battle_plans)").all() as { name: string }[];
  const wbpColumns = new Set(wbpTableInfo.map((col) => col.name));
  if (!wbpColumns.has("deleted_at")) {
    try {
      database.exec("ALTER TABLE weekly_battle_plans ADD COLUMN deleted_at TEXT");
    } catch {
      // Column might already exist
    }
  }

  // Add step_writeups_json column to weekly_battle_plans for formula step write-ups
  if (!wbpColumns.has("step_writeups_json")) {
    try {
      database.exec("ALTER TABLE weekly_battle_plans ADD COLUMN step_writeups_json TEXT");
    } catch {
      // Column might already exist
    }
  }

  // Add forwarding columns to tasks for roll-forward feature
  if (!tasksColumns.has("forwarded_from_task_id")) {
    try {
      database.exec("ALTER TABLE tasks ADD COLUMN forwarded_from_task_id TEXT");
    } catch {
      // Column might already exist
    }
  }
  if (!tasksColumns.has("forwarded_to_task_id")) {
    try {
      database.exec("ALTER TABLE tasks ADD COLUMN forwarded_to_task_id TEXT");
    } catch {
      // Column might already exist
    }
  }

  // Add archived_at column to tasks for complete archive
  if (!tasksColumns.has("archived_at")) {
    try {
      database.exec("ALTER TABLE tasks ADD COLUMN archived_at TEXT");
    } catch {
      // Column might already exist
    }
  }

  // Add due_at column for TM (Time Due) feature
  if (!tasksColumns.has("due_at")) {
    try {
      database.exec("ALTER TABLE tasks ADD COLUMN due_at TEXT");
    } catch {
      // Column might already exist
    }
  }

  // Add reminder_at column for Reminder feature
  if (!tasksColumns.has("reminder_at")) {
    try {
      database.exec("ALTER TABLE tasks ADD COLUMN reminder_at TEXT");
    } catch {
      // Column might already exist
    }
  }

  // Add recurrence columns for Recurring Targets feature
  if (!tasksColumns.has("recurrence_rule")) {
    try {
      database.exec("ALTER TABLE tasks ADD COLUMN recurrence_rule TEXT");
    } catch {
      // Column might already exist
    }
  }
  if (!tasksColumns.has("recurrence_source_id")) {
    try {
      database.exec("ALTER TABLE tasks ADD COLUMN recurrence_source_id TEXT");
    } catch {
      // Column might already exist
    }
  }

  // Add gds column to stat_definitions if it doesn't exist
  const statDefInfo = database.prepare("PRAGMA table_info(stat_definitions)").all() as { name: string }[];
  const statDefColumns = new Set(statDefInfo.map((col) => col.name));
  if (!statDefColumns.has("gds")) {
    try {
      database.exec("ALTER TABLE stat_definitions ADD COLUMN gds INTEGER DEFAULT 0");
    } catch {
      // Column might already exist
    }
  }

  // Add is_money, is_percentage, is_inverted columns to stat_definitions
  if (!statDefColumns.has("is_money")) {
    try {
      database.exec("ALTER TABLE stat_definitions ADD COLUMN is_money INTEGER DEFAULT 0");
    } catch {
      // Column might already exist
    }
  }
  if (!statDefColumns.has("is_percentage")) {
    try {
      database.exec("ALTER TABLE stat_definitions ADD COLUMN is_percentage INTEGER DEFAULT 0");
    } catch {
      // Column might already exist
    }
  }
  if (!statDefColumns.has("is_inverted")) {
    try {
      database.exec("ALTER TABLE stat_definitions ADD COLUMN is_inverted INTEGER DEFAULT 0");
    } catch {
      // Column might already exist
    }
  }

  if (!statDefColumns.has("linked_stat_ids")) {
    try {
      database.exec("ALTER TABLE stat_definitions ADD COLUMN linked_stat_ids TEXT");
    } catch {
      // Column might already exist
    }
  }

  if (!statDefColumns.has("abbreviation")) {
    try {
      database.exec("ALTER TABLE stat_definitions ADD COLUMN abbreviation TEXT");
    } catch {
      // Column might already exist
    }
  }

  // Ensure stat_quotas table exists (for databases created before ES7 feature)
  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS stat_quotas (
        id TEXT PRIMARY KEY,
        stat_id TEXT NOT NULL,
        week_ending_date TEXT NOT NULL,
        quotas_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(stat_id, week_ending_date),
        FOREIGN KEY (stat_id) REFERENCES stat_definitions(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_stat_quotas_stat ON stat_quotas(stat_id);
      CREATE INDEX IF NOT EXISTS idx_stat_quotas_lookup ON stat_quotas(stat_id, week_ending_date);
    `);
  } catch {
    // Table likely already exists
  }

  // Purge items soft-deleted more than 30 days ago
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  database.prepare("DELETE FROM tasks WHERE deleted_at IS NOT NULL AND deleted_at < ?").run(thirtyDaysAgo);
  database.prepare("DELETE FROM weekly_battle_plans WHERE deleted_at IS NOT NULL AND deleted_at < ?").run(thirtyDaysAgo);
}

// Lazy initialization to avoid locking during build
function getDb(): DatabaseType {
  if (db) return db;

  // Ensure data directory exists
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Create database connection
  db = new Database(dbPath);

  // Enable WAL mode for better concurrent access
  db.pragma("journal_mode = WAL");

  // Run migrations for existing databases
  runMigrations(db);

  // Initialize schema
  db.exec(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      org TEXT,
      division INTEGER,
      department INTEGER,
      post_title TEXT,
      role TEXT DEFAULT 'user',
      created_at TEXT NOT NULL
    );

    -- User relationships (senior/junior)
    CREATE TABLE IF NOT EXISTS user_relationships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      senior_id TEXT NOT NULL,
      junior_id TEXT NOT NULL,
      UNIQUE(senior_id, junior_id),
      FOREIGN KEY (senior_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (junior_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Info Terminal relationships (people who can view someone's board but aren't their senior)
    CREATE TABLE IF NOT EXISTS info_terminal_relationships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id TEXT NOT NULL,
      viewer_id TEXT NOT NULL,
      UNIQUE(owner_id, viewer_id),
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (viewer_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Task notes (senior comments on junior tasks, and junior replies)
    CREATE TABLE IF NOT EXISTS task_notes (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      read_at TEXT,
      note_type TEXT DEFAULT 'senior',
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Sessions table
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Tasks table (with user_id)
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'todo',
      "order" INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      label TEXT DEFAULT 'none',
      priority TEXT DEFAULT 'none',
      category TEXT,
      bugged INTEGER DEFAULT 0,
      weekly_bp_id TEXT,
      formula_step_id TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Notes table (with user_id)
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Settings table (with user_id as part of key)
    CREATE TABLE IF NOT EXISTS settings (
      user_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (user_id, key),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Custom categories table (with user_id)
    CREATE TABLE IF NOT EXISTS custom_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      UNIQUE(user_id, name),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Weekly Battle Plans table
    CREATE TABLE IF NOT EXISTS weekly_battle_plans (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      week_start TEXT NOT NULL,
      formula_id TEXT NOT NULL,
      formula_name TEXT NOT NULL,
      formula_code TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- BP notes (senior comments on junior weekly battle plans)
    CREATE TABLE IF NOT EXISTS bp_notes (
      id TEXT PRIMARY KEY,
      bp_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      read_at TEXT,
      note_type TEXT DEFAULT 'senior',
      FOREIGN KEY (bp_id) REFERENCES weekly_battle_plans(id) ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Index for faster user lookups
    CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
    CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);
    CREATE INDEX IF NOT EXISTS idx_settings_user ON settings(user_id);
    CREATE INDEX IF NOT EXISTS idx_categories_user ON custom_categories(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_relationships_senior ON user_relationships(senior_id);
    CREATE INDEX IF NOT EXISTS idx_relationships_junior ON user_relationships(junior_id);
    CREATE INDEX IF NOT EXISTS idx_task_notes_task ON task_notes(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_notes_author ON task_notes(author_id);
    CREATE INDEX IF NOT EXISTS idx_weekly_bp_user ON weekly_battle_plans(user_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_weekly_bp ON tasks(weekly_bp_id);
    CREATE INDEX IF NOT EXISTS idx_bp_notes_bp ON bp_notes(bp_id);
    CREATE INDEX IF NOT EXISTS idx_bp_notes_author ON bp_notes(author_id);
    CREATE INDEX IF NOT EXISTS idx_info_terminal_owner ON info_terminal_relationships(owner_id);
    CREATE INDEX IF NOT EXISTS idx_info_terminal_viewer ON info_terminal_relationships(viewer_id);

    -- Stat definitions (stats to track)
    CREATE TABLE IF NOT EXISTS stat_definitions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_by TEXT NOT NULL,
      division INTEGER,
      department INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Stat entries (numeric data points)
    CREATE TABLE IF NOT EXISTS stat_entries (
      id TEXT PRIMARY KEY,
      stat_id TEXT NOT NULL,
      value REAL NOT NULL,
      date TEXT NOT NULL,
      period_type TEXT NOT NULL DEFAULT 'daily',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(stat_id, date, period_type),
      FOREIGN KEY (stat_id) REFERENCES stat_definitions(id) ON DELETE CASCADE
    );

    -- Stat quotas for Exec Series 7 (per-stat per-week quota targets)
    CREATE TABLE IF NOT EXISTS stat_quotas (
      id TEXT PRIMARY KEY,
      stat_id TEXT NOT NULL,
      week_ending_date TEXT NOT NULL,
      quotas_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(stat_id, week_ending_date),
      FOREIGN KEY (stat_id) REFERENCES stat_definitions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_stat_definitions_user ON stat_definitions(user_id);
    CREATE INDEX IF NOT EXISTS idx_stat_definitions_created_by ON stat_definitions(created_by);
    CREATE INDEX IF NOT EXISTS idx_stat_entries_stat ON stat_entries(stat_id);
    CREATE INDEX IF NOT EXISTS idx_stat_entries_date ON stat_entries(stat_id, date);
    CREATE INDEX IF NOT EXISTS idx_stat_quotas_stat ON stat_quotas(stat_id);
    CREATE INDEX IF NOT EXISTS idx_stat_quotas_lookup ON stat_quotas(stat_id, week_ending_date);
  `);

  return db;
}

// User operations
export const userOps = {
  create: (user: { id: string; username: string; passwordHash: string; role?: string }) => {
    const stmt = getDb().prepare(`
      INSERT INTO users (id, username, password_hash, role, created_at)
      VALUES (@id, @username, @passwordHash, @role, @createdAt)
    `);
    stmt.run({
      id: user.id,
      username: user.username,
      passwordHash: user.passwordHash,
      role: user.role || "user",
      createdAt: new Date().toISOString(),
    });
    return user;
  },

  findByUsername: (username: string) => {
    return getDb().prepare("SELECT * FROM users WHERE username = ?").get(username) as DbUser | undefined;
  },

  findById: (id: string) => {
    return getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as DbUser | undefined;
  },

  getAll: () => {
    return getDb().prepare("SELECT id, username, first_name, last_name, org, division, department, post_title, role, created_at FROM users ORDER BY created_at").all() as DbUser[];
  },

  count: () => {
    const result = getDb().prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
    return result.count;
  },

  updateProfile: (id: string, updates: Partial<Omit<DbUser, "id" | "password_hash" | "created_at">>) => {
    const allowedFields = ["first_name", "last_name", "org", "division", "department", "post_title"];
    const fields = Object.keys(updates)
      .filter((k) => allowedFields.includes(k))
      .map((k) => `${k} = @${k}`)
      .join(", ");

    if (!fields) return;

    const stmt = getDb().prepare(`UPDATE users SET ${fields} WHERE id = @id`);
    stmt.run({ id, ...updates });
  },

  updateRole: (id: string, role: string) => {
    getDb().prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
  },

  updatePassword: (id: string, passwordHash: string) => {
    getDb().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, id);
  },

  updateUsername: (id: string, username: string) => {
    getDb().prepare("UPDATE users SET username = ? WHERE id = ?").run(username, id);
  },

  delete: (id: string) => {
    getDb().prepare("DELETE FROM users WHERE id = ?").run(id);
  },
};

// Session operations
export const sessionOps = {
  create: (session: { id: string; userId: string; expiresAt: string }) => {
    const stmt = getDb().prepare(`
      INSERT INTO sessions (id, user_id, expires_at)
      VALUES (@id, @userId, @expiresAt)
    `);
    stmt.run({
      id: session.id,
      userId: session.userId,
      expiresAt: session.expiresAt,
    });
    return session;
  },

  findById: (id: string) => {
    return getDb().prepare("SELECT * FROM sessions WHERE id = ?").get(id) as DbSession | undefined;
  },

  delete: (id: string) => {
    getDb().prepare("DELETE FROM sessions WHERE id = ?").run(id);
  },

  deleteByUserId: (userId: string) => {
    getDb().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  },

  deleteExpired: () => {
    getDb().prepare("DELETE FROM sessions WHERE expires_at < ?").run(new Date().toISOString());
  },

  refresh: (id: string, newExpiresAt: string) => {
    getDb().prepare("UPDATE sessions SET expires_at = ? WHERE id = ?").run(newExpiresAt, id);
  },
};

// Task operations (now require userId)
export const taskOps = {
  getAll: (userId: string) => {
    return getDb().prepare('SELECT * FROM tasks WHERE user_id = ? AND deleted_at IS NULL AND (archived_at IS NULL OR weekly_bp_id IS NOT NULL) ORDER BY status, "order"').all(userId) as DbTask[];
  },

  getById: (taskId: string) => {
    return getDb().prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) as DbTask | undefined;
  },

  create: (task: DbTask) => {
    const stmt = getDb().prepare(`
      INSERT INTO tasks (id, user_id, title, description, status, "order", created_at, label, priority, category, bugged, weekly_bp_id, formula_step_id, forwarded_from_task_id, forwarded_to_task_id, due_at, reminder_at, recurrence_rule, recurrence_source_id)
      VALUES (@id, @user_id, @title, @description, @status, @order, @created_at, @label, @priority, @category, @bugged, @weekly_bp_id, @formula_step_id, @forwarded_from_task_id, @forwarded_to_task_id, @due_at, @reminder_at, @recurrence_rule, @recurrence_source_id)
    `);
    stmt.run({
      id: task.id,
      user_id: task.user_id,
      title: task.title,
      description: task.description || "",
      status: task.status,
      order: task.order,
      created_at: task.created_at,
      label: task.label || "none",
      priority: task.priority || "none",
      category: task.category || null,
      bugged: task.bugged ? 1 : 0,
      weekly_bp_id: task.weekly_bp_id || null,
      formula_step_id: task.formula_step_id || null,
      forwarded_from_task_id: task.forwarded_from_task_id || null,
      forwarded_to_task_id: task.forwarded_to_task_id || null,
      due_at: task.due_at || null,
      reminder_at: task.reminder_at || null,
      recurrence_rule: task.recurrence_rule || null,
      recurrence_source_id: task.recurrence_source_id || null,
    });
    return task;
  },

  update: (id: string, userId: string, updates: Partial<DbTask>) => {
    const fields = Object.keys(updates)
      .filter((k) => k !== "id" && k !== "user_id")
      .map((k) => {
        if (k === "order") return `"order" = @${k}`;
        if (k === "bugged") return `bugged = @bugged`;
        return `${k} = @${k}`;
      })
      .join(", ");

    if (!fields) return;

    const stmt = getDb().prepare(`UPDATE tasks SET ${fields} WHERE id = @id AND user_id = @userId`);
    stmt.run({
      id,
      userId,
      ...updates,
      bugged: updates.bugged ? 1 : 0,
    });
  },

  delete: (id: string, userId: string) => {
    getDb().prepare("DELETE FROM tasks WHERE id = ? AND user_id = ?").run(id, userId);
  },

  softDelete: (id: string, userId: string) => {
    getDb().prepare("UPDATE tasks SET deleted_at = ? WHERE id = ? AND user_id = ?").run(new Date().toISOString(), id, userId);
  },

  restore: (id: string, userId: string) => {
    getDb().prepare("UPDATE tasks SET deleted_at = NULL WHERE id = ? AND user_id = ?").run(id, userId);
  },

  getDeleted: (userId: string) => {
    return getDb().prepare("SELECT * FROM tasks WHERE user_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC").all(userId) as DbTask[];
  },

  updateOrder: (userId: string, tasks: { id: string; order: number; status: string }[]) => {
    const database = getDb();
    const stmt = database.prepare('UPDATE tasks SET "order" = @order, status = @status WHERE id = @id AND user_id = @userId');
    const updateMany = database.transaction((items: { id: string; order: number; status: string }[]) => {
      for (const item of items) {
        stmt.run({ ...item, userId });
      }
    });
    updateMany(tasks);
  },

  forwardTasks: (userId: string, sourceTasks: DbTask[], targetBpId: string) => {
    const database = getDb();
    const insertStmt = database.prepare(`
      INSERT INTO tasks (id, user_id, title, description, status, "order", created_at, label, priority, category, bugged, weekly_bp_id, formula_step_id, forwarded_from_task_id, forwarded_to_task_id, due_at, reminder_at, recurrence_rule, recurrence_source_id)
      VALUES (@id, @user_id, @title, @description, @status, @order, @created_at, @label, @priority, @category, @bugged, @weekly_bp_id, @formula_step_id, @forwarded_from_task_id, @forwarded_to_task_id, @due_at, @reminder_at, @recurrence_rule, @recurrence_source_id)
    `);
    const updateOriginalStmt = database.prepare(
      `UPDATE tasks SET forwarded_to_task_id = ? WHERE id = ? AND user_id = ?`
    );

    const doForward = database.transaction(() => {
      const results: { originalId: string; cloneId: string }[] = [];
      for (const src of sourceTasks) {
        const cloneId = crypto.randomUUID();
        insertStmt.run({
          id: cloneId,
          user_id: userId,
          title: src.title,
          description: src.description || "",
          status: src.status,
          order: src.order,
          created_at: new Date().toISOString(),
          label: src.label || "none",
          priority: src.priority || "none",
          category: src.category || null,
          bugged: src.bugged ? 1 : 0,
          weekly_bp_id: targetBpId,
          formula_step_id: null, // Clear — different formula context
          forwarded_from_task_id: src.id,
          forwarded_to_task_id: null,
          due_at: null,
          reminder_at: null,
          recurrence_rule: src.recurrence_rule || null,
          recurrence_source_id: null,
        });
        updateOriginalStmt.run(cloneId, src.id, userId);
        results.push({ originalId: src.id, cloneId });
      }
      return results;
    });

    return doForward();
  },

  archiveCompleted: (userId: string, weekStartIso: string) => {
    const now = new Date().toISOString();
    // Truncate to date-only for BP week_start comparison (handles both date-only and full ISO stored values)
    const weekStartDate = weekStartIso.split("T")[0];
    getDb().prepare(`
      UPDATE tasks SET archived_at = ?
      WHERE user_id = ? AND status = 'complete'
        AND archived_at IS NULL AND deleted_at IS NULL
        AND (
          (weekly_bp_id IS NOT NULL AND weekly_bp_id IN (
            SELECT id FROM weekly_battle_plans WHERE substr(week_start, 1, 10) < ?
          ))
          OR
          (weekly_bp_id IS NULL AND created_at < ?)
        )
    `).run(now, userId, weekStartDate, weekStartIso);
  },

  getArchived: (userId: string) => {
    return getDb().prepare('SELECT * FROM tasks WHERE user_id = ? AND archived_at IS NOT NULL AND deleted_at IS NULL ORDER BY archived_at DESC').all(userId) as DbTask[];
  },

  unarchive: (id: string, userId: string) => {
    // Reset status to "todo" so archiveCompleted() doesn't immediately re-archive it
    getDb().prepare("UPDATE tasks SET archived_at = NULL, status = 'todo' WHERE id = ? AND user_id = ?").run(id, userId);
  },
};

// Note operations (now require userId)
export const noteOps = {
  getAll: (userId: string) => {
    return getDb().prepare("SELECT * FROM notes WHERE user_id = ? ORDER BY updated_at DESC").all(userId) as DbNote[];
  },

  create: (note: DbNote) => {
    const stmt = getDb().prepare(`
      INSERT INTO notes (id, user_id, title, content, created_at, updated_at)
      VALUES (@id, @user_id, @title, @content, @created_at, @updated_at)
    `);
    stmt.run(note);
    return note;
  },

  update: (id: string, userId: string, updates: Partial<DbNote>) => {
    const fields = Object.keys(updates)
      .filter((k) => k !== "id" && k !== "user_id")
      .map((k) => `${k} = @${k}`)
      .join(", ");

    if (!fields) return;

    const stmt = getDb().prepare(`UPDATE notes SET ${fields} WHERE id = @id AND user_id = @userId`);
    stmt.run({ id, userId, ...updates });
  },

  delete: (id: string, userId: string) => {
    getDb().prepare("DELETE FROM notes WHERE id = ? AND user_id = ?").run(id, userId);
  },
};

// Settings operations (now require userId)
export const settingsOps = {
  get: (userId: string, key: string) => {
    const row = getDb().prepare("SELECT value FROM settings WHERE user_id = ? AND key = ?").get(userId, key) as { value: string } | undefined;
    return row ? JSON.parse(row.value) : null;
  },

  getAll: (userId: string) => {
    const rows = getDb().prepare("SELECT key, value FROM settings WHERE user_id = ?").all(userId) as { key: string; value: string }[];
    const result: Record<string, unknown> = {};
    for (const row of rows) {
      result[row.key] = JSON.parse(row.value);
    }
    return result;
  },

  set: (userId: string, key: string, value: unknown) => {
    const stmt = getDb().prepare(`
      INSERT INTO settings (user_id, key, value) VALUES (@userId, @key, @value)
      ON CONFLICT(user_id, key) DO UPDATE SET value = @value
    `);
    stmt.run({ userId, key, value: JSON.stringify(value) });
  },
};

// Custom categories operations (now require userId)
export const categoryOps = {
  getAll: (userId: string) => {
    return (getDb().prepare("SELECT name FROM custom_categories WHERE user_id = ? ORDER BY name").all(userId) as { name: string }[]).map(
      (r) => r.name
    );
  },

  add: (userId: string, name: string) => {
    try {
      getDb().prepare("INSERT INTO custom_categories (user_id, name) VALUES (?, ?)").run(userId, name);
      return true;
    } catch {
      return false; // Already exists
    }
  },

  delete: (userId: string, name: string) => {
    const database = getDb();
    database.prepare("DELETE FROM custom_categories WHERE user_id = ? AND name = ?").run(userId, name);
    // Also clear category from tasks
    database.prepare("UPDATE tasks SET category = NULL WHERE user_id = ? AND category = ?").run(userId, name);
  },
};

// Relationship operations (senior/junior)
export const relationshipOps = {
  getAll: () => {
    return getDb().prepare(`
      SELECT ur.id, ur.senior_id, ur.junior_id,
             s.username as senior_username, s.first_name as senior_first_name, s.last_name as senior_last_name,
             j.username as junior_username, j.first_name as junior_first_name, j.last_name as junior_last_name
      FROM user_relationships ur
      JOIN users s ON ur.senior_id = s.id
      JOIN users j ON ur.junior_id = j.id
    `).all() as DbRelationshipWithNames[];
  },

  getJuniors: (seniorId: string) => {
    return getDb().prepare(`
      SELECT u.id, u.username, u.first_name, u.last_name, u.org, u.division, u.department, u.post_title, u.role, u.created_at
      FROM users u
      JOIN user_relationships ur ON u.id = ur.junior_id
      WHERE ur.senior_id = ?
    `).all(seniorId) as DbUser[];
  },

  getSeniors: (juniorId: string) => {
    return getDb().prepare(`
      SELECT u.id, u.username, u.first_name, u.last_name, u.org, u.division, u.department, u.post_title, u.role, u.created_at
      FROM users u
      JOIN user_relationships ur ON u.id = ur.senior_id
      WHERE ur.junior_id = ?
    `).all(juniorId) as DbUser[];
  },

  create: (seniorId: string, juniorId: string) => {
    try {
      getDb().prepare("INSERT INTO user_relationships (senior_id, junior_id) VALUES (?, ?)").run(seniorId, juniorId);
      return true;
    } catch {
      return false; // Already exists or invalid
    }
  },

  delete: (seniorId: string, juniorId: string) => {
    getDb().prepare("DELETE FROM user_relationships WHERE senior_id = ? AND junior_id = ?").run(seniorId, juniorId);
  },

  deleteById: (id: number) => {
    getDb().prepare("DELETE FROM user_relationships WHERE id = ?").run(id);
  },
};

// Info Terminal operations (people who can view someone's board)
export const infoTerminalOps = {
  getAll: () => {
    return getDb().prepare(`
      SELECT itr.id, itr.owner_id, itr.viewer_id,
             o.username as owner_username, o.first_name as owner_first_name, o.last_name as owner_last_name,
             v.username as viewer_username, v.first_name as viewer_first_name, v.last_name as viewer_last_name
      FROM info_terminal_relationships itr
      JOIN users o ON itr.owner_id = o.id
      JOIN users v ON itr.viewer_id = v.id
    `).all() as DbInfoTerminalWithNames[];
  },

  // Get all users who can view this owner's board
  getViewers: (ownerId: string) => {
    return getDb().prepare(`
      SELECT u.id, u.username, u.first_name, u.last_name, u.org, u.division, u.department, u.post_title, u.role, u.created_at
      FROM users u
      JOIN info_terminal_relationships itr ON u.id = itr.viewer_id
      WHERE itr.owner_id = ?
    `).all(ownerId) as DbUser[];
  },

  // Get all boards this viewer can see (as info terminal)
  getViewableBoards: (viewerId: string) => {
    return getDb().prepare(`
      SELECT u.id, u.username, u.first_name, u.last_name, u.org, u.division, u.department, u.post_title, u.role, u.created_at
      FROM users u
      JOIN info_terminal_relationships itr ON u.id = itr.owner_id
      WHERE itr.viewer_id = ?
    `).all(viewerId) as DbUser[];
  },

  // Check if viewer can view owner's board
  canView: (ownerId: string, viewerId: string) => {
    const result = getDb().prepare(`
      SELECT COUNT(*) as count FROM info_terminal_relationships
      WHERE owner_id = ? AND viewer_id = ?
    `).get(ownerId, viewerId) as { count: number };
    return result.count > 0;
  },

  create: (ownerId: string, viewerId: string) => {
    try {
      getDb().prepare("INSERT INTO info_terminal_relationships (owner_id, viewer_id) VALUES (?, ?)").run(ownerId, viewerId);
      return true;
    } catch {
      return false; // Already exists or invalid
    }
  },

  delete: (ownerId: string, viewerId: string) => {
    getDb().prepare("DELETE FROM info_terminal_relationships WHERE owner_id = ? AND viewer_id = ?").run(ownerId, viewerId);
  },

  deleteById: (id: number) => {
    getDb().prepare("DELETE FROM info_terminal_relationships WHERE id = ?").run(id);
  },
};

// Task notes operations (senior comments on junior tasks)
export const taskNoteOps = {
  getById: (id: string) => {
    return getDb().prepare(`
      SELECT tn.id, tn.task_id, tn.author_id, tn.content, tn.created_at, tn.read_at, tn.note_type,
             u.username as author_username, u.first_name as author_first_name, u.last_name as author_last_name
      FROM task_notes tn
      JOIN users u ON tn.author_id = u.id
      WHERE tn.id = ?
    `).get(id) as DbTaskNoteWithAuthor | undefined;
  },

  getByTaskId: (taskId: string, noteType?: string) => {
    if (noteType) {
      return getDb().prepare(`
        SELECT tn.id, tn.task_id, tn.author_id, tn.content, tn.created_at, tn.read_at, tn.note_type,
               u.username as author_username, u.first_name as author_first_name, u.last_name as author_last_name
        FROM task_notes tn
        JOIN users u ON tn.author_id = u.id
        WHERE tn.task_id = ? AND tn.note_type = ?
        ORDER BY tn.created_at ASC
      `).all(taskId, noteType) as DbTaskNoteWithAuthor[];
    }
    return getDb().prepare(`
      SELECT tn.id, tn.task_id, tn.author_id, tn.content, tn.created_at, tn.read_at, tn.note_type,
             u.username as author_username, u.first_name as author_first_name, u.last_name as author_last_name
      FROM task_notes tn
      JOIN users u ON tn.author_id = u.id
      WHERE tn.task_id = ?
      ORDER BY tn.created_at ASC
    `).all(taskId) as DbTaskNoteWithAuthor[];
  },

  getByTaskIds: (taskIds: string[], noteType?: string) => {
    if (taskIds.length === 0) return [];
    const placeholders = taskIds.map(() => "?").join(",");
    if (noteType) {
      return getDb().prepare(`
        SELECT tn.id, tn.task_id, tn.author_id, tn.content, tn.created_at, tn.read_at, tn.note_type,
               u.username as author_username, u.first_name as author_first_name, u.last_name as author_last_name
        FROM task_notes tn
        JOIN users u ON tn.author_id = u.id
        WHERE tn.task_id IN (${placeholders}) AND tn.note_type = ?
        ORDER BY tn.created_at ASC
      `).all(...taskIds, noteType) as DbTaskNoteWithAuthor[];
    }
    return getDb().prepare(`
      SELECT tn.id, tn.task_id, tn.author_id, tn.content, tn.created_at, tn.read_at, tn.note_type,
             u.username as author_username, u.first_name as author_first_name, u.last_name as author_last_name
      FROM task_notes tn
      JOIN users u ON tn.author_id = u.id
      WHERE tn.task_id IN (${placeholders})
      ORDER BY tn.created_at ASC
    `).all(...taskIds) as DbTaskNoteWithAuthor[];
  },

  // Get all notes on a user's own tasks (for juniors to see senior notes)
  getForTaskOwner: (ownerId: string, noteType?: string) => {
    if (noteType) {
      return getDb().prepare(`
        SELECT tn.id, tn.task_id, tn.author_id, tn.content, tn.created_at, tn.read_at, tn.note_type,
               u.username as author_username, u.first_name as author_first_name, u.last_name as author_last_name,
               t.title as task_title
        FROM task_notes tn
        JOIN users u ON tn.author_id = u.id
        JOIN tasks t ON tn.task_id = t.id
        WHERE t.user_id = ? AND tn.note_type = ?
        ORDER BY tn.created_at DESC
      `).all(ownerId, noteType) as (DbTaskNoteWithAuthor & { task_title: string })[];
    }
    return getDb().prepare(`
      SELECT tn.id, tn.task_id, tn.author_id, tn.content, tn.created_at, tn.read_at, tn.note_type,
             u.username as author_username, u.first_name as author_first_name, u.last_name as author_last_name,
             t.title as task_title
      FROM task_notes tn
      JOIN users u ON tn.author_id = u.id
      JOIN tasks t ON tn.task_id = t.id
      WHERE t.user_id = ?
      ORDER BY tn.created_at DESC
    `).all(ownerId) as (DbTaskNoteWithAuthor & { task_title: string })[];
  },

  // Get unread count for a user (notes on their tasks that they haven't read, excluding their own notes)
  getUnreadCount: (ownerId: string, noteType?: string) => {
    if (noteType) {
      const result = getDb().prepare(`
        SELECT COUNT(*) as count
        FROM task_notes tn
        JOIN tasks t ON tn.task_id = t.id
        WHERE t.user_id = ? AND tn.author_id != ? AND tn.read_at IS NULL AND tn.note_type = ?
      `).get(ownerId, ownerId, noteType) as { count: number };
      return result.count;
    }
    const result = getDb().prepare(`
      SELECT COUNT(*) as count
      FROM task_notes tn
      JOIN tasks t ON tn.task_id = t.id
      WHERE t.user_id = ? AND tn.author_id != ? AND tn.read_at IS NULL
    `).get(ownerId, ownerId) as { count: number };
    return result.count;
  },

  // Mark notes as read
  markAsRead: (noteIds: string[]) => {
    if (noteIds.length === 0) return;
    const placeholders = noteIds.map(() => "?").join(",");
    const readAt = new Date().toISOString();
    getDb().prepare(`UPDATE task_notes SET read_at = ? WHERE id IN (${placeholders}) AND read_at IS NULL`).run(readAt, ...noteIds);
  },

  // Mark all notes on a task as read (for the task owner)
  markTaskNotesAsRead: (taskId: string, ownerId: string, noteType?: string) => {
    const readAt = new Date().toISOString();
    if (noteType) {
      getDb().prepare(`
        UPDATE task_notes
        SET read_at = ?
        WHERE task_id = ? AND author_id != ? AND read_at IS NULL AND note_type = ?
      `).run(readAt, taskId, ownerId, noteType);
    } else {
      getDb().prepare(`
        UPDATE task_notes
        SET read_at = ?
        WHERE task_id = ? AND author_id != ? AND read_at IS NULL
      `).run(readAt, taskId, ownerId);
    }
  },

  create: (note: { id: string; taskId: string; authorId: string; content: string; noteType?: string }) => {
    const stmt = getDb().prepare(`
      INSERT INTO task_notes (id, task_id, author_id, content, created_at, note_type)
      VALUES (@id, @taskId, @authorId, @content, @createdAt, @noteType)
    `);
    stmt.run({
      id: note.id,
      taskId: note.taskId,
      authorId: note.authorId,
      content: note.content,
      createdAt: new Date().toISOString(),
      noteType: note.noteType || "senior",
    });
    return note;
  },

  delete: (id: string) => {
    getDb().prepare("DELETE FROM task_notes WHERE id = ?").run(id);
  },
};

// Weekly Battle Plan operations
export const weeklyBPOps = {
  getAll: (userId: string) => {
    return getDb().prepare(`
      SELECT * FROM weekly_battle_plans
      WHERE user_id = ? AND deleted_at IS NULL
      ORDER BY created_at DESC
    `).all(userId) as DbWeeklyBattlePlan[];
  },

  getById: (id: string) => {
    return getDb().prepare("SELECT * FROM weekly_battle_plans WHERE id = ?").get(id) as DbWeeklyBattlePlan | undefined;
  },

  create: (bp: DbWeeklyBattlePlan) => {
    const stmt = getDb().prepare(`
      INSERT INTO weekly_battle_plans (id, user_id, title, week_start, formula_id, formula_name, formula_code, notes, step_writeups_json, created_at)
      VALUES (@id, @user_id, @title, @week_start, @formula_id, @formula_name, @formula_code, @notes, @step_writeups_json, @created_at)
    `);
    stmt.run({
      id: bp.id,
      user_id: bp.user_id,
      title: bp.title,
      week_start: bp.week_start,
      formula_id: bp.formula_id,
      formula_name: bp.formula_name,
      formula_code: bp.formula_code,
      notes: bp.notes || null,
      step_writeups_json: bp.step_writeups_json || null,
      created_at: bp.created_at,
    });
    return bp;
  },

  update: (id: string, userId: string, updates: Partial<DbWeeklyBattlePlan>) => {
    const fields = Object.keys(updates)
      .filter((k) => k !== "id" && k !== "user_id" && k !== "created_at")
      .map((k) => `${k} = @${k}`)
      .join(", ");

    if (!fields) return;

    const stmt = getDb().prepare(`UPDATE weekly_battle_plans SET ${fields} WHERE id = @id AND user_id = @userId`);
    stmt.run({ id, userId, ...updates });
  },

  delete: (id: string, userId: string) => {
    // First, unlink all tasks from this BP
    getDb().prepare("UPDATE tasks SET weekly_bp_id = NULL WHERE weekly_bp_id = ? AND user_id = ?").run(id, userId);
    // Then delete the BP
    getDb().prepare("DELETE FROM weekly_battle_plans WHERE id = ? AND user_id = ?").run(id, userId);
  },

  softDelete: (id: string, userId: string) => {
    // Unlink tasks from this BP
    getDb().prepare("UPDATE tasks SET weekly_bp_id = NULL WHERE weekly_bp_id = ? AND user_id = ?").run(id, userId);
    // Soft-delete the BP
    getDb().prepare("UPDATE weekly_battle_plans SET deleted_at = ? WHERE id = ? AND user_id = ?").run(new Date().toISOString(), id, userId);
  },

  restore: (id: string, userId: string) => {
    getDb().prepare("UPDATE weekly_battle_plans SET deleted_at = NULL WHERE id = ? AND user_id = ?").run(id, userId);
  },

  getDeleted: (userId: string) => {
    return getDb().prepare(`
      SELECT * FROM weekly_battle_plans
      WHERE user_id = ? AND deleted_at IS NOT NULL
      ORDER BY deleted_at DESC
    `).all(userId) as DbWeeklyBattlePlan[];
  },

  // Get task counts for progress calculation
  getTaskCounts: (bpId: string) => {
    const total = getDb().prepare("SELECT COUNT(*) as count FROM tasks WHERE weekly_bp_id = ? AND deleted_at IS NULL").get(bpId) as { count: number };
    const completed = getDb().prepare("SELECT COUNT(*) as count FROM tasks WHERE weekly_bp_id = ? AND status = 'complete' AND deleted_at IS NULL").get(bpId) as { count: number };
    return { total: total.count, completed: completed.count };
  },

  // Get all BPs with progress for a user
  getAllWithProgress: (userId: string) => {
    const bps = getDb().prepare(`
      SELECT * FROM weekly_battle_plans
      WHERE user_id = ? AND deleted_at IS NULL
      ORDER BY created_at DESC
    `).all(userId) as DbWeeklyBattlePlan[];

    return bps.map((bp) => {
      const counts = weeklyBPOps.getTaskCounts(bp.id);
      return {
        ...bp,
        totalTasks: counts.total,
        completedTasks: counts.completed,
        progressPercent: counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0,
      };
    });
  },
};

// BP notes operations (senior comments on junior weekly battle plans)
export const bpNoteOps = {
  getById: (id: string) => {
    return getDb().prepare(`
      SELECT bn.id, bn.bp_id, bn.author_id, bn.content, bn.created_at, bn.read_at, bn.note_type,
             u.username as author_username, u.first_name as author_first_name, u.last_name as author_last_name
      FROM bp_notes bn
      JOIN users u ON bn.author_id = u.id
      WHERE bn.id = ?
    `).get(id) as DbBPNoteWithAuthor | undefined;
  },

  getByBpId: (bpId: string, noteType?: string) => {
    if (noteType) {
      return getDb().prepare(`
        SELECT bn.id, bn.bp_id, bn.author_id, bn.content, bn.created_at, bn.read_at, bn.note_type,
               u.username as author_username, u.first_name as author_first_name, u.last_name as author_last_name
        FROM bp_notes bn
        JOIN users u ON bn.author_id = u.id
        WHERE bn.bp_id = ? AND bn.note_type = ?
        ORDER BY bn.created_at ASC
      `).all(bpId, noteType) as DbBPNoteWithAuthor[];
    }
    return getDb().prepare(`
      SELECT bn.id, bn.bp_id, bn.author_id, bn.content, bn.created_at, bn.read_at, bn.note_type,
             u.username as author_username, u.first_name as author_first_name, u.last_name as author_last_name
      FROM bp_notes bn
      JOIN users u ON bn.author_id = u.id
      WHERE bn.bp_id = ?
      ORDER BY bn.created_at ASC
    `).all(bpId) as DbBPNoteWithAuthor[];
  },

  getByBpIds: (bpIds: string[], noteType?: string) => {
    if (bpIds.length === 0) return [];
    const placeholders = bpIds.map(() => "?").join(",");
    if (noteType) {
      return getDb().prepare(`
        SELECT bn.id, bn.bp_id, bn.author_id, bn.content, bn.created_at, bn.read_at, bn.note_type,
               u.username as author_username, u.first_name as author_first_name, u.last_name as author_last_name
        FROM bp_notes bn
        JOIN users u ON bn.author_id = u.id
        WHERE bn.bp_id IN (${placeholders}) AND bn.note_type = ?
        ORDER BY bn.created_at ASC
      `).all(...bpIds, noteType) as DbBPNoteWithAuthor[];
    }
    return getDb().prepare(`
      SELECT bn.id, bn.bp_id, bn.author_id, bn.content, bn.created_at, bn.read_at, bn.note_type,
             u.username as author_username, u.first_name as author_first_name, u.last_name as author_last_name
      FROM bp_notes bn
      JOIN users u ON bn.author_id = u.id
      WHERE bn.bp_id IN (${placeholders})
      ORDER BY bn.created_at ASC
    `).all(...bpIds) as DbBPNoteWithAuthor[];
  },

  // Get all notes on a user's own BPs (for juniors to see senior notes)
  getForBPOwner: (ownerId: string, noteType?: string) => {
    if (noteType) {
      return getDb().prepare(`
        SELECT bn.id, bn.bp_id, bn.author_id, bn.content, bn.created_at, bn.read_at, bn.note_type,
               u.username as author_username, u.first_name as author_first_name, u.last_name as author_last_name,
               bp.title as bp_title
        FROM bp_notes bn
        JOIN users u ON bn.author_id = u.id
        JOIN weekly_battle_plans bp ON bn.bp_id = bp.id
        WHERE bp.user_id = ? AND bn.note_type = ?
        ORDER BY bn.created_at DESC
      `).all(ownerId, noteType) as (DbBPNoteWithAuthor & { bp_title: string })[];
    }
    return getDb().prepare(`
      SELECT bn.id, bn.bp_id, bn.author_id, bn.content, bn.created_at, bn.read_at, bn.note_type,
             u.username as author_username, u.first_name as author_first_name, u.last_name as author_last_name,
             bp.title as bp_title
      FROM bp_notes bn
      JOIN users u ON bn.author_id = u.id
      JOIN weekly_battle_plans bp ON bn.bp_id = bp.id
      WHERE bp.user_id = ?
      ORDER BY bn.created_at DESC
    `).all(ownerId) as (DbBPNoteWithAuthor & { bp_title: string })[];
  },

  // Get unread count for a user (notes on their BPs that they haven't read, excluding their own notes)
  getUnreadCount: (ownerId: string, noteType?: string) => {
    if (noteType) {
      const result = getDb().prepare(`
        SELECT COUNT(*) as count
        FROM bp_notes bn
        JOIN weekly_battle_plans bp ON bn.bp_id = bp.id
        WHERE bp.user_id = ? AND bn.author_id != ? AND bn.read_at IS NULL AND bn.note_type = ?
      `).get(ownerId, ownerId, noteType) as { count: number };
      return result.count;
    }
    const result = getDb().prepare(`
      SELECT COUNT(*) as count
      FROM bp_notes bn
      JOIN weekly_battle_plans bp ON bn.bp_id = bp.id
      WHERE bp.user_id = ? AND bn.author_id != ? AND bn.read_at IS NULL
    `).get(ownerId, ownerId) as { count: number };
    return result.count;
  },

  // Mark all notes on a BP as read (for the BP owner)
  markBPNotesAsRead: (bpId: string, ownerId: string, noteType?: string) => {
    const readAt = new Date().toISOString();
    if (noteType) {
      getDb().prepare(`
        UPDATE bp_notes
        SET read_at = ?
        WHERE bp_id = ? AND author_id != ? AND read_at IS NULL AND note_type = ?
      `).run(readAt, bpId, ownerId, noteType);
    } else {
      getDb().prepare(`
        UPDATE bp_notes
        SET read_at = ?
        WHERE bp_id = ? AND author_id != ? AND read_at IS NULL
      `).run(readAt, bpId, ownerId);
    }
  },

  create: (note: { id: string; bpId: string; authorId: string; content: string; noteType?: string }) => {
    const stmt = getDb().prepare(`
      INSERT INTO bp_notes (id, bp_id, author_id, content, created_at, note_type)
      VALUES (@id, @bpId, @authorId, @content, @createdAt, @noteType)
    `);
    stmt.run({
      id: note.id,
      bpId: note.bpId,
      authorId: note.authorId,
      content: note.content,
      createdAt: new Date().toISOString(),
      noteType: note.noteType || "senior",
    });
    return note;
  },

  delete: (id: string) => {
    getDb().prepare("DELETE FROM bp_notes WHERE id = ?").run(id);
  },
};

// Types for database rows
export interface DbUser {
  id: string;
  username: string;
  password_hash: string;
  first_name: string | null;
  last_name: string | null;
  org: string | null;
  division: number | null;
  department: number | null;
  post_title: string | null;
  role: string;
  created_at: string;
}

export interface DbRelationship {
  id: number;
  senior_id: string;
  junior_id: string;
}

export interface DbRelationshipWithNames extends DbRelationship {
  senior_username: string;
  senior_first_name: string | null;
  senior_last_name: string | null;
  junior_username: string;
  junior_first_name: string | null;
  junior_last_name: string | null;
}

export interface DbTaskNote {
  id: string;
  task_id: string;
  author_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
  note_type: string;
}

export interface DbTaskNoteWithAuthor extends DbTaskNote {
  author_username: string;
  author_first_name: string | null;
  author_last_name: string | null;
}

export interface DbInfoTerminal {
  id: number;
  owner_id: string;
  viewer_id: string;
}

export interface DbInfoTerminalWithNames extends DbInfoTerminal {
  owner_username: string;
  owner_first_name: string | null;
  owner_last_name: string | null;
  viewer_username: string;
  viewer_first_name: string | null;
  viewer_last_name: string | null;
}

export interface DbSession {
  id: string;
  user_id: string;
  expires_at: string;
}

export interface DbTask {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: string;
  order: number;
  created_at: string;
  label: string;
  priority: string;
  category: string | null;
  bugged: number | boolean;
  weekly_bp_id: string | null;
  formula_step_id: string | null;
  deleted_at?: string | null;
  archived_at?: string | null;
  forwarded_from_task_id?: string | null;
  forwarded_to_task_id?: string | null;
  due_at?: string | null;
  reminder_at?: string | null;
  recurrence_rule?: string | null;
  recurrence_source_id?: string | null;
}

export interface DbWeeklyBattlePlan {
  id: string;
  user_id: string;
  title: string;
  week_start: string;
  formula_id: string;
  formula_name: string;
  formula_code: string;
  notes: string | null;
  created_at: string;
  deleted_at?: string | null;
  step_writeups_json?: string | null;
}

export interface DbNote {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface DbBPNote {
  id: string;
  bp_id: string;
  author_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
  note_type: string;
}

export interface DbBPNoteWithAuthor extends DbBPNote {
  author_username: string;
  author_first_name: string | null;
  author_last_name: string | null;
}

// Stat definition DB types
export interface DbStatDefinition {
  id: string;
  name: string;
  abbreviation: string | null;
  user_id: string;
  created_by: string;
  division: number | null;
  department: number | null;
  gds: number;
  is_money: number;
  is_percentage: number;
  is_inverted: number;
  linked_stat_ids: string | null;
  created_at: string;
}

export interface DbStatDefinitionWithUser extends DbStatDefinition {
  user_username: string;
  user_first_name: string | null;
  user_last_name: string | null;
  user_org: string | null;
  user_division: number | null;
  user_department: number | null;
  user_post_title: string | null;
}

export interface DbStatEntry {
  id: string;
  stat_id: string;
  value: number;
  date: string;
  period_type: string;
  created_at: string;
  updated_at: string;
}

export interface DbStatQuota {
  id: string;
  stat_id: string;
  week_ending_date: string;
  quotas_json: string;
  created_at: string;
  updated_at: string;
}

// Stat definition operations
export const statDefinitionOps = {
  // Get all stats visible to a user (own + created by them + juniors + terminals; admins see all)
  getForUser: (userId: string, isAdmin: boolean) => {
    if (isAdmin) {
      return getDb().prepare(`
        SELECT sd.*, u.username as user_username, u.first_name as user_first_name, u.last_name as user_last_name, u.org as user_org, u.division as user_division, u.department as user_department, u.post_title as user_post_title
        FROM stat_definitions sd
        JOIN users u ON sd.user_id = u.id
        ORDER BY sd.name
      `).all() as DbStatDefinitionWithUser[];
    }
    return getDb().prepare(`
      SELECT sd.*, u.username as user_username, u.first_name as user_first_name, u.last_name as user_last_name, u.org as user_org, u.division as user_division, u.department as user_department, u.post_title as user_post_title
      FROM stat_definitions sd
      JOIN users u ON sd.user_id = u.id
      WHERE sd.user_id = ?
        OR sd.created_by = ?
        OR sd.user_id IN (SELECT junior_id FROM user_relationships WHERE senior_id = ?)
        OR sd.user_id IN (SELECT owner_id FROM info_terminal_relationships WHERE viewer_id = ?)
      ORDER BY sd.name
    `).all(userId, userId, userId, userId) as DbStatDefinitionWithUser[];
  },

  getByUserId: (userId: string) => {
    return getDb().prepare(`
      SELECT sd.*, u.username as user_username, u.first_name as user_first_name, u.last_name as user_last_name, u.org as user_org, u.division as user_division, u.department as user_department, u.post_title as user_post_title
      FROM stat_definitions sd
      JOIN users u ON sd.user_id = u.id
      WHERE sd.user_id = ?
      ORDER BY sd.name
    `).all(userId) as DbStatDefinitionWithUser[];
  },

  getById: (id: string) => {
    return getDb().prepare(`
      SELECT sd.*, u.username as user_username, u.first_name as user_first_name, u.last_name as user_last_name, u.org as user_org, u.division as user_division, u.department as user_department, u.post_title as user_post_title
      FROM stat_definitions sd
      JOIN users u ON sd.user_id = u.id
      WHERE sd.id = ?
    `).get(id) as DbStatDefinitionWithUser | undefined;
  },

  create: (stat: DbStatDefinition) => {
    const stmt = getDb().prepare(`
      INSERT INTO stat_definitions (id, name, abbreviation, user_id, created_by, division, department, gds, is_money, is_percentage, is_inverted, linked_stat_ids, created_at)
      VALUES (@id, @name, @abbreviation, @user_id, @created_by, @division, @department, @gds, @is_money, @is_percentage, @is_inverted, @linked_stat_ids, @created_at)
    `);
    stmt.run({
      id: stat.id,
      name: stat.name,
      abbreviation: stat.abbreviation ?? null,
      user_id: stat.user_id,
      created_by: stat.created_by,
      division: stat.division ?? null,
      department: stat.department ?? null,
      gds: stat.gds ?? 0,
      is_money: stat.is_money ?? 0,
      is_percentage: stat.is_percentage ?? 0,
      is_inverted: stat.is_inverted ?? 0,
      linked_stat_ids: stat.linked_stat_ids ?? null,
      created_at: stat.created_at,
    });
    return stat;
  },

  update: (id: string, updates: Partial<Pick<DbStatDefinition, "name" | "abbreviation" | "division" | "department" | "user_id" | "gds" | "is_money" | "is_percentage" | "is_inverted" | "linked_stat_ids">>) => {
    const fields = Object.keys(updates)
      .filter((k) => ["name", "abbreviation", "division", "department", "user_id", "gds", "is_money", "is_percentage", "is_inverted", "linked_stat_ids"].includes(k))
      .map((k) => `${k} = @${k}`)
      .join(", ");
    if (!fields) return;
    const stmt = getDb().prepare(`UPDATE stat_definitions SET ${fields} WHERE id = @id`);
    stmt.run({ id, ...updates });
  },

  delete: (id: string) => {
    // Cascade will handle stat_entries
    getDb().prepare("DELETE FROM stat_definitions WHERE id = ?").run(id);
  },
};

// Stat entry operations
export const statEntryOps = {
  getByStatId: (statId: string) => {
    return getDb().prepare(`
      SELECT * FROM stat_entries WHERE stat_id = ? ORDER BY date ASC
    `).all(statId) as DbStatEntry[];
  },

  getByStatIdInRange: (statId: string, startDate: string, endDate: string) => {
    return getDb().prepare(`
      SELECT * FROM stat_entries
      WHERE stat_id = ? AND date >= ? AND date <= ?
      ORDER BY date ASC
    `).all(statId, startDate, endDate) as DbStatEntry[];
  },

  create: (entry: DbStatEntry) => {
    const stmt = getDb().prepare(`
      INSERT INTO stat_entries (id, stat_id, value, date, period_type, created_at, updated_at)
      VALUES (@id, @stat_id, @value, @date, @period_type, @created_at, @updated_at)
    `);
    stmt.run(entry);
    return entry;
  },

  upsert: (entry: DbStatEntry) => {
    const stmt = getDb().prepare(`
      INSERT INTO stat_entries (id, stat_id, value, date, period_type, created_at, updated_at)
      VALUES (@id, @stat_id, @value, @date, @period_type, @created_at, @updated_at)
      ON CONFLICT(stat_id, date, period_type)
      DO UPDATE SET value = @value, updated_at = @updated_at
    `);
    stmt.run(entry);
    return entry;
  },

  bulkUpsert: (entries: DbStatEntry[]) => {
    const database = getDb();
    const stmt = database.prepare(`
      INSERT INTO stat_entries (id, stat_id, value, date, period_type, created_at, updated_at)
      VALUES (@id, @stat_id, @value, @date, @period_type, @created_at, @updated_at)
      ON CONFLICT(stat_id, date, period_type)
      DO UPDATE SET value = @value, updated_at = @updated_at
    `);
    const runAll = database.transaction((items: DbStatEntry[]) => {
      for (const item of items) {
        stmt.run(item);
      }
    });
    runAll(entries);
  },

  update: (id: string, value: number) => {
    const now = new Date().toISOString();
    getDb().prepare("UPDATE stat_entries SET value = ?, updated_at = ? WHERE id = ?").run(value, now, id);
  },

  delete: (id: string) => {
    getDb().prepare("DELETE FROM stat_entries WHERE id = ?").run(id);
  },

  getLastNBeforeDate: (statId: string, beforeDate: string, periodType: string, n: number) => {
    return getDb().prepare(`
      SELECT * FROM stat_entries
      WHERE stat_id = ? AND date < ? AND period_type = ?
      ORDER BY date DESC
      LIMIT ?
    `).all(statId, beforeDate, periodType, n) as DbStatEntry[];
  },
};

// Stat quota operations (Exec Series 7)
export const statQuotaOps = {
  getByStatAndWeek: (statId: string, weekEndingDate: string) => {
    return getDb().prepare(`
      SELECT * FROM stat_quotas WHERE stat_id = ? AND week_ending_date = ?
    `).get(statId, weekEndingDate) as DbStatQuota | undefined;
  },

  getByStatId: (statId: string) => {
    return getDb().prepare(`
      SELECT * FROM stat_quotas WHERE stat_id = ? ORDER BY week_ending_date DESC
    `).all(statId) as DbStatQuota[];
  },

  // Get the most recent quota on or before a given date (for inheriting quotas)
  getMostRecentForStat: (statId: string, beforeOrOnDate: string) => {
    return getDb().prepare(`
      SELECT * FROM stat_quotas
      WHERE stat_id = ? AND week_ending_date <= ?
      ORDER BY week_ending_date DESC
      LIMIT 1
    `).get(statId, beforeOrOnDate) as DbStatQuota | undefined;
  },

  upsert: (quota: DbStatQuota) => {
    const stmt = getDb().prepare(`
      INSERT INTO stat_quotas (id, stat_id, week_ending_date, quotas_json, created_at, updated_at)
      VALUES (@id, @stat_id, @week_ending_date, @quotas_json, @created_at, @updated_at)
      ON CONFLICT(stat_id, week_ending_date)
      DO UPDATE SET quotas_json = @quotas_json, updated_at = @updated_at
    `);
    stmt.run(quota);
    return quota;
  },

  delete: (id: string) => {
    getDb().prepare("DELETE FROM stat_quotas WHERE id = ?").run(id);
  },
};

export default getDb;
