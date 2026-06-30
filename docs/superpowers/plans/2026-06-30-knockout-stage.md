# Knockout Stage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the World Cup knockout matches first-class fixtures that players can predict and the admin can score, with draw-advancer entry and automatic winner propagation through the bracket.

**Architecture:** Knockout matches (73–104) become entries in `fixtures.json` with a `round` field instead of `group`. A new pure module `views/knockout.js` owns the bracket feed tree and resolves each match's teams from the Round-of-32 fixtures plus prior-round winners. Round of 32 teams are hardcoded (real 2026 teams); later rounds resolve from results. A drawn knockout result carries an `advancer`; predictions earn the existing score points plus a configurable `advance` bonus for naming the team that goes through.

**Tech Stack:** Vanilla ES modules, `node:test` + `node:assert/strict` for tests, no build step. Browser app served statically; Supabase for storage.

## Global Constraints

- No new runtime dependencies; vanilla ES modules only.
- Tests use `node:test` and `node:assert/strict`, one `*.test.js` beside each module.
- `group` is absent on knockout fixtures; `round` is present. Group fixtures are unchanged (`group` present, no `round`).
- A knockout `result` / prediction may carry `advancer` (a team name string); group ones never do.
- `advancer` is only meaningful when `homeGoals === awayGoals`; on a decisive score the advancer is the higher-scoring team.
- Knockout `round` values, in order: `"Round of 32"`, `"Round of 16"`, `"Quarter-finals"`, `"Semi-finals"`, `"Third place"`, `"Final"`.
- Commit style: imperative subject ≤50 chars, no Co-Authored-By/Generated-with trailer.
- Run the full suite with `node --test` from the repo root.

---

## Reference data (used by Task 2 and Task 3)

**Round of 32 — real 2026 teams.** Match numbers 73–80 are confirmed; 81–88 teams
are confirmed but their exact number/date assignment must be **verified against
the Wikipedia bracket** (`2026_FIFA_World_Cup_knockout_stage`) during Task 2 and
corrected if wrong. Times are best-effort UTC; verify and adjust.

| id | home | away | kickoff (UTC) |
|----|------|------|---------------|
| m73 | South Africa | Canada | 2026-06-28T19:00:00Z |
| m74 | Brazil | Japan | 2026-06-29T17:00:00Z |
| m75 | Germany | Paraguay | 2026-06-29T20:30:00Z |
| m76 | Netherlands | Morocco | 2026-06-30T01:00:00Z |
| m77 | France | Sweden | 2026-06-30T21:00:00Z |
| m78 | Ivory Coast | Norway | 2026-06-30T17:00:00Z |
| m79 | Mexico | Ecuador | 2026-07-01T01:00:00Z |
| m80 | England | DR Congo | 2026-07-01T16:00:00Z |
| m81 | United States | Bosnia and Herzegovina | 2026-06-30T19:00:00Z |
| m82 | Belgium | Senegal | 2026-06-30T23:00:00Z |
| m83 | Portugal | Croatia | 2026-06-29T23:00:00Z |
| m84 | Spain | Austria | 2026-07-01T19:00:00Z |
| m85 | Switzerland | Algeria | 2026-06-28T23:00:00Z |
| m86 | Colombia | Ghana | 2026-07-01T23:00:00Z |
| m87 | Argentina | Cape Verde | 2026-06-29T01:00:00Z |
| m88 | Australia | Egypt | 2026-06-30T05:00:00Z |

**Feed tree (reliable).** Each later match's two slots are filled by the WINNERS
of two earlier matches (the third-place match m103 by the LOSERS of m101/m102):

```
R16:  89←[76,77]  90←[79,80]  91←[81,82]  92←[83,84]
      93←[85,86]  94←[87,88]  95←[73,75]  96←[74,78]
QF:   97←[89,90]  98←[91,92]  99←[93,94]  100←[95,96]
SF:   101←[97,98]  102←[99,100]
3rd:  103←losers[101,102]
Final:104←[101,102]
```

Best-effort later-round kickoffs (verify): R16 Jul 2–6, QF Jul 9–10, SF Jul 14–15,
3rd Jul 18, Final Jul 19. Use 18:00:00Z as a default time where unknown.

---

### Task 1: Carry `advancer` through the store

**Files:**
- Modify: `store.js` (`flattenPredictions`, `mergeMatches`)
- Test: `store.test.js`

**Interfaces:**
- Produces: `flattenPredictions(records)` rows now include `advancer` when the stored match has one; `mergeMatches(existing, edits)` preserves `advancer` on each merged match.

- [ ] **Step 1: Write failing tests**

Add to `store.test.js`:

```javascript
test("flattenPredictions carries advancer when present", () => {
  const records = [{ id: "p1", player: "Ana", matches: [
    { matchId: "m73", homeGoals: 1, awayGoals: 1, advancer: "Canada" },
    { matchId: "m1", homeGoals: 2, awayGoals: 0 },
  ] }];
  assert.deepEqual(flattenPredictions(records), [
    { player: "Ana", matchId: "m73", homeGoals: 1, awayGoals: 1, advancer: "Canada" },
    { player: "Ana", matchId: "m1", homeGoals: 2, awayGoals: 0, advancer: undefined },
  ]);
});

test("mergeMatches preserves advancer on edits", () => {
  const merged = mergeMatches(
    [{ matchId: "m73", homeGoals: 0, awayGoals: 0, advancer: "South Africa" }],
    [{ matchId: "m73", homeGoals: 1, awayGoals: 1, advancer: "Canada" }],
  );
  assert.deepEqual(merged, [{ matchId: "m73", homeGoals: 1, awayGoals: 1, advancer: "Canada" }]);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test store.test.js`
Expected: FAIL — new keys missing (`advancer` undefined not present / dropped).

- [ ] **Step 3: Implement**

In `store.js`, update `flattenPredictions` to include `advancer`:

```javascript
export function flattenPredictions(records) {
  return records.flatMap((r) =>
    (r.matches || []).map((m) => ({
      player: r.player,
      matchId: m.matchId,
      homeGoals: m.homeGoals,
      awayGoals: m.awayGoals,
      advancer: m.advancer,
    }))
  );
}
```

