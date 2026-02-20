export async function register() {
  // Only run on the Node.js server runtime (not during build or on client)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { scheduleBackups } = await import("./lib/backup");
    scheduleBackups();
  }
}
