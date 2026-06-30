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
  assert.deepEqual(order["Round of 32"], [76,77,79,80,81,82,83,84,85,86,87,88,73,75,74,78]);
  assert.deepEqual(order["Round of 16"], [89,90,91,92,93,94,95,96]);
  assert.deepEqual(order["Quarter-finals"], [97,98,99,100]);
  assert.deepEqual(order["Semi-finals"], [101,102]);
  assert.deepEqual(order["Final"], [104]);
});

test("resolveKnockout end-to-end: all home wins propagate through the full bracket", () => {
  // Build all 32 KO fixtures; R32 have team names, later rounds just round+kickoff.
  const allFixtures = [
    ...[ 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88 ].map((n) => ({
      id: `m${n}`, round: "Round of 32", kickoff: "2026-06-28T19:00:00Z",
      home: `H${n}`, away: `A${n}`,
    })),
    ...[ 89, 90, 91, 92, 93, 94, 95, 96 ].map((n) => ({
      id: `m${n}`, round: "Round of 16", kickoff: "2026-07-02T22:00:00Z",
    })),
    ...[ 97, 98, 99, 100 ].map((n) => ({
      id: `m${n}`, round: "Quarter-finals", kickoff: "2026-07-05T22:00:00Z",
    })),
    ...[ 101, 102 ].map((n) => ({
      id: `m${n}`, round: "Semi-finals", kickoff: "2026-07-09T22:00:00Z",
    })),
    { id: "m103", round: "Third place", kickoff: "2026-07-13T19:00:00Z" },
    { id: "m104", round: "Final", kickoff: "2026-07-13T22:00:00Z" },
  ];
  // Every match is a decisive 1-0 home win.
  const allResults = [ 73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,
                       89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104 ]
    .map((n) => ({ matchId: `m${n}`, homeGoals: 1, awayGoals: 0 }));

  const resolved = resolveKnockout(allFixtures, allResults);
  const byId = new Map(resolved.map((m) => [m.id, m]));

  const m101 = byId.get("m101");
  const m102 = byId.get("m102");
  const m103 = byId.get("m103");
  const m104 = byId.get("m104");

  assert.equal(m104.defined, true);
  assert.equal(m104.winner, m104.home);

  // Third-place match is fed by the losers of the two semi-finals.
  assert.equal(m103.home, m101.loser);
  assert.equal(m103.away, m102.loser);

  // For every resolved match, home wins so loser === away and winner === home.
  for (const m of resolved) {
    if (m.defined && m.result) {
      assert.equal(m.winner, m.home, `expected home to win m${m.match}`);
      assert.equal(m.loser, m.away, `expected away to lose m${m.match}`);
    }
  }
});

test("resolveKnockout admin entry overrides a fixture's baked result", () => {
  const fixture = {
    id: "m73", round: "Round of 32", kickoff: "2026-06-28T19:00:00Z",
    home: "HomeTeam", away: "AwayTeam",
    result: { homeGoals: 0, awayGoals: 1 }, // baked: away wins
  };
  const adminResults = [
    { matchId: "m73", homeGoals: 2, awayGoals: 0 }, // admin: home wins
  ];
  const m73 = resolveKnockout([fixture], adminResults).find((m) => m.id === "m73");
  assert.equal(m73.winner, "HomeTeam");
});