Update `mergeMatches` to keep `advancer`:

```javascript
export function mergeMatches(existing, edits) {
  const byId = new Map((existing || []).map((m) => [m.matchId, { ...m }]));
  for (const e of edits) {
    const m = { matchId: e.matchId, homeGoals: e.homeGoals, awayGoals: e.awayGoals };
    if (e.advancer != null) m.advancer = e.advancer;
    byId.set(e.matchId, m);
  }
  return [...byId.values()];
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test store.test.js`
Expected: PASS (all store tests).

- [ ] **Step 5: Commit**

```bash
git add store.js store.test.js
git commit -m "Carry advancer through prediction store"
```

---

### Task 2: Add knockout matches to fixtures.json

**Files:**
- Modify: `fixtures.json` (append entries m73–m104)

**Interfaces:**
- Produces: 32 new fixture objects. R32 (m73–m88) have `round`, `kickoff`, `home`, `away`. R16→Final (m89–m104) have `round`, `kickoff` only (no `home`/`away`). None have `group`.

- [ ] **Step 1: Verify the R32 data against Wikipedia**

Open `https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage`. Confirm the
match-number → team pairings for m73–m88 and their dates/times against the table in
this plan's Reference data. Correct any mismatches before writing. (Teams are real;
the 81–88 numbering/dates are the parts most likely to need fixing.)

- [ ] **Step 2: Append R32 fixtures**

Append to the `fixtures.json` array (before the closing `]`). Example shape; fill all
16 from the verified Reference-data table:

```json
  { "id": "m73", "round": "Round of 32", "kickoff": "2026-06-28T19:00:00Z", "home": "South Africa", "away": "Canada" },
  { "id": "m74", "round": "Round of 32", "kickoff": "2026-06-29T17:00:00Z", "home": "Brazil", "away": "Japan" },
  { "id": "m75", "round": "Round of 32", "kickoff": "2026-06-29T20:30:00Z", "home": "Germany", "away": "Paraguay" },
  { "id": "m76", "round": "Round of 32", "kickoff": "2026-06-30T01:00:00Z", "home": "Netherlands", "away": "Morocco" },
  { "id": "m77", "round": "Round of 32", "kickoff": "2026-06-30T21:00:00Z", "home": "France", "away": "Sweden" },
  { "id": "m78", "round": "Round of 32", "kickoff": "2026-06-30T17:00:00Z", "home": "Ivory Coast", "away": "Norway" },
  { "id": "m79", "round": "Round of 32", "kickoff": "2026-07-01T01:00:00Z", "home": "Mexico", "away": "Ecuador" },
  { "id": "m80", "round": "Round of 32", "kickoff": "2026-07-01T16:00:00Z", "home": "England", "away": "DR Congo" },
  { "id": "m81", "round": "Round of 32", "kickoff": "2026-06-30T19:00:00Z", "home": "United States", "away": "Bosnia and Herzegovina" },
  { "id": "m82", "round": "Round of 32", "kickoff": "2026-06-30T23:00:00Z", "home": "Belgium", "away": "Senegal" },
  { "id": "m83", "round": "Round of 32", "kickoff": "2026-06-29T23:00:00Z", "home": "Portugal", "away": "Croatia" },
  { "id": "m84", "round": "Round of 32", "kickoff": "2026-07-01T19:00:00Z", "home": "Spain", "away": "Austria" },
  { "id": "m85", "round": "Round of 32", "kickoff": "2026-06-28T23:00:00Z", "home": "Switzerland", "away": "Algeria" },
  { "id": "m86", "round": "Round of 32", "kickoff": "2026-07-01T23:00:00Z", "home": "Colombia", "away": "Ghana" },
  { "id": "m87", "round": "Round of 32", "kickoff": "2026-06-29T01:00:00Z", "home": "Argentina", "away": "Cape Verde" },
  { "id": "m88", "round": "Round of 32", "kickoff": "2026-06-30T05:00:00Z", "home": "Australia", "away": "Egypt" },
```

- [ ] **Step 3: Append R16→Final fixtures (no teams)**

```json
  { "id": "m89", "round": "Round of 16", "kickoff": "2026-07-04T17:00:00Z" },
  { "id": "m90", "round": "Round of 16", "kickoff": "2026-07-02T18:00:00Z" },
  { "id": "m91", "round": "Round of 16", "kickoff": "2026-07-05T18:00:00Z" },
  { "id": "m92", "round": "Round of 16", "kickoff": "2026-07-06T18:00:00Z" },
  { "id": "m93", "round": "Round of 16", "kickoff": "2026-07-03T18:00:00Z" },
  { "id": "m94", "round": "Round of 16", "kickoff": "2026-07-03T22:00:00Z" },
  { "id": "m95", "round": "Round of 16", "kickoff": "2026-07-02T22:00:00Z" },
  { "id": "m96", "round": "Round of 16", "kickoff": "2026-07-04T21:00:00Z" },
  { "id": "m97", "round": "Quarter-finals", "kickoff": "2026-07-09T18:00:00Z" },
  { "id": "m98", "round": "Quarter-finals", "kickoff": "2026-07-10T18:00:00Z" },
  { "id": "m99", "round": "Quarter-finals", "kickoff": "2026-07-07T18:00:00Z" },
  { "id": "m100", "round": "Quarter-finals", "kickoff": "2026-07-07T22:00:00Z" },
  { "id": "m101", "round": "Semi-finals", "kickoff": "2026-07-14T18:00:00Z" },
  { "id": "m102", "round": "Semi-finals", "kickoff": "2026-07-15T18:00:00Z" },
  { "id": "m103", "round": "Third place", "kickoff": "2026-07-18T18:00:00Z" },
  { "id": "m104", "round": "Final", "kickoff": "2026-07-19T18:00:00Z" }
```

- [ ] **Step 4: Validate JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('fixtures.json','utf8')); console.log('ok')"`
Expected: `ok`.

- [ ] **Step 5: Commit**

