# Stage Grouping & Filtering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the Predict / Admin / Played match lists into "Group stage" and "Knockout stage" collapsibles (only the current one expanded), and add a stage filter to the partial leaderboard.

**Architecture:** A shared pure module `views/stages.js` classifies a match's stage and partitions fixtures into stages with a "current" flag. `batch-grid.js` and `played.js` wrap their existing day-groups in `<details.stage>`; `collapse-all` is broadened to toggle stages too. `leaderboard.js`'s `partialStandings` gains a stage filter, surfaced as a `<select>`.

**Tech Stack:** Vanilla ES modules, `node:test` + `node:assert/strict`, no build step.

## Global Constraints

- No new runtime dependencies; vanilla ES modules.
- Tests use `node:test` / `node:assert/strict`, beside the module.
- A match's stage: `round ? "knockout" : "group"` (works for raw fixtures and `matchIndex` entries, where group entries are `{round:null}`).
- Stage order is always Group stage, then Knockout stage. Exactly one present stage is `current`: first with a match `kickoff > now`, else the last present stage.
- Stage labels: `"Group stage"`, `"Knockout stage"`. Stage keys: `"group"`, `"knockout"`.
- Partial-leaderboard filter values: `"all"` (default, no filtering), `"group"`, `"knockout"`. Full (top) leaderboard is NOT filtered.
- Commit subject imperative ≤50 chars, no Co-Authored-By / Generated-with trailer.
- Full suite: `node --test` from repo root.

---

### Task 1: Shared stage module

**Files:**
- Create: `views/stages.js`
- Test: `views/stages.test.js`

**Interfaces:**
- Produces:
  - `STAGES: [{key:"group",label:"Group stage"},{key:"knockout",label:"Knockout stage"}]`
  - `stageOf(m) -> "group" | "knockout"` — `"knockout"` iff `m && m.round` is truthy.
  - `groupByStage(fixtures, now) -> [{key, label, fixtures, current}]` — non-empty stages in STAGES order; fixture order preserved; exactly one `current:true`.

- [ ] **Step 1: Write the failing tests**

Create `views/stages.test.js`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { stageOf, groupByStage } from "./stages.js";

test("stageOf classifies by round presence", () => {
  assert.equal(stageOf({ round: "Round of 16" }), "knockout");
  assert.equal(stageOf({ group: "A" }), "group");
  assert.equal(stageOf({ round: null }), "group"); // matchIndex group entry
  assert.equal(stageOf(undefined), "group");
});

const G = (id, ko) => ({ id, kickoff: ko, group: "A" });          // group fixture
const K = (id, ko) => ({ id, kickoff: ko, round: "Round of 32" }); // knockout fixture

test("groupByStage partitions in order, preserving fixture order", () => {
  const fx = [G("m1", "2026-06-11T19:00:00Z"), K("m73", "2026-06-28T19:00:00Z"), G("m2", "2026-06-12T19:00:00Z")];
  const out = groupByStage(fx, Date.parse("2026-06-01T00:00:00Z"));
  assert.deepEqual(out.map((s) => s.key), ["group", "knockout"]);
  assert.deepEqual(out[0].fixtures.map((f) => f.id), ["m1", "m2"]);
  assert.deepEqual(out[1].fixtures.map((f) => f.id), ["m73"]);
});

test("groupByStage: group is current when it has an upcoming match", () => {
  const fx = [G("m1", "2026-06-11T19:00:00Z"), K("m73", "2026-06-28T19:00:00Z")];
  const out = groupByStage(fx, Date.parse("2026-06-10T00:00:00Z")); // before group match
  assert.equal(out.find((s) => s.key === "group").current, true);
  assert.equal(out.find((s) => s.key === "knockout").current, false);
});

test("groupByStage: knockout is current when group is all past but knockout upcoming", () => {
  const fx = [G("m1", "2026-06-11T19:00:00Z"), K("m73", "2026-06-28T19:00:00Z")];
  const out = groupByStage(fx, Date.parse("2026-06-20T00:00:00Z")); // group done, ko upcoming
  assert.equal(out.find((s) => s.key === "knockout").current, true);
  assert.equal(out.find((s) => s.key === "group").current, false);
});

