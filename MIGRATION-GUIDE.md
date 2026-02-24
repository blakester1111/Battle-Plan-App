# Admin Basics — Migration & Deployment Guide

**For: AI agent on Windows 2019 offline server**
**From: Mac development version → Windows 2019 production server**
**Date: February 2026**

---

## Overview

The app has been renamed from "Battle Plan" to **"Admin Basics"** and now includes a full **Stats & Graphs** feature set on top of the existing Kanban board, weekly battle plans, notes, and team hierarchy features. The existing database, users, and sessions will be preserved — the new stats tables are created automatically on first run, and existing tables receive non-destructive ALTER TABLE migrations.

---

## CRITICAL: Do NOT Copy `node_modules`

The `node_modules` folder from the Mac must **NOT** be copied to the Windows server. Native modules (especially `better-sqlite3`) are compiled per-platform. You must run `npm install` fresh on the Windows machine to get correct Windows binaries.

---

## Step-by-Step Deployment

### Step 1: Copy the Source Code

Copy the **entire `BP App/` folder** to the Windows server, **excluding** these:
- `node_modules/` — will be rebuilt on Windows
- `.next/` — will be rebuilt on Windows
- `data/battleplan.db*` — existing database stays in place on the server (see Step 3)

Everything else should be copied (all `src/`, `public/`, config files, `package.json`, etc.).

### Step 2: Install Dependencies

On the Windows server, open a terminal in the `BP App/` directory and run:

```bash
npm install
```

This will install **all** dependencies from `package.json`, including the new ones required for stats/graphs:

#### New Runtime Dependencies (not in the old version)
| Package | Version | Purpose |
|---------|---------|---------|
| `recharts` | `^3.7.0` | Chart library for Stats & Graphs (AreaChart, dual Y-axes, tooltips) |

#### Existing Dependencies (already in old version, ensure present)
| Package | Version | Purpose |
|---------|---------|---------|
| `better-sqlite3` | `^12.6.2` | SQLite database (native module — must be compiled on Windows) |
| `next` | `16.1.6` | Framework |
| `react` | `19.2.3` | UI library |
| `react-dom` | `19.2.3` | React DOM |
| `@dnd-kit/core` | `^6.3.1` | Drag and drop |
| `@dnd-kit/sortable` | `^10.0.0` | Sortable drag and drop |
| `@dnd-kit/utilities` | `^3.2.2` | DnD utilities |
| `bcryptjs` | `^3.0.3` | Password hashing |
| `next-themes` | `^0.4.6` | Dark mode |
| `docx` | `^9.5.2` | Word document export |
| `pdfkit` | `^0.17.2` | PDF export |
| `node-cron` | `^4.2.1` | Scheduled tasks |
| `@fontsource/outfit` | `^5.2.8` | Font |

#### Dev Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| `tailwindcss` | `^4` | CSS framework |
| `@tailwindcss/postcss` | `^4` | Tailwind PostCSS plugin |
| `typescript` | `^5` | TypeScript compiler |
| `eslint` | `^9` | Linting |
| `eslint-config-next` | `16.1.6` | Next.js ESLint config |
| `@types/better-sqlite3` | `^7.6.13` | Type definitions |
| `@types/node` | `^20` | Type definitions |
| `@types/react` | `^19` | Type definitions |
| `@types/react-dom` | `^19` | Type definitions |
| `@types/node-cron` | `^3.0.11` | Type definitions |
| `@types/pdfkit` | `^0.17.5` | Type definitions |
| `@types/bcryptjs` | `^2.4.6` | Type definitions |

### Step 3: Migrate the Existing Database

The existing `data/battleplan.db` on the Windows server **stays in place**. Do NOT overwrite it.

When the app starts, `src/lib/db.ts` automatically:

1. **Creates new tables** if they don't exist:
   - `stat_definitions` — stat configuration (name, format, assigned user, etc.)
   - `stat_entries` — individual data points (value, date, period type)

2. **Runs non-destructive ALTER TABLE migrations** on existing tables:
   - Adds `gds` column to `stat_definitions` (INTEGER DEFAULT 0)
   - Adds `is_money` column to `stat_definitions` (INTEGER DEFAULT 0)
   - Adds `is_percentage` column to `stat_definitions` (INTEGER DEFAULT 0)
   - Adds `is_inverted` column to `stat_definitions` (INTEGER DEFAULT 0)
   - Adds `linked_stat_ids` column to `stat_definitions` (TEXT, for composite stats)

