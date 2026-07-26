export const DEFAULT_SETTINGS = Object.freeze({
  timezone: "UTC",
  notifications: {
    enabled: true,
    firstAfterMinutes: 60,
    repeatEveryMinutes: 120,
    quietHours: { enabled: true, start: "00:00", end: "06:00" }
  },
  approvals: { enabled: true, expiresAfterMinutes: 20 },
  progress: { decimals: 0 }
});

export function mergeSettings(base = DEFAULT_SETTINGS, override = {}) {
  return {
    ...base,
    ...override,
    notifications: {
      ...base.notifications,
      ...override.notifications,
      quietHours: { ...base.notifications.quietHours, ...override.notifications?.quietHours }
    },
    approvals: { ...base.approvals, ...override.approvals },
    progress: { ...base.progress, ...override.progress }
  };
}

export function validateSettings(settings) {
  const merged = mergeSettings(DEFAULT_SETTINGS, settings);
  try { new Intl.DateTimeFormat("en-US", { timeZone: merged.timezone }).format(); }
  catch { throw new Error(`Unknown IANA timezone: ${merged.timezone}`); }
  for (const key of ["firstAfterMinutes", "repeatEveryMinutes"]) {
    const value = merged.notifications[key];
    if (!Number.isFinite(value) || value <= 0) throw new Error(`notifications.${key} must be positive`);
  }
  for (const key of ["start", "end"]) {
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(merged.notifications.quietHours[key])) {
      throw new Error(`quietHours.${key} must use HH:MM`);
    }
  }
  if (!Number.isInteger(merged.progress.decimals) || merged.progress.decimals < 0 || merged.progress.decimals > 2) {
    throw new Error("progress.decimals must be 0, 1, or 2");
  }
  return merged;
}