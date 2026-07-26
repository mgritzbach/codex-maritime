# Sendblue setup and live test

This is the end-to-end connection checklist. Sendblue transports exact messages; it does not run an agent or consume LLM tokens.

## 1. Create and verify a Sendblue sandbox

Install the official CLI and create the account:

```sh
npm install -g @sendblue/cli
sendblue setup --phone +15551234567 --company codex-maritime
sendblue show-keys
```

The phone setup displays a one-time phrase and a shared Sendblue number. Send the phrase from the phone being verified. If the intended recipient is different, run:

```sh
sendblue add-contact +15551234567
```

Then have that recipient text the displayed Sendblue number once. Free shared-line accounts require this inbound-first verification before outbound messages. Confirm the provider works before involving Maritime:

```sh
sendblue send +15551234567 "Sendblue connection works"
```

Record these values without committing them:

- API key ID and API secret key from `sendblue show-keys`.
- The Sendblue line assigned to the account (`SENDBLUE_FROM_NUMBER`).
- The verified destination phone (`SENDBLUE_RECIPIENT`).

## 2. Deploy the repository to Maritime

Create a new Maritime agent from this GitHub repository rather than an OpenClaw or ZeroClaw template:

```sh
maritime create codex-maritime \
  --repo https://github.com/mgritzbach/codex-maritime \
  --branch main \
  --public \
  --port 8787
```

The Dockerfile starts the gateway and exposes port 8787. Save the public HTTPS URL Maritime returns.

Generate two unrelated random secrets locally:

```sh
openssl rand -hex 32  # CODEX_MARITIME_TOKEN
openssl rand -hex 32  # SENDBLUE_WEBHOOK_SECRET
```

Set the following in the Maritime dashboard or with `maritime env set`. Secret values should stay marked secret:

```text
CODEX_MARITIME_TOKEN=<gateway bearer token>
CODEX_MARITIME_CHANNEL=sendblue
CODEX_MARITIME_PUBLIC_URL=https://YOUR-MARITIME-URL
CODEX_MARITIME_STATE_PATH=./data/state.json
CODEX_MARITIME_TIMEZONE=America/Los_Angeles
SENDBLUE_API_KEY_ID=<Sendblue API key>
SENDBLUE_API_SECRET_KEY=<Sendblue API secret>
SENDBLUE_FROM_NUMBER=+1...
SENDBLUE_RECIPIENT=+1...
SENDBLUE_WEBHOOK_SECRET=<different random webhook secret>
CODEX_MARITIME_ALLOWED_SENDERS=+1...
```

All phone numbers must use E.164 format. `CODEX_MARITIME_ALLOWED_SENDERS` can be a comma-separated list, but start with only your verified phone.

For the short live test, also set:

```text
CODEX_MARITIME_FIRST_MINUTES=2
CODEX_MARITIME_REPEAT_MINUTES=5
CODEX_MARITIME_QUIET_ENABLED=false
```

Restore `60`, `120`, and `true` after the test. Quiet start/end and timezone are independently adjustable:

```text
CODEX_MARITIME_QUIET_START=00:00
CODEX_MARITIME_QUIET_END=06:00
CODEX_MARITIME_TIMEZONE=America/Los_Angeles
```

## 3. Register the inbound webhook

Set a Sendblue `receive` webhook to the deployed URL and use exactly the same secret as `SENDBLUE_WEBHOOK_SECRET`:

```sh
curl -X POST https://api.sendblue.co/api/account/webhooks \
  -H "sb-api-key-id: YOUR_API_KEY" \
  -H "sb-api-secret-key: YOUR_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "webhooks": [{
      "url": "https://YOUR-MARITIME-URL/webhooks/sendblue",
      "secret": "YOUR_WEBHOOK_SECRET"
    }],
    "type": "receive"
  }'
```

This endpoint appends a webhook. Check the existing Sendblue webhook list before rerunning it so the same URL is not added twice. The gateway rejects missing or incorrect `sb-signing-secret` headers, ignores outbound/status events, allowlists the sender, and deduplicates `message_handle` values.

## 4. Validate both sides

Run the same environment locally or in a Maritime shell:

```sh
codex-maritime doctor
```

A ready result prints the exact webhook URL without printing credentials. Then verify:

```sh
curl https://YOUR-MARITIME-URL/healthz
```

Expected response:

```json
{"ok":true}
```

In each activated project, `.codex/maritime.local.json` must contain the public Maritime URL and the same gateway bearer token:

```json
{
  "gatewayUrl": "https://YOUR-MARITIME-URL",
  "token": "YOUR_CODEX_MARITIME_TOKEN",
  "deviceId": "a-stable-unique-id-for-this-computer"
}
```

## 5. Run the accelerated live test

Start a small task expected to last at least several minutes:

```sh
codex-maritime run "Create a small validation file, test it, and summarize the result"
```

The expected sequence is:

1. Immediate text: `[ABC] Tracking: ... Updates begin after 2m if still active.`
2. After two minutes: a goal breakdown with exact percentages.
3. Text `/status ABC`; receive the current status immediately.
4. Text `ABC /s: add one edge-case test`; the local bridge receives the steering command.
5. Trigger a harmless approval and reply `Y ABC-A1` or `N ABC-A1`.
6. Keep the task open for five more minutes and confirm the repeat update.
7. Complete the task and confirm the final message.

If the process can sleep, configure a Maritime cron trigger to call authenticated `POST /v1/tick` every minute. The in-process scheduler also ticks every minute while the service is awake; an external trigger is what makes delivery reliable after idle suspension.

## Failure map

- `Sendblue send failed (401/403)`: API key/secret is wrong or belongs to another account.
- Recipient/contact error: run `sendblue add-contact`, then text the shared line once from that phone.
- No inbound commands: check the receive webhook URL, the matching webhook secret, and `CODEX_MARITIME_ALLOWED_SENDERS`.
- `401 Invalid Sendblue webhook secret`: the webhook's secret and Maritime's `SENDBLUE_WEBHOOK_SECRET` differ.
- Health works but updates are late: the service slept; add the minute cron trigger.
- Android receives SMS rather than RCS: Sendblue selected the available carrier/device fallback; command behavior is unchanged.
- WhatsApp required: use the generic webhook adapter with a WhatsApp provider; Sendblue does not provide WhatsApp.