These migrations use `PRAGMA table_info()` checks — they only run if the column doesn't already exist, so they're safe to run multiple times.

**All existing data is preserved:** users, sessions, tasks, notes, weekly battle plans, relationships, categories, settings, task notes, BP notes, info terminal relationships.

### Step 4: Build the App

```bash
npm run build
```

This compiles the Next.js app with all new components. The build output goes to `.next/`.

### Step 5: Start the Server

```bash
npm run start
```

The app runs on **port 4000** (hardcoded in `package.json` scripts).

For development with hot-reload:
```bash
npm run dev
```

---

## New Features Summary

### 1. Stats & Graphs (Major Feature)

A complete statistics tracking and visualization system accessible via the chart icon button in the header.

**Components** (all in `src/components/stats/`):
- `StatsView.tsx` — Main stats page layout (sidebar + graph area)
- `StatsList.tsx` — Sidebar listing all stat definitions with filters (All, GDS, Up, Down, Down 3+)
- `StatGraph.tsx` — Recharts-based area chart with dual Y-axes, overlay support, composite rendering
- `StatDefinitionModal.tsx` — Create/edit stat definitions (name, format, assignment, composite linking)
- `StatEntryModal.tsx` — Enter data for individual dates or bulk import, with tabbed UI for composites
- `TimeRangeSelector.tsx` — Preset date range buttons (7d, 14d, 30d, 12w, 6m, 1y, custom)
- `YAxisControls.tsx` — Manual Y-axis min/max controls for left and right axes

**API Routes:**
- `src/app/api/stats/route.ts` — CRUD for stat definitions (GET, POST, PUT, DELETE)
- `src/app/api/stat-entries/route.ts` — CRUD + bulk import for stat entries (GET, POST, PUT, PATCH, DELETE)

**Capabilities:**
- Create stats assigned to self, juniors, or info terminal users
- Daily, weekly, or monthly period types
- Currency ($) and percentage (%) formatting
- Inverted stats (lower is better — trend arrows flip)
- GDS designation flag
- Trend arrows (up/down/flat) calculated from last 4 entries
- Down-streak counter (3+ consecutive drops highlighted)
- Configurable date ranges with custom date picker
- Manual Y-axis scaling (auto or set min/max)
- Data labels toggle on graph points
- Print support for stat graphs

### 2. Composite (Dual/Triple) Stats

Stats that combine 2-3 existing stats on a single chart for direct comparison.

- **Line 1:** Solid stroke, left Y-axis
- **Line 2:** Dashed stroke (`8 4`), right Y-axis
- **Line 3:** Dotted stroke (`2 3`), right Y-axis (optional)
- Each line has independent up/down coloring (black for up, red for down)
- Legend displayed above the chart
- Enhanced tooltip showing all lines with stat names and line-style indicators
- Left and right Y-axes scale independently with separate manual controls
- Composite stats are created via a "Composite Stat" toggle in the stat definition modal
- Original linked stats remain as independent stats with their own graphs

### 3. Stat Overlay

Compare any stat against another by overlaying it on the same chart.

- Overlay stat renders on the right Y-axis using the accent color
- Time-shift overlay data forward or backward by N periods for comparison
- Overlay dropdown hidden when viewing composite stats (they have their own multi-line display)

### 4. Delete Confirmation for Stats

When deleting a stat, a confirmation modal appears requiring the user to type the exact stat name before deletion proceeds. Prevents accidental data loss.

### 5. App Renamed to "Admin Basics"

All user-facing branding changed from "Battle Plan" to "Admin Basics":
- Browser tab title
- Login page heading
- Header title
- Print document titles, headers, and footers
- Export/download filenames (`admin-basics.pdf`, `admin-basics.docx`)

**NOT changed** (preserves backward compatibility):
- Database filename (`battleplan.db`) — changing would lose data
- Session cookie name (`battleplan_session`) — changing would log everyone out
- Database table names (`weekly_battle_plans`) — internal
- API route paths (`/weekly-battle-plans`) — internal
- TypeScript types and state property names — internal code

