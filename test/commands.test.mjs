import test from "node:test";
import assert from "node:assert/strict";
import { parseInboundCommand } from "../src/commands.mjs";

test("parses queued commands and steering", () => {
  assert.deepEqual(parseInboundCommand("K7M /c: add DST tests"), { type: "command", code: "K7M", text: "add DST tests" });
  assert.deepEqual(parseInboundCommand("/s K7M: ship SMS first"), { type: "steer", code: "K7M", text: "ship SMS first" });
});

test("parses scoped and unscoped approvals", () => {
  assert.deepEqual(parseInboundCommand("Y"), { type: "approval", decision: "accept", reference: null });
  assert.deepEqual(parseInboundCommand("N K7M-A2"), { type: "approval", decision: "decline", reference: "K7M-A2" });
});

test("parses adjustable settings", () => {
  assert.deepEqual(parseInboundCommand("/settings quiet 23:00-07:00"), { type: "settings", key: "quiet", enabled: true, start: "23:00", end: "07:00" });
  assert.deepEqual(parseInboundCommand("/settings cadence 90m"), { type: "settings", key: "cadence", minutes: 90 });
});