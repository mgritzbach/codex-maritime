# Codex Maritime

Token-efficient progress updates, remote steering, and scoped approvals for long-running Codex tasks. The gateway runs as a small public service on Maritime and uses Sendblue for two-way iMessage, RCS, or SMS.

## Why Sendblue directly

Sendblue is the primary messaging adapter. OpenClaw and ZeroClaw are not needed in the delivery path: this repository already owns task state, schedules, command parsing, and approvals, so another agent runtime would add cost and failure modes without adding useful reasoning. The generic webhook adapter remains available for WhatsApp or another provider.

For Android phones, Sendblue can deliver using RCS or SMS fallback. Sendblue is not a WhatsApp provider.

## Features

- Three-character, human-friendly task codes, collision checked per gateway.
- First update after 60 minutes, then every 120 minutes by default.
- Timezone-aware quiet hours, defaulting to 00:00-06:00.
- Runtime cadence and quiet-hour changes by configuration or text command.
- Arbitrary 0-100 goal progress with optional weights and evidence; there are no 25% buckets.
- `/s:` steering, `/c:` queued commands, status, pause, resume, and stop.
- Single-use Y/N approvals bound to one exact app-server request.
- Sendblue webhook-secret verification, sender allowlists, and message-handle deduplication.
- Atomic JSON persistence and zero runtime npm dependencies.

## Quick start

Requirements: Node.js 20+ and a current Codex CLI.

```sh
npm test

# Local console-only gateway
export CODEX_MARITIME_TOKEN="$(openssl rand -hex 32)"
export CODEX_MARITIME_TIMEZONE="America/Los_Angeles"
npm start
```

In another terminal:

```sh
npm link
cd /path/to/a/project
codex-maritime init
codex-maritime run "Implement the migration with tests and documentation"
```

`init` creates `.codex/maritime.json` for safe project settings and the git-ignored `.codex/maritime.local.json` for the gateway URL, token, and device ID.

## Sendblue connection

The shortest working path is:

1. Create a free Sendblue sandbox and verify your phone/contact.
2. Deploy this repository to Maritime as a public GitHub-backed service on port 8787.
3. Add the Sendblue credentials, line, recipient, webhook secret, and allowed sender as Maritime environment variables.
4. Register `https://YOUR_MARITIME_URL/webhooks/sendblue` as a Sendblue `receive` webhook using the same secret.
5. Run `codex-maritime doctor`, then use the accelerated live-test cadence.

See [the complete Sendblue setup and live-test checklist](docs/sendblue.md). The old Inkbox and generic webhook adapters remain optional compatibility paths.

## Message protocol

```text
K7M /c: add tests for daylight-saving transitions
K7M /s: skip WhatsApp and finish the SMS path
/status K7M
/pause K7M
/resume K7M
/stop K7M
Y K7M-A2
N K7M-A2
```

When exactly one task or approval is active, the code/reference may be omitted.

Settings can be adjusted without redeploying:

```text
/settings quiet off
/settings quiet 23:00-07:00
/settings cadence 90m
/settings first 45m
```

Inbound commands remain accepted during quiet hours. Routine updates, completion notices, and approval notifications wait until quiet hours end.

## Progress and token use

Goal progress is any number from 0 through 100. Overall progress is a weighted mean:

```text
overall = sum(goal.progress * goal.weight) / sum(goal.weight)
```

Codex plan events only expose `pending`, `inProgress`, and `completed`; the bridge maps those coarse states to 0, 50, and 100. The MCP tool accepts exact values such as 17, 62.5, or 93 whenever better evidence exists.

Routine operation uses zero LLM calls. Command parsing is regex-based, percentages are arithmetic, schedules are deterministic, and messages are formatted from structured state. Codex Maritime never prompts the active task merely to generate a periodic update.

## Project layout

- `src/gateway-service.mjs`: task state, scheduling, inbound commands, and approvals.
- `src/channel.mjs`: Sendblue, Inkbox, console, and generic webhook delivery.
- `src/sendblue-webhook.mjs`: verified inbound Sendblue messages.
- `src/codex-bridge.mjs`: Codex app-server plans, steering, turns, and approvals.
- `scripts/mcp-server.mjs`: plugin MCP tools for structured updates.
- `skills/progress-notifier/`: reusable Codex behavior.
- `test/`: parser, progress, schedule, provider, webhook, and workflow tests.

See [Maritime deployment](docs/maritime.md), [architecture](docs/architecture.md), and [security](SECURITY.md).
