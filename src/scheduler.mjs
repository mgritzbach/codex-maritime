function clockMinutes(value) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function zonedClockMinutes(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0) % 24;
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

export function isQuietTime(date, settings) {
  const quiet = settings.notifications.quietHours;
  if (!quiet.enabled) return false;
  const start = clockMinutes(quiet.start);
  const end = clockMinutes(quiet.end);
  if (start === end) return false;
  const now = zonedClockMinutes(date, settings.timezone);
  return start < end ? now >= start && now < end : now >= start || now < end;
}

export function nextAllowedTime(date, settings) {
  if (!isQuietTime(date, settings)) return new Date(date);
  const candidate = new Date(date);
  candidate.setUTCSeconds(0, 0);
  candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  for (let minute = 0; minute < 60 * 48; minute += 1) {
    if (!isQuietTime(candidate, settings)) return candidate;
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  }
  throw new Error("Could not find an allowed delivery time within 48 hours");
}

export const firstUpdateAt = (startedAt, settings) => new Date(new Date(startedAt).getTime() + settings.notifications.firstAfterMinutes * 60_000);
export const nextUpdateAfter = (sentAt, settings) => new Date(new Date(sentAt).getTime() + settings.notifications.repeatEveryMinutes * 60_000);

export function evaluateDelivery(task, now, settings) {
  if (!settings.notifications.enabled || task.status !== "active" || task.paused) return { due: false, nextAt: task.nextUpdateAt };
  const dueAt = new Date(task.nextUpdateAt);
  if (dueAt > now) return { due: false, nextAt: dueAt.toISOString() };
  const allowed = nextAllowedTime(now, settings);
  if (allowed > now) return { due: false, nextAt: allowed.toISOString(), deferredForQuietHours: true };
  return { due: true, nextAt: nextUpdateAfter(now, settings).toISOString() };
}