test("groupByStage: all past -> last present stage is current", () => {
  const fx = [G("m1", "2026-06-11T19:00:00Z"), K("m73", "2026-06-28T19:00:00Z")];
  const out = groupByStage(fx, Date.parse("2026-07-30T00:00:00Z"));
  assert.equal(out.find((s) => s.key === "knockout").current, true);
});

test("groupByStage: single stage present is current; empty -> []", () => {
  const only = groupByStage([G("m1", "2026-06-11T19:00:00Z")], Date.parse("2026-07-30T00:00:00Z"));
  assert.deepEqual(only.map((s) => s.key), ["group"]);
  assert.equal(only[0].current, true);
  assert.deepEqual(groupByStage([], Date.now()), []);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test views/stages.test.js`
Expected: FAIL — `stages.js` not found.

- [ ] **Step 3: Implement `views/stages.js`**

```javascript
// Stage classification + partitioning shared by the match lists (Predict,
// Admin, Played) and the partial leaderboard's stage filter.

export const STAGES = [
  { key: "group", label: "Group stage" },
  { key: "knockout", label: "Knockout stage" },
];

// A match's (or matchIndex entry's) stage. Knockout fixtures/entries carry a
// truthy `round`; group ones do not.
export function stageOf(m) {
  return m && m.round ? "knockout" : "group";
}

// Partition fixtures into the non-empty stages (STAGES order), preserving each
// stage's fixture order. Exactly one returned stage is current: the first with
// an upcoming match (kickoff > now), else the last present stage.
export function groupByStage(fixtures, now) {
  const buckets = new Map(STAGES.map((s) => [s.key, []]));
  for (const fx of fixtures) buckets.get(stageOf(fx)).push(fx);
  const present = STAGES
    .filter((s) => buckets.get(s.key).length)
    .map((s) => ({ key: s.key, label: s.label, fixtures: buckets.get(s.key) }));
  let currentKey = null;
  for (const s of present) {
    if (s.fixtures.some((fx) => Date.parse(fx.kickoff) > now)) { currentKey = s.key; break; }
  }
  if (currentKey === null && present.length) currentKey = present[present.length - 1].key;
  return present.map((s) => ({ ...s, current: s.key === currentKey }));
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test views/stages.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add views/stages.js views/stages.test.js
git commit -m "Add shared stage grouping module"
```

---

### Task 2: Stage groups in the batch grid (Predict + Admin)

**Files:**
- Modify: `views/batch-grid.js` (import + wrap the day loop)
- Modify: `views/collapse-all.js` (selector)
- Modify: `styles.css` (stage summary styling)

**Interfaces:**
- Consumes: `groupByStage(fixtures, now)` from Task 1.

- [ ] **Step 1: Import the helper**

At the top of `views/batch-grid.js`, add to the imports:

```javascript
import { groupByStage } from "./stages.js";
```

- [ ] **Step 2: Wrap the day loop in stage sections**

The current code (around line 85) starts the day loop:

```javascript
  groupFixturesByDay(opts.fixtures).forEach((day) => {
```

Replace that single line with the stage loop opening + the day loop opening:

```javascript
  groupByStage(opts.fixtures, Date.now()).forEach((stage) => {
    const stageEl = document.createElement("details");
    stageEl.className = "stage";
    stageEl.open = stage.current;
    stageEl.appendChild(Object.assign(document.createElement("summary"), { textContent: stage.label }));
    groupFixturesByDay(stage.fixtures).forEach((day) => {
```

Then find where that day loop currently closes (the lines that read):

```javascript
    root.appendChild(details);
  });
```

Replace those two lines with (append the day into the stage, close the day loop, append the stage to root, close the stage loop):

```javascript
    stageEl.appendChild(details);
    });
    root.appendChild(stageEl);
  });
```

Everything between (the `day.fixtures.forEach((fx) => { … })` body that builds cards and pushes `entries`) is unchanged. Indentation need not be perfect, but braces must balance.

- [ ] **Step 3: Broaden collapse-all to include stages**

In `views/collapse-all.js`, change the `groups()` selector:

```javascript
  const groups = () => [...container.querySelectorAll("details.stage, details.day")];
```

(The rest of the file — click handler, `sync`, capture listener — is unchanged.)

- [ ] **Step 4: Style the stage summary**

In `styles.css`, add (near the existing `details.day` / `summary` rules):

```css
details.stage > summary { font-weight: 700; font-size: 1.05rem; margin: .5rem 0; }
```

- [ ] **Step 5: Verify the suite + lint the braces**

Run: `node --test`
Expected: PASS (no unit test covers batch-grid directly; this confirms the module still parses/imports across the suite).
Run: `node -e "import('./views/batch-grid.js').then(()=>console.log('ok'))"`
Expected: `ok` (module parses; balanced braces).

- [ ] **Step 6: Manual verification**

Serve the app, open Predict and Admin. Confirm: two collapsible sections "Group stage" and "Knockout stage"; only the current stage open (today: Knockout); day groups nest inside; entering scores + Save still works; "Expand all" / "Collapse all" toggles stages and days together.

- [ ] **Step 7: Commit**

```bash
git add views/batch-grid.js views/collapse-all.js styles.css
git commit -m "Group batch grid matches by stage"
```

---

### Task 3: Stage groups in the Played tab

**Files:**
- Modify: `views/played.js` (import + wrap the day loop)

**Interfaces:**
- Consumes: `groupByStage(fixtures, now)` from Task 1.

- [ ] **Step 1: Import the helper**

Add to the imports in `views/played.js`:

```javascript
import { groupByStage } from "./stages.js";
```

- [ ] **Step 2: Wrap the day loop in stage sections**

The current code starts the day loop with:

```javascript
  groupFixturesByDay(past).forEach((day) => {
```

Replace that single line with:

```javascript
  groupByStage(past, Date.now()).forEach((stage) => {
    const stageEl = document.createElement("details");
    stageEl.className = "stage";
    stageEl.open = stage.current;
    stageEl.appendChild(Object.assign(document.createElement("summary"), { textContent: stage.label }));
    groupFixturesByDay(stage.fixtures).forEach((day) => {
```

Then find where that day loop currently closes:

```javascript
    root.appendChild(details);
  });
```

Replace with:

```javascript
    stageEl.appendChild(details);
    });
    root.appendChild(stageEl);
  });
```

The match-card building inside (`day.fixtures.forEach((fx) => { … })`) is unchanged, and the final `collapseAll.sync();` stays after the loop.

- [ ] **Step 3: Verify the suite + parse**

Run: `node --test`
Expected: PASS (existing played.test.js for `pastFixtures`/`predictionRows` still passes; they are unaffected).
Run: `node -e "import('./views/played.js').then(()=>console.log('ok'))"`
Expected: `ok`.

- [ ] **Step 4: Manual verification**

Open the Played tab. Confirm: matches grouped into "Group stage" / "Knockout stage" collapsibles; the latest stage with results starts open; day groups + prediction tables render inside; Expand/Collapse all works.

- [ ] **Step 5: Commit**

```bash
git add views/played.js
git commit -m "Group played matches by stage"
```

---

### Task 4: Partial-leaderboard stage filter

**Files:**
- Modify: `views/leaderboard.js` (`partialStandings` + `renderLeaderboard`)
- Test: `views/leaderboard.test.js`

**Interfaces:**
- Consumes: `stageOf(m)` from Task 1.
- Produces: `partialStandings(predictions, results, config, selectedPlayers, index, stage="all")` — when `stage` is `"group"`/`"knockout"`, the eligible match set is filtered to that stage via `index`; `"all"` is unfiltered (unchanged behavior).

- [ ] **Step 1: Write the failing tests**

Add to `views/leaderboard.test.js` (ensure `partialStandings` is imported — it already is in that file's import list):

```javascript
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
  assert.deepEqual(grp.find((r) => r.player === "Ana"), { player: "Ana", points: 18 });

  // default (5-arg) stays unfiltered
  assert.equal(partialStandings(predictions, results, cfg, players, index).matchCount, 2);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test views/leaderboard.test.js`
Expected: FAIL — `partialStandings` ignores the 6th arg, so the `"group"`/`"knockout"` matchCounts are both 2.

- [ ] **Step 3: Implement the filter**

In `views/leaderboard.js`, add `stageOf` to the `knockout.js` import line:

```javascript
import { advancerOf, predictedAdvancer, resolveKnockout } from "./knockout.js";
import { stageOf } from "./stages.js";
```

Replace `partialStandings` with:

```javascript
export function partialStandings(predictions, results, config, selectedPlayers, index, stage = "all") {
  let eligible = eligibleMatchIds(predictions, selectedPlayers);
  if (stage !== "all") {
    eligible = new Set([...eligible].filter((id) => {
      const info = index && index.get(id);
      return info ? stageOf(info) === stage : false;
    }));
  }
  const selected = new Set(selectedPlayers);
  const subset = predictions.filter((p) => selected.has(p.player) && eligible.has(p.matchId));
  return { standings: computeStandings(subset, results, config, index), matchCount: eligible.size };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test views/leaderboard.test.js`
Expected: PASS (all leaderboard tests).

- [ ] **Step 5: Add the stage `<select>` to the UI**

In `renderLeaderboard` (the partial-leaderboard section), add a stage selector and
thread it through `renderPartial`. After the `note` paragraph is appended and
before the `picker` is built, add:

```javascript
  let stage = "all";
  const stagePicker = document.createElement("div");
  stagePicker.className = "stage-picker";
  const stageSelect = document.createElement("select");
  [["all", "All stages"], ["group", "Group stage"], ["knockout", "Knockout stage"]]
    .forEach(([value, label]) => {
      stageSelect.appendChild(Object.assign(document.createElement("option"), { value, textContent: label }));
    });
  stageSelect.addEventListener("change", () => { stage = stageSelect.value; renderPartial(); });
  stagePicker.append("Stage: ", stageSelect);
  section.appendChild(stagePicker);
```

Then update `renderPartial` to pass `stage` and reflect it in the note:

```javascript
  function renderPartial() {
    const chosen = players.filter((p) => selected.has(p));
    const { standings, matchCount } = partialStandings(predictions, eff, config, chosen, index, stage);
    const where = stage === "group" ? " Group-stage" : stage === "knockout" ? " Knockout-stage" : "";
    note.textContent = chosen.length
      ? `Scoring ${chosen.length} player(s) over ${matchCount}${where} match(es) all of them predicted.`
      : "Select at least one player.";
    tableHolder.innerHTML = "";
    tableHolder.appendChild(standingsTable(standings, "No common matches yet."));
  }
```

(The full top-leaderboard `computeStandings` call near the start of
`renderLeaderboard` is NOT changed.)

- [ ] **Step 6: Verify suite + manual check**

Run: `node --test`
Expected: PASS.
Manual: open Leaderboard; in the partial section, switch the Stage select between
All / Group stage / Knockout stage and confirm the standings + the note's match
count change accordingly, and the player checkboxes still re-filter.

- [ ] **Step 7: Commit**

```bash
git add views/leaderboard.js views/leaderboard.test.js
git commit -m "Filter partial leaderboard by stage"
```

---

## Self-review notes

- **Spec coverage:** shared module (T1), batch-grid + collapse-all (T2), played (T3), partial-leaderboard filter + UI (T4). All spec sections map to a task.
- **Type consistency:** `groupByStage(fixtures, now)` and `stageOf(m)` signatures identical across T1–T4; `{key,label,fixtures,current}` shape consumed in T2/T3; `partialStandings(..., index, stage="all")` matches T4 usage and the spec.
- **No placeholders:** stages.js and the leaderboard changes are full code; batch-grid/played changes are precise surgical edits against quoted current lines (their large unchanged bodies are intentionally not reproduced — the edits are anchored to exact existing lines, not "similar to" references).
- **Final:** after T4, run `node --test` and manually click through Predict → Admin → Played → Leaderboard.
