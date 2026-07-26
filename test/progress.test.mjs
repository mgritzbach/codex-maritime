import test from "node:test";
import assert from "node:assert/strict";
import { calculateProgress, normalizeGoal } from "../src/progress.mjs";

test("progress accepts arbitrary percentages", () => {
  assert.equal(normalizeGoal({ title: "A", progress: 33.3 }).progress, 33.3);
  const result = calculateProgress([
    { title: "Small", progress: 33, weight: 1 },
    { title: "Large", progress: 87, weight: 3 }
  ], 1);
  assert.equal(result.percent, 73.5);
});

test("progress rejects out-of-range values", () => {
  assert.throws(() => normalizeGoal({ title: "No", progress: 101 }), /between 0 and 100/);
});