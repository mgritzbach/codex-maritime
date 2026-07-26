import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyInkboxWebhook({ rawBody, requestId, timestamp, signature, signingKey, now = Date.now() }) {
  if (!rawBody || !requestId || !timestamp || !signature || !signingKey) return false;
  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds) || Math.abs(Math.floor(now / 1000) - timestampSeconds) > 300) return false;
  const expected = `sha256=${createHmac("sha256", signingKey).update(`${requestId}.${timestamp}.${rawBody}`).digest("hex")}`;
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export function extractInkboxInbound(payload) {
  if (payload?.event_type !== "text.received") return null;
  const message = payload.data?.text_message;
  if (!message?.text) return null;
  return { id: payload.id ?? message.id, sender: message.sender_phone_number ?? message.remote_phone_number, text: message.text };
}