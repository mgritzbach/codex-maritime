export class GatewayClient {
  constructor({ url = process.env.CODEX_MARITIME_GATEWAY_URL ?? "http://127.0.0.1:8787", token = process.env.CODEX_MARITIME_TOKEN } = {}) {
    if (!token) throw new Error("CODEX_MARITIME_TOKEN is required");
    this.url = url.replace(/\/$/, "");
    this.token = token;
  }
  async request(path, { method = "GET", body } = {}) {
    const response = await fetch(`${this.url}${path}`, {
      method,
      headers: { authorization: `Bearer ${this.token}`, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? `Gateway request failed (${response.status})`);
    return payload;
  }
  registerTask(body) { return this.request("/v1/tasks", { method: "POST", body }); }
  updateTask(code, body) { return this.request(`/v1/tasks/${code}`, { method: "PATCH", body }); }
  completeTask(code, body) { return this.request(`/v1/tasks/${code}/complete`, { method: "POST", body }); }
  requestApproval(code, body) { return this.request(`/v1/tasks/${code}/approvals`, { method: "POST", body }); }
  commands(deviceId) { return this.request(`/v1/commands?deviceId=${encodeURIComponent(deviceId)}`); }
  ack(id) { return this.request(`/v1/commands/${id}/ack`, { method: "POST" }); }
}