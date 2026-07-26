# Deploy on Maritime

## Recommended SMS path

1. Create an OpenClaw Identity agent in Maritime so the phone identity is provisioned.
2. Obtain or configure the identity-scoped Inkbox API key, phone-number ID, recipient, and signing key.
3. Deploy this repository as a public Maritime service on port 8787.
4. Configure the environment variables from `.env.example`.
5. Point the Inkbox `text.received` webhook to `/webhooks/inkbox`.
6. Configure a Maritime cron trigger to call authenticated `POST /v1/tick` every minute, or keep the gateway on an always-on tier. The process also ticks itself while awake.
7. Text `START` to the provisioned number and verify a test task.

A custom service can be created from the repository and Dockerfile with Maritime's GitHub deployment flow. Secrets belong in Maritime environment variables, never in `maritime.json` or Git.

## ZeroClaw

ZeroClaw is a good lightweight choice for WhatsApp or other supported channels, but the standard Maritime ZeroClaw template does not provision the SMS identity used above. Connect it through the generic webhook contract:

- outbound: receive `{ "text": "..." }` from Codex Maritime and send through the configured ZeroClaw channel;
- inbound: forward allowlisted message IDs, senders, and text to `POST /v1/inbound`.

Do not put an LLM between those endpoints. The adapter should route exact bytes and let Codex Maritime parse the control protocol.