```bash
git add fixtures.json
git commit -m "Add knockout matches to fixtures"
```

---

### Task 3: `knockout.js` — feed tree, advancer logic, resolution

**Files:**
- Create: `views/knockout.js`
- Test: `views/knockout.test.js`

**Interfaces:**
- Consumes: fixtures (group + knockout) and the admin results array `[{matchId, homeGoals, awayGoals, advancer?}]`.
- Produces:
  - `KO_ROUNDS: string[]` — round names in order.
  - `KO_TREE: { match:number, round:string, feeds:[number,number]|null, losers?:boolean }[]`.
  - `advancerOf(result, home, away) -> string|null` — team that goes through.
  - `predictedAdvancer(prediction, home, away) -> string|null` — a prediction's implied pick.
  - `resolveKnockout(fixtures, results) -> ResolvedMatch[]` where `ResolvedMatch = { id, match, round, kickoff, home, away, homeLabel, awayLabel, defined:boolean, result, winner, loser }`. `home`/`away` are team names or `null`; `homeLabel`/`awayLabel` are display strings ("Winner 76"); `defined` is true once both teams are known.
  - `koDisplayOrder() -> { [round:string]: number[] }` — top-to-bottom match order per round.

- [ ] **Step 1: Write failing tests**

Create `views/knockout.test.js`:

```javascript
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
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test views/knockout.test.js`
Expected: FAIL — `knockout.js` not found.

- [ ] **Step 3: Implement `knockout.js`**

Create `views/knockout.js`:

```javascript
// The knockout bracket: feed tree, team resolution, and advancer logic.
// Pure module — no DOM, no storage. The Knockout/Predict/Played/Leaderboard
// views all read resolved matchups from here.

export const KO_ROUNDS = [
  "Round of 32", "Round of 16", "Quarter-finals", "Semi-finals", "Third place", "Final",
];

// Each node: the match number, its round, and the two feeder matches whose
// WINNERS fill its [home, away] slots (null for Round of 32 — teams come from
// fixtures.json). The third-place match (103) is fed by the LOSERS of 101/102.
const R32 = [73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88];
export const KO_TREE = [
  ...R32.map((match) => ({ match, round: "Round of 32", feeds: null })),
  { match: 89, round: "Round of 16", feeds: [76, 77] },
  { match: 90, round: "Round of 16", feeds: [79, 80] },
  { match: 91, round: "Round of 16", feeds: [81, 82] },
  { match: 92, round: "Round of 16", feeds: [83, 84] },
  { match: 93, round: "Round of 16", feeds: [85, 86] },
  { match: 94, round: "Round of 16", feeds: [87, 88] },
  { match: 95, round: "Round of 16", feeds: [73, 75] },
  { match: 96, round: "Round of 16", feeds: [74, 78] },
  { match: 97, round: "Quarter-finals", feeds: [89, 90] },
  { match: 98, round: "Quarter-finals", feeds: [91, 92] },
  { match: 99, round: "Quarter-finals", feeds: [93, 94] },
  { match: 100, round: "Quarter-finals", feeds: [95, 96] },
  { match: 101, round: "Semi-finals", feeds: [97, 98] },
  { match: 102, round: "Semi-finals", feeds: [99, 100] },
  { match: 103, round: "Third place", feeds: [101, 102], losers: true },
  { match: 104, round: "Final", feeds: [101, 102] },
];

// The team that goes through: higher score, or the explicit advancer on a draw.
export function advancerOf(result, home, away) {
  if (!result) return null;
  if (result.homeGoals > result.awayGoals) return home;
  if (result.homeGoals < result.awayGoals) return away;
  return result.advancer || null;
}

// The eliminated team (only meaningful once a result and both teams exist).
function loserOf(result, home, away) {
  const w = advancerOf(result, home, away);
  if (!w || !home || !away) return null;
  return w === home ? away : home;
}

// A prediction's implied pick — same rule as advancerOf.
export function predictedAdvancer(prediction, home, away) {
  if (!prediction) return null;
  if (prediction.homeGoals > prediction.awayGoals) return home;
  if (prediction.homeGoals < prediction.awayGoals) return away;
  return prediction.advancer || null;
}

// Effective result for a match id: admin entry, else the fixture's baked result.
function effectiveResultMap(fixtures, results) {
  const admin = new Map(results.map((r) => [r.matchId, r]));
  const out = new Map();
  for (const fx of fixtures) {
    const a = admin.get(fx.id);
    if (a) out.set(fx.id, a);
    else if (fx.result) out.set(fx.id, fx.result);
  }
  return out;
}

// Resolve every knockout match's teams from R32 fixtures + prior winners.
export function resolveKnockout(fixtures, results) {
  const fxById = new Map(fixtures.map((f) => [f.id, f]));
  const eff = effectiveResultMap(fixtures, results);
  const id = (n) => `m${n}`;
  const memo = new Map();

  function resolve(node) {
    if (memo.has(node.match)) return memo.get(node.match);
    const fx = fxById.get(id(node.match)) || {};
    const result = eff.get(id(node.match)) || null;
    let home, away, homeLabel, awayLabel;
    if (!node.feeds) {
      home = fx.home ?? null; away = fx.away ?? null;
      homeLabel = home; awayLabel = away;
    } else {
      const [hf, af] = node.feeds;
      const pick = (m) => node.losers ? feederLoser(m) : feederWinner(m);
      home = pick(hf); away = pick(af);
      const verb = node.losers ? "Loser" : "Winner";
      homeLabel = home || `${verb} ${hf}`;
      awayLabel = away || `${verb} ${af}`;
    }
    const winner = advancerOf(result, home, away);
    const loser = loserOf(result, home, away);
    const m = {
      id: id(node.match), match: node.match, round: node.round,
      kickoff: fx.kickoff || null, home, away, homeLabel, awayLabel,
      defined: home != null && away != null, result, winner, loser,
    };
    memo.set(node.match, m);
    return m;
  }
  const byMatch = new Map(KO_TREE.map((n) => [n.match, n]));
  function feederWinner(m) { return resolve(byMatch.get(m)).winner; }
  function feederLoser(m) { return resolve(byMatch.get(m)).loser; }

  return KO_TREE.map(resolve);
}

// Top-to-bottom display order per round: DFS the tree from the Final so each
// round lines up with its feeders (R32 numbering is out of tree order).
export function koDisplayOrder() {
  const byMatch = new Map(KO_TREE.map((n) => [n.match, n]));
  const leaves = (m) => {
    const node = byMatch.get(m);
    return node.feeds ? node.feeds.flatMap(leaves) : [m];
  };
  const r32order = leaves(104);
  const firstLeaf = (m) => r32order.indexOf(leaves(m)[0]);
  const out = {};
  for (const r of KO_ROUNDS) {
    out[r] = KO_TREE.filter((n) => n.round === r).map((n) => n.match)
      .sort((a, b) => firstLeaf(a) - firstLeaf(b));
  }
  return out;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test views/knockout.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add views/knockout.js views/knockout.test.js
git commit -m "Add knockout resolution module"
```

