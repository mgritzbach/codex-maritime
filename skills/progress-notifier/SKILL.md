---
name: progress-notifier
description: Register and update long-running goal-based Codex tasks with Codex Maritime so the user can receive scheduled progress, steer work, and answer scoped approvals over a configured messaging channel.
---

# Codex Maritime progress notifier

Use this skill when the user asks to track a long-running task, requests Maritime/SMS/WhatsApp progress, or the project enables Codex Maritime.

1. Register as soon as there are concrete goals; the gateway decides when the first update is due.
2. Use the returned short code in the first visible update.
3. Progress accepts any number from 0 through 100, not quarter steps.
4. Send only material changes with concise evidence, current work, blockers, and next action.
5. Complete or fail the task at a terminal outcome.
6. Never call an LLM merely to format a routine update.

Tools: `maritime_register_task`, `maritime_update_task`, and `maritime_complete_task`.

If MCP is unavailable, say tracking is inactive. For full `/s`, `/c`, and Y/N support, launch through `codex-maritime run`.