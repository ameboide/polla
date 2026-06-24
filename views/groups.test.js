import { test } from "node:test";
import assert from "node:assert/strict";
import { groupStandings } from "./groups.js";

test("groupStandings tallies P/W/D/L, goals, GD and 3-1-0 points, sorted", () => {
  const fixtures = [
    { id: "m1", group: "A", home: "Mexico", away: "South Africa", result: { homeGoals: 2, awayGoals: 0 } },
    { id: "m2", group: "A", home: "South Korea", away: "Czech Republic", result: { homeGoals: 2, awayGoals: 1 } },
    { id: "m3", group: "A", home: "Czech Republic", away: "South Africa", result: { homeGoals: 1, awayGoals: 1 } },
    { id: "m4", group: "A", home: "Mexico", away: "South Korea" }, // not played
  ];
  const [groupA] = groupStandings(fixtures, []);
  assert.equal(groupA.group, "A");
  assert.deepEqual(groupA.standings, [
    { team: "Mexico", played: 1, won: 1, drawn: 0, lost: 0, gf: 2, ga: 0, gd: 2, points: 3 },
    { team: "South Korea", played: 1, won: 1, drawn: 0, lost: 0, gf: 2, ga: 1, gd: 1, points: 3 },
    { team: "Czech Republic", played: 2, won: 0, drawn: 1, lost: 1, gf: 2, ga: 3, gd: -1, points: 1 },
    { team: "South Africa", played: 2, won: 0, drawn: 1, lost: 1, gf: 1, ga: 3, gd: -2, points: 1 },
  ]);
});

test("head-to-head beats overall goal difference for teams level on points", () => {
  // T1 and T2 both finish on 6 pts. T2 has the better overall GD (+6 vs +3),
  // but T1 won the head-to-head, so T1 must rank first.
  const fixtures = [
    { id: "m1", group: "A", home: "T1", away: "T2", result: { homeGoals: 1, awayGoals: 0 } }, // T1 beats T2
    { id: "m2", group: "A", home: "T1", away: "T3", result: { homeGoals: 0, awayGoals: 1 } },
    { id: "m3", group: "A", home: "T1", away: "T4", result: { homeGoals: 3, awayGoals: 0 } },
    { id: "m4", group: "A", home: "T2", away: "T3", result: { homeGoals: 5, awayGoals: 0 } },
    { id: "m5", group: "A", home: "T2", away: "T4", result: { homeGoals: 2, awayGoals: 0 } },
    { id: "m6", group: "A", home: "T3", away: "T4", result: { homeGoals: 0, awayGoals: 0 } },
  ];
  const [groupA] = groupStandings(fixtures, []);
  const top2 = groupA.standings.slice(0, 2).map((t) => t.team);
  assert.deepEqual(top2, ["T1", "T2"]); // T1 first despite T2's superior overall GD
  assert.ok(groupA.standings[1].gd > groupA.standings[0].gd); // confirm GD was the loser here
});

test("groupStandings lists every team even before any match is played, and sorts groups", () => {
  const fixtures = [
    { id: "x1", group: "B", home: "Spain", away: "Brazil" },
    { id: "x2", group: "A", home: "France", away: "Japan" },
  ];
  const out = groupStandings(fixtures, []);
  assert.deepEqual(out.map((g) => g.group), ["A", "B"]);
  assert.equal(out[0].standings.length, 2);
  assert.equal(out[0].standings[0].played, 0);
});

test("groupStandings prefers admin results over fixture results", () => {
  const fixtures = [
    { id: "m1", group: "A", home: "Mexico", away: "South Africa", result: { homeGoals: 2, awayGoals: 0 } },
  ];
  const adminResults = [{ matchId: "m1", homeGoals: 0, awayGoals: 3 }];
  const [groupA] = groupStandings(fixtures, adminResults);
  const mexico = groupA.standings.find((t) => t.team === "Mexico");
  assert.equal(mexico.lost, 1);
  assert.equal(mexico.points, 0);
});
