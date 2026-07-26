const STATUS_PROGRESS = { pending: 0, inProgress: 50, in_progress: 50, completed: 100, failed: 100, skipped: 100 };

export function normalizeGoal(goal, index = 0) {
  if (!goal || typeof goal !== "object") throw new Error(`Goal ${index + 1} must be an object`);
  const title = String(goal.title ?? goal.step ?? "").trim();
  if (!title) throw new Error(`Goal ${index + 1} requires a title`);
  const progress = Number(goal.progress ?? STATUS_PROGRESS[goal.status] ?? 0);
  if (!Number.isFinite(progress) || progress < 0 || progress > 100) throw new Error(`Goal "${title}" progress must be between 0 and 100`);
  const weight = goal.weight == null ? 1 : Number(goal.weight);
  if (!Number.isFinite(weight) || weight <= 0) throw new Error(`Goal "${title}" weight must be positive`);
  return {
    id: String(goal.id ?? `goal-${index + 1}`), title, progress, weight,
    status: String(goal.status ?? statusFromProgress(progress)), evidence: goal.evidence ? String(goal.evidence) : ""
  };
}

export function statusFromProgress(progress) {
  if (progress >= 100) return "completed";
  if (progress > 0) return "inProgress";
  return "pending";
}

export function calculateProgress(goals = [], decimals = 0) {
  const normalized = goals.map(normalizeGoal);
  if (normalized.length === 0) return { percent: 0, completed: 0, total: 0, goals: normalized };
  const totalWeight = normalized.reduce((sum, goal) => sum + goal.weight, 0);
  const weighted = normalized.reduce((sum, goal) => sum + goal.progress * goal.weight, 0);
  const scale = 10 ** decimals;
  return {
    percent: Math.round((weighted / totalWeight) * scale) / scale,
    completed: normalized.filter((goal) => goal.progress >= 100).length,
    total: normalized.length,
    goals: normalized
  };
}

export function compactGoalLine(goal) {
  const marker = goal.progress >= 100 ? "✓" : goal.progress > 0 ? "◐" : "○";
  return `${marker} ${goal.title}: ${goal.progress}%${goal.evidence ? ` — ${goal.evidence}` : ""}`;
}