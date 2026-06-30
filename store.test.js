import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG, resolveConfig, flattenPredictions, resultsMatches, mergeMatches } from "./store.js";

test("flattenPredictions expands per-player records into flat rows", () => {
  const records = [
    { id: "p1", player: "Ana", matches: [
      { matchId: "m1", homeGoals: 2, awayGoals: 1 },
      { matchId: "m2", homeGoals: 0, awayGoals: 0 },
    ] },
    { id: "p2", player: "Bob", matches: [{ matchId: "m1", homeGoals: 1, awayGoals: 1 }] },
    { id: "p3", player: "Cy", matches: [] }, // no matches -> contributes nothing
  ];
  assert.deepEqual(flattenPredictions(records), [
    { player: "Ana", matchId: "m1", homeGoals: 2, awayGoals: 1, advancer: undefined },
    { player: "Ana", matchId: "m2", homeGoals: 0, awayGoals: 0, advancer: undefined },
    { player: "Bob", matchId: "m1", homeGoals: 1, awayGoals: 1, advancer: undefined },
  ]);
});

test("resultsMatches returns the matches array or empty", () => {
  assert.deepEqual(resultsMatches({ id: "r1", matches: [{ matchId: "m1", homeGoals: 1, awayGoals: 0 }] }),
    [{ matchId: "m1", homeGoals: 1, awayGoals: 0 }]);
  assert.deepEqual(resultsMatches(null), []);
});

test("mergeMatches overlays edits by matchId, keeping untouched ones", () => {
  const existing = [
    { matchId: "m1", homeGoals: 1, awayGoals: 0 },
    { matchId: "m2", homeGoals: 2, awayGoals: 2 },
  ];
  const edits = [
    { matchId: "m2", homeGoals: 3, awayGoals: 0 }, // update
    { matchId: "m3", homeGoals: 1, awayGoals: 1 }, // new
  ];
  assert.deepEqual(mergeMatches(existing, edits), [
    { matchId: "m1", homeGoals: 1, awayGoals: 0 },
    { matchId: "m2", homeGoals: 3, awayGoals: 0 },
    { matchId: "m3", homeGoals: 1, awayGoals: 1 },
  ]);
});

test("mergeMatches handles a null/empty existing array", () => {
  assert.deepEqual(mergeMatches(null, [{ matchId: "m1", homeGoals: 0, awayGoals: 0 }]),
    [{ matchId: "m1", homeGoals: 0, awayGoals: 0 }]);
});

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

test("flattenPredictions carries advancer when present", () => {
  const records = [{ id: "p1", player: "Ana", matches: [
    { matchId: "m73", homeGoals: 1, awayGoals: 1, advancer: "Canada" },
    { matchId: "m1", homeGoals: 2, awayGoals: 0 },
  ] }];
  assert.deepEqual(flattenPredictions(records), [
    { player: "Ana", matchId: "m73", homeGoals: 1, awayGoals: 1, advancer: "Canada" },
    { player: "Ana", matchId: "m1", homeGoals: 2, awayGoals: 0, advancer: undefined },
  ]);
});

test("mergeMatches preserves advancer on edits", () => {
  const merged = mergeMatches(
    [{ matchId: "m73", homeGoals: 0, awayGoals: 0, advancer: "South Africa" }],
    [{ matchId: "m73", homeGoals: 1, awayGoals: 1, advancer: "Canada" }],
  );
  assert.deepEqual(merged, [{ matchId: "m73", homeGoals: 1, awayGoals: 1, advancer: "Canada" }]);
});
