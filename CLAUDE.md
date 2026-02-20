# CLAUDE.md — Battle Plan App

A Next.js 16 full-stack project management application for weekly battle plans, Kanban task boards, and team supervision with senior/junior hierarchy. Uses React 19, TypeScript, Tailwind CSS 4, and SQLite.

---

## Commands

### Setup
```bash
cd "BP App"
npm install              # Install dependencies
npm run build            # Build production bundle (.next/)
```

### Running the Server
```bash
# Development (interactive, hot-reload)
start-bp-server-dev.bat          # Runs next dev on port 4000

# Production
start-bp-server-prod.bat         # Builds if needed, starts on port 4000, tracks PID
stop-bp-server.bat               # Stops production server
```

### Other
```bash
npm run lint             # ESLint
```

There are no automated tests configured.

---

## Architecture

### Tech Stack
- **Framework:** Next.js 16.1.6 (App Router, Turbopack)
- **Frontend:** React 19.2.3, TypeScript 5, Tailwind CSS 4 (PostCSS)
- **Database:** SQLite via better-sqlite3 (WAL mode), stored at `data/battleplan.db`
- **Auth:** Session-based (HTTP-only cookies), bcryptjs password hashing
- **Drag & Drop:** @dnd-kit/core + @dnd-kit/sortable
- **Theming:** next-themes (class-based dark mode)
- **Font:** Outfit (local woff2 files in `src/fonts/`)
- **Port:** 4000 (hardcoded in package.json scripts)

### Directory Structure
```
BP App/
├── src/
│   ├── app/
│   │   ├── api/                    # 12 API route files (Next.js route handlers)
│   │   │   ├── auth/route.ts
│   │   │   ├── tasks/route.ts
│   │   │   ├── notes/route.ts
│   │   │   ├── users/route.ts
│   │   │   ├── categories/route.ts
│   │   │   ├── settings/route.ts
│   │   │   ├── relationships/route.ts
│   │   │   ├── junior-tasks/route.ts
│   │   │   ├── task-notes/route.ts
│   │   │   ├── bp-notes/route.ts
│   │   │   ├── weekly-battle-plans/route.ts
│   │   │   └── info-terminals/     # route.ts + board/[userId]/ + my-viewers/ + viewable/
│   │   ├── globals.css             # Tailwind import + custom styles
│   │   ├── layout.tsx              # Root layout with ThemeProvider
│   │   └── page.tsx                # Entry point, mounts AppProvider + AppShell
│   ├── components/
│   │   ├── kanban/                 # KanbanBoard, KanbanColumn, KanbanCard, KanbanCardModal
│   │   ├── notes/                  # NotesArea, NoteEditor
│   │   ├── todo/                   # TodoList
│   │   ├── AppShell.tsx            # Main layout router (login vs board)
│   │   ├── Header.tsx              # Top nav bar
│   │   ├── Sidebar.tsx             # Left sidebar (collapsible sections)
│   │   ├── LoginForm.tsx           # Login/register UI
│   │   ├── AdminPanel.tsx          # Admin user management
│   │   ├── ProfileModal.tsx        # User profile editor
│   │   ├── SettingsModal.tsx       # Settings (shortcuts, colors, dates)
│   │   ├── WeeklyBPModal.tsx       # Create/edit weekly battle plans
│   │   ├── WeeklyBPList.tsx        # BP list with progress bars
│   │   ├── JuniorBoardView.tsx     # Senior viewing junior's board
│   │   ├── JuniorsList.tsx         # List of current user's juniors
│   │   ├── InfoTerminalBoardView.tsx
│   │   ├── InfoTerminalsList.tsx
│   │   ├── TaskNotesModal.tsx      # Senior feedback on tasks
│   │   ├── BPNotesModal.tsx        # Senior feedback on BPs
│   │   ├── NotificationBell.tsx    # Unread note notifications
│   │   ├── CategoryFilter.tsx
│   │   ├── SortModeSelector.tsx
│   │   └── ThemeToggle.tsx
│   ├── context/
│   │   └── AppContext.tsx          # Global state (useReducer) — all app state + 70+ actions
│   ├── lib/
│   │   ├── db.ts                   # Database schema, migrations, all CRUD ops (~1100 lines)
│   │   ├── auth.ts                 # Password hashing, session management, cookie helpers
│   │   ├── api.ts                  # Client-side API methods (authApi, tasksApi, notesApi, etc.)
│   │   ├── types.ts                # All TypeScript interfaces and type definitions
│   │   ├── utils.ts                # ID generation, color maps, shortcut parsing
│   │   ├── conditionFormulas.ts    # 10 condition formula definitions with steps
│   │   ├── dateUtils.ts            # Date formatting, week calculations, timezones
│   │   └── storage.ts             # localStorage persistence helpers
│   ├── providers/
│   │   └── ThemeProvider.tsx       # next-themes wrapper
│   └── fonts/                      # Outfit woff2 files (300/400/500/600 weights)
├── data/                           # SQLite database (auto-created)
├── public/                         # Static assets (SVGs)
├── Condition Formula Screenshots/  # Reference screenshots
├── package.json
├── tsconfig.json
├── postcss.config.mjs
└── next.config.ts
```

### Backend

#### Database (`src/lib/db.ts`)

SQLite with WAL mode, singleton connection. Schema auto-creates on first run. Migrations run inline via column existence checks.

