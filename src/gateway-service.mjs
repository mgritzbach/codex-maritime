import { randomUUID } from "node:crypto";
import { parseInboundCommand } from "./commands.mjs";
import { mergeSettings, validateSettings } from "./defaults.mjs";
import { formatApproval, formatTaskUpdate } from "./format.mjs";
import { normalizeGoal } from "./progress.mjs";
import { evaluateDelivery, firstUpdateAt, isQuietTime } from "./scheduler.mjs";
import { createTaskCode, normalizeTaskCode } from "./task-code.mjs";

export class GatewayService {
  constructor({ store, channel, settings, now = () => new Date() }) {
    this.store = store;
    this.channel = channel;
    this.baseSettings = validateSettings(settings);
    this.now = now;
  }

  effectiveSettings(state) { return validateSettings(mergeSettings(this.baseSettings, state.settingsOverride)); }

  async registerTask(input) {
    const now = this.now();
    const result = await this.store.mutate((state) => {
      const code = createTaskCode(new Set(Object.keys(state.tasks)));
      const settings = this.effectiveSettings(state);
      const task = {
        code,
        projectId: String(input.projectId ?? "default"),
        deviceId: String(input.deviceId ?? "default"),
        threadId: input.threadId ? String(input.threadId) : null,
        title: String(input.title ?? "Untitled task"),
        goals: (input.goals ?? []).map(normalizeGoal),
        current: input.current ? String(input.current) : "",
        blockers: Array.isArray(input.blockers) ? input.blockers.map(String) : [],
        next: input.next ? String(input.next) : "",
        status: "active",
        paused: false,
        startedAt: now.toISOString(),
        updatedAt: now.toISOString(),
        nextUpdateAt: firstUpdateAt(now, settings).toISOString(),
        pendingFinal: false,
        approvalSequence: 0
      };
      state.tasks[code] = task;
      return structuredClone(task);
    });
    await this.channel.send(`[${result.code}] Tracking: ${result.title}\nUpdates begin after 1h if still active.`);
    return result;
  }

  async getTask(code) {
    const state = await this.store.read();
    return state.tasks[normalizeTaskCode(code)] ?? null;
  }

  async updateTask(code, patch) {
    return this.store.mutate((state) => {
      const task = requireTask(state, code);
      if (patch.goals) task.goals = patch.goals.map(normalizeGoal);
      if (patch.current !== undefined) task.current = String(patch.current ?? "");
      if (patch.blockers !== undefined) task.blockers = Array.isArray(patch.blockers) ? patch.blockers.map(String) : [];
      if (patch.next !== undefined) task.next = String(patch.next ?? "");
      task.updatedAt = this.now().toISOString();
      return structuredClone(task);
    });
  }

  async completeTask(code, result = {}) {
    const now = this.now();
    const task = await this.store.mutate((state) => {
      const current = requireTask(state, code);
      current.status = result.status === "failed" ? "failed" : "completed";
      current.current = result.summary ? String(result.summary) : current.current;
      current.updatedAt = now.toISOString();
      current.pendingFinal = true;
      return structuredClone(current);
    });
    await this.flushFinal(task.code);
    return task;
  }

  async requestApproval(code, input) {
    const now = this.now();
    const approval = await this.store.mutate((state) => {
      const task = requireTask(state, code);
      task.approvalSequence += 1;
      const reference = `${task.code}-A${task.approvalSequence}`;
      const settings = this.effectiveSettings(state);
      const item = {
        id: randomUUID(), reference, code: task.code, deviceId: task.deviceId,
        kind: String(input.kind ?? "command"), summary: String(input.summary ?? "Unspecified action"),
        cwd: input.cwd ? String(input.cwd) : "", reason: input.reason ? String(input.reason) : "",
        status: "pending", createdAt: now.toISOString(), notifiedAt: null,
        expiresAt: new Date(now.getTime() + settings.approvals.expiresAfterMinutes * 60_000).toISOString()
      };
      state.approvals[item.id] = item;
      return structuredClone(item);
    });
    await this.flushApproval(approval.id);
    return approval;
  }

  async pendingCommands(deviceId = "default") {
    const state = await this.store.read();
    return state.commands.filter((item) => !item.ackedAt && item.deviceId === deviceId);
  }

  async acknowledgeCommand(id) {
    return this.store.mutate((state) => {
      const command = state.commands.find((item) => item.id === id);
      if (!command) throw new Error("Command not found");
      command.ackedAt = this.now().toISOString();
      return structuredClone(command);
    });
  }

