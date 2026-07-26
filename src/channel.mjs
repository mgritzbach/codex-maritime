export class ConsoleChannel {
  async send(text) { process.stdout.write(`[message]\n${text}\n`); return { id: `console-${Date.now()}` }; }
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
  switch ((env.CODEX_MARITIME_CHANNEL ?? "console").toLowerCase()) {
    case "inkbox": return new InkboxSmsChannel({ apiKey: env.INKBOX_API_KEY, phoneNumberId: env.INKBOX_PHONE_NUMBER_ID, recipient: env.INKBOX_RECIPIENT });
    case "webhook": return new WebhookChannel({ url: env.CODEX_MARITIME_OUTBOUND_WEBHOOK_URL, token: env.CODEX_MARITIME_OUTBOUND_WEBHOOK_TOKEN });
    default: return new ConsoleChannel();
  }
}