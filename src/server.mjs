import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { resolve } from "node:path";
import { channelFromEnv } from "./channel.mjs";
import { DEFAULT_SETTINGS } from "./defaults.mjs";
import { allowedSendersFromEnv } from "./diagnostics.mjs";
import { GatewayService } from "./gateway-service.mjs";
import { extractInkboxInbound, verifyInkboxWebhook } from "./inkbox-webhook.mjs";
import { extractSendblueInbound, verifySendblueWebhookSecret } from "./sendblue-webhook.mjs";
import { JsonFileStore } from "./store.mjs";

export function createGatewayFromEnv(env = process.env) {
  if (!env.CODEX_MARITIME_TOKEN) throw new Error("CODEX_MARITIME_TOKEN is required");
  const settings = {
    ...DEFAULT_SETTINGS,
    timezone: env.CODEX_MARITIME_TIMEZONE ?? "UTC",
    notifications: {
      ...DEFAULT_SETTINGS.notifications,
      firstAfterMinutes: Number(env.CODEX_MARITIME_FIRST_MINUTES ?? 60),
      repeatEveryMinutes: Number(env.CODEX_MARITIME_REPEAT_MINUTES ?? 120),
      quietHours: {
        enabled: env.CODEX_MARITIME_QUIET_ENABLED !== "false",
        start: env.CODEX_MARITIME_QUIET_START ?? "00:00",
        end: env.CODEX_MARITIME_QUIET_END ?? "06:00"
      }
    }
  };
  return new GatewayService({
    store: new JsonFileStore(resolve(env.CODEX_MARITIME_STATE_PATH ?? "./data/state.json")),
    channel: channelFromEnv(env),
    settings,
    allowedSenders: allowedSendersFromEnv(env)
  });
}

export function createHttpServer({ service, token, inkboxSigningKey = "", sendblueWebhookSecret = "" }) {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");
      if (request.method === "GET" && url.pathname === "/healthz") return json(response, 200, { ok: true });
      const rawBody = await readBody(request);
      if (url.pathname === "/webhooks/inkbox" && request.method === "POST") {
        const valid = verifyInkboxWebhook({
          rawBody,
          requestId: request.headers["x-inkbox-request-id"],
          timestamp: request.headers["x-inkbox-timestamp"],
          signature: request.headers["x-inkbox-signature"],
          signingKey: inkboxSigningKey
        });
        if (!valid) return json(response, 401, { error: "Invalid Inkbox signature" });
        const inbound = extractInkboxInbound(JSON.parse(rawBody));
        return json(response, 200, inbound ? await service.processInbound(inbound) : { ignored: true });
      }
      if (url.pathname === "/webhooks/sendblue" && request.method === "POST") {
        const valid = verifySendblueWebhookSecret({
          providedSecret: request.headers["sb-signing-secret"],
          webhookSecret: sendblueWebhookSecret
        });
        if (!valid) return json(response, 401, { error: "Invalid Sendblue webhook secret" });
        const inbound = extractSendblueInbound(JSON.parse(rawBody));
        return json(response, 200, inbound ? await service.processInbound(inbound) : { ignored: true });
      }
      if (!authorized(request.headers.authorization, token)) return json(response, 401, { error: "Unauthorized" });
      const body = rawBody ? JSON.parse(rawBody) : {};
      if (request.method === "POST" && url.pathname === "/v1/tasks") return json(response, 201, await service.registerTask(body));
      if (request.method === "POST" && url.pathname === "/v1/inbound") return json(response, 200, await service.processInbound(body));
      if (request.method === "POST" && url.pathname === "/v1/tick") return json(response, 200, await service.tick());
      if (request.method === "GET" && url.pathname === "/v1/commands") return json(response, 200, await service.pendingCommands(url.searchParams.get("deviceId") ?? "default"));
      let match = url.pathname.match(/^\/v1\/commands\/([^/]+)\/ack$/);
      if (request.method === "POST" && match) return json(response, 200, await service.acknowledgeCommand(match[1]));
      match = url.pathname.match(/^\/v1\/tasks\/([^/]+)$/);
      if (request.method === "GET" && match) return json(response, 200, await service.getTask(match[1]));
      if (request.method === "PATCH" && match) return json(response, 200, await service.updateTask(match[1], body));
      match = url.pathname.match(/^\/v1\/tasks\/([^/]+)\/complete$/);
      if (request.method === "POST" && match) return json(response, 200, await service.completeTask(match[1], body));
      match = url.pathname.match(/^\/v1\/tasks\/([^/]+)\/approvals$/);
      if (request.method === "POST" && match) return json(response, 201, await service.requestApproval(match[1], body));
      return json(response, 404, { error: "Not found" });
    } catch (error) {
      return json(response, 400, { error: error.message });
    }
  });
}

function authorized(header, token) {
  if (!header || !token) return false;
  const actual = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${token}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function readBody(request) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) { reject(new Error("Request body too large")); request.destroy(); }
      else chunks.push(chunk);
    });
    request.on("end", () => resolveBody(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function json(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}