---

### Task 4: Rewrite the Knockout (bracket) view to use real teams

**Files:**
- Modify: `views/bracket.js` (replace group-slot resolution with `resolveKnockout`)
- Test: `views/bracket.test.js` (rewrite for the new model)

**Interfaces:**
- Consumes: `resolveKnockout`, `koDisplayOrder`, `KO_ROUNDS` from `knockout.js`; `flagFor`.
- Produces: `renderBracket(root, ctx)`. The old `buildBracket`/`displayOrder`/`BRACKET` exports are removed; nothing else imports them after this task.

- [ ] **Step 1: Rewrite the test**

Replace `views/bracket.test.js` with:

```javascript
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
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test views/bracket.test.js`
Expected: FAIL — old `buildBracket` import gone / new assertions unmet until Step 3 lands the module. (If the import line still references `./bracket.js`, this test will error; that is the failing state.)

- [ ] **Step 3: Rewrite `bracket.js`**

Replace `views/bracket.js` with:

```javascript
import { resolveKnockout, koDisplayOrder, KO_ROUNDS } from "./knockout.js";
import { flagFor } from "./flags.js";

function teamSpan(label, team, isWinner) {
  const el = document.createElement("div");
  el.className = "bk-slot" + (team ? "" : " undefined") + (isWinner ? " winner" : "");
  el.textContent = team ? `${flagFor(team)} ${team}`.trim() : label;
  return el;
}

function matchCard(m) {
  const card = document.createElement("div");
  card.className = "bk-match";
  const head = document.createElement("span");
  head.className = "bk-num";
  head.textContent = m.result
    ? `Match ${m.match} · ${m.result.homeGoals}-${m.result.awayGoals}`
    : `Match ${m.match}`;
  card.appendChild(head);
  card.appendChild(teamSpan(m.homeLabel, m.home, m.winner && m.winner === m.home));
  card.appendChild(teamSpan(m.awayLabel, m.away, m.winner && m.winner === m.away));
  return card;
}

export function renderBracket(root, ctx) {
  const { fixtures, results } = ctx.data;
  const resolved = resolveKnockout(fixtures, results);
  const byNo = new Map(resolved.map((m) => [m.match, m]));
  const order = koDisplayOrder();

  const wrap = document.createElement("div");
  wrap.className = "bracket";
  for (const round of KO_ROUNDS) {
    if (round === "Third place") continue; // rendered separately below
    const col = document.createElement("div");
    col.className = "bk-round";
    col.appendChild(Object.assign(document.createElement("h2"), { textContent: round }));
    const body = document.createElement("div");
    body.className = "bk-body";
    order[round].forEach((no) => body.appendChild(matchCard(byNo.get(no))));
    col.appendChild(body);
    wrap.appendChild(col);
  }
  root.appendChild(wrap);

  const third = byNo.get(103);
  if (third) {
    const tp = document.createElement("div");
    tp.className = "bk-thirdplace";
    tp.appendChild(Object.assign(document.createElement("h2"), { textContent: "Third place" }));
    tp.appendChild(matchCard(third));
    root.appendChild(tp);
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test views/bracket.test.js`
Expected: PASS.

- [ ] **Step 5: Add a winner-highlight style**

In `styles.css`, add near the existing `.bk-slot` rules:

```css
.bk-slot.winner { font-weight: 700; }
```

- [ ] **Step 6: Commit**

```bash
git add views/bracket.js views/bracket.test.js styles.css
git commit -m "Render knockout bracket from real results"
```

---

### Task 5: Add the `advance` scoring weight

**Files:**
- Modify: `store.js` (`DEFAULT_CONFIG`)
- Modify: `views/admin.js` (`WEIGHTS`)
- Test: `store.test.js`

**Interfaces:**
- Produces: `DEFAULT_CONFIG.advance` (number) available to scoring; admin weights form edits `advance`.

- [ ] **Step 1: Write failing test**

Add to `store.test.js`:

```javascript
test("DEFAULT_CONFIG includes an advance bonus", () => {
  assert.equal(typeof DEFAULT_CONFIG.advance, "number");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test store.test.js`
Expected: FAIL — `advance` undefined.

- [ ] **Step 3: Implement**

In `store.js`:

```javascript
export const DEFAULT_CONFIG = {
  winner: 3, exactScore: 10, goalDiff: 2, totalGoals: 1, eachTeamGoals: 1, advance: 5,
};
```

In `views/admin.js`:

```javascript
const WEIGHTS = ["winner", "exactScore", "goalDiff", "totalGoals", "eachTeamGoals", "advance"];
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test store.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add store.js views/admin.js
git commit -m "Add advance bonus scoring weight"
```

---

### Task 6: Score the advancer bonus in the leaderboard

**Files:**
- Modify: `views/leaderboard.js` (`computeStandings`, `pointsByMatch`, `renderLeaderboard`, `partialStandings`)
- Test: `views/leaderboard.test.js`

