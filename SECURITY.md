# Security

Report vulnerabilities privately. Do not include keys, phone numbers, Codex transcripts, or approval payloads in public issues.

Remote approvals are limited to one exact pending action and always resolve to `accept` once or `decline`. A text reply never grants session-wide authority.

- Use a long random gateway bearer token.
- Verify Inkbox webhook signatures and allowlist inbound senders.
- Keep `codex app-server` on local stdio; never expose it directly.
- Use TLS for an internet-reachable gateway.
- Keep destructive, credential, financial, and broad permission changes in the Codex UI.