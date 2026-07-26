# Codex Maritime

Long-running Codex task updates, remote steering, and scoped approvals over a Maritime-hosted messaging gateway.

Codex Maritime is deterministic by default: it does not spend model tokens to parse messages, calculate percentages, check schedules, or format routine updates.

## Runtime choice: OpenClaw vs ZeroClaw

Use **OpenClaw Identity for the default SMS deployment**. Maritime provisions it with an Inkbox phone number and agent-scoped credentials, so it is the shortest route to reliable two-way SMS.

Use **ZeroClaw when you specifically want its lightweight runtime or native WhatsApp channel**. The core of this repository does not depend on either runtime: channel delivery is an adapter. ZeroClaw is therefore supported as an integration target, but adding it between Codex and the gateway is unnecessary for SMS and adds another agent loop.

The included production adapter talks directly to Inkbox. A generic webhook adapter supports OpenClaw, ZeroClaw, or another channel bridge without changing task logic.

## Features

- Three-character human-friendly task codes, collision checked per gateway.
- First update after 60 minutes, then every 120 minutes by default.
- Timezone-aware quiet hours, defaulting to 00:00–06:00.
- Runtime adjustments by config or text command.
- Arbitrary 0–100 goal progress with optional weights and evidence.
- `/s:` steering, `/c:` queued commands, status, pause, resume, and stop.
- Single-use Y/N approvals bound to one exact app-server request.
- Signed Inkbox inbound webhooks and sender allowlists.
- JSON persistence with atomic replacement and no runtime npm dependencies.
- A Codex plugin skill and MCP tools for use outside the bridge-owned task flow.

## Quick start

Requirements: Node.js 20+ and a current Codex CLI.

```sh
npm test

# Configure a local console gateway
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

`init` creates:

- `.codex/maritime.json`: safe, shareable project identity and notification preferences.
- `.codex/maritime.local.json`: git-ignored gateway token, URL, and device ID.

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

When exactly one task or approval is active, the task/reference may be omitted.

Adjust settings without redeploying:

```text
/settings quiet off
/settings quiet 23:00-07:00
/settings cadence 90m
/settings first 45m
```

Inbound commands remain accepted during quiet hours. Routine outbound updates, completion notices, and approval notifications wait until quiet hours end.

## Progress model

Goal progress is any number from 0 through 100. There are no 25% buckets. Overall progress is a weighted mean:

```text
overall = sum(goal.progress × goal.weight) / sum(goal.weight)
```

Codex plan events only contain `pending`, `inProgress`, and `completed`; the bridge maps those coarse states to 0, 50, and 100. The MCP tool accepts exact values such as 17, 62.5, or 93 whenever the agent has better evidence.

## Token use

Routine operation uses zero LLM calls:

- command parsing is regular-expression based;
- percentages are arithmetic;
- quiet hours use `Intl.DateTimeFormat`;
- updates are template formatted from structured state;
- scheduler ticks inspect local state only.

Codex itself still uses its normal task tokens. Codex Maritime neither asks for periodic summaries nor sends status prompts back into the active turn.

## SMS configuration

Set:

```sh
CODEX_MARITIME_CHANNEL=inkbox
INKBOX_API_KEY=...
INKBOX_PHONE_NUMBER_ID=...
INKBOX_RECIPIENT=+1...
INKBOX_SIGNING_KEY=...
INKBOX_ALLOWED_SENDERS=+1...
```

Configure the Inkbox `text.received` webhook to:

```text
https://YOUR_GATEWAY/webhooks/inkbox
```

New numbers may need 10DLC warm-up, and the recipient must text `START` before outbound delivery.

## Generic channel integration

Set `CODEX_MARITIME_CHANNEL=webhook` and point `CODEX_MARITIME_OUTBOUND_WEBHOOK_URL` at an OpenClaw, ZeroClaw, WhatsApp, or custom sender. Deliver inbound control messages to authenticated `POST /v1/inbound`:

```json
{ "id": "provider-message-id", "sender": "+15551234567", "text": "K7M /s: ship the smaller version" }
```

## Project layout

- `src/gateway-service.mjs`: task state, scheduling, inbound commands, approvals.
- `src/codex-bridge.mjs`: Codex app-server plans, steering, turns, and approvals.
- `scripts/mcp-server.mjs`: plugin MCP tools for structured updates.
- `skills/progress-notifier/`: reusable Codex behavior.
- `test/`: schedule, parser, progress, signature, and workflow tests.

See [Maritime deployment](docs/maritime.md), [architecture](docs/architecture.md), and [security](SECURITY.md).

## Status

This is an MVP. SMS, console, and generic webhooks are implemented. A native ZeroClaw WhatsApp adapter is intentionally not hard-coded; use the generic adapter until its gateway protocol is pinned and integration-tested.