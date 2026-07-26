import test from "node:test";
import assert from "node:assert/strict";
import { allowedSendersFromEnv, diagnoseEnvironment } from "../src/diagnostics.mjs";

const valid = {
  CODEX_MARITIME_TOKEN: "gateway-token",
  CODEX_MARITIME_CHANNEL: "sendblue",
  SENDBLUE_API_KEY_ID: "key-id",
  SENDBLUE_API_SECRET_KEY: "secret-key",
  SENDBLUE_FROM_NUMBER: "+15551110000",
  SENDBLUE_RECIPIENT: "+15552220000",
  SENDBLUE_WEBHOOK_SECRET: "hook-secret",
  CODEX_MARITIME_ALLOWED_SENDERS: "+15552220000",
  CODEX_MARITIME_PUBLIC_URL: "https://gateway.example.com/"
};

test("Sendblue diagnostics identify a ready connection", () => {
  assert.deepEqual(diagnoseEnvironment(valid), {
    ok: true,
    provider: "sendblue",
    webhookUrl: "https://gateway.example.com/webhooks/sendblue",
    errors: [],
    warnings: []
  });
});

test("Sendblue diagnostics report missing connection pieces without exposing values", () => {
  const result = diagnoseEnvironment({ CODEX_MARITIME_CHANNEL: "sendblue" });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("CODEX_MARITIME_TOKEN")));
  assert.ok(result.errors.some((error) => error.includes("SENDBLUE_WEBHOOK_SECRET")));
  assert.ok(result.errors.some((error) => error.includes("ALLOWED_SENDERS")));
});

test("provider-specific sender allowlists remain compatible", () => {
  assert.deepEqual(allowedSendersFromEnv({ CODEX_MARITIME_CHANNEL: "sendblue", SENDBLUE_ALLOWED_SENDERS: "+15550000001,+15550000002" }), [
    "+15550000001",
    "+15550000002"
  ]);
});
