# Knockout stage: real matches, predictions, results, propagation

Date: 2026-06-30

## Problem

The group stage is over and the knockout stage has started. Knockout matches
(73–104) currently exist only as a derived slot-spec in `views/bracket.js`; they
are not in `fixtures.json`, so the Predict, Played, and Admin views (which all
iterate `fixtures`) cannot see them. There is no way to predict a knockout
match, enter its result, or score it, and later rounds are never wired to real
results — the bracket shows static "Winner 73" labels.

We need to:

1. Add the real knockout matches to the fixture data.
2. Let players predict them (score, plus who advances when they predict a draw).
3. Let the admin enter actual results; on a draw the advancing team is recorded,
   and winners propagate to fill the next round's matchups.

## Decisions (settled with the user)

- **R32 teams are hardcoded** into `fixtures.json` (real 2026 teams from
  Wikipedia), with the real kickoff schedule. Later rounds resolve dynamically
  from results.
- **Prediction = score; advancer is picked only when the predicted score is a
  draw.** A decisive score implies its winner.
- **Scoring = existing score weights + a configurable `advance` bonus** for
  naming the team that actually advances.
- **Consistency caveat accepted:** hardcoded real R32 teams will not match this
  app's fictional group results. The Groups tab keeps showing group-derived
  standings; Knockout/Predict show the real hardcoded teams. They reconcile only
  if/when real group-final results are entered. This divergence is acceptable.

## Data model

Knockout matches are first-class entries in `fixtures.json`, distinguished by a
`round` field instead of `group`:

```json
{ "id": "m73", "round": "Round of 32", "kickoff": "2026-06-28T19:00:00Z",
  "home": "South Africa", "away": "Canada" }
```

- **R32 (m73–m88):** concrete `home`/`away` + real `kickoff`, hardcoded.
- **R16 → Final (m89–m104):** `home`/`away` omitted — resolved at runtime from
  prior winners. Each entry carries `id`, `round`, `kickoff` only.
- A knockout `result` is `{ homeGoals, awayGoals, advancer }` where `advancer` is
  a team name, **required only when `homeGoals === awayGoals`** (penalties); on a
  decisive score the advancer is the higher-scoring team and `advancer` is
  ignored/omitted.
- `group` is absent on knockout fixtures. `groupStandings` already skips
  `fx.group == null`, so group tables are unaffected.

`round` values, in order: `"Round of 32"`, `"Round of 16"`, `"Quarter-finals"`,
`"Semi-finals"`, `"Third place"`, `"Final"` — matching `bracket.js`.

### Results storage

The single results record stays `{ matches: [{ matchId, homeGoals, awayGoals,
advancer? }] }`. `store.js` `mergeMatches` and the flatten helpers must carry the
optional `advancer` field through unchanged.

### Prediction storage

A prediction row stays `{ matchId, homeGoals, awayGoals }` plus an optional
`advancer` (only meaningful on a drawn prediction). `flattenPredictions` and
`savePlayerPredictions`/`mergeMatches` carry `advancer` through.

## Resolution & propagation — new module `views/knockout.js`

Single source of truth for resolved knockout matchups. Pure functions, unit
tested in `views/knockout.test.js`.

- `winnerOf(result)` → team name, or `null` if no result. Draw → `result.advancer`;
  decisive → higher-scoring side. Validates that on a draw `advancer` is one of
  the two teams.
- `resolveKnockout(fixtures, results)` → array of resolved knockout matches in
  bracket order, each:
  ```
  { id, round, kickoff, home, away, result, winner, loser, homeDefined, awayDefined }
  ```
  - R32: `home`/`away` come straight from the fixture.
  - R16+: `home` = winner of the match feeding the home slot, `away` = winner of
    the match feeding the away slot, per the feed tree (below). Unresolved feeder
    → that side is `null` and `homeDefined`/`awayDefined` is `false`; a display
    label ("Winner M89") is derived by the renderer, not stored here.
  - `result` is the effective result (admin entry overriding any baked
    `fx.result`), via the existing `effectiveResults` overlay applied to KO ids.

