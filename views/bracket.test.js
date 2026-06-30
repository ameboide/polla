import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveKnockout, koDisplayOrder } from "./knockout.js";

const fx = [
  { id: "m73", round: "Round of 32", kickoff: "2026-06-28T19:00:00Z", home: "South Africa", away: "Canada" },
  { id: "m75", round: "Round of 32", kickoff: "2026-06-29T20:30:00Z", home: "Germany", away: "Paraguay" },
  { id: "m95", round: "Round of 16", kickoff: "2026-07-02T22:00:00Z" },
];

test("R32 cards carry the hardcoded real teams", () => {
  const m73 = resolveKnockout(fx, []).find((m) => m.id === "m73");
  assert.deepEqual([m73.home, m73.away], ["South Africa", "Canada"]);
});

test("a played match exposes its winner for highlighting", () => {
  const r = [{ matchId: "m73", homeGoals: 2, awayGoals: 0 }];
  assert.equal(resolveKnockout(fx, r).find((m) => m.id === "m73").winner, "South Africa");
});

test("displayOrder covers every round and ends at the Final", () => {
  const order = koDisplayOrder();
  assert.equal(order["Round of 32"].length, 16);
  assert.deepEqual(order["Final"], [104]);
});
