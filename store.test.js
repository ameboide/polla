import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG, resolveConfig } from "./store.js";

test("resolveConfig returns the single existing record", () => {
  const rec = { id: "c1", winner: 4, exactScore: 8, goalDiff: 2, totalGoals: 1, eachTeamGoals: 1 };
  assert.deepEqual(resolveConfig([rec]), rec);
});

test("resolveConfig falls back to defaults when empty", () => {
  const cfg = resolveConfig([]);
  assert.equal(cfg.id, null);
  assert.equal(cfg.winner, DEFAULT_CONFIG.winner);
  assert.equal(cfg.exactScore, DEFAULT_CONFIG.exactScore);
});
