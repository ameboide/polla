import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeStandings,
  effectiveResults,
  pointsByMatch,
  allPlayers,
  eligibleMatchIds,
  partialStandings,
  matchIndex,
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

test("computeStandings counts how many matches each player predicted", () => {
  const predictions = [
    { player: "Ana", matchId: "m1", homeGoals: 1, awayGoals: 0 },
    { player: "Ana", matchId: "m2", homeGoals: 2, awayGoals: 2 }, // no result, still counted
    { player: "Bob", matchId: "m1", homeGoals: 0, awayGoals: 0 },
  ];
  const s = computeStandings(predictions, [], cfg);
  assert.equal(s.find((r) => r.player === "Ana").predicted, 2);
  assert.equal(s.find((r) => r.player === "Bob").predicted, 1);
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

test("computeStandings adds the advance bonus for a correct knockout pick", () => {
  const cfg = { winner: 3, exactScore: 10, goalDiff: 2, totalGoals: 1, eachTeamGoals: 1, advance: 5 };
  const index = new Map([["m73", { round: "Round of 32", home: "SA", away: "CA" }]]);
  const predictions = [{ player: "Ana", matchId: "m73", homeGoals: 1, awayGoals: 1, advancer: "CA" }];
  const results = [{ matchId: "m73", homeGoals: 0, awayGoals: 0, advancer: "CA" }];
  // exact 0-0? prediction is 1-1 so: winner(draw=draw)=3, goalDiff(0=0)=2, totalGoals(2!=0)=0 -> 5, + advance 5 = 10
  const [row] = computeStandings(predictions, results, cfg, index);
  assert.equal(row.points, 10);
});

test("computeStandings gives no bonus for a wrong knockout pick", () => {
  const cfg = { winner: 3, exactScore: 10, goalDiff: 2, totalGoals: 1, eachTeamGoals: 1, advance: 5 };
  const index = new Map([["m73", { round: "Round of 32", home: "SA", away: "CA" }]]);
  const predictions = [{ player: "Ana", matchId: "m73", homeGoals: 1, awayGoals: 1, advancer: "SA" }];
  const results = [{ matchId: "m73", homeGoals: 0, awayGoals: 0, advancer: "CA" }];
  assert.equal(computeStandings(predictions, results, cfg, index)[0].points, 5); // score only, no bonus
});

test("computeStandings never bonuses group matches", () => {
  const cfg = { winner: 3, exactScore: 10, goalDiff: 2, totalGoals: 1, eachTeamGoals: 1, advance: 5 };
  const index = new Map([["m1", { round: null, home: "X", away: "Y" }]]);
  const predictions = [{ player: "Ana", matchId: "m1", homeGoals: 1, awayGoals: 1, advancer: "X" }];
  const results = [{ matchId: "m1", homeGoals: 0, awayGoals: 0 }];
  // draw=draw: winner 3, goalDiff(0=0) 2, totalGoals(2!=0) 0 -> 5; no bonus for group match
  assert.equal(computeStandings(predictions, results, cfg, index)[0].points, 5); // winner 3 + goalDiff 2
});

test("effectiveResults carries advancer on a knockout result but not on group rows", () => {
  const fixtures = [
    { id: "m73", round: "Round of 32", home: "South Africa", away: "Canada" },
    { id: "m1", group: "A", home: "X", away: "Y", result: { homeGoals: 2, awayGoals: 0 } },
  ];
  const results = [{ matchId: "m73", homeGoals: 1, awayGoals: 1, advancer: "Canada" }];
  assert.deepEqual(effectiveResults(fixtures, results), [
    { matchId: "m73", homeGoals: 1, awayGoals: 1, advancer: "Canada" },
    { matchId: "m1", homeGoals: 2, awayGoals: 0 },
  ]);
});

test("a drawn knockout result scored via effectiveResults awards the advance bonus", () => {
  const cfg = { winner: 3, exactScore: 10, goalDiff: 2, totalGoals: 1, eachTeamGoals: 1, advance: 5 };
  const fixtures = [{ id: "m73", round: "Round of 32", home: "South Africa", away: "Canada" }];
  const results = [{ matchId: "m73", homeGoals: 1, awayGoals: 1, advancer: "Canada" }];
  const predictions = [{ player: "Ana", matchId: "m73", homeGoals: 1, awayGoals: 1, advancer: "Canada" }];
  const eff = effectiveResults(fixtures, results);
  const index = matchIndex(fixtures, results);
  // 1-1 vs 1-1: exact 10 + winner 3 + goalDiff 2 + totalGoals 1 + eachTeam 1+1 = 18, + advance 5 = 23
  assert.equal(computeStandings(predictions, eff, cfg, index)[0].points, 23);
});

test("partialStandings filters the eligible matches by stage", () => {
  const cfg = { winner: 3, exactScore: 10, goalDiff: 2, totalGoals: 1, eachTeamGoals: 1, advance: 5 };
  const index = new Map([
    ["m1",  { round: null, home: "X", away: "Y" }],          // group
    ["m73", { round: "Round of 32", home: "SA", away: "CA" }], // knockout
  ]);
  const results = [
    { matchId: "m1",  homeGoals: 1, awayGoals: 0 },
    { matchId: "m73", homeGoals: 2, awayGoals: 1 },
  ];
  // Both players predicted both matches, so both are "eligible" before filtering.
  const predictions = [
    { player: "Ana", matchId: "m1",  homeGoals: 1, awayGoals: 0 },
    { player: "Ana", matchId: "m73", homeGoals: 2, awayGoals: 1 },
    { player: "Bob", matchId: "m1",  homeGoals: 0, awayGoals: 0 },
    { player: "Bob", matchId: "m73", homeGoals: 1, awayGoals: 1 },
  ];
  const players = ["Ana", "Bob"];

  assert.equal(partialStandings(predictions, results, cfg, players, index, "all").matchCount, 2);
  assert.equal(partialStandings(predictions, results, cfg, players, index, "group").matchCount, 1);
  assert.equal(partialStandings(predictions, results, cfg, players, index, "knockout").matchCount, 1);

  // group-only: only m1 counts -> Ana exact 1-0 (18), Bob 0-0 vs 1-0 (0)
  const grp = partialStandings(predictions, results, cfg, players, index, "group").standings;
  assert.deepEqual(grp.find((r) => r.player === "Ana"), { player: "Ana", points: 18, predicted: 1 });

  // default (5-arg) stays unfiltered
  assert.equal(partialStandings(predictions, results, cfg, players, index).matchCount, 2);
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
