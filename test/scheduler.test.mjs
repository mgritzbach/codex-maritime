import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS, mergeSettings } from "../src/defaults.mjs";
import { evaluateDelivery, isQuietTime, nextAllowedTime } from "../src/scheduler.mjs";

const settings = mergeSettings(DEFAULT_SETTINGS, { timezone: "America/Los_Angeles" });

test("quiet hours defer to 06:00 in the configured timezone", () => {
  const at0030 = new Date("2026-07-26T07:30:00.000Z");
  assert.equal(isQuietTime(at0030, settings), true);
  assert.equal(nextAllowedTime(at0030, settings).toISOString(), "2026-07-26T13:00:00.000Z");
});

test("quiet hours can be disabled", () => {
  const adjustable = mergeSettings(settings, { notifications: { quietHours: { enabled: false } } });
  const now = new Date("2026-07-26T07:30:00.000Z");
  const task = { status: "active", paused: false, nextUpdateAt: "2026-07-26T07:00:00.000Z" };
  assert.equal(evaluateDelivery(task, now, adjustable).due, true);
});

test("overnight quiet ranges are supported", () => {
  const overnight = mergeSettings(settings, { notifications: { quietHours: { enabled: true, start: "22:00", end: "07:00" } } });
  assert.equal(isQuietTime(new Date("2026-07-26T06:00:00.000Z"), overnight), true);
});