  async processInbound({ id = randomUUID(), sender = "unknown", text }) {
    const existing = await this.store.read();
    if (existing.seenInbound[id]) return { duplicate: true };
    const allowed = (process.env.INKBOX_ALLOWED_SENDERS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
    if (allowed.length && !allowed.includes(sender)) throw new Error("Sender is not allowlisted");
    const parsed = parseInboundCommand(text);
    const reply = await this.store.mutate((state) => {
      state.seenInbound[id] = this.now().toISOString();
      return this.applyInbound(state, parsed);
    });
    if (reply) await this.channel.send(reply);
    return { parsed, reply };
  }

  applyInbound(state, parsed) {
    if (parsed.type === "settings") return applySettings(state, parsed);
    if (parsed.type === "approval") {
      const pending = Object.values(state.approvals).filter((item) => item.status === "pending" && new Date(item.expiresAt) > this.now());
      const approval = parsed.reference ? pending.find((item) => item.reference === parsed.reference) : pending.length === 1 ? pending[0] : null;
      if (!approval) return pending.length > 1 ? "More than one approval is pending; reply with its full code." : "No matching pending approval.";
      approval.status = "queued";
      queueCommand(state, approval.deviceId, approval.code, "approval", { approvalId: approval.id, decision: parsed.decision });
      return `${approval.reference}: ${parsed.decision === "accept" ? "approved once" : "declined"}.`;
    }
    if (["command", "steer", "stop"].includes(parsed.type)) {
      const task = resolveTask(state, parsed.code);
      if (!task) return "Specify a task code because zero or multiple tasks are active.";
      queueCommand(state, task.deviceId, task.code, parsed.type, parsed.text ? { text: parsed.text } : {});
      return `[${task.code}] ${parsed.type} queued.`;
    }
    if (["status", "pause", "resume"].includes(parsed.type)) {
      const task = resolveTask(state, parsed.code);
      if (!task) return "Specify a task code because zero or multiple tasks are active.";
      if (parsed.type === "pause") task.paused = true;
      if (parsed.type === "resume") task.paused = false;
      if (parsed.type !== "status") return `[${task.code}] notifications ${task.paused ? "paused" : "resumed"}.`;
      return formatTaskUpdate(task, this.effectiveSettings(state), this.now());
    }
    return "Unknown command. Use CODE /c:, CODE /s:, /status CODE, Y, N, or /settings.";
  }

  async tick() {
    const state = await this.store.read();
    const settings = this.effectiveSettings(state);
    const now = this.now();
    let sent = 0;
    for (const task of Object.values(state.tasks)) {
      if (task.pendingFinal) { if (await this.flushFinal(task.code)) sent += 1; continue; }
      const evaluation = evaluateDelivery(task, now, settings);
      if (evaluation.deferredForQuietHours) await this.store.mutate((next) => { next.tasks[task.code].nextUpdateAt = evaluation.nextAt; });
      if (evaluation.due) {
        await this.channel.send(formatTaskUpdate(task, settings, now));
        await this.store.mutate((next) => { next.tasks[task.code].nextUpdateAt = evaluation.nextAt; });
        sent += 1;
      }
    }
    for (const approval of Object.values(state.approvals)) {
      if (approval.status === "pending" && !approval.notifiedAt && await this.flushApproval(approval.id)) sent += 1;
    }
    return { sent };
  }

  async flushFinal(code) {
    const state = await this.store.read();
    const task = state.tasks[code];
    if (!task?.pendingFinal) return false;
    const settings = this.effectiveSettings(state);
    if (isQuietTime(this.now(), settings)) return false;
    const label = task.status === "failed" ? "failed" : "complete";
    await this.channel.send(`[${task.code}] ${label}: ${task.current || task.title}`);
    await this.store.mutate((next) => { next.tasks[code].pendingFinal = false; });
    return true;
  }

  async flushApproval(id) {
    const state = await this.store.read();
    const approval = state.approvals[id];
    if (!approval || approval.status !== "pending" || approval.notifiedAt) return false;
    const settings = this.effectiveSettings(state);
    if (!settings.approvals.enabled || isQuietTime(this.now(), settings)) return false;
    await this.channel.send(formatApproval(approval));
    await this.store.mutate((next) => { next.approvals[id].notifiedAt = this.now().toISOString(); });
    return true;
  }
}

function requireTask(state, code) {
  const normalized = normalizeTaskCode(code);
  const task = state.tasks[normalized];
  if (!task) throw new Error(`Task ${normalized} not found`);
  return task;
}

function resolveTask(state, code) {
  if (code) return state.tasks[code] ?? null;
  const active = Object.values(state.tasks).filter((task) => task.status === "active");
  return active.length === 1 ? active[0] : null;
}

function queueCommand(state, deviceId, code, type, data) {
  state.commands.push({ id: randomUUID(), deviceId, code, type, ...data, createdAt: new Date().toISOString(), ackedAt: null });
}

function applySettings(state, command) {
  state.settingsOverride.notifications ??= {};
  if (command.key === "quiet") {
    state.settingsOverride.notifications.quietHours ??= {};
    Object.assign(state.settingsOverride.notifications.quietHours, { enabled: command.enabled });
    if (command.start) Object.assign(state.settingsOverride.notifications.quietHours, { start: command.start, end: command.end });
    return command.enabled ? `Quiet hours set to ${command.start ?? "configured start"}-${command.end ?? "configured end"}.` : "Quiet hours disabled.";
  }
  if (command.key === "cadence") state.settingsOverride.notifications.repeatEveryMinutes = command.minutes;
  if (command.key === "first") state.settingsOverride.notifications.firstAfterMinutes = command.minutes;
  return `${command.key} set to ${command.minutes} minutes.`;
}