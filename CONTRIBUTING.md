# Contributing

Requirements: Node.js 20 or newer and a current Codex CLI for bridge tests.

```sh
npm test
npm run check
```

The core has no runtime npm dependencies. Keep parsing, scheduling, progress, and approval routing deterministic. An LLM call must never be required to interpret a control message or format a routine update.