### Feed tree

The feed tree lives in `bracket.js`'s `BRACKET` (matchWinner / matchLoser links).
It is **corrected to the real 2026 bracket** sourced from Wikipedia
(`2026_FIFA_World_Cup_knockout_stage`). R32 entries in `BRACKET` no longer carry
group slots (`r`/`w`/`third`); instead the R32 teams come from `fixtures.json`.
`resolveKnockout` reads R32 teams from fixtures and R16+ links from `BRACKET`.

Implementation note: verify the full real R32 pairings (m73–m88), the feed links
for m89–m104, and the kickoff dates/times against Wikipedia during
implementation; the values must be checked, not assumed.

## Views

### `bracket.js` (Knockout tab)
Render via `resolveKnockout` instead of `buildBracket`'s group-slot resolution.
R32 cards show the hardcoded real teams; a played match shows its score and
highlights the winner; later rounds fill in as winners propagate. Unresolved
slots keep the greyed "Winner M89" label. The group-simulation overlay (sims)
applies to the Groups tab only and no longer drives R32 here (R32 is real).
`buildBracket`'s third-place allocation and group-slot resolution become dead for
R32 and are removed or reduced to what `resolveKnockout` needs. Update
`bracket.test.js` accordingly.

### `predict.js` + `batch-grid.js`
Knockout matches appear in the Predict grid alongside group matches.
`batch-grid.js` gains one optional hook:

```
extraControl(fx, { homeInput, awayInput, getValue, setValue })
  → { el, value(), isDirty(), reset() } | null
```

For a knockout fixture the extra control is an **advancer selector** (a small
home/away choice) that is shown/enabled only while the entered score is a draw,
and is folded into the saved fields as `advancer`. The grid's dirty-tracking and
`saveAll` payload include `advancer` when present. Non-knockout fixtures return
`null` (no extra control) — group rendering is unchanged.

A knockout match whose teams are not yet resolved is rendered disabled with an
"awaiting Match NN / NN" note and cannot be predicted until its feeders have
results. Normal kickoff locking (`lockedFor`) still applies once teams exist.

### `played.js`
Works automatically once knockout matches are fixtures with results. Show the
advancer on drawn knockout results (e.g. "1-1 (Canada advance)").

### `admin.js` (Actual results)
The results grid reuses the same `extraControl` advancer selector so the admin
records who advanced on a drawn knockout result. Baseline prefill carries
`advancer` from the saved/baked result.

## Scoring

- New config weight `advance` added to `DEFAULT_CONFIG` in `store.js` and to the
  `WEIGHTS` list in `admin.js`'s weights form.
- A prediction's implied advance pick = predicted `advancer` if the prediction is
  a draw, else the predicted winning side. If it equals the match's actual
  advancer, award `config.advance` on top of the existing score-based points.
- The advancer bonus needs both the prediction's and the result's advancer, so it
  is computed where match context exists. Extend `scoring.js` `score()` to accept
  an optional knockout result carrying `advancer` and add the bonus, or add a
  dedicated `knockoutBonus(prediction, result, config)` used by
  `pointsByMatch`/`computeStandings`/`played` `predictionRows`. Group matches
  (no `advancer` in result) get no bonus — behaviour unchanged.

## Out of scope (YAGNI)

- No automatic fetching of live scores or schedule at runtime; data is committed
  to `fixtures.json`.
- No editing of the knockout bracket tree in the UI.
- No third-place-team allocation algorithm for R32 (teams are hardcoded), though
  the Third place *match* (m103) is included.

## Test plan

- `knockout.test.js`: `winnerOf` (decisive both directions, draw with advancer,
  draw missing/invalid advancer), `resolveKnockout` (R32 from fixtures, R16+
  propagation, unresolved feeders, effective-result overlay).
- `bracket.test.js`: updated for real-team R32 and corrected feed tree.
- `scoring.test.js`: advancer bonus awarded/not, group matches unaffected.
- `batch-grid` / `editing`: advancer included in dirty-tracking and save payload.
- `store.test.js`: `advancer` survives flatten/merge round-trips.
```
