# Stage grouping & filtering

Date: 2026-06-30

## Problem

The match lists (Predict, Admin) and the Played tab show a flat list of
day-groups spanning the whole tournament. As the knockout stage starts, the
group-stage matches are noise. We want each match list collapsed into two
stages — **Group stage** and **Knockout stage** — with only the current stage
expanded. The partial leaderboard should also let you score players over just
one stage's matches.

## Decisions (settled with the user)

- Two stages: **Group stage** (`fx.round` absent) and **Knockout stage**
  (`fx.round` present). A match's stage is `round ? knockout : group` — this
  works for raw fixtures (group fixtures lack `round`; knockout fixtures carry
  it) and for `matchIndex` entries (group entries are `{round:null,...}`).
- Collapsible stage groups in **Predict**, **Admin** (both via `batch-grid.js`)
  and **Played** (`played.js`). Only the current stage starts expanded.
- "Current" stage = the first stage (group, then knockout) that has a match with
  `kickoff > now`; if none is upcoming, the last present stage. (In Played, which
  only holds kicked-off matches, this resolves to the last stage with results —
  knockout once any knockout match has played.)
- The **partial** leaderboard gains a stage filter (All / Group / Knockout). The
  top (full) leaderboard is unchanged.

## Shared module: `views/stages.js`

```js
export const STAGES = [
  { key: "group", label: "Group stage" },
  { key: "knockout", label: "Knockout stage" },
];

// A match/index-entry's stage. Knockout fixtures and index entries carry a
// truthy `round`; group ones do not (group fixtures have `group`, index group
// entries have `round: null`).
export function stageOf(m) {
  return m && m.round ? "knockout" : "group";
}

// Partition fixtures into the non-empty stages in STAGES order, preserving each
// stage's fixture order. Exactly one returned stage has `current: true`: the
// first with an upcoming match (kickoff > now), else the last present stage.
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

Tested in `views/stages.test.js`.

## Collapsible stage groups

### `batch-grid.js` (Predict + Admin)
Today the renderer does `groupFixturesByDay(opts.fixtures).forEach(day => …)`
appending each `<details.day>` to `root`. Wrap that in a stage loop:

- `groupByStage(opts.fixtures, Date.now()).forEach(stage => …)`.
- For each stage create `<details class="stage">` with a `<summary>` of
  `stage.label`; set `details.open = stage.current`.
- Run the existing day loop over `stage.fixtures`, appending each `<details.day>`
  into the stage element (not `root`).
- Append the stage element to `root`.

Everything else is unchanged: `entries` are still collected across all stages (so
dirty-tracking, the single save bar, `totalPoints` banner, and the live-lock
timers all keep working), and per-day open/`isPast` logic is untouched.

### `played.js`
Same wrapping around the existing match-card day loop: replace
`groupFixturesByDay(past).forEach(day => …append to root)` with a
`groupByStage(past, Date.now())` outer loop creating `<details.stage>`
(`open = stage.current`), and append each day's `<details.day>` into the stage.
Card building, advancer display, and `predictionRows` are unchanged.

### `collapse-all.js`
Broaden the controlled set so the button toggles stages and days together:
change the selector from `"details.day"` to `"details.stage, details.day"` in
`groups()`. The expand/collapse logic and `sync()` are otherwise unchanged. This
covers all three tabs (shared control) and ensures "Expand all" reveals matches
even when a stage is collapsed.

## Partial-leaderboard stage filter

### `partialStandings` (`leaderboard.js`)
Add a `stage` parameter (default `"all"`). After computing the eligible match set
(matches predicted by every selected player), filter it by stage using the
`index`:

```js
import { stageOf } from "./stages.js";

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

`"all"` preserves today's behavior exactly (no filtering). The existing 5-arg
callers (none after this change; `renderLeaderboard` is updated below) still work
via the default.

### `renderLeaderboard` (`leaderboard.js`)
In the partial-leaderboard section, add a stage `<select>` next to the player
picker:

- Options: `All stages` (`all`), `Group stage` (`group`), `Knockout stage`
  (`knockout`); default `all`.
- A `let stage = "all"` closure variable; `change` handler sets it and calls
  `renderPartial()`.
- `renderPartial()` passes `stage` as the 6th arg to `partialStandings` and the
  note text reflects the filter, e.g.
  `Scoring N player(s) over M match(es) all of them predicted` for `all`, and
  `… over M Group-stage match(es) …` / `… Knockout-stage …` when filtered.

The full (top) leaderboard call is unchanged.

## Tests

- `views/stages.test.js`:
  - `stageOf`: `{round:"Round of 16"}` → `"knockout"`; `{group:"A"}` → `"group"`;
    `{round:null}` (index group entry) → `"group"`; `undefined` → `"group"`.
  - `groupByStage`: partitions into both stages in order, preserving fixture
    order; with a future group match → group is `current`; with all group matches
    past and a future knockout match → knockout is `current`; with all matches
    past → the last present stage is `current`; single-stage input → that stage
    is `current`; `[]` → `[]`. (`now` passed explicitly.)
- `views/leaderboard.test.js`:
  - `partialStandings` with `stage:"group"` keeps only group matches in the
    eligible set (correct `matchCount` and standings); `stage:"knockout"` keeps
    only knockout matches; `stage:"all"` (and the defaulted 5-arg form) is
    unchanged. Build the `index` map by hand:
    `new Map([["m1",{round:null,...}],["m73",{round:"Round of 32",...}]])`.

Rendering (the `<details.stage>` DOM in batch-grid/played and the `<select>`) is
not unit-tested — the project has no DOM harness; the pure helpers carry the
coverage.

## Out of scope (YAGNI)

- No stage filter on the full leaderboard.
- No persistence of the chosen stage/expanded state across reloads.
- No third stage or per-round (R16/QF/…) grouping — just group vs knockout.