**Interfaces:**
- Consumes: `advancerOf`, `predictedAdvancer`, `resolveKnockout` from `knockout.js`.
- Produces:
  - `matchIndex(fixtures, results) -> Map(matchId -> { round, home, away })` (round is `null` for group matches).
  - `computeStandings(predictions, results, config, index)` — `index` optional; when given, knockout predictions earn `config.advance` for a correct advancer.
  - `pointsByMatch(fixtures, predictions, results, config, player)` — unchanged signature; now adds the bonus for knockout matches internally.

- [ ] **Step 1: Write failing tests**

Add to `views/leaderboard.test.js` (import `matchIndex` alongside the existing imports):

```javascript
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
  const predictions = [{ player: "Ana", matchId: "m1", homeGoals: 1, awayGoals: 0 }];
  const results = [{ matchId: "m1", homeGoals: 1, awayGoals: 0 }];
  assert.equal(computeStandings(predictions, results, cfg, index)[0].points, 5); // winner 3 + goalDiff 2
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test views/leaderboard.test.js`
Expected: FAIL — `matchIndex` not exported / `computeStandings` ignores the 4th arg.

- [ ] **Step 3: Implement**

In `views/leaderboard.js`, add the import and helpers, and thread `index` through:

```javascript
import { score } from "../scoring.js";
import { advancerOf, predictedAdvancer, resolveKnockout } from "./knockout.js";

// matchId -> { round, home, away }. Knockout teams come resolved; group rounds
// are null so the advancer bonus is skipped for them.
export function matchIndex(fixtures, results) {
  const idx = new Map();
  for (const fx of fixtures) {
    if (fx.group != null) idx.set(fx.id, { round: null, home: fx.home, away: fx.away });
  }
  for (const k of resolveKnockout(fixtures, results)) {
    idx.set(k.id, { round: k.round, home: k.home, away: k.away });
  }
  return idx;
}

function bonus(prediction, result, info, config) {
  if (!info || !info.round) return 0;
  const actual = advancerOf(result, info.home, info.away);
  const pick = predictedAdvancer(prediction, info.home, info.away);
  return actual && pick && actual === pick ? (config.advance || 0) : 0;
}
```

Update `computeStandings` to accept and use `index`:

```javascript
export function computeStandings(predictions, results, config, index) {
  const resultByMatch = new Map(results.map((r) => [r.matchId, r]));
  const totals = new Map();
  for (const p of predictions) {
    const r = resultByMatch.get(p.matchId);
    let pts = r ? score(p, r, config) : 0;
    if (r && index) pts += bonus(p, r, index.get(p.matchId), config);
    totals.set(p.player, (totals.get(p.player) || 0) + pts);
  }
  return [...totals.entries()]
    .map(([player, points]) => ({ player, points }))
    .sort((a, b) => b.points - a.points || a.player.localeCompare(b.player));
}
```

Update `pointsByMatch` to add the bonus (it already iterates fixtures):

```javascript
export function pointsByMatch(fixtures, predictions, results, config, player) {
  const eff = new Map(effectiveResults(fixtures, results).map((r) => [r.matchId, r]));
  const resolved = new Map(resolveKnockout(fixtures, results).map((k) => [k.id, k]));
  const out = new Map();
  for (const fx of fixtures) {
    const r = eff.get(fx.id);
    const p = predictions.find((x) => x.player === player && x.matchId === fx.id);
    if (!r || !p) continue;
    let pts = score(p, r, config);
    const k = resolved.get(fx.id);
    if (k && k.round) pts += bonus(p, r, { round: k.round, home: k.home, away: k.away }, config);
    out.set(fx.id, pts);
  }
  return out;
}
```

Update `partialStandings` and `renderLeaderboard` to pass an index. In `partialStandings`, add an `index` parameter forwarded to `computeStandings`:

```javascript
export function partialStandings(predictions, results, config, selectedPlayers, index) {
  const eligible = eligibleMatchIds(predictions, selectedPlayers);
  const selected = new Set(selectedPlayers);
  const subset = predictions.filter((p) => selected.has(p.player) && eligible.has(p.matchId));
  return { standings: computeStandings(subset, results, config, index), matchCount: eligible.size };
}
```

In `renderLeaderboard`, build the index once and pass it through both call sites:

```javascript
export function renderLeaderboard(root, ctx) {
  const { fixtures, predictions, results, config } = ctx.data;
  const eff = effectiveResults(fixtures, results);
  const index = matchIndex(fixtures, results);

  root.appendChild(standingsTable(computeStandings(predictions, eff, config, index), "No standings yet."));
  // ...unchanged until renderPartial:
  function renderPartial() {
    const chosen = players.filter((p) => selected.has(p));
    const { standings, matchCount } = partialStandings(predictions, eff, config, chosen, index);
    // ...rest unchanged
  }
  // ...
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test views/leaderboard.test.js`
Expected: PASS (existing tests still pass — they call `computeStandings` with 3 args, `index` is `undefined`, bonus skipped).

- [ ] **Step 5: Commit**

```bash
git add views/leaderboard.js views/leaderboard.test.js
git commit -m "Award advancer bonus in standings"
```

---

### Task 7: Show knockout matches and advancer in the Played view

**Files:**
- Modify: `views/played.js` (`predictionRows`, `renderPlayed`)
- Test: `views/played.test.js`

