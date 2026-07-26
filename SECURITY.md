# Security

Report vulnerabilities privately. Never include keys, phone numbers, Codex transcripts, or approval payloads in public issues.

Remote approvals are limited to one exact pending action and always resolve to `accept` once or `decline`. A text reply never grants session-wide authority.

- Use unrelated, long random values for `CODEX_MARITIME_TOKEN` and `SENDBLUE_WEBHOOK_SECRET`.
- Configure the Sendblue receive webhook as an object with a secret; the gateway checks `sb-signing-secret` with a constant-time comparison.
- Set `CODEX_MARITIME_ALLOWED_SENDERS` to the smallest possible E.164 phone-number list.
- Keep Sendblue API credentials and the gateway token in Maritime secret environment variables and git-ignored local config.
- Keep `codex app-server` on local stdio; never expose it directly.
- Use HTTPS for the public gateway. Sendblue webhooks require HTTPS.
- Keep destructive, credential, financial, and broad permission changes in the Codex UI.
- Respect carrier and recipient opt-in/opt-out rules. Do not reinterpret STOP-like messages as task commands.

Inbound requests are deduplicated using Sendblue's `message_handle`. The JSON state file contains message IDs and operational task summaries; protect its storage and retention accordingly.
