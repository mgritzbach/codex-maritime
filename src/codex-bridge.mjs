import { randomUUID } from "node:crypto";
import { CodexRpcClient } from "./codex-rpc.mjs";
import { GatewayClient } from "./gateway-client.mjs";

const PLAN_PROGRESS = { pending: 0, inProgress: 50, completed: 100 };
const APPROVAL_METHODS = new Set(["item/commandExecution/requestApproval", "item/fileChange/requestApproval"]);

export class CodexMaritimeBridge {
  constructor({ gateway = new GatewayClient(), rpc = new CodexRpcClient(), deviceId = randomUUID(), pollMs = 3000 } = {}) {
    Object.assign(this, { gateway, rpc, deviceId, pollMs });
    this.pendingApprovals = new Map();
    this.queuedTurns = [];
    this.done = new Promise((resolve, reject) => Object.assign(this, { resolveDone: resolve, rejectDone: reject }));
  }

  async run({ prompt, cwd = process.cwd(), projectId = process.env.CODEX_MARITIME_PROJECT_ID ?? cwd }) {
    await this.rpc.start();
    this.rpc.on("notification", (message) => this.onNotification(message).catch((error) => this.rejectDone(error)));
    this.rpc.on("request", (message) => this.onRequest(message).catch((error) => this.rejectDone(error)));
    const started = await this.rpc.call("thread/start", {
      cwd,
      experimentalRawEvents: false,
      persistExtendedHistory: true
    });
    this.threadId = started.thread.id;
    const task = await this.gateway.registerTask({ projectId, deviceId: this.deviceId, threadId: this.threadId, title: prompt });
    this.code = task.code;
    process.stdout.write(`Tracking as [${this.code}]\n`);
    await this.startTurn(prompt, cwd);
    this.pollTimer = setInterval(() => this.pollCommands().catch((error) => process.stderr.write(`${error.message}\n`)), this.pollMs);
    try { return await this.done; }
    finally { clearInterval(this.pollTimer); this.rpc.close(); }
  }

  async startTurn(text, cwd) {
    const result = await this.rpc.call("turn/start", {
      threadId: this.threadId,
      input: [{ type: "text", text, text_elements: [] }],
      cwd,
      approvalPolicy: "on-request",
      approvalsReviewer: "user"
    });
    this.activeTurnId = result.turn.id;
  }

  async onNotification(message) {
    if (message.method === "turn/plan/updated" && message.params.threadId === this.threadId) {
      const goals = message.params.plan.map((item, index) => ({
        id: `plan-${index + 1}`,
        title: item.step,
        status: item.status,
        progress: PLAN_PROGRESS[item.status] ?? 0
      }));
      await this.gateway.updateTask(this.code, { goals, current: goals.find((goal) => goal.status === "inProgress")?.title ?? "" });
      return;
    }
    if (message.method === "turn/completed" && message.params.threadId === this.threadId) {
      this.activeTurnId = null;
      if (this.queuedTurns.length) {
        const next = this.queuedTurns.shift();
        await this.startTurn(next, process.cwd());
        return;
      }
      const failed = message.params.turn.status === "failed";
      await this.gateway.completeTask(this.code, {
        status: failed ? "failed" : "completed",
        summary: failed ? message.params.turn.error?.message ?? "Codex turn failed" : "Codex task finished"
      });
      this.resolveDone({ code: this.code, status: message.params.turn.status });
    }
  }

  async onRequest(message) {
    if (!APPROVAL_METHODS.has(message.method)) {
      this.rpc.respondError(message.id, -32601, `Codex Maritime does not handle ${message.method}; use the Codex client.`);
      return;
    }
    const params = message.params;
    const kind = message.method.includes("fileChange") ? "file" : "command";
    const summary = params.command ?? params.reason ?? (kind === "file" ? "Apply proposed file changes" : "Run proposed command");
    const approval = await this.gateway.requestApproval(this.code, { kind, summary, cwd: params.cwd, reason: params.reason });
    this.pendingApprovals.set(approval.id, { requestId: message.id, method: message.method, expiresAt: approval.expiresAt });
  }

  async pollCommands() {
    const commands = await this.gateway.commands(this.deviceId);
    for (const command of commands) {
      try {
        if (command.type === "approval") {
          const pending = this.pendingApprovals.get(command.approvalId);
          if (pending) {
            this.rpc.respond(pending.requestId, { decision: command.decision === "accept" ? "accept" : "decline" });
            this.pendingApprovals.delete(command.approvalId);
          }
        } else if (command.type === "steer" && this.activeTurnId) {
          await this.rpc.call("turn/steer", { threadId: this.threadId, expectedTurnId: this.activeTurnId, input: [{ type: "text", text: command.text, text_elements: [] }] });
        } else if (command.type === "command") {
          if (this.activeTurnId) this.queuedTurns.push(command.text);
          else await this.startTurn(command.text, process.cwd());
        } else if (command.type === "stop" && this.activeTurnId) {
          await this.rpc.call("turn/interrupt", { threadId: this.threadId, turnId: this.activeTurnId });
        }
      } finally {
        await this.gateway.ack(command.id);
      }
    }
    const now = Date.now();
    for (const [approvalId, pending] of this.pendingApprovals) {
      if (new Date(pending.expiresAt).getTime() <= now) {
        this.rpc.respond(pending.requestId, { decision: "cancel" });
        this.pendingApprovals.delete(approvalId);
      }
    }
  }
}