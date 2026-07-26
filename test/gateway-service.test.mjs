import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS, mergeSettings } from "../src/defaults.mjs";
import { GatewayService } from "../src/gateway-service.mjs";
import { MemoryStore } from "../src/store.mjs";

class RecordingChannel { messages = []; async send(text) { this.messages.push(text); return { id: String(this.messages.length) }; } }

function fixture() {
  let now = new Date("2026-07-26T16:00:00.000Z");
  const channel = new RecordingChannel();
  const service = new GatewayService({
    store: new MemoryStore(), channel,
    settings: mergeSettings(DEFAULT_SETTINGS, { timezone: "America/Los_Angeles" }),
    now: () => now
  });
  return { service, channel, setNow: (value) => { now = new Date(value); } };
}

test("registers, reports after one hour, and queues steering", async () => {
  const { service, channel, setNow } = fixture();
  const task = await service.registerTask({ title: "Build bridge", deviceId: "dev", goals: [{ title: "Core", progress: 37 }] });
  assert.match(channel.messages[0], new RegExp(`\\[${task.code}\\]`));
  setNow("2026-07-26T17:00:00.000Z");
  assert.equal((await service.tick()).sent, 1);
  assert.match(channel.messages[1], /37%/);
  await service.processInbound({ id: "m1", sender: "+15550000000", text: `${task.code} /s: focus tests` });
  const commands = await service.pendingCommands("dev");
  assert.equal(commands[0].type, "steer");
  assert.equal(commands[0].text, "focus tests");
});

test("approval replies are exact and one-time", async () => {
  const { service } = fixture();
  const task = await service.registerTask({ title: "Approve", deviceId: "dev" });
  const approval = await service.requestApproval(task.code, { summary: "npm install" });
  await service.processInbound({ id: "m2", sender: "+15550000000", text: `Y ${approval.reference}` });
  const commands = await service.pendingCommands("dev");
  assert.equal(commands[0].decision, "accept");
  assert.equal(commands[0].approvalId, approval.id);
});