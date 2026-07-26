# Deploy on Maritime

## Recommended path

Deploy this repository itself as a public GitHub-backed Maritime service. Do not choose OpenClaw or ZeroClaw for the Sendblue path; the repository is already the deterministic gateway.

```sh
maritime create codex-maritime \
  --repo https://github.com/mgritzbach/codex-maritime \
  --branch main \
  --public \
  --port 8787
```

The dashboard equivalent is New agent, deploy from GitHub, select the repository, enable a public URL, and expose port 8787. Add the variables in `.env.example` as Maritime environment variables, then register the public `/webhooks/sendblue` URL with Sendblue.

Configure a Maritime cron trigger to call authenticated `POST /v1/tick` every minute if the service may sleep. The process performs the same tick internally while awake. Incoming Sendblue webhooks also wake a public service, but they cannot wake it at the moment a scheduled outbound update is due.

Maritime credits cover the deployed compute. Sendblue is a separate external messaging service and is billed by Sendblue; Maritime API budget is only relevant if another component makes model calls. This gateway makes no model calls for routine notifications.

See [Sendblue setup and live test](sendblue.md) for all values, webhook registration, verification, and troubleshooting.

## Other providers

Inkbox remains as an optional compatibility adapter. For WhatsApp or another channel, set `CODEX_MARITIME_CHANNEL=webhook`; the outbound target receives `{ "text": "..." }` and should forward inbound messages to authenticated `POST /v1/inbound`.

OpenClaw or ZeroClaw can sit behind that generic adapter when they uniquely provide a desired channel, but neither is necessary for Sendblue, SMS, RCS, scheduling, progress calculation, or approvals.
