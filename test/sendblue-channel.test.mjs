import test from "node:test";
import assert from "node:assert/strict";
import { SendblueChannel, channelFromEnv } from "../src/channel.mjs";

test("Sendblue channel sends the documented request shape", async () => {
  let observed;
  const channel = new SendblueChannel({
    apiKeyId: "key-id",
    apiSecretKey: "secret-key",
    fromNumber: "+15551110000",
    recipient: "+15552220000",
    fetchImpl: async (url, options) => {
      observed = { url, options };
      return { ok: true, status: 200, json: async () => ({ message_handle: "msg-1" }) };
    }
  });

  assert.deepEqual(await channel.send("Status update"), { message_handle: "msg-1" });
  assert.equal(observed.url, "https://api.sendblue.co/api/send-message");
  assert.equal(observed.options.headers["sb-api-key-id"], "key-id");
  assert.equal(observed.options.headers["sb-api-secret-key"], "secret-key");
  assert.deepEqual(JSON.parse(observed.options.body), {
    from_number: "+15551110000",
    number: "+15552220000",
    content: "Status update"
  });
});

test("Sendblue channel surfaces provider failures", async () => {
  const channel = new SendblueChannel({
    apiKeyId: "key-id",
    apiSecretKey: "secret-key",
    fromNumber: "+15551110000",
    recipient: "+15552220000",
    fetchImpl: async () => ({ ok: false, status: 403, json: async () => ({ error: "forbidden" }) })
  });
  await assert.rejects(() => channel.send("test"), /Sendblue send failed \(403\).*forbidden/);
});

test("environment aliases create a Sendblue channel", () => {
  const channel = channelFromEnv({
    CODEX_MARITIME_CHANNEL: "sendblue",
    SENDBLUE_API_API_KEY: "key-id",
    SENDBLUE_API_API_SECRET: "secret-key",
    SENDBLUE_FROM_NUMBER: "+15551110000",
    SENDBLUE_RECIPIENT: "+15552220000"
  });
  assert.ok(channel instanceof SendblueChannel);
});

test("unknown messaging providers fail fast", () => {
  assert.throws(() => channelFromEnv({ CODEX_MARITIME_CHANNEL: "typo" }), /Unsupported CODEX_MARITIME_CHANNEL/);
});
