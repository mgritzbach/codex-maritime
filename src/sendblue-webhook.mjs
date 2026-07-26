import { timingSafeEqual } from "node:crypto";

export function verifySendblueWebhookSecret({ providedSecret, webhookSecret }) {
  if (Array.isArray(providedSecret)) providedSecret = providedSecret[0];
  if (!providedSecret || !webhookSecret) return false;
  const actual = Buffer.from(String(providedSecret));
  const expected = Buffer.from(String(webhookSecret));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function extractSendblueInbound(payload) {
  if (!payload || payload.is_outbound !== false) return null;
  if (String(payload.status ?? "").toUpperCase() !== "RECEIVED") return null;
  if (!payload.message_handle || !payload.from_number || typeof payload.content !== "string") return null;
  if (/^(?:stop|unsubscribe|cancel|opt out|revoke|end|quit)$/i.test(payload.content.trim())) return null;
  return {
    id: String(payload.message_handle),
    sender: String(payload.from_number),
    text: payload.content
  };
}