**Interfaces:**
- Consumes: `resolveKnockout`, `advancerOf`, `predictedAdvancer` from `knockout.js`.
- Produces: `predictionRows(predictions, matchId, result, config, info)` — `info` optional `{ round, home, away }`; when a knockout match, scores include the advancer bonus and each row exposes `advancer` (the player's pick). `renderPlayed` lists knockout matches alongside group matches.

- [ ] **Step 1: Write failing test**

Add to `views/played.test.js`:

```javascript
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
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test views/played.test.js`
Expected: FAIL — `predictionRows` ignores `info`/no bonus, `advancer` undefined.

- [ ] **Step 3: Implement**

In `views/played.js`, import and extend `predictionRows`:

```javascript
import { score } from "../scoring.js";
import { effectiveResults } from "./leaderboard.js";
import { resolveKnockout, advancerOf, predictedAdvancer } from "./knockout.js";
import { groupFixturesByDay } from "./grouping.js";
import { flagFor } from "./flags.js";
import { makeCollapseAllControl } from "./collapse-all.js";

export function predictionRows(predictions, matchId, result, config, info) {
  return predictions
    .filter((p) => p.matchId === matchId)
    .map((p) => {
      let points = result ? score(p, result, config) : null;
      if (points !== null && info && info.round) {
        const a = advancerOf(result, info.home, info.away);
        const pick = predictedAdvancer(p, info.home, info.away);
        if (a && pick && a === pick) points += config.advance || 0;
      }
      return {
        player: p.player, homeGoals: p.homeGoals, awayGoals: p.awayGoals,
        advancer: p.advancer, points,
      };
    })
    .sort((a, b) => (b.points ?? -1) - (a.points ?? -1) || a.player.localeCompare(b.player));
}
```

In `renderPlayed`, fold resolved knockout matches into the list and pass `info`:

```javascript
export function renderPlayed(root, ctx) {
  const { fixtures, predictions, results, config } = ctx.data;
  const resolved = resolveKnockout(fixtures, results);
  const resolvedById = new Map(resolved.map((k) => [k.id, k]));
  // Group fixtures keep their own home/away; knockout fixtures take resolved teams.
  const allMatches = fixtures.map((fx) => {
    const k = resolvedById.get(fx.id);
    return k ? { ...fx, home: k.home, away: k.away, round: k.round } : fx;
  });
  const past = pastFixtures(allMatches, Date.now());
  if (!past.length) {
    root.appendChild(document.createTextNode("No matches have kicked off yet."));
    return;
  }
  const resultByMatch = new Map(effectiveResults(fixtures, results).map((r) => [r.matchId, r]));
  // ...existing collapse/toolbar unchanged...

  groupFixturesByDay(past).forEach((day) => {
    // ...existing details/summary unchanged...
    day.fixtures.forEach((fx) => {
      const result = resultByMatch.get(fx.id) || null;
      const k = resolvedById.get(fx.id);
      const info = k && k.round ? { round: k.round, home: k.home, away: k.away } : null;
      const card = document.createElement("div");
      card.className = "match";

      const head = document.createElement("div");
      head.className = "match-head";
      const tag = fx.group ? `[${fx.group}]` : `[${fx.round}]`;
      const homeName = fx.home || (k ? k.homeLabel : "?");
      const awayName = fx.away || (k ? k.awayLabel : "?");
      head.appendChild(Object.assign(document.createElement("span"), {
        textContent: `${tag} ${flagFor(homeName)} ${homeName} vs ${awayName} ${flagFor(awayName)}`,
      }));
      let scoreText = result ? `${result.homeGoals}-${result.awayGoals}` : "—";
      if (result && info) {
        const adv = advancerOf(result, info.home, info.away);
        if (result.homeGoals === result.awayGoals && adv) scoreText += ` (${adv} adv.)`;
      }
      head.appendChild(Object.assign(document.createElement("span"), {
        className: "match-time", textContent: scoreText,
      }));
      card.appendChild(head);

      const rows = predictionRows(predictions, fx.id, result, config, info);
      // ...existing table rendering unchanged (optionally show row.advancer)...
      details.appendChild(card);
    });
    root.appendChild(details);
  });
  collapseAll.sync();
}
```

Note: `pastFixtures` filters out knockout matches whose kickoff hasn't passed; matches with unresolved teams that have kicked off still render with their `Winner NN` labels (rare — only if a feeder is unscored past kickoff).

- [ ] **Step 4: Run to verify pass**

Run: `node --test views/played.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add views/played.js views/played.test.js
git commit -m "Show knockout matches and advancer in Played"
```

---

### Task 8: Add an extra-control hook to the batch grid

**Files:**
- Modify: `views/editing.js` (`isDirty`, `summarizeEdits`)
- Modify: `views/batch-grid.js` (render + collect the extra control)
- Test: `views/editing.test.js`

**Interfaces:**
- Produces:
  - `isDirty(baseline, homeStr, awayStr, extra)` — `extra` optional `{ value, baseline }`; dirty if the score changed OR `extra.value !== extra.baseline`.
  - `summarizeEdits(entries)` — each entry may carry `extra: { value, baseline }`; a saveable entry's `fields` gains `advancer: extra.value` when `extra.value` is truthy.
  - `renderBatchGrid` opts gain `extraControl(fx, api) -> { el, value(), baseline, reset() } | null` where `api = { homeInput, awayInput, recompute }`. When present and non-null, the control's element is appended to the card and its value flows into dirty-tracking and `saveAll`.

- [ ] **Step 1: Write failing tests**

Add to `views/editing.test.js`:

```javascript
test("isDirty flags a changed extra value even when the score is unchanged", () => {
  assert.equal(isDirty({ homeGoals: 1, awayGoals: 1 }, "1", "1", { value: "B", baseline: "A" }), true);
  assert.equal(isDirty({ homeGoals: 1, awayGoals: 1 }, "1", "1", { value: "A", baseline: "A" }), false);
});

test("summarizeEdits folds a truthy extra value into the saved fields as advancer", () => {
  const { saveable } = summarizeEdits([
    { key: "m73", baseline: { homeGoals: 0, awayGoals: 0 }, homeStr: "1", awayStr: "1",
      extra: { value: "Canada", baseline: "" } },
  ]);
  assert.deepEqual(saveable, [{ key: "m73", fields: { homeGoals: 1, awayGoals: 1, advancer: "Canada" } }]);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test views/editing.test.js`
Expected: FAIL — `extra` ignored.

- [ ] **Step 3: Implement editing.js**

```javascript
export function isDirty(baseline, homeStr, awayStr, extra) {
  const cur = parseScore(homeStr, awayStr);
  const extraDirty = extra ? extra.value !== extra.baseline : false;
  if (!cur) {
    if (!baseline) return extraDirty || homeStr !== "" || awayStr !== "";
    return true;
  }
  if (!baseline) return true;
  if (cur.homeGoals !== baseline.homeGoals || cur.awayGoals !== baseline.awayGoals) return true;
  return extraDirty;
}

export function summarizeEdits(entries) {
  const saveable = [];
  let dirtyCount = 0;
  let incompleteCount = 0;
  for (const e of entries) {
    if (!isDirty(e.baseline, e.homeStr, e.awayStr, e.extra)) continue;
    dirtyCount++;
    const fields = parseScore(e.homeStr, e.awayStr);
    if (fields) {
      if (e.extra && e.extra.value) fields.advancer = e.extra.value;
      saveable.push({ key: e.key, fields });
    } else incompleteCount++;
  }
  return { dirtyCount, incompleteCount, saveable };
}
```

- [ ] **Step 4: Implement batch-grid.js extra control**

In `renderBatchGrid`, after creating `home`/`away` inputs and appending the score row,
add the optional extra control and include it in the snapshot. Changes:

```javascript
// inside the day.fixtures.forEach, after `card.append(homeFlag, " ", home, " - ", away, " ", awayFlag);`
let extra = null;
if (opts.extraControl) {
  extra = opts.extraControl(fx, { homeInput: home, awayInput: away, recompute });
  if (extra && extra.el) card.appendChild(extra.el);
}
// change the entries.push to carry extra:
entries.push({ fx, baseline, home, away, card, extra });
```

Update `snapshot()` to include the extra value:

```javascript
const snapshot = () =>
  entries.map((e) => ({
    key: e.fx.id,
    baseline: e.baseline,
    homeStr: e.home.value,
    awayStr: e.away.value,
    extra: e.extra ? { value: e.extra.value(), baseline: e.extra.baseline } : undefined,
  }));
```

In `recompute()`, pass the extra into `isDirty` for the dirty highlight:

```javascript
for (const e of entries) {
  const ex = e.extra ? { value: e.extra.value(), baseline: e.extra.baseline } : undefined;
  e.card.classList.toggle("dirty", isDirty(e.baseline, e.home.value, e.away.value, ex));
}
```

In the live-lock `lockEntry`, reset the extra control too:

```javascript
function lockEntry(e) {
  e.home.value = e.baseline ? e.baseline.homeGoals : "";
  e.away.value = e.baseline ? e.baseline.awayGoals : "";
  e.home.disabled = e.away.disabled = true;
  if (e.extra && e.extra.reset) e.extra.reset();
  e.card.classList.add("locked");
  recompute();
  ctx.setStatus("A match kicked off — its inputs are now locked.");
}
```

- [ ] **Step 5: Run to verify pass**

Run: `node --test views/editing.test.js`
Expected: PASS. Also run `node --test` to confirm batch-grid consumers (predict/admin) still parse — no behavior change yet since no caller passes `extraControl`.

- [ ] **Step 6: Commit**

```bash
git add views/editing.js views/editing.test.js views/batch-grid.js
git commit -m "Add extra-control hook to batch grid"
```

---

### Task 9: Predict knockout matches with an advancer selector

**Files:**
- Modify: `views/predict.js`
- Modify: `styles.css` (advancer control styling — minimal)

**Interfaces:**
- Consumes: `resolveKnockout` from `knockout.js`; the `extraControl` hook from Task 8.
- Produces: the Predict grid lists group + knockout matches. Knockout fixtures render with resolved teams; a home/away advancer selector appears when the entered score is a draw; unresolved matches are locked with a "Winner NN" note.

- [ ] **Step 1: Build the combined fixture list**

In `renderPredict`, replace the use of `data.fixtures` with a combined list that swaps
resolved teams onto knockout fixtures:

```javascript
import { resolveKnockout, predictedAdvancer } from "./knockout.js";
// ...
const resolved = new Map(resolveKnockout(data.fixtures, data.results).map((k) => [k.id, k]));
const matches = data.fixtures.map((fx) => {
  const k = resolved.get(fx.id);
  return k ? { ...fx, home: k.home, away: k.away, homeLabel: k.homeLabel, awayLabel: k.awayLabel, round: k.round, resolved: k.defined } : fx;
});
```

- [ ] **Step 2: Wire the grid with the advancer control**

Pass `matches` as `fixtures`, and add `extraControl` + lock unresolved knockout matches:

```javascript
renderBatchGrid(root, ctx, {
  fixtures: matches,
  baselineFor: (fx) => scoresOf(findPrediction(data.predictions, player, fx.id)),
  lockedFor: (fx) =>
    (fx.round && !fx.resolved) ||           // teams not known yet
    (!ctx.adminUnlockPast && Date.now() >= Date.parse(fx.kickoff)),
  extraControl: (fx, api) => makeAdvancerControl(fx, api, findPrediction(data.predictions, player, fx.id)),
  saveAll: async (saveable) => { /* unchanged from current implementation */ },
  resultFor: (fx) => resultByMatch.get(fx.id) || null,
  pointsFor: (fx) => (pts.has(fx.id) ? pts.get(fx.id) : null),
  dayPoints: (fxs) => fxs.reduce((s, fx) => s + (pts.get(fx.id) || 0), 0),
  totalPoints: () => [...pts.values()].reduce((s, v) => s + v, 0),
});
```

- [ ] **Step 3: Implement the advancer control**

Add to `views/predict.js`:

```javascript
// A home/away advancer picker for knockout matches, shown only while the entered
// score is a level draw. Returns null for group matches (no control).
function makeAdvancerControl(fx, api, savedPrediction) {
  if (!fx.round) return null;                 // group match — no advancer
  const baseline = savedPrediction && savedPrediction.advancer ? savedPrediction.advancer : "";
  const wrap = document.createElement("div");
  wrap.className = "advancer";
  const select = document.createElement("select");
  select.innerHTML = `<option value="">— advances —</option>`;
  for (const team of [fx.home, fx.away]) {
    if (!team) continue;
    const opt = document.createElement("option");
    opt.value = team; opt.textContent = team;
    select.appendChild(opt);
  }
  select.value = baseline;
  wrap.appendChild(select);

  const sync = () => {
    const draw = api.homeInput.value !== "" && api.homeInput.value === api.awayInput.value;
    wrap.style.display = draw ? "" : "none";
    if (!draw) select.value = "";   // a decisive score has no manual advancer
    api.recompute();
  };
  api.homeInput.addEventListener("input", sync);
  api.awayInput.addEventListener("input", sync);
  select.addEventListener("change", api.recompute);
  sync();

  return {
    el: wrap,
    value: () => select.value,
    baseline,
    reset: () => { select.value = baseline; },
  };
}
```

- [ ] **Step 4: Style the control**

In `styles.css`:

```css
.advancer { margin-top: .35rem; }
.advancer select { font-size: .9rem; }
```

- [ ] **Step 5: Manual verification**

Run the app (`python3 -m http.server` or the project's usual static serve), open Predict.
Confirm: knockout matches appear with resolved teams; entering equal scores reveals the
advancer dropdown; saving persists it (reopen Predict and the pick is still there); a
match with unresolved teams shows locked with the "Winner NN" labels.

- [ ] **Step 6: Run the suite + commit**

Run: `node --test`
Expected: PASS (no test regressions).

```bash
git add views/predict.js styles.css
git commit -m "Predict knockout matches with advancer pick"
```

---

### Task 10: Enter knockout results with an advancer in Admin

**Files:**
- Modify: `views/admin.js` (`resultsSection`)

**Interfaces:**
- Consumes: `resolveKnockout` from `knockout.js`; the `extraControl` hook.
- Produces: the Admin results grid shows resolved knockout teams and an advancer selector for drawn knockout results; saving stores `advancer` on the result match.

- [ ] **Step 1: Resolve teams + reuse the advancer control**

In `views/admin.js`, update `resultsSection`:

```javascript
import { saveResults, saveConfig, mergeMatches, resultsMatches, cacheConfig } from "../store.js";
import { renderBatchGrid } from "./batch-grid.js";
import { resolveKnockout, advancerOf } from "./knockout.js";

function makeAdvancerControl(fx, api, savedResult) {
  if (!fx.round) return null;
  const baseline = savedResult && savedResult.advancer ? savedResult.advancer : "";
  const wrap = document.createElement("div");
  wrap.className = "advancer";
  const select = document.createElement("select");
  select.innerHTML = `<option value="">— advances —</option>`;
  for (const team of [fx.home, fx.away]) {
    if (!team) continue;
    const opt = document.createElement("option");
    opt.value = team; opt.textContent = team;
    select.appendChild(opt);
  }
  select.value = baseline;
  wrap.appendChild(select);
  const sync = () => {
    const draw = api.homeInput.value !== "" && api.homeInput.value === api.awayInput.value;
    wrap.style.display = draw ? "" : "none";
    if (!draw) select.value = "";
    api.recompute();
  };
  api.homeInput.addEventListener("input", sync);
  api.awayInput.addEventListener("input", sync);
  select.addEventListener("change", api.recompute);
  sync();
  return { el: wrap, value: () => select.value, baseline, reset: () => { select.value = baseline; } };
}

function resultsSection(root, ctx) {
  root.appendChild(Object.assign(document.createElement("h3"), { textContent: "Actual results" }));
  const adminResult = (fx) => ctx.data.results.find((r) => r.matchId === fx.id) || null;
  const resolved = new Map(resolveKnockout(ctx.data.fixtures, ctx.data.results).map((k) => [k.id, k]));
  const matches = ctx.data.fixtures.map((fx) => {
    const k = resolved.get(fx.id);
    return k ? { ...fx, home: k.home, away: k.away, round: k.round, resolved: k.defined } : fx;
  });
  renderBatchGrid(root, ctx, {
    fixtures: matches,
    baselineFor: (fx) => {
      const r = adminResult(fx);
      if (r) return { homeGoals: r.homeGoals, awayGoals: r.awayGoals };
      return fx.result ? { homeGoals: fx.result.homeGoals, awayGoals: fx.result.awayGoals } : null;
    },
    lockedFor: (fx) => Boolean(fx.round && !fx.resolved), // can't score teams that aren't set
    extraControl: (fx, api) => makeAdvancerControl(fx, api, adminResult(fx)),
    saveAll: async (saveable) => {
      const rec = ctx.data.resultsRecord || null;
      const edits = saveable.map((s) => ({ matchId: s.key, ...s.fields }));
      const saved = await saveResults(rec, mergeMatches(rec ? rec.matches : [], edits));
      ctx.data.resultsRecord = saved;
      ctx.data.results = resultsMatches(saved);
    },
  });
}
```

(The duplicated `makeAdvancerControl` between predict.js and admin.js is acceptable; if
preferred, extract it to `views/advancer-control.js` and import in both — optional, do
only if it reads cleaner.)

- [ ] **Step 2: Manual verification**

Open Admin (code `pollo`). Enter a drawn knockout result (e.g. m73 1-1) — the advancer
dropdown appears; pick a team; Save. Reopen Admin: the score and advancer persist. Open
Knockout: the next-round slot fed by m73 now shows the advancer. Enter a decisive result
elsewhere and confirm no advancer is required.

- [ ] **Step 3: Run the suite + commit**

Run: `node --test`
Expected: PASS.

```bash
git add views/admin.js
git commit -m "Enter knockout results with advancer in admin"
```

---

## Self-review notes

- **Spec coverage:** data model (T2, T1), `knockout.js` resolution + propagation (T3),
  bracket render + feed-tree correction (T4), predict + advancer UX (T8, T9), played (T7),
  admin results advancer (T10), scoring `advance` weight + bonus (T5, T6). All spec
  sections map to a task.
- **Type consistency:** `advancerOf`/`predictedAdvancer`/`resolveKnockout` signatures match
  across knockout.js, leaderboard.js, played.js. `extraControl` returns
  `{ el, value(), baseline, reset() }` consistently in T8/T9/T10. `matchIndex` values
  `{ round, home, away }` used identically in T6.
- **Data caveat:** R32 81–88 numbering/dates are best-effort and gated by the T2
  verification step against Wikipedia — real teams, ordering to confirm.
- **Final step:** after T10, run `node --test` (full suite) and do a manual click-through
  of Predict → Admin (enter results) → Knockout → Played → Leaderboard.
```
