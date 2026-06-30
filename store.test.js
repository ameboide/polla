import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG, resolveConfig, configRows, flattenPredictions, resultsMatches, mergeMatches } from "./store.js";

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

test("resolveConfig assembles a flat object from key-value rows, coercing numerics", () => {
  const rows = [
    { id: "1", configKey: "winner", configValue: "4" },
    { id: "2", configKey: "exactScore", configValue: "8" },
    { id: "3", configKey: "name", configValue: "Polla 2026" },
  ];
  const cfg = resolveConfig(rows);
  assert.equal(cfg.winner, 4);          // numeric string -> number
  assert.equal(cfg.exactScore, 8);
  assert.equal(cfg.name, "Polla 2026"); // non-numeric stays a string
  assert.equal(cfg.goalDiff, DEFAULT_CONFIG.goalDiff); // missing key -> default
  assert.equal("id" in cfg, false);     // no single-row id concept
});

test("resolveConfig with no rows returns the defaults", () => {
  assert.deepEqual(resolveConfig([]), { ...DEFAULT_CONFIG });
});

test("configRows shapes fields into string-valued upsert rows in order", () => {
  assert.deepEqual(configRows({ winner: 3, advance: 5 }), [
    { configKey: "winner", configValue: "3" },
    { configKey: "advance", configValue: "5" },
  ]);
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

test("mergeMatches drops advancer when an edit omits it", () => {
  const merged = mergeMatches(
    [{ matchId: "m73", homeGoals: 0, awayGoals: 0, advancer: "Canada" }],
    [{ matchId: "m73", homeGoals: 1, awayGoals: 0 }],
  );
  assert.deepEqual(merged, [{ matchId: "m73", homeGoals: 1, awayGoals: 0 }]);
});

test("DEFAULT_CONFIG includes an advance bonus", () => {
  assert.equal(typeof DEFAULT_CONFIG.advance, "number");
});
