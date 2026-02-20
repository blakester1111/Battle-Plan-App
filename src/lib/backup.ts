import path from "path";
import fs from "fs";
import cron from "node-cron";
import getDb from "./db";

const BACKUP_DIR = path.join(process.cwd(), "backups");
const MAX_AGE_DAYS = 30;

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function getTimestamp(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}-${h}${min}`;
}

function purgeOldBackups() {
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const files = fs.readdirSync(BACKUP_DIR);
  for (const file of files) {
    if (!file.endsWith(".db")) continue;
    const filePath = path.join(BACKUP_DIR, file);
    const stat = fs.statSync(filePath);
    if (stat.mtimeMs < cutoff) {
      fs.unlinkSync(filePath);
      console.log(`[Backup] Purged old backup: ${file}`);
    }
  }
}

export function runBackup() {
  try {
    ensureBackupDir();
    const destPath = path.join(BACKUP_DIR, `battleplan-${getTimestamp()}.db`);
    const db = getDb();
    db.backup(destPath);
    console.log(`[Backup] Created: ${destPath}`);
    purgeOldBackups();
  } catch (error) {
    console.error("[Backup] Failed:", error);
  }
}

export function scheduleBackups() {
  // Run one backup immediately on startup
  runBackup();

  // Schedule daily at 2:00 AM Eastern Time
  cron.schedule("0 2 * * *", () => {
    console.log("[Backup] Running scheduled daily backup...");
    runBackup();
  }, {
    timezone: "America/New_York",
  });

  console.log("[Backup] Scheduled daily backup at 2:00 AM ET");
}
