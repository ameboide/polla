import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBracket, displayOrder } from "./bracket.js";

// Group A: full round-robin, all played. T1 wins all (1st), T2 (2nd).
const groupA = [
  { id: "a1", group: "A", home: "T1", away: "T2", result: { homeGoals: 1, awayGoals: 0 } },
  { id: "a2", group: "A", home: "T3", away: "T4", result: { homeGoals: 1, awayGoals: 0 } },
  { id: "a3", group: "A", home: "T1", away: "T3", result: { homeGoals: 1, awayGoals: 0 } },
  { id: "a4", group: "A", home: "T2", away: "T4", result: { homeGoals: 1, awayGoals: 0 } },
  { id: "a5", group: "A", home: "T1", away: "T4", result: { homeGoals: 1, awayGoals: 0 } },
  { id: "a6", group: "A", home: "T2", away: "T3", result: { homeGoals: 1, awayGoals: 0 } },
];
// Group B: only one match played -> incomplete. B1 currently 1st, B2 2nd.
const groupB = [
  { id: "b1", group: "B", home: "B1", away: "B2", result: { homeGoals: 2, awayGoals: 0 } },
];

function slotsOf(rounds, matchNo) {
  for (const r of rounds) for (const m of r.matches) if (m.match === matchNo) return m.slots;
  throw new Error(`match ${matchNo} not found`);
}

test("a completed group resolves winner/runner-up slots to real teams", () => {
  const rounds = buildBracket([...groupA, ...groupB], []);
  // Match 79 = Winner Group A; Match 73 = Runner-up A vs Runner-up B
  assert.deepEqual(slotsOf(rounds, 79)[0], { defined: true, label: "1A", team: "T1" });
  assert.deepEqual(slotsOf(rounds, 73)[0], { defined: true, label: "2A", team: "T2" });
});

test("an incomplete group keeps the criterion with the provisional occupant", () => {
  const rounds = buildBracket([...groupA, ...groupB], []);
  // Match 73 slot 2 = Runner-up B: B incomplete -> undefined, current 2nd = B2
  assert.deepEqual(slotsOf(rounds, 73)[1], { defined: false, label: "2B", team: "B2" });
});

test("third-place and match-feed slots are undefined criteria", () => {
  const rounds = buildBracket([...groupA, ...groupB], []);
  // Match 77's third allows C/D/F/G/H — none complete here, so it stays empty.
  assert.deepEqual(slotsOf(rounds, 77)[1], { defined: false, label: "3rd C/D/F/G/H", team: undefined });
  assert.deepEqual(slotsOf(rounds, 89)[0], { defined: false, label: "Winner 74" });
  assert.deepEqual(slotsOf(rounds, 103)[0], { defined: false, label: "Loser 101" });
});

test("displayOrder lays each round out along the bracket tree, not by match number", () => {
  const order = displayOrder();
  // R32 ordered so each adjacent pair shares an R16 parent (74&77 -> 89, 73&75 -> 90, ...)
  assert.deepEqual(order["Round of 32"],
    [74, 77, 73, 75, 83, 84, 81, 82, 76, 78, 79, 80, 86, 88, 85, 87]);
  // R16 follows the same top-to-bottom order as its feeders
  assert.deepEqual(order["Round of 16"], [89, 90, 93, 94, 91, 92, 95, 96]);
  assert.deepEqual(order["Quarter-finals"], [97, 98, 99, 100]);
  assert.deepEqual(order["Final"], [104]);
});

test("simulations move the provisional team but the slot stays undefined", () => {
  // Group B: full round-robin, all UNPLAYED (no results). Simulate B1 winning.
  const groupBsim = [
    { id: "s1", group: "B", home: "B1", away: "B2" },
    { id: "s2", group: "B", home: "B3", away: "B4" },
    { id: "s3", group: "B", home: "B1", away: "B3" },
    { id: "s4", group: "B", home: "B2", away: "B4" },
    { id: "s5", group: "B", home: "B1", away: "B4" },
    { id: "s6", group: "B", home: "B2", away: "B3" },
  ];
  const sims = [
    { matchId: "s1", homeGoals: 1, awayGoals: 0 }, // B1 beats B2
    { matchId: "s3", homeGoals: 1, awayGoals: 0 }, // B1 beats B3
    { matchId: "s5", homeGoals: 1, awayGoals: 0 }, // B1 beats B4 -> B1 1st
    { matchId: "s4", homeGoals: 1, awayGoals: 0 }, // B2 beats B4
    { matchId: "s6", homeGoals: 1, awayGoals: 0 }, // B2 beats B3 -> B2 2nd
  ];
  const rounds = buildBracket(groupBsim, [], sims);
  // Match 85 = Winner B, Match 73 slot 2 = Runner-up B
  assert.deepEqual(slotsOf(rounds, 85)[0], { defined: false, label: "1B", team: "B1" });
  assert.deepEqual(slotsOf(rounds, 73)[1], { defined: false, label: "2B", team: "B2" });
});

test("a fully simulated group fills a third-place slot (greyed) with its 3rd team", () => {
  const groupB = [
    { id: "s1", group: "B", home: "B1", away: "B2" },
    { id: "s2", group: "B", home: "B3", away: "B4" },
    { id: "s3", group: "B", home: "B1", away: "B3" },
    { id: "s4", group: "B", home: "B2", away: "B4" },
    { id: "s5", group: "B", home: "B1", away: "B4" },
    { id: "s6", group: "B", home: "B2", away: "B3" },
  ];
  // B1 wins all, B2 second, B3 third, B4 last.
  const sims = [
    { matchId: "s1", homeGoals: 1, awayGoals: 0 },
    { matchId: "s2", homeGoals: 1, awayGoals: 0 },
    { matchId: "s3", homeGoals: 1, awayGoals: 0 },
    { matchId: "s4", homeGoals: 1, awayGoals: 0 },
    { matchId: "s5", homeGoals: 1, awayGoals: 0 },
    { matchId: "s6", homeGoals: 1, awayGoals: 0 },
  ];
  const rounds = buildBracket(groupB, [], sims);
  // Match 74's third slot allows groups A/B/C/D/F; only B is complete -> gets B3.
  assert.deepEqual(slotsOf(rounds, 74)[1], { defined: false, label: "3rd A/B/C/D/F", team: "B3" });
});

test("third-place slots stay empty when no group is complete", () => {
  const rounds = buildBracket(groupA.map((m) => ({ ...m, result: undefined })), []);
  assert.deepEqual(slotsOf(rounds, 74)[1], { defined: false, label: "3rd A/B/C/D/F", team: undefined });
});

test("admin results count toward group completion", () => {
  // Same as groupA but the last match has no fixture result; supply it via admin.
  const noLast = groupA.slice(0, 5).concat([{ id: "a6", group: "A", home: "T2", away: "T3" }]);
  const incomplete = buildBracket([...noLast, ...groupB], []);
  assert.equal(slotsOf(incomplete, 79)[0].defined, false); // 5/6 played
  const complete = buildBracket([...noLast, ...groupB], [{ matchId: "a6", homeGoals: 1, awayGoals: 0 }]);
  assert.equal(slotsOf(complete, 79)[0].defined, true); // 6/6 with admin result
});
