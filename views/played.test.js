import { test } from "node:test";
import assert from "node:assert/strict";
import { pastFixtures, predictionRows } from "./played.js";

const cfg = { winner: 3, exactScore: 10, goalDiff: 2, totalGoals: 1, eachTeamGoals: 1 };

test("pastFixtures keeps only fixtures whose kickoff is at or before now", () => {
  const fixtures = [
    { id: "m1", kickoff: "2026-06-11T19:00:00Z" },
    { id: "m2", kickoff: "2026-06-30T19:00:00Z" },
  ];
  const now = Date.parse("2026-06-12T00:00:00Z");
  assert.deepEqual(pastFixtures(fixtures, now).map((f) => f.id), ["m1"]);
});

test("predictionRows scores a match's predictions and sorts by points desc then name", () => {
  const predictions = [
    { player: "Bob", matchId: "m1", homeGoals: 1, awayGoals: 0 }, // vs 2-1: winner 3 + goalDiff 2 -> 5
    { player: "Ana", matchId: "m1", homeGoals: 2, awayGoals: 1 }, // exact -> 18
    { player: "Cy", matchId: "m2", homeGoals: 0, awayGoals: 0 },  // other match -> excluded
  ];
  const result = { matchId: "m1", homeGoals: 2, awayGoals: 1 };
  const rows = predictionRows(predictions, "m1", result, cfg);
  assert.deepEqual(rows, [
    { player: "Ana", homeGoals: 2, awayGoals: 1, points: 18 },
    { player: "Bob", homeGoals: 1, awayGoals: 0, points: 5 },
  ]);
});

test("predictionRows leaves points null when there is no result yet", () => {
  const predictions = [{ player: "Ana", matchId: "m1", homeGoals: 2, awayGoals: 1 }];
  const rows = predictionRows(predictions, "m1", null, cfg);
  assert.equal(rows[0].points, null);
});

test("predictionRows adds the advance bonus and exposes the pick for knockout", () => {
  const cfg = { winner: 3, exactScore: 10, goalDiff: 2, totalGoals: 1, eachTeamGoals: 1, advance: 5 };
  const predictions = [{ player: "Ana", matchId: "m73", homeGoals: 1, awayGoals: 1, advancer: "Canada" }];
  const result = { matchId: "m73", homeGoals: 1, awayGoals: 1, advancer: "Canada" };
  const info = { round: "Round of 32", home: "South Africa", away: "Canada" };
  const [row] = predictionRows(predictions, "m73", result, cfg, info);
  // 1-1 vs 1-1: exact 10 + winner 3 + goalDiff 2 + totalGoals 1 + eachTeam 1+1 = 18, + advance 5 = 23
  assert.equal(row.points, 23);
  assert.equal(row.advancer, "Canada");
});

test("predictionRows adds the bonus for a decisive knockout pick via score", () => {
  const cfg = { winner: 3, exactScore: 10, goalDiff: 2, totalGoals: 1, eachTeamGoals: 1, advance: 5 };
  const predictions = [{ player: "Ana", matchId: "m95", homeGoals: 2, awayGoals: 1 }];
  const result = { matchId: "m95", homeGoals: 2, awayGoals: 1 };
  const info = { round: "Round of 16", home: "South Africa", away: "Germany" };
  const [row] = predictionRows(predictions, "m95", result, cfg, info);
  // exact 2-1: exact 10 + winner 3 + goalDiff 2 + totalGoals 1 + eachTeam 1+1 = 18, + advance 5 (home wins -> SA) = 23
  assert.equal(row.points, 23);
  assert.equal(row.advancer, undefined); // no explicit pick on a decisive prediction
});
