import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyInkboxWebhook } from "../src/inkbox-webhook.mjs";

test("verifies timestamped Inkbox signatures", () => {
  const rawBody = "{\"event_type\":\"text.received\"}";
  const requestId = "req_123";
  const timestamp = "1785052800";
  const signingKey = "secret";
  const signature = `sha256=${createHmac("sha256", signingKey).update(`${requestId}.${timestamp}.${rawBody}`).digest("hex")}`;
  assert.equal(verifyInkboxWebhook({ rawBody, requestId, timestamp, signature, signingKey, now: 1785052800 * 1000 }), true);
  assert.equal(verifyInkboxWebhook({ rawBody, requestId, timestamp, signature: "sha256=bad", signingKey, now: 1785052800 * 1000 }), false);
});