import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStandings } from "./leaderboard.js";

const cfg = { winner: 3, exactScore: 10, goalDiff: 2, totalGoals: 1, eachTeamGoals: 1 };

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
