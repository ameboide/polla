# Polla — World Cup Prediction SPA

**Date:** 2026-06-23
**Status:** Approved design

## Purpose

Single-page web app for a group of friends to predict World Cup match
scores and compete on a leaderboard. Proof of concept: data security and
scalability are explicitly out of scope. No backend is written; data is
stored via the reqres.in collections REST API.

## Scope

- Friends predict the exact final score of each match.
- Points are awarded per match using a configurable scoring formula.
- An admin enters actual match results and tunes scoring weights.
- A leaderboard ranks players by total points.

Out of scope (POC): authentication security, authorization beyond a shared
secret, scalability, rate-limit hardening beyond simple backoff, mobile-app
packaging.

## Stack

- Vanilla HTML / CSS / JavaScript. No build step, no framework.
- Deployable as static files on any static host.
- Persistence via reqres.in collections REST API.

### reqres.in API

- Base URL: `https://reqres.in/api`
- Auth header: `x-api-key: <PROJECT_KEY>` on every request.
- Also send `X-Reqres-Env: prod` and `Content-Type: application/json`.
- Endpoints used:
  - `GET    /collections/{c}/records`        — list
  - `POST   /collections/{c}/records`        — create (body `{"data":{...}}`)
  - `GET    /collections/{c}/records/{id}`   — read one
  - `PUT    /collections/{c}/records/{id}`   — update
  - `DELETE /collections/{c}/records/{id}`   — delete

**Known limitation (accepted for POC):** the API key ships in client-side
JS and is therefore publicly visible. Acceptable because security is out of
scope.

## Identity & Roles

- **Player identity:** name only. Chosen on first visit, persisted in
  `localStorage`. No password.
- **Admin:** unlocked by entering a hardcoded secret code in the app. No
  separate account; admin is a UI state, not a stored role.

## Data Model

| Store | Location | Record shape |
|---|---|---|
| Fixtures (schedule) | local `fixtures.json` seed | `{id, group, home, away, kickoff}` |
| Predictions | reqres `predictions` collection | `{player, matchId, homeGoals, awayGoals}` |
| Results | reqres `results` collection | `{matchId, homeGoals, awayGoals}` |
| Scoring config | reqres `config` collection (single record) | `{winner, exactScore, goalDiff, totalGoals, eachTeamGoals}` |

- Fixtures are static (the World Cup schedule) and ship as a seed JSON file;
  they are not stored in reqres.
- `kickoff` is an ISO 8601 timestamp.
- One prediction record per (player, matchId). Updating a prediction updates
  the existing record.
- One result record per matchId, created/updated by the admin.
- Scoring config is a single record. If none exists on first load, the app
  seeds it with default weights.

## Scoring

`scoring.js` exposes a pure function `score(prediction, result, config)`
returning a point total for one match. Each component contributes its
configured weight when its condition holds:

- `winner` — predicted outcome (home win / draw / away win) matches actual.
- `exactScore` — predicted score equals actual score exactly.
- `goalDiff` — predicted goal difference (home − away) matches actual.
- `totalGoals` — predicted sum (home + away) matches actual.
- `eachTeamGoals` — awarded per team whose goal count was predicted exactly
  (so 0, 1, or 2 × the weight).

Components are independent and additive; an exact-score prediction naturally
also satisfies winner / goalDiff / totalGoals / eachTeamGoals and accrues all
their weights. All weights are admin-configurable and may be zero.

The leaderboard is computed entirely client-side: for each player, sum
`score()` over all matches that have a result.

## Views

Single page; tab/route switching in JS. No full page reloads.

1. **Predict** — lists fixtures grouped by stage. Each match shows the
   player's current prediction and inputs for home/away goals. A match is
   **locked** (read-only) once `now >= kickoff`. Saving writes to the
   `predictions` collection (create or update).
2. **Leaderboard** — players ranked by total points, descending.
3. **Admin** (secret-gated) — enter/edit actual results per match; edit the
   scoring config weights.

## Locking

Each match locks at its `kickoff` time, checked against the client clock.
Trust-based (POC): no server enforcement.

## Components / Files

- `index.html` — app shell, tab containers.
- `styles.css` — styling.
- `api.js` — thin reqres CRUD wrapper (key header, env, JSON, error mapping).
- `store.js` — load and cache fixtures, predictions, results, config.
- `scoring.js` — pure scoring function.
- `views/predict.js` — predict view render + save.
- `views/leaderboard.js` — leaderboard compute + render.
- `views/admin.js` — results entry + config editor (secret-gated).
- `app.js` — bootstrap, identity, admin unlock, routing/tabs.
- `fixtures.json` — World Cup schedule seed.

## Error Handling

- reqres request failures surface an inline message with a retry action.
- On HTTP 429 (rate limit), apply simple exponential backoff before retry.
- Saves are confirmed (not optimistic): UI reflects success only after the
  request resolves.

## Testing

- `scoring.js` is pure and gets unit tests (Node's built-in `node:test`, no
  extra framework). Cover: exact score, correct outcome only, goal-diff-only,
  total-goals match, each-team-goals partial credit, zero weights.
- UI verified manually.

## Configuration

A single config constants section (in `app.js` or a small `config.js`) holds:
the reqres base URL, project API key, env value, and the admin secret code.
