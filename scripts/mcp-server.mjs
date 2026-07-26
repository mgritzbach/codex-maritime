#!/usr/bin/env node
import { createInterface } from "node:readline";
import { GatewayClient } from "../src/gateway-client.mjs";

const lines = createInterface({ input: process.stdin });
const projectId = process.env.CODEX_MARITIME_PROJECT_ID ?? "default";
let client;

lines.on("line", async (line) => {
  let request;
  try { request = JSON.parse(line); }
  catch { return; }
  if (request.id === undefined) return;
  try {
    let result;
    if (request.method === "initialize") {
      result = { protocolVersion: request.params?.protocolVersion ?? "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "codex-maritime", version: "0.1.0" } };
    } else if (request.method === "tools/list") {
      result = { tools: toolDefinitions() };
    } else if (request.method === "tools/call") {
      result = await callTool(request.params.name, request.params.arguments ?? {});
    } else {
      throw new Error(`Unsupported method: ${request.method}`);
    }
    respond({ jsonrpc: "2.0", id: request.id, result });
  } catch (error) {
    respond({ jsonrpc: "2.0", id: request.id, result: { content: [{ type: "text", text: error.message }], isError: true } });
  }
});

function gateway() { return client ??= new GatewayClient(); }
function content(value) { return { content: [{ type: "text", text: JSON.stringify(value) }] }; }

async function callTool(name, args) {
  if (name === "maritime_register_task") return content(await gateway().registerTask({ ...args, projectId }));
  if (name === "maritime_update_task") {
    const { code, ...patch } = args;
    return content(await gateway().updateTask(code, patch));
  }
  if (name === "maritime_complete_task") {
    const { code, ...result } = args;
    return content(await gateway().completeTask(code, result));
  }
  throw new Error(`Unknown tool: ${name}`);
}

function toolDefinitions() {
  const goal = { type: "object", required: ["title", "progress"], properties: { id: { type: "string" }, title: { type: "string" }, progress: { type: "number", minimum: 0, maximum: 100 }, weight: { type: "number", exclusiveMinimum: 0 }, evidence: { type: "string" } } };
  return [
    { name: "maritime_register_task", description: "Register a goal-based task for scheduled messaging updates.", inputSchema: { type: "object", required: ["title"], properties: { title: { type: "string" }, goals: { type: "array", items: goal }, current: { type: "string" }, blockers: { type: "array", items: { type: "string" } }, next: { type: "string" } } } },
    { name: "maritime_update_task", description: "Update structured progress without an extra model call.", inputSchema: { type: "object", required: ["code"], properties: { code: { type: "string" }, goals: { type: "array", items: goal }, current: { type: "string" }, blockers: { type: "array", items: { type: "string" } }, next: { type: "string" } } } },
    { name: "maritime_complete_task", description: "Mark a task complete or failed.", inputSchema: { type: "object", required: ["code"], properties: { code: { type: "string" }, status: { enum: ["completed", "failed"] }, summary: { type: "string" } } } }
  ];
}

function respond(message) { process.stdout.write(`${JSON.stringify(message)}\n`); }