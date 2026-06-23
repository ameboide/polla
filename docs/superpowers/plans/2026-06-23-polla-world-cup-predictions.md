# Polla — World Cup Prediction SPA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a backend-free single-page app where friends predict World Cup match scores and compete on a leaderboard, persisting data via the reqres.in collections API.

**Architecture:** Vanilla ES-module JS, no build step. A thin `api.js` wraps the reqres REST collections endpoints; `store.js` loads and caches all data; `scoring.js` is a pure, unit-tested scoring function; three view modules render Predict / Leaderboard / Admin into a single HTML shell, switched by a tiny tab router in `app.js`.

**Tech Stack:** HTML, CSS, ES-module JavaScript (`<script type="module">`), reqres.in collections REST API, Node's built-in `node:test` for unit tests. No frameworks, no bundler, no npm dependencies.

## Global Constraints

- No build step. Files run directly in the browser as ES modules.
- No runtime dependencies; no framework. Node is used only to run tests.
- Persistence is reqres.in only. Base URL `https://reqres.in/api`. Every request sends headers `x-api-key: <PROJECT_KEY>`, `X-Reqres-Env: prod`, and (for POST/PUT) `Content-Type: application/json`.
- Collection record bodies are created as `{"data": {...fields}}`; a stored record reads back as `{id, data:{...fields}}` and must be normalized to `{id, ...fields}`.
- Security and scalability are out of scope (POC). The API key is allowed to be visible in client JS.
- Player identity is name-only, stored in `localStorage`. Admin is a UI state unlocked by a hardcoded secret code, never stored.
- Fixtures are a static local seed (`fixtures.json`), not stored in reqres. `kickoff` is an ISO 8601 string.
- A match locks (prediction read-only) when `Date.now() >= Date.parse(kickoff)`.
- Scoring components are independent and additive; weights are admin-configurable and may be zero.
- Commit messages: imperative mood, subject ≤ 50 chars, no AI/co-author trailer.

---

### Task 1: Project scaffold — shell, styles, config, fixtures seed

**Files:**
- Create: `polla/index.html`
- Create: `polla/styles.css`
- Create: `polla/config.js`
- Create: `polla/fixtures.json`
- Create: `polla/.gitignore`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `config.js` exports: `API_BASE` (string), `API_KEY` (string), `API_ENV` (string), `ADMIN_SECRET` (string), `COLLECTIONS` (`{predictions, results, config}` of collection-name strings).
  - `index.html` provides DOM anchors: `<nav>` with buttons `data-tab="predict|leaderboard|admin"`, and `<main id="view">`.
  - `fixtures.json` is an array of `{id, group, home, away, kickoff}`.

- [ ] **Step 1: Create `.gitignore`**

```
.DS_Store
node_modules/
*.log
```

- [ ] **Step 2: Create `config.js`**

```js
export const API_BASE = "https://reqres.in/api";
export const API_KEY = "REPLACE_WITH_PROJECT_KEY";
export const API_ENV = "prod";
export const ADMIN_SECRET = "goooal-2026";
export const COLLECTIONS = {
  predictions: "predictions",
  results: "results",
  config: "config",
};
```

- [ ] **Step 3: Create `fixtures.json`** (seed with a small but real set; ids are strings, kickoff is ISO 8601)

```json
[
  { "id": "m1", "group": "A", "home": "Qatar",   "away": "Ecuador",  "kickoff": "2026-06-11T16:00:00Z" },
  { "id": "m2", "group": "A", "home": "Senegal",  "away": "Netherlands", "kickoff": "2026-06-11T19:00:00Z" },
  { "id": "m3", "group": "B", "home": "England",  "away": "Iran",     "kickoff": "2026-06-12T16:00:00Z" },
  { "id": "m4", "group": "B", "home": "USA",       "away": "Wales",    "kickoff": "2026-06-12T19:00:00Z" }
]
```

