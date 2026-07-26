import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { DEFAULT_SETTINGS } from "../src/defaults.mjs";
import { GatewayService } from "../src/gateway-service.mjs";
import { createHttpServer } from "../src/server.mjs";
import { MemoryStore } from "../src/store.mjs";

class SilentChannel { async send() { return { id: "1" }; } }

test("HTTP gateway requires bearer auth and creates tasks", async (context) => {
  const service = new GatewayService({ store: new MemoryStore(), channel: new SilentChannel(), settings: DEFAULT_SETTINGS });
  const server = createHttpServer({ service, token: "test-token" });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => server.close());
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}`;
  assert.equal((await fetch(`${url}/healthz`)).status, 200);
  assert.equal((await fetch(`${url}/v1/tasks`, { method: "POST", body: "{}" })).status, 401);
  const response = await fetch(`${url}/v1/tasks`, {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify({ title: "HTTP test" })
  });
  assert.equal(response.status, 201);
  assert.match((await response.json()).code, /^[23456789A-HJKMNP-TV-Z]{3}$/);
});