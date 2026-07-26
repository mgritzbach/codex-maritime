#!/usr/bin/env node
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { CodexMaritimeBridge } from "../src/codex-bridge.mjs";
import { diagnoseEnvironment } from "../src/diagnostics.mjs";
import { GatewayClient } from "../src/gateway-client.mjs";
import { createGatewayFromEnv, createHttpServer } from "../src/server.mjs";

const [command = "help", ...args] = process.argv.slice(2);

try {
  if (command === "init") await initializeProject();
  else if (command === "gateway") await runGateway();
  else if (command === "run") await runTask(args);
  else if (command === "tick") console.log(await configuredClient().request("/v1/tick", { method: "POST" }));
  else if (command === "doctor") runDoctor();
  else printHelp();
} catch (error) {
  process.stderr.write(`codex-maritime: ${error.message}\n`);
  process.exitCode = 1;
}

async function initializeProject() {
  const directory = resolve(".codex");
  await mkdir(directory, { recursive: true });
  const tracked = {
    enabled: true,
    projectId: process.env.CODEX_MARITIME_PROJECT_ID ?? randomUUID(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    notifications: { firstAfterMinutes: 60, repeatEveryMinutes: 120, quietHours: { enabled: true, start: "00:00", end: "06:00" } }
  };
  const local = {
    gatewayUrl: process.env.CODEX_MARITIME_GATEWAY_URL ?? "http://127.0.0.1:8787",
    token: process.env.CODEX_MARITIME_TOKEN ?? randomBytes(32).toString("base64url"),
    deviceId: randomUUID()
  };
  await writeFile(resolve(directory, "maritime.json"), `${JSON.stringify(tracked, null, 2)}\n`);
  await writeFile(resolve(directory, "maritime.local.json"), `${JSON.stringify(local, null, 2)}\n`);
  process.stdout.write("Created .codex/maritime.json and git-ignored .codex/maritime.local.json\n");
  process.stdout.write("Export CODEX_MARITIME_TOKEN from maritime.local.json before starting the gateway.\n");
}

async function runGateway() {
  const service = createGatewayFromEnv();
  const server = createHttpServer({
    service,
    token: process.env.CODEX_MARITIME_TOKEN,
    inkboxSigningKey: process.env.INKBOX_SIGNING_KEY,
    sendblueWebhookSecret: process.env.SENDBLUE_WEBHOOK_SECRET
  });
  const port = Number(process.env.PORT ?? 8787);
  server.listen(port, "0.0.0.0", () => process.stdout.write(`Codex Maritime gateway listening on ${port}\n`));
  setInterval(() => service.tick().catch((error) => process.stderr.write(`tick: ${error.message}\n`)), 60_000).unref();
}

async function runTask(args) {
  const prompt = args.join(" ").trim();
  if (!prompt) throw new Error("Usage: codex-maritime run <prompt>");
  const config = await loadProjectConfig();
  const gateway = new GatewayClient({ url: config.local.gatewayUrl, token: config.local.token });
  const bridge = new CodexMaritimeBridge({ gateway, deviceId: config.local.deviceId });
  console.log(await bridge.run({ prompt, cwd: process.cwd(), projectId: config.tracked.projectId }));
}

async function loadProjectConfig() {
  const tracked = JSON.parse(await readFile(resolve(".codex/maritime.json"), "utf8"));
  const local = JSON.parse(await readFile(resolve(".codex/maritime.local.json"), "utf8"));
  return { tracked, local };
}

function configuredClient() { return new GatewayClient(); }

function runDoctor() {
  const result = diagnoseEnvironment();
  process.stdout.write(`Provider: ${result.provider}\n`);
  for (const warning of result.warnings) process.stdout.write(`WARN  ${warning}\n`);
  for (const error of result.errors) process.stdout.write(`ERROR ${error}\n`);
  if (result.webhookUrl) process.stdout.write(`Webhook: ${result.webhookUrl}\n`);
  process.stdout.write(result.ok ? "Configuration is ready.\n" : "Configuration needs attention.\n");
  if (!result.ok) process.exitCode = 1;
}

function printHelp() {
  process.stdout.write(`codex-maritime\n\n  init              Activate the current project\n  doctor            Validate messaging configuration\n  gateway           Run the messaging gateway\n  run <prompt>      Run a Codex task with steering and approvals\n  tick              Process due notifications once\n`);
}
