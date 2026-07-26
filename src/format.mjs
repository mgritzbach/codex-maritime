import { calculateProgress, compactGoalLine } from "./progress.mjs";

export function formatTaskUpdate(task, settings, now = new Date()) {
  const progress = calculateProgress(task.goals, settings.progress.decimals);
  const elapsedMinutes = Math.max(0, Math.round((now.getTime() - new Date(task.startedAt).getTime()) / 60_000));
  const elapsed = elapsedMinutes >= 60 ? `${Math.floor(elapsedMinutes / 60)}h ${elapsedMinutes % 60}m` : `${elapsedMinutes}m`;
  const lines = [`[${task.code}] ${elapsed} update — ${progress.percent}% · ${progress.completed}/${progress.total} goals`];
  for (const goal of progress.goals) lines.push(compactGoalLine(goal));
  if (task.current) lines.push(`Current: ${task.current}`);
  lines.push(task.blockers?.length ? `Blocked: ${task.blockers.join("; ")}` : "Blocked: none");
  if (task.next) lines.push(`Next: ${task.next}`);
  return truncate(lines.join("\n"), 1500);
}

export function formatApproval(approval) {
  return truncate([
    `[${approval.reference}] Approval needed`, `Action: ${approval.summary}`,
    approval.cwd ? `Project: ${approval.cwd}` : null, approval.reason ? `Reason: ${approval.reason}` : null,
    "Scope: approve once", `Reply Y ${approval.reference} or N ${approval.reference}.`
  ].filter(Boolean).join("\n"), 1500);
}

export const truncate = (text, max) => text.length <= max ? text : `${text.slice(0, max - 1)}…`;