import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";

export class CodexRpcClient extends EventEmitter {
  constructor(options = {}) {
    super();
    const resolved = resolveCodexCommand(options);
    this.command = resolved.command;
    this.args = resolved.args;
    this.nextId = 1;
    this.pending = new Map();
  }

  async start() {
    this.process = spawn(this.command, this.args, { stdio: ["pipe", "pipe", "inherit"], windowsHide: true });
    const lines = createInterface({ input: this.process.stdout });
    lines.on("line", (line) => this.handleLine(line));
    this.process.on("exit", (code) => {
      const error = new Error(`codex app-server exited with code ${code}`);
      for (const pending of this.pending.values()) pending.reject(error);
      this.pending.clear();
      this.emit("exit", code);
    });
    await this.call("initialize", {
      clientInfo: { name: "codex_maritime", title: "Codex Maritime", version: "0.1.0" },
      capabilities: { experimentalApi: false }
    });
    this.notify("initialized", {});
    return this;
  }

  call(method, params = {}) {
    const id = this.nextId++;
    this.write({ method, id, params });
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  notify(method, params = {}) { this.write({ method, params }); }
  respond(id, result) { this.write({ id, result }); }
  respondError(id, code, message) { this.write({ id, error: { code, message } }); }
  write(message) { this.process.stdin.write(`${JSON.stringify(message)}\n`); }

  handleLine(line) {
    let message;
    try { message = JSON.parse(line); }
    catch { this.emit("protocolError", new Error(`Invalid JSON from app-server: ${line}`)); return; }
    if (message.id !== undefined && (message.result !== undefined || message.error !== undefined)) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message ?? "JSON-RPC error"));
      else pending.resolve(message.result);
      return;
    }
    if (message.id !== undefined && message.method) this.emit("request", message);
    else if (message.method) this.emit("notification", message);
  }

  close() { this.process?.stdin.end(); }
}

function resolveCodexCommand(options) {
  if (options.command) return { command: options.command, args: options.args ?? ["app-server"] };
  if (process.env.CODEX_CLI_PATH) return { command: process.env.CODEX_CLI_PATH, args: options.args ?? ["app-server"] };
  if (process.platform === "win32" && process.env.APPDATA) {
    const script = join(process.env.APPDATA, "npm", "node_modules", "@openai", "codex", "bin", "codex.js");
    if (existsSync(script)) return { command: process.execPath, args: [script, ...(options.args ?? ["app-server"])] };
  }
  return { command: "codex", args: options.args ?? ["app-server"] };
}