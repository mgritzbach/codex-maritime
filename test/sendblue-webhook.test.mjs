import test from "node:test";
import assert from "node:assert/strict";
import { extractSendblueInbound, verifySendblueWebhookSecret } from "../src/sendblue-webhook.mjs";

test("verifies the Sendblue signing secret exactly", () => {
  assert.equal(verifySendblueWebhookSecret({ providedSecret: "hook-secret", webhookSecret: "hook-secret" }), true);
  assert.equal(verifySendblueWebhookSecret({ providedSecret: "wrong", webhookSecret: "hook-secret" }), false);
  assert.equal(verifySendblueWebhookSecret({ providedSecret: "", webhookSecret: "hook-secret" }), false);
});

test("extracts received inbound Sendblue messages", () => {
  assert.deepEqual(extractSendblueInbound({
    message_handle: "msg-123",
    is_outbound: false,
    status: "RECEIVED",
    from_number: "+15552220000",
    content: "K7M /status"
  }), {
    id: "msg-123",
    sender: "+15552220000",
    text: "K7M /status"
  });
});

test("ignores outbound, non-received, and carrier opt-out events", () => {
  assert.equal(extractSendblueInbound({ is_outbound: true, status: "RECEIVED" }), null);
  assert.equal(extractSendblueInbound({ is_outbound: false, status: "SENT" }), null);
  assert.equal(extractSendblueInbound({
    message_handle: "msg-stop",
    is_outbound: false,
    status: "RECEIVED",
    from_number: "+15552220000",
    content: "STOP"
  }), null);
});
