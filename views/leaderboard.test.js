import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStandings, effectiveResults } from "./leaderboard.js";

const cfg = { winner: 3, exactScore: 10, goalDiff: 2, totalGoals: 1, eachTeamGoals: 1 };

test("effectiveResults prefers admin result over the fixture default", () => {
  const fixtures = [
    { id: "m1", result: { homeGoals: 1, awayGoals: 0 } }, // has real result
    { id: "m2", result: { homeGoals: 3, awayGoals: 3 } }, // admin will override
    { id: "m3" },                                          // not played, no result
  ];
  const adminResults = [{ matchId: "m2", homeGoals: 2, awayGoals: 0 }];
  const eff = effectiveResults(fixtures, adminResults);
  assert.deepEqual(eff, [
    { matchId: "m1", homeGoals: 1, awayGoals: 0 }, // fixture default
    { matchId: "m2", homeGoals: 2, awayGoals: 0 }, // admin override
  ]); // m3 omitted (no result anywhere)
});

test("sums points per player and sorts desc", () => {
  const predictions = [
    { player: "Ana", matchId: "m1", homeGoals: 2, awayGoals: 1 },
    { player: "Bob", matchId: "m1", homeGoals: 0, awayGoals: 0 },
  ];
  const results = [{ matchId: "m1", homeGoals: 2, awayGoals: 1 }];
  const s = computeStandings(predictions, results, cfg);
  assert.equal(s[0].player, "Ana");          // exact: 3+10+2+1+1+1 = 18
  assert.equal(s[0].points, 18);
  assert.equal(s[1].player, "Bob");           // 0-0 vs 2-1: nothing matches = 0
  assert.equal(s[1].points, 0);
});

test("ignores matches without a result", () => {
  const predictions = [{ player: "Ana", matchId: "m9", homeGoals: 1, awayGoals: 0 }];
  const s = computeStandings(predictions, [], cfg);
  assert.equal(s[0].points, 0);
});