---

## New Files List (all files that don't exist in the old version)

```
src/components/stats/
  StatsView.tsx
  StatsList.tsx
  StatGraph.tsx
  StatDefinitionModal.tsx
  StatEntryModal.tsx
  TimeRangeSelector.tsx
  YAxisControls.tsx

src/app/api/stats/route.ts
src/app/api/stat-entries/route.ts
```

## Modified Files (files that exist in old version but have changes)

```
package.json                        — renamed to "admin-basics", added recharts dependency
src/app/layout.tsx                  — title changed to "Admin Basics"
src/lib/types.ts                    — added StatDefinition, StatEntry, StatsViewConfig types;
                                      added stats-related action types to AppAction union;
                                      added stats fields to AppState interface
src/lib/db.ts                       — added stat_definitions and stat_entries tables + CRUD ops;
                                      added ALTER TABLE migrations for stat columns
src/lib/api.ts                      — added statsApi and statEntriesApi client methods
src/context/AppContext.tsx           — added stats state fields, reducer cases for 15 stat actions,
                                      stats hydration from localStorage, loadUserData fetch for stats
src/components/Header.tsx           — "Admin Basics" title, stats toggle button
src/components/LoginForm.tsx        — "Admin Basics" heading
src/components/AppShell.tsx         — conditionally renders StatsView when viewingStats is true
src/components/PrintBPModal.tsx     — "Admin Basics" in document titles/footers/filenames
src/app/api/export/route.ts        — download filename changed to admin-basics.*
```

---

## Database Schema Reference

### stat_definitions table
```sql
CREATE TABLE IF NOT EXISTS stat_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  division INTEGER,
  department INTEGER,
  gds INTEGER DEFAULT 0,
  is_money INTEGER DEFAULT 0,
  is_percentage INTEGER DEFAULT 0,
  is_inverted INTEGER DEFAULT 0,
  linked_stat_ids TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_stat_definitions_user ON stat_definitions(user_id);
CREATE INDEX IF NOT EXISTS idx_stat_definitions_created_by ON stat_definitions(created_by);
```

### stat_entries table
```sql
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

CREATE INDEX IF NOT EXISTS idx_stat_entries_stat ON stat_entries(stat_id);
CREATE INDEX IF NOT EXISTS idx_stat_entries_date ON stat_entries(stat_id, date);
```

---

## Verification Checklist

After deployment, verify:

1. [ ] `npm install` completes without errors (especially `better-sqlite3` native build)
2. [ ] `npm run build` succeeds with no TypeScript errors
3. [ ] App starts on port 4000
4. [ ] Existing users can log in (sessions preserved)
5. [ ] Existing tasks, notes, battle plans all visible and functional
6. [ ] Stats toggle button (chart icon) appears in header
7. [ ] Can create a new stat definition
8. [ ] Can enter data for a stat
9. [ ] Graph renders with correct formatting (currency, percentage)
10. [ ] Trend arrows appear in stats sidebar
11. [ ] Can create a composite (dual/triple) stat
12. [ ] Composite graph shows multiple lines with legend
13. [ ] Delete stat shows confirmation modal requiring name input
14. [ ] Browser tab shows "Admin Basics"
15. [ ] Login page shows "Admin Basics"
16. [ ] Print preview shows "Admin Basics" in header/footer

---

## Troubleshooting

### `better-sqlite3` fails to install on Windows
This native module requires build tools. Install:
```bash
npm install -g windows-build-tools
```
Or ensure Visual Studio Build Tools (C++ workload) is installed.

### Port 4000 already in use
Check `package.json` scripts — port is hardcoded. Kill existing process or change the port in both `dev` and `start` scripts.

### Database locked errors
Ensure only one instance of the app is running. The SQLite database uses WAL mode for better concurrency, but only one server process should access it at a time.

### Offline server — npm install without internet
If the Windows server has no internet access:
1. On an internet-connected Windows machine with the same Node.js version, run `npm install` in the project directory
2. Copy the entire `node_modules/` folder to the offline server
3. **Important:** Both machines must be Windows and have the same Node.js major version for native modules to be compatible