**Tables:**
- `users` — id, username (unique), password_hash, first_name, last_name, org (Day/Foundation), division, department, post_title, role (admin/user), created_at
- `sessions` — id (32-byte hex), user_id, expires_at (7-day sessions)
- `tasks` — id, user_id, title, description, status (todo/in-progress/complete), order, label, priority, category, bugged, weekly_bp_id, formula_step_id, created_at
- `notes` — id, user_id, title, content, created_at, updated_at
- `settings` — user_id, key, value (JSON-stored user preferences)
- `custom_categories` — id, user_id, name (unique per user)
- `user_relationships` — id, senior_id, junior_id (hierarchy)
- `info_terminal_relationships` — id, owner_id, viewer_id (board access grants)
- `weekly_battle_plans` — id, user_id, title, week_start, formula_id/name/code, notes, created_at
- `task_notes` — id, task_id, author_id, content, created_at, read_at, note_type (senior/info)
- `bp_notes` — id, bp_id, author_id, content, created_at, read_at, note_type (senior/info)

**Operation modules:** `userOps`, `sessionOps`, `taskOps`, `noteOps`, `settingsOps`, `categoryOps`, `relationshipOps`, `infoTerminalOps`, `taskNoteOps`, `weeklyBPOps`, `bpNoteOps`

#### Authentication (`src/lib/auth.ts`)

- Session-based with HTTP-only cookie (`battleplan_session`)
- bcryptjs hashing (10 salt rounds)
- 7-day session expiry, auto-refreshed on activity
- First registered user becomes admin automatically
- Roles: `admin` (full access, user management) and `user` (own data only)

#### API Routes

All Next.js route handlers at `src/app/api/*/route.ts`. Standard pattern: authenticate via `getCurrentUserId()`, perform DB operations, return JSON.

**Key endpoints:**
- `POST /api/auth` — Login (with `?action=register` for registration)
- `GET /api/auth` — Get current user from session
- `DELETE /api/auth` — Logout
- `GET|POST|PUT|DELETE /api/tasks` — Task CRUD; `PATCH` for bulk reorder
- `GET|POST|PUT|DELETE /api/notes` — Personal notes CRUD
- `GET|POST /api/settings` — User preferences (key-value)
- `GET|POST|DELETE /api/categories` — Custom task categories
- `GET|POST|PATCH|DELETE /api/users` — User management (admin); profile update (self)
- `GET|POST|DELETE /api/relationships` — Senior/junior hierarchy (admin)
- `GET /api/junior-tasks` — Fetch junior's tasks and BPs (seniors only)
- `GET|POST|PATCH|DELETE /api/task-notes` — Feedback notes on tasks
- `GET|POST|PATCH|DELETE /api/bp-notes` — Feedback notes on BPs
- `GET|POST|PUT|DELETE /api/weekly-battle-plans` — Weekly BP CRUD with linked tasks
- `GET|POST|DELETE /api/info-terminals` — Board access grants; `/my-viewers`, `/viewable`, `/board/[userId]`

### Frontend

#### State Management (`src/context/AppContext.tsx`)

Single `useReducer`-based global context with 70+ action types. Manages:
- Auth state (user, loading)
- Kanban tasks (CRUD, drag-and-drop reorder, move between columns)
- Notes (CRUD, active selection)
- Weekly Battle Plans (CRUD, progress tracking, formula linking)
- Junior viewing mode (senior sees junior's board)
- Info Terminal viewing mode (granted viewers see owner's board)
- Task/BP notes (senior feedback, read status, unread counts)
- UI preferences (sidebar, categories, filters, sort mode, accent color, date format, week settings)

#### Key Business Logic

**Condition Formulas (`src/lib/conditionFormulas.ts`):**
10 organizational condition formulas (Power, Power Change, PV Repair, Affluence, Action Affluence, Normal, Emergency, Danger, Treason, Confusion), each with numbered steps. Weekly BPs link to a formula, and tasks can link to specific formula steps.

**Senior/Junior Hierarchy:**
- Admins create relationships (one senior → many juniors)
- Seniors view junior's board (read-only tasks + feedback notes)
- Task notes have `note_type`: "senior" (from hierarchy) or "info" (from info terminal)
- Unread tracking: notes have `read_at` timestamp

**Info Terminals:**
- Any user can grant other users view access to their board
- Viewers can add "info" type feedback notes
- Separate from senior/junior hierarchy

**Week Settings:**
- Configurable week boundaries (start/end day + hour, timezone)
- Default: Thursday 2pm to Thursday 2pm
- Used for BP date calculations

**Board Sort Modes:** priority-formula, formula, manual

**Accent Colors:** amber, blue, emerald, violet, rose, cyan

---

## Environment

- **Port:** 4000 (hardcoded in package.json)
- **Database:** `data/battleplan.db` (auto-created with WAL mode)
- **Node compatibility:** Works with Node 20.x and 22.x
- **No `.env` required** — falls back to dev defaults. In production, `NODE_ENV=production` enables secure cookies.
- **No build step for CSS** — Tailwind CSS 4 uses PostCSS at build time

---

## Dependencies

**Runtime:** next, react, react-dom, better-sqlite3, bcryptjs, @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, @fontsource/outfit, next-themes

**Dev:** tailwindcss, @tailwindcss/postcss, typescript, eslint, eslint-config-next, @types/better-sqlite3, @types/bcryptjs, @types/node, @types/react, @types/react-dom
