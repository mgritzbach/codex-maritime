export class ConsoleChannel {
  async send(text) { process.stdout.write(`[message]\n${text}\n`); return { id: `console-${Date.now()}` }; }
}

export class SendblueChannel {
  constructor({
    apiKeyId,
    apiSecretKey,
    fromNumber,
    recipient,
    baseUrl = "https://api.sendblue.co/api",
    fetchImpl = fetch
  }) {
    if (!apiKeyId || !apiSecretKey || !fromNumber || !recipient) {
      throw new Error("Sendblue requires API key ID, API secret key, from number, and recipient");
    }
    if (!isE164(fromNumber) || !isE164(recipient)) {
      throw new Error("Sendblue from number and recipient must use E.164 format (for example +15551234567)");
    }
    Object.assign(this, {
      apiKeyId,
      apiSecretKey,
      fromNumber,
      recipient,
      baseUrl: baseUrl.replace(/\/$/, ""),
      fetchImpl
    });
  }

  async send(text) {
    const response = await this.fetchImpl(`${this.baseUrl}/send-message`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "sb-api-key-id": this.apiKeyId,
        "sb-api-secret-key": this.apiSecretKey
      },
      body: JSON.stringify({
        from_number: this.fromNumber,
        number: this.recipient,
        content: text
      })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Sendblue send failed (${response.status}): ${JSON.stringify(body)}`);
    return body;
  }
}

export class InkboxSmsChannel {
  constructor({ apiKey, phoneNumberId, recipient, baseUrl = "https://inkbox.ai/api/v1/phone" }) {
    if (!apiKey || !phoneNumberId || !recipient) throw new Error("Inkbox requires API key, phone number ID, and recipient");
    Object.assign(this, { apiKey, phoneNumberId, recipient, baseUrl: baseUrl.replace(/\/$/, "") });
  }
  async send(text) {
    const response = await fetch(`${this.baseUrl}/numbers/${encodeURIComponent(this.phoneNumberId)}/texts`, {
      method: "POST", headers: { "content-type": "application/json", "x-api-key": this.apiKey },
      body: JSON.stringify({ to: this.recipient, text })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Inkbox send failed (${response.status}): ${JSON.stringify(body)}`);
    return body;
  }
}

export class WebhookChannel {
  constructor({ url, token }) { if (!url) throw new Error("Webhook channel requires a URL"); Object.assign(this, { url, token }); }
  async send(text) {
    const response = await fetch(this.url, {
      method: "POST", headers: { "content-type": "application/json", ...(this.token ? { authorization: `Bearer ${this.token}` } : {}) },
      body: JSON.stringify({ text })
    });
    if (!response.ok) throw new Error(`Outbound webhook failed (${response.status})`);
    return response.json().catch(() => ({ ok: true }));
  }
}

export function channelFromEnv(env = process.env) {
  const provider = (env.CODEX_MARITIME_CHANNEL ?? "console").toLowerCase();
  switch (provider) {
    case "sendblue": return new SendblueChannel({
      apiKeyId: env.SENDBLUE_API_KEY_ID ?? env.SENDBLUE_API_API_KEY,
      apiSecretKey: env.SENDBLUE_API_SECRET_KEY ?? env.SENDBLUE_API_API_SECRET,
      fromNumber: env.SENDBLUE_FROM_NUMBER,
      recipient: env.SENDBLUE_RECIPIENT,
      baseUrl: env.SENDBLUE_API_BASE_URL
    });
    case "inkbox": return new InkboxSmsChannel({ apiKey: env.INKBOX_API_KEY, phoneNumberId: env.INKBOX_PHONE_NUMBER_ID, recipient: env.INKBOX_RECIPIENT });
    case "webhook": return new WebhookChannel({ url: env.CODEX_MARITIME_OUTBOUND_WEBHOOK_URL, token: env.CODEX_MARITIME_OUTBOUND_WEBHOOK_TOKEN });
    case "console": return new ConsoleChannel();
    default: throw new Error(`Unsupported CODEX_MARITIME_CHANNEL: ${provider}`);
  }
}

export function isE164(value) {
  return /^\+[1-9]\d{7,14}$/.test(value ?? "");
}