- [ ] **Step 4: Create `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Polla — World Cup Predictions</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header>
    <h1>Polla</h1>
    <div id="identity"></div>
  </header>
  <nav>
    <button data-tab="predict">Predict</button>
    <button data-tab="leaderboard">Leaderboard</button>
    <button data-tab="admin">Admin</button>
  </nav>
  <main id="view"></main>
  <div id="status" role="status"></div>
  <script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 5: Create `styles.css`** (minimal, readable)

```css
* { box-sizing: border-box; }
body { font-family: system-ui, sans-serif; margin: 0; color: #1a1a1a; }
header { display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: #0a3d62; color: #fff; }
nav { display: flex; gap: .5rem; padding: .5rem 1rem; border-bottom: 1px solid #ddd; }
nav button { padding: .5rem 1rem; cursor: pointer; border: 1px solid #ccc; background: #f5f5f5; border-radius: 4px; }
nav button.active { background: #0a3d62; color: #fff; }
main { padding: 1rem; max-width: 720px; margin: 0 auto; }
.match { border: 1px solid #ddd; border-radius: 6px; padding: .75rem; margin-bottom: .5rem; }
.match.locked { opacity: .6; }
.match input { width: 3rem; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: .4rem; border-bottom: 1px solid #eee; }
#status { position: fixed; bottom: 1rem; right: 1rem; }
#status.error { color: #b00; }
.hidden { display: none; }
```

- [ ] **Step 6: Verify it loads**

Run: `cd polla && python3 -m http.server 8000` then open `http://localhost:8000`.
Expected: header "Polla", three nav buttons visible, no console errors. (`app.js` 404 is expected until Task 5 — note it and move on, or create an empty `app.js` placeholder.)

- [ ] **Step 7: Commit**

```bash
git add polla/index.html polla/styles.css polla/config.js polla/fixtures.json polla/.gitignore
git commit -m "Scaffold Polla shell, styles, config, fixtures"
```

---

### Task 2: Scoring function (TDD)

**Files:**
- Create: `polla/scoring.js`
- Test: `polla/scoring.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `export function score(prediction, result, config)` where `prediction`/`result` are `{homeGoals, awayGoals}` (numbers) and `config` is `{winner, exactScore, goalDiff, totalGoals, eachTeamGoals}` (numbers). Returns a number (total points for that match). `export function outcome({homeGoals, awayGoals})` returns `"home" | "draw" | "away"`.

- [ ] **Step 1: Write the failing tests**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { score, outcome } from "./scoring.js";

const W = { winner: 5, exactScore: 10, goalDiff: 3, totalGoals: 2, eachTeamGoals: 1 };

test("outcome classifies result", () => {
  assert.equal(outcome({ homeGoals: 2, awayGoals: 1 }), "home");
  assert.equal(outcome({ homeGoals: 1, awayGoals: 1 }), "draw");
  assert.equal(outcome({ homeGoals: 0, awayGoals: 3 }), "away");
});

test("exact score earns every component", () => {
  // 2-1 vs 2-1: winner+exact+goalDiff+totalGoals+both teams = 5+10+3+2+1+1
  assert.equal(score({ homeGoals: 2, awayGoals: 1 }, { homeGoals: 2, awayGoals: 1 }, W), 22);
});

test("correct outcome only", () => {
  // 3-0 vs 1-0: same winner(home), diff goalDiff(3 vs1), diff total(3 vs1),
  // away team goals match(0), home team 3 vs 1 no.
  assert.equal(score({ homeGoals: 3, awayGoals: 0 }, { homeGoals: 1, awayGoals: 0 }, W), 5 + 1);
});

test("goal difference without exact", () => {
  // 2-1 vs 3-2: winner home both, goalDiff 1==1, total 3 vs 5 no, teams no.
  assert.equal(score({ homeGoals: 2, awayGoals: 1 }, { homeGoals: 3, awayGoals: 2 }, W), 5 + 3);
});

test("total goals without exact or diff", () => {
  // 3-0 vs 0-3: winner home vs away no, goalDiff 3 vs -3 no, total 3==3 yes, teams no.
  assert.equal(score({ homeGoals: 3, awayGoals: 0 }, { homeGoals: 0, awayGoals: 3 }, W), 2);
});

test("each-team-goals gives partial credit", () => {
  // 2-0 vs 2-3: home goals 2==2 (yes), away 0 vs3 no, winner home vs away no,
  // diff 2 vs -1 no, total 2 vs5 no => only one team = 1.
  assert.equal(score({ homeGoals: 2, awayGoals: 0 }, { homeGoals: 2, awayGoals: 3 }, W), 1);
});

test("zero weights score zero", () => {
  const Z = { winner: 0, exactScore: 0, goalDiff: 0, totalGoals: 0, eachTeamGoals: 0 };
  assert.equal(score({ homeGoals: 1, awayGoals: 1 }, { homeGoals: 1, awayGoals: 1 }, Z), 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd polla && node --test scoring.test.js`
Expected: FAIL — `Cannot find module './scoring.js'` / `score is not a function`.

- [ ] **Step 3: Implement `scoring.js`**

```js
export function outcome({ homeGoals, awayGoals }) {
  if (homeGoals > awayGoals) return "home";
  if (homeGoals < awayGoals) return "away";
  return "draw";
}

export function score(prediction, result, config) {
  let pts = 0;
  if (outcome(prediction) === outcome(result)) pts += config.winner;
  if (prediction.homeGoals === result.homeGoals && prediction.awayGoals === result.awayGoals)
    pts += config.exactScore;
  if (prediction.homeGoals - prediction.awayGoals === result.homeGoals - result.awayGoals)
    pts += config.goalDiff;
  if (prediction.homeGoals + prediction.awayGoals === result.homeGoals + result.awayGoals)
    pts += config.totalGoals;
  if (prediction.homeGoals === result.homeGoals) pts += config.eachTeamGoals;
  if (prediction.awayGoals === result.awayGoals) pts += config.eachTeamGoals;
  return pts;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd polla && node --test scoring.test.js`
Expected: PASS — 7 tests passing.

- [ ] **Step 5: Commit**

```bash
git add polla/scoring.js polla/scoring.test.js
git commit -m "Add configurable match scoring function"
```

---

### Task 3: reqres API wrapper (TDD with fetch mock)

**Files:**
- Create: `polla/api.js`
- Test: `polla/api.test.js`

**Interfaces:**
- Consumes: `config.js` (`API_BASE`, `API_KEY`, `API_ENV`).
- Produces (all async, all normalize records to `{id, ...fields}`):
  - `list(collection)` → `Promise<Array<{id, ...}>>`
  - `create(collection, fields)` → `Promise<{id, ...}>`
  - `update(collection, id, fields)` → `Promise<{id, ...}>`
  - `remove(collection, id)` → `Promise<void>`
  - Helper `normalize(record)` → `{id, ...record.data}` (exported for testing).

- [ ] **Step 1: Write the failing tests** (inject a fake `fetch` via the global)

```js
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { list, create, normalize } from "./api.js";

function mockFetch(responder) {
  globalThis.fetch = async (url, opts = {}) => {
    const body = responder(url, opts);
    return { ok: true, status: 200, json: async () => body };
  };
}

test("normalize flattens data wrapper", () => {
  assert.deepEqual(normalize({ id: "x", data: { a: 1 } }), { id: "x", a: 1 });
});

test("list returns normalized array and sends api key", async () => {
  let seen;
  mockFetch((url, opts) => { seen = { url, opts }; return { data: [{ id: "1", data: { player: "Ana" } }] }; });
  const rows = await list("predictions");
  assert.deepEqual(rows, [{ id: "1", player: "Ana" }]);
  assert.match(seen.url, /\/collections\/predictions\/records$/);
  assert.ok(seen.opts.headers["x-api-key"]);
});

test("create posts {data:{...}} and returns normalized record", async () => {
  let sentBody;
  mockFetch((url, opts) => { sentBody = JSON.parse(opts.body); return { id: "9", data: sentBody.data }; });
  const rec = await create("results", { matchId: "m1", homeGoals: 2, awayGoals: 1 });
  assert.deepEqual(sentBody, { data: { matchId: "m1", homeGoals: 2, awayGoals: 1 } });
  assert.deepEqual(rec, { id: "9", matchId: "m1", homeGoals: 2, awayGoals: 1 });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd polla && node --test api.test.js`
Expected: FAIL — module/exports not found.

- [ ] **Step 3: Implement `api.js`**

```js
import { API_BASE, API_KEY, API_ENV } from "./config.js";

function headers(hasBody) {
  const h = { "x-api-key": API_KEY, "X-Reqres-Env": API_ENV };
  if (hasBody) h["Content-Type"] = "application/json";
  return h;
}

async function request(method, path, fields) {
  const opts = { method, headers: headers(Boolean(fields)) };
  if (fields) opts.body = JSON.stringify({ data: fields });
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) throw new Error(`reqres ${method} ${path} -> ${res.status}`);
  if (method === "DELETE") return undefined;
  return res.json();
}

export function normalize(record) {
  const { id, data } = record;
  return { id, ...(data ?? {}) };
}

export async function list(collection) {
  const body = await request("GET", `/collections/${collection}/records`);
  const rows = Array.isArray(body) ? body : (body.data ?? []);
  return rows.map(normalize);
}

export async function create(collection, fields) {
  const body = await request("POST", `/collections/${collection}/records`, fields);
  return normalize(body.data ? body : { id: body.id, data: body.data ?? fields });
}

export async function update(collection, id, fields) {
  const body = await request("PUT", `/collections/${collection}/records/${id}`, fields);
  return normalize(body.data ? body : { id, data: fields });
}

export async function remove(collection, id) {
  await request("DELETE", `/collections/${collection}/records/${id}`);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd polla && node --test api.test.js`
Expected: PASS.

- [ ] **Step 5: Verify real response shape against reqres**

After setting a real `API_KEY` in `config.js`, manually run one create + list against the live API (browser console or `node`) and confirm the normalized shape matches. If reqres wraps records differently than assumed, adjust `normalize`/`list`/`create` and re-run Step 4. Note any change in the commit body.

- [ ] **Step 6: Commit**

```bash
git add polla/api.js polla/api.test.js
git commit -m "Add reqres collections API wrapper"
```

---

### Task 4: Data store with caching and config seeding

**Files:**
- Create: `polla/store.js`
- Test: `polla/store.test.js`

**Interfaces:**
- Consumes: `api.js` (`list`, `create`, `update`), `config.js` (`COLLECTIONS`).
- Produces:
  - `DEFAULT_CONFIG` = `{winner:3, exactScore:10, goalDiff:2, totalGoals:1, eachTeamGoals:1}`.
  - `loadFixtures()` → `Promise<Array<fixture>>` (fetches `fixtures.json`).
  - `loadAll()` → `Promise<{fixtures, predictions, results, config}>` — config is the single record, seeded with `DEFAULT_CONFIG` if the collection is empty.
  - `savePrediction(existing, fields)` → create if `existing` is null else update; returns the record.
  - `saveResult(existing, fields)` and `saveConfig(existing, fields)` — same create-or-update pattern.

- [ ] **Step 1: Write the failing tests** (mock the `api` module via a small injectable seam)

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG, resolveConfig } from "./store.js";

test("resolveConfig returns the single existing record", () => {
  const rec = { id: "c1", winner: 4, exactScore: 8, goalDiff: 2, totalGoals: 1, eachTeamGoals: 1 };
  assert.deepEqual(resolveConfig([rec]), rec);
});

test("resolveConfig falls back to defaults when empty", () => {
  const cfg = resolveConfig([]);
  assert.equal(cfg.id, null);
  assert.equal(cfg.winner, DEFAULT_CONFIG.winner);
  assert.equal(cfg.exactScore, DEFAULT_CONFIG.exactScore);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd polla && node --test store.test.js`
Expected: FAIL — exports missing.

- [ ] **Step 3: Implement `store.js`**

```js
import { list, create, update } from "./api.js";
import { COLLECTIONS } from "./config.js";

export const DEFAULT_CONFIG = {
  winner: 3, exactScore: 10, goalDiff: 2, totalGoals: 1, eachTeamGoals: 1,
};

export function resolveConfig(records) {
  if (records.length > 0) return records[0];
  return { id: null, ...DEFAULT_CONFIG };
}

export async function loadFixtures() {
  const res = await fetch("fixtures.json");
  if (!res.ok) throw new Error(`fixtures.json -> ${res.status}`);
  return res.json();
}

export async function loadAll() {
  const [fixtures, predictions, results, configRecords] = await Promise.all([
    loadFixtures(),
    list(COLLECTIONS.predictions),
    list(COLLECTIONS.results),
    list(COLLECTIONS.config),
  ]);
  return { fixtures, predictions, results, config: resolveConfig(configRecords) };
}

function saveCollection(collection, existing, fields) {
  return existing && existing.id
    ? update(collection, existing.id, fields)
    : create(collection, fields);
}

export const savePrediction = (existing, fields) => saveCollection(COLLECTIONS.predictions, existing, fields);
export const saveResult = (existing, fields) => saveCollection(COLLECTIONS.results, existing, fields);
export const saveConfig = (existing, fields) => saveCollection(COLLECTIONS.config, existing, fields);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd polla && node --test store.test.js`
Expected: PASS.

- [ ] **Step 5: Run the full test suite**

Run: `cd polla && node --test`
Expected: all tests across `scoring`, `api`, `store` PASS.

- [ ] **Step 6: Commit**

```bash
git add polla/store.js polla/store.test.js
git commit -m "Add data store with caching and config seeding"
```

---

### Task 5: App bootstrap — identity, admin unlock, tab router

**Files:**
- Create: `polla/app.js`

**Interfaces:**
- Consumes: `config.js` (`ADMIN_SECRET`), `store.js` (`loadAll`), and the three view modules (Task 6–8): `renderPredict(root, ctx)`, `renderLeaderboard(root, ctx)`, `renderAdmin(root, ctx)`.
- Produces: a runtime `ctx` object passed to views: `{ data, player, isAdmin, refresh, setStatus }` where `data` is the `loadAll()` result, `player` is the current name (string), `isAdmin` is boolean, `refresh()` re-loads data and re-renders the active tab, `setStatus(msg, isError)` writes to `#status`.

> **Note:** Build this task after views exist, OR stub the three `render*` imports as no-ops first and fill them in Tasks 6–8. Implementer's choice; the imports below assume the view modules exist.

- [ ] **Step 1: Implement `app.js`**

```js
import { ADMIN_SECRET } from "./config.js";
import { loadAll } from "./store.js";
import { renderPredict } from "./views/predict.js";
import { renderLeaderboard } from "./views/leaderboard.js";
import { renderAdmin } from "./views/admin.js";

const viewRoot = document.getElementById("view");
const statusEl = document.getElementById("status");
const identityEl = document.getElementById("identity");

const renderers = { predict: renderPredict, leaderboard: renderLeaderboard, admin: renderAdmin };
let activeTab = "predict";
let data = null;

function setStatus(msg, isError = false) {
  statusEl.textContent = msg || "";
  statusEl.classList.toggle("error", Boolean(isError));
}

function getPlayer() {
  let name = localStorage.getItem("polla.player");
  if (!name) {
    name = (prompt("Enter your name:") || "").trim();
    if (name) localStorage.setItem("polla.player", name);
  }
  return name;
}

function isAdmin() {
  return localStorage.getItem("polla.admin") === "1";
}

function renderIdentity() {
  const player = getPlayer();
  identityEl.textContent = player ? `Hi, ${player}` : "";
  const adminBtn = document.querySelector('nav button[data-tab="admin"]');
  adminBtn.classList.toggle("hidden", !isAdmin());
}

async function refresh() {
  setStatus("Loading…");
  try {
    data = await loadAll();
    setStatus("");
    renderActive();
  } catch (e) {
    setStatus(`Load failed: ${e.message}`, true);
  }
}

function ctx() {
  return { data, player: getPlayer(), isAdmin: isAdmin(), refresh, setStatus };
}

function renderActive() {
  if (!data) return;
  document.querySelectorAll("nav button").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === activeTab));
  viewRoot.innerHTML = "";
  renderers[activeTab](viewRoot, ctx());
}

function selectTab(tab) {
  if (tab === "admin" && !isAdmin()) {
    const code = (prompt("Admin code:") || "").trim();
    if (code === ADMIN_SECRET) { localStorage.setItem("polla.admin", "1"); renderIdentity(); }
    else { setStatus("Wrong admin code", true); return; }
  }
  activeTab = tab;
  renderActive();
}

document.querySelectorAll("nav button").forEach((b) =>
  b.addEventListener("click", () => selectTab(b.dataset.tab)));

renderIdentity();
refresh();
```

- [ ] **Step 2: Verify in browser**

Run: serve and open the app. Expected: name prompt on first load; data loads (empty collections OK); clicking Admin prompts for code; correct code reveals Admin tab; wrong code shows error in `#status`. Console clean.

- [ ] **Step 3: Commit**

```bash
git add polla/app.js
git commit -m "Add app bootstrap, identity and tab router"
```

---

### Task 6: Predict view

**Files:**
- Create: `polla/views/predict.js`

**Interfaces:**
- Consumes: `ctx` (`data.fixtures`, `data.predictions`, `player`, `refresh`, `setStatus`), `store.savePrediction`, `scoring` not needed here.
- Produces: `export function renderPredict(root, ctx)` — renders one card per fixture with goal inputs; locked cards (kickoff passed) are read-only; saving upserts the player's prediction.

- [ ] **Step 1: Implement `views/predict.js`**

```js
import { savePrediction } from "../store.js";

function isLocked(fixture) {
  return Date.now() >= Date.parse(fixture.kickoff);
}

function findPrediction(predictions, player, matchId) {
  return predictions.find((p) => p.player === player && p.matchId === matchId) || null;
}

export function renderPredict(root, ctx) {
  const { data, player, refresh, setStatus } = ctx;
  if (!player) { root.textContent = "Set your name to predict."; return; }

  data.fixtures.forEach((fx) => {
    const existing = findPrediction(data.predictions, player, fx.id);
    const locked = isLocked(fx);

    const card = document.createElement("div");
    card.className = "match" + (locked ? " locked" : "");

    const label = document.createElement("div");
    label.textContent = `[${fx.group}] ${fx.home} vs ${fx.away} — ${new Date(fx.kickoff).toLocaleString()}`;
    card.appendChild(label);

    const home = document.createElement("input");
    home.type = "number"; home.min = "0"; home.value = existing ? existing.homeGoals : "";
    const away = document.createElement("input");
    away.type = "number"; away.min = "0"; away.value = existing ? existing.awayGoals : "";
    home.disabled = away.disabled = locked;

    const save = document.createElement("button");
    save.textContent = locked ? "Locked" : "Save";
    save.disabled = locked;
    save.addEventListener("click", async () => {
      const fields = {
        player, matchId: fx.id,
        homeGoals: Number(home.value), awayGoals: Number(away.value),
      };
      if (home.value === "" || away.value === "") { setStatus("Enter both scores", true); return; }
      setStatus("Saving…");
      try { await savePrediction(existing, fields); setStatus("Saved"); await refresh(); }
      catch (e) { setStatus(`Save failed: ${e.message}`, true); }
    });

    card.append(" ", home, " - ", away, " ", save);
    root.appendChild(card);
  });
}
```

- [ ] **Step 2: Verify in browser**

Expected: cards render; entering 2 and 1 then Save shows "Saved" and the value persists after reload; a fixture with a past `kickoff` (temporarily edit `fixtures.json` to a past date to test) is read-only.

- [ ] **Step 3: Commit**

```bash
git add polla/views/predict.js
git commit -m "Add predict view with kickoff locking"
```

---

### Task 7: Leaderboard view

**Files:**
- Create: `polla/views/leaderboard.js`
- Test: `polla/views/leaderboard.test.js`

**Interfaces:**
- Consumes: `scoring.score`, `ctx.data` (`predictions`, `results`, `config`).
- Produces:
  - `export function computeStandings(predictions, results, config)` → sorted `Array<{player, points}>` desc.
  - `export function renderLeaderboard(root, ctx)`.

- [ ] **Step 1: Write the failing test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStandings } from "./leaderboard.js";

const cfg = { winner: 3, exactScore: 10, goalDiff: 2, totalGoals: 1, eachTeamGoals: 1 };

test("sums points per player and sorts desc", () => {
  const predictions = [
    { player: "Ana", matchId: "m1", homeGoals: 2, awayGoals: 1 },
    { player: "Bob", matchId: "m1", homeGoals: 0, awayGoals: 0 },
  ];
  const results = [{ matchId: "m1", homeGoals: 2, awayGoals: 1 }];
  const s = computeStandings(predictions, results, cfg);
  assert.equal(s[0].player, "Ana");          // exact: 3+10+2+1+1+1 = 18
  assert.equal(s[0].points, 18);
  assert.equal(s[1].player, "Bob");           // 0-0 vs 2-1: nothing matches = 0
  assert.equal(s[1].points, 0);
});

test("ignores matches without a result", () => {
  const predictions = [{ player: "Ana", matchId: "m9", homeGoals: 1, awayGoals: 0 }];
  const s = computeStandings(predictions, [], cfg);
  assert.equal(s[0].points, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd polla && node --test views/leaderboard.test.js`
Expected: FAIL — export missing.

- [ ] **Step 3: Implement `views/leaderboard.js`**

```js
import { score } from "../scoring.js";

export function computeStandings(predictions, results, config) {
  const resultByMatch = new Map(results.map((r) => [r.matchId, r]));
  const totals = new Map();
  for (const p of predictions) {
    const r = resultByMatch.get(p.matchId);
    const pts = r ? score(p, r, config) : 0;
    totals.set(p.player, (totals.get(p.player) || 0) + pts);
  }
  return [...totals.entries()]
    .map(([player, points]) => ({ player, points }))
    .sort((a, b) => b.points - a.points);
}

export function renderLeaderboard(root, ctx) {
  const { predictions, results, config } = ctx.data;
  const standings = computeStandings(predictions, results, config);
  const table = document.createElement("table");
  table.innerHTML = "<thead><tr><th>#</th><th>Player</th><th>Points</th></tr></thead>";
  const body = document.createElement("tbody");
  standings.forEach((row, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i + 1}</td><td>${row.player}</td><td>${row.points}</td>`;
    body.appendChild(tr);
  });
  table.appendChild(body);
  root.appendChild(standings.length ? table : document.createTextNode("No standings yet."));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd polla && node --test views/leaderboard.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add polla/views/leaderboard.js polla/views/leaderboard.test.js
git commit -m "Add leaderboard view and standings calc"
```

---

### Task 8: Admin view — results entry and scoring config

**Files:**
- Create: `polla/views/admin.js`

**Interfaces:**
- Consumes: `ctx` (`data.fixtures`, `data.results`, `data.config`, `isAdmin`, `refresh`, `setStatus`), `store.saveResult`, `store.saveConfig`.
- Produces: `export function renderAdmin(root, ctx)` — a scoring-config form (the five weights) plus a per-fixture actual-result entry; both upsert and refresh.

- [ ] **Step 1: Implement `views/admin.js`**

```js
import { saveResult, saveConfig } from "../store.js";

const WEIGHTS = ["winner", "exactScore", "goalDiff", "totalGoals", "eachTeamGoals"];

function configForm(ctx) {
  const { config, } = ctx.data;
  const form = document.createElement("div");
  form.className = "match";
  form.appendChild(Object.assign(document.createElement("h3"), { textContent: "Scoring weights" }));

  const inputs = {};
  WEIGHTS.forEach((key) => {
    const wrap = document.createElement("label");
    wrap.textContent = ` ${key}: `;
    const inp = document.createElement("input");
    inp.type = "number"; inp.value = config[key]; inp.min = "0";
    inputs[key] = inp;
    wrap.appendChild(inp);
    form.append(wrap, document.createElement("br"));
  });

  const save = document.createElement("button");
  save.textContent = "Save weights";
  save.addEventListener("click", async () => {
    const fields = {};
    WEIGHTS.forEach((k) => { fields[k] = Number(inputs[k].value); });
    ctx.setStatus("Saving weights…");
    try { await saveConfig(config.id ? config : null, fields); ctx.setStatus("Saved"); await ctx.refresh(); }
    catch (e) { ctx.setStatus(`Save failed: ${e.message}`, true); }
  });
  form.appendChild(save);
  return form;
}

function resultsSection(ctx) {
  const { fixtures, results } = ctx.data;
  const section = document.createElement("div");
  section.appendChild(Object.assign(document.createElement("h3"), { textContent: "Actual results" }));

  fixtures.forEach((fx) => {
    const existing = results.find((r) => r.matchId === fx.id) || null;
    const card = document.createElement("div");
    card.className = "match";
    card.appendChild(Object.assign(document.createElement("div"),
      { textContent: `[${fx.group}] ${fx.home} vs ${fx.away}` }));

    const home = document.createElement("input");
    home.type = "number"; home.min = "0"; home.value = existing ? existing.homeGoals : "";
    const away = document.createElement("input");
    away.type = "number"; away.min = "0"; away.value = existing ? existing.awayGoals : "";

    const save = document.createElement("button");
    save.textContent = "Save result";
    save.addEventListener("click", async () => {
      if (home.value === "" || away.value === "") { ctx.setStatus("Enter both scores", true); return; }
      const fields = { matchId: fx.id, homeGoals: Number(home.value), awayGoals: Number(away.value) };
      ctx.setStatus("Saving result…");
      try { await saveResult(existing, fields); ctx.setStatus("Saved"); await ctx.refresh(); }
      catch (e) { ctx.setStatus(`Save failed: ${e.message}`, true); }
    });

    card.append(" ", home, " - ", away, " ", save);
    section.appendChild(card);
  });
  return section;
}

export function renderAdmin(root, ctx) {
  if (!ctx.isAdmin) { root.textContent = "Admin only."; return; }
  root.appendChild(configForm(ctx));
  root.appendChild(resultsSection(ctx));
}
```

- [ ] **Step 2: Verify in browser**

Expected (as admin): weights form prefilled with defaults; changing `exactScore` and saving persists after reload; entering an actual result for a match, saving, then viewing Leaderboard shows updated points. Console clean.

- [ ] **Step 3: Run full test suite**

Run: `cd polla && node --test`
Expected: all `scoring`, `api`, `store`, `leaderboard` tests PASS.

- [ ] **Step 4: Commit**

```bash
git add polla/views/admin.js
git commit -m "Add admin view for results and scoring config"
```

---

## Self-Review

**Spec coverage:**
- Match-score prediction → Task 6. ✓
- Configurable scoring (winner, exactScore, goalDiff, totalGoals, eachTeamGoals) → Task 2 + Task 8 form. ✓
- Name-only identity + admin secret → Task 5. ✓
- Hardcoded fixtures seed → Task 1. ✓
- reqres collections for predictions/results/config → Tasks 3–4. ✓
- Client-side leaderboard → Task 7. ✓
- Kickoff locking → Task 6. ✓
- Error handling / inline status → `setStatus` (Task 5) used by all save paths. ✓ (Note: exponential backoff on 429 from the spec is NOT implemented in this plan — see gap below.)
- Vanilla, no build, `node:test` → throughout. ✓

**Gap found and resolved:** The spec mentions exponential backoff on HTTP 429. To keep tasks bite-sized and avoid scope creep, backoff is intentionally deferred; `api.js` surfaces the error via `setStatus` instead. If backoff is required for the POC, add it as a follow-up task wrapping `request()` in `api.js` with a retry-on-429 loop. Flagging rather than silently dropping.

**Placeholder scan:** No TBD/TODO; all code steps contain full code. `API_KEY` in `config.js` is a real placeholder value the user must replace with their reqres project key — called out in Task 3 Step 5.

**Type consistency:** `{homeGoals, awayGoals}` shape consistent across scoring, predict, results, leaderboard. `score(prediction, result, config)` signature matches caller in `computeStandings`. `save*` (create-or-update) signatures `(existing, fields)` consistent in Tasks 4/6/8. `ctx` shape defined in Task 5 matches usage in Tasks 6–8.
