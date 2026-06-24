import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeStandings,
  effectiveResults,
  pointsByMatch,
  allPlayers,
  eligibleMatchIds,
  partialStandings,
} from "./leaderboard.js";

const cfg = { winner: 3, exactScore: 10, goalDiff: 2, totalGoals: 1, eachTeamGoals: 1 };

test("pointsByMatch scores a player's predictions against effective results", () => {
  const fixtures = [
    { id: "m1", result: { homeGoals: 2, awayGoals: 1 } }, // exact -> 18
    { id: "m2", result: { homeGoals: 0, awayGoals: 0 } }, // wrong -> 0
    { id: "m3" },                                          // no result
  ];
  const predictions = [
    { player: "Ana", matchId: "m1", homeGoals: 2, awayGoals: 1 },
    { player: "Ana", matchId: "m2", homeGoals: 2, awayGoals: 1 }, // vs 0-0: nothing matches -> 0
    { player: "Ana", matchId: "m3", homeGoals: 1, awayGoals: 0 }, // no result -> omitted
    { player: "Bob", matchId: "m1", homeGoals: 0, awayGoals: 0 },
  ];
  const m = pointsByMatch(fixtures, predictions, [], cfg, "Ana");
  assert.equal(m.get("m1"), 18);
  assert.equal(m.get("m2"), 0);
  assert.equal(m.has("m3"), false); // no result
  assert.equal(m.size, 2);
});

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

test("allPlayers returns unique players sorted", () => {
  const predictions = [
    { player: "Bob", matchId: "m1", homeGoals: 1, awayGoals: 0 },
    { player: "Ana", matchId: "m1", homeGoals: 0, awayGoals: 0 },
    { player: "Bob", matchId: "m2", homeGoals: 2, awayGoals: 2 },
  ];
  assert.deepEqual(allPlayers(predictions), ["Ana", "Bob"]);
});

test("eligibleMatchIds is the intersection of selected players' predicted matches", () => {
  const predictions = [
    { player: "Ana", matchId: "m1", homeGoals: 1, awayGoals: 0 },
    { player: "Ana", matchId: "m2", homeGoals: 1, awayGoals: 0 },
    { player: "Ana", matchId: "m3", homeGoals: 1, awayGoals: 0 },
    { player: "Bob", matchId: "m1", homeGoals: 0, awayGoals: 0 },
    { player: "Bob", matchId: "m2", homeGoals: 0, awayGoals: 0 },
  ];
  const ids = eligibleMatchIds(predictions, ["Ana", "Bob"]);
  assert.deepEqual([...ids].sort(), ["m1", "m2"]); // m3 only Ana predicted
});

test("eligibleMatchIds with one player is all their predicted matches", () => {
  const predictions = [
    { player: "Ana", matchId: "m1", homeGoals: 1, awayGoals: 0 },
    { player: "Ana", matchId: "m2", homeGoals: 1, awayGoals: 0 },
    { player: "Bob", matchId: "m1", homeGoals: 0, awayGoals: 0 },
  ];
  assert.deepEqual([...eligibleMatchIds(predictions, ["Ana"])].sort(), ["m1", "m2"]);
});

test("eligibleMatchIds with no selected players is empty", () => {
  const predictions = [{ player: "Ana", matchId: "m1", homeGoals: 1, awayGoals: 0 }];
  assert.equal(eligibleMatchIds(predictions, []).size, 0);
});

test("partialStandings only counts matches all selected players predicted", () => {
  const predictions = [
    { player: "Ana", matchId: "m1", homeGoals: 2, awayGoals: 1 }, // exact -> 18
    { player: "Ana", matchId: "m2", homeGoals: 2, awayGoals: 1 }, // only Ana -> excluded
    { player: "Bob", matchId: "m1", homeGoals: 0, awayGoals: 0 }, // wrong -> 0
  ];
  const results = [
    { matchId: "m1", homeGoals: 2, awayGoals: 1 },
    { matchId: "m2", homeGoals: 2, awayGoals: 1 },
  ];
  const { standings, matchCount } = partialStandings(predictions, results, cfg, ["Ana", "Bob"]);
  assert.equal(matchCount, 1); // only m1 common
  assert.equal(standings[0].player, "Ana");
  assert.equal(standings[0].points, 18); // m2 excluded despite being exact
  assert.equal(standings[1].player, "Bob");
  assert.equal(standings[1].points, 0);
});
