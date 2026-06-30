import { test } from "node:test";
import assert from "node:assert/strict";
import { advancerOf, predictedAdvancer, resolveKnockout, koDisplayOrder } from "./knockout.js";

test("advancerOf picks the higher score, ignoring any advancer field", () => {
  assert.equal(advancerOf({ homeGoals: 2, awayGoals: 1, advancer: "B" }, "A", "B"), "A");
  assert.equal(advancerOf({ homeGoals: 0, awayGoals: 3 }, "A", "B"), "B");
});

test("advancerOf uses the explicit advancer on a draw", () => {
  assert.equal(advancerOf({ homeGoals: 1, awayGoals: 1, advancer: "B" }, "A", "B"), "B");
  assert.equal(advancerOf({ homeGoals: 1, awayGoals: 1 }, "A", "B"), null); // unset
  assert.equal(advancerOf(null, "A", "B"), null);
});

test("predictedAdvancer mirrors advancerOf for a prediction", () => {
  assert.equal(predictedAdvancer({ homeGoals: 2, awayGoals: 0 }, "A", "B"), "A");
  assert.equal(predictedAdvancer({ homeGoals: 0, awayGoals: 0, advancer: "B" }, "A", "B"), "B");
  assert.equal(predictedAdvancer(null, "A", "B"), null);
});

const fx = [
  { id: "m73", round: "Round of 32", kickoff: "2026-06-28T19:00:00Z", home: "SA", away: "CA" },
  { id: "m75", round: "Round of 32", kickoff: "2026-06-29T20:30:00Z", home: "DE", away: "PY" },
  { id: "m95", round: "Round of 16", kickoff: "2026-07-02T22:00:00Z" },
];

test("resolveKnockout reads R32 teams straight from fixtures", () => {
  const m73 = resolveKnockout(fx, []).find((m) => m.id === "m73");
  assert.equal(m73.home, "SA");
  assert.equal(m73.away, "CA");
  assert.equal(m73.defined, true);
});

test("resolveKnockout leaves a later match undefined until both feeders resolve", () => {
  const m95 = resolveKnockout(fx, []).find((m) => m.id === "m95");
  assert.equal(m95.home, null);
  assert.equal(m95.defined, false);
  assert.equal(m95.homeLabel, "Winner 73");
  assert.equal(m95.awayLabel, "Winner 75");
});

test("resolveKnockout propagates winners into the next round", () => {
  const results = [
    { matchId: "m73", homeGoals: 1, awayGoals: 0 },          // SA through
    { matchId: "m75", homeGoals: 1, awayGoals: 1, advancer: "PY" }, // PY through on pens
  ];
  const m95 = resolveKnockout(fx, results).find((m) => m.id === "m95");
  assert.equal(m95.home, "SA");
  assert.equal(m95.away, "PY");
  assert.equal(m95.defined, true);
});

test("resolveKnockout overlays a fixture's baked result when no admin entry", () => {
  const baked = fx.map((m) => m.id === "m73" ? { ...m, result: { homeGoals: 2, awayGoals: 0 } } : m);
  const m73 = resolveKnockout(baked, []).find((m) => m.id === "m73");
  assert.equal(m73.winner, "SA");
});

test("koDisplayOrder pairs each adjacent R32 along the real bracket tree", () => {
  const order = koDisplayOrder();
  assert.deepEqual(order["Round of 16"].length, 8);
  assert.deepEqual(order["Final"], [104]);
});
