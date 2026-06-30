# Key-Value Config Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single wide `config` row (one column per weight) with a key-value table `configs` (`configKey`/`configValue` text), so settings can be added without schema changes.

**Architecture:** `store.js` assembles a flat config object from key-value rows (coercing numeric strings to numbers) and saves via a PostgREST upsert on `configKey`. A new `api.upsert` helper performs merge-duplicates upserts. The Admin form is unchanged; only its save path differs. The live Supabase table is migrated by the user.

**Tech Stack:** Vanilla ES modules, `node:test` + `node:assert/strict`, Supabase/PostgREST.

## Global Constraints

- No new runtime dependencies; vanilla ES modules.
- Tests use `node:test` / `node:assert/strict`, beside the module.
- Table is named `configs`; columns are `id`, `configKey` (text, unique), `configValue` (text). Column names are quoted in SQL to preserve camelCase.
- `COLLECTIONS.config` keeps its JS key; its value is `"configs"`.
- Read coercion rule: a `configValue` string is converted to `Number` only when non-empty and `Number(s)` is finite; otherwise it stays a string.
- `DEFAULT_CONFIG` is unchanged and fills any key missing from the table.
- Commit subject imperative ≤50 chars, no Co-Authored-By / Generated-with trailer.
- Full suite: `node --test` from repo root.

**Deploy ordering (not a code task):** the app will query the `configs` table once `COLLECTIONS.config` flips to `"configs"`. The user must run the migration SQL (drop `config`, create+seed `configs`) in Supabase before/with deploying, or loads fail.

---

### Task 1: Add `upsert` to the API client

**Files:**
- Modify: `api.js`
- Test: `api.test.js`

**Interfaces:**
- Produces: `upsert(table, rows, onConflict) -> Promise<Array>` — POSTs `rows` to `/{table}?on_conflict={onConflict}` with `Prefer: resolution=merge-duplicates,return=representation`; always returns an array.

- [ ] **Step 1: Write the failing test**

Add to `api.test.js` (and add `upsert` to the import on line 3):

```javascript
test("upsert POSTs to /table?on_conflict=col with merge-duplicates and returns an array", async () => {
  let sent;
  mockFetch((url, opts) => { sent = { url, opts, body: JSON.parse(opts.body) }; return JSON.parse(opts.body); });
  const rows = [{ configKey: "winner", configValue: "3" }, { configKey: "advance", configValue: "5" }];
  const out = await upsert("configs", rows, "configKey");
  assert.match(sent.url, /\/configs\?on_conflict=configKey$/);
  assert.equal(sent.opts.method, "POST");
  assert.equal(sent.opts.headers.Prefer, "resolution=merge-duplicates,return=representation");
  assert.deepEqual(sent.body, rows);
  assert.deepEqual(out, rows);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test api.test.js`
Expected: FAIL — `upsert` is not exported / not a function.

- [ ] **Step 3: Implement**

Add to `api.js` (after `update`, before `remove`):

```javascript
// Upsert rows, merging on a unique column. PostgREST resolves conflicts on
// `onConflict` and echoes the resulting rows.
export async function upsert(table, rows, onConflict) {
  const result = await request(
    "POST", `/${table}?on_conflict=${onConflict}`, rows,
    "resolution=merge-duplicates,return=representation",
  );
  return Array.isArray(result) ? result : [result];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test api.test.js`
Expected: PASS (all api tests).

- [ ] **Step 5: Commit**

```bash
git add api.js api.test.js
git commit -m "Add upsert helper to API client"
```

---

### Task 2: Key-value config in the store

**Files:**
- Modify: `store.js` (`resolveConfig`, `saveConfig`; add `configRows`; import `upsert`)
- Test: `store.test.js`

**Interfaces:**
- Consumes: `upsert(table, rows, onConflict)` from Task 1.
- Produces:
  - `resolveConfig(rows) -> object` — flat config from `[{id, configKey, configValue}]`; numeric strings coerced to numbers; missing keys filled from `DEFAULT_CONFIG`; no `id` on the result.
  - `configRows(fields) -> [{configKey, configValue}]` — pure shaper; values stringified; preserves entry order.
  - `saveConfig(fields) -> Promise<Array>` — upserts `configRows(fields)` on `configKey`. (NOTE: signature drops the old `existing` argument.)

- [ ] **Step 1: Write the failing tests**

In `store.test.js`, update the import to include `configRows`:

```javascript
import { DEFAULT_CONFIG, resolveConfig, configRows, flattenPredictions, resultsMatches, mergeMatches } from "./store.js";
```

Replace the two existing `resolveConfig` tests (the "returns the single existing record" and "falls back to defaults when empty" tests) with:

```javascript
test("resolveConfig assembles a flat object from key-value rows, coercing numerics", () => {
  const rows = [
    { id: "1", configKey: "winner", configValue: "4" },
    { id: "2", configKey: "exactScore", configValue: "8" },
    { id: "3", configKey: "name", configValue: "Polla 2026" },
  ];
  const cfg = resolveConfig(rows);
  assert.equal(cfg.winner, 4);          // numeric string -> number
  assert.equal(cfg.exactScore, 8);
  assert.equal(cfg.name, "Polla 2026"); // non-numeric stays a string
  assert.equal(cfg.goalDiff, DEFAULT_CONFIG.goalDiff); // missing key -> default
  assert.equal("id" in cfg, false);     // no single-row id concept
});

test("resolveConfig with no rows returns the defaults", () => {
  assert.deepEqual(resolveConfig([]), { ...DEFAULT_CONFIG });
});

test("configRows shapes fields into string-valued upsert rows in order", () => {
  assert.deepEqual(configRows({ winner: 3, advance: 5 }), [
    { configKey: "winner", configValue: "3" },
    { configKey: "advance", configValue: "5" },
  ]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test store.test.js`
Expected: FAIL — `configRows` not exported; `resolveConfig` returns the old shape (record with `id`, or `{id:null,...}`).

- [ ] **Step 3: Implement**

In `store.js`, replace `resolveConfig` and `saveConfig`, add `configRows`, and add `upsert` to the api import.

Update the import line:

```javascript
import { list, create, update, upsert } from "./api.js";
```

Replace the existing `resolveConfig` function with:

```javascript
// A config row's value is text; turn it into a number when it clearly is one,
// otherwise keep the string (so future non-numeric settings pass through).
function coerceConfigValue(s) {
  return typeof s === "string" && s.trim() !== "" && Number.isFinite(Number(s))
    ? Number(s)
    : s;
}

// Assemble a flat config object from key-value rows, filling any missing key
// from DEFAULT_CONFIG. (No single-row id — each key is its own row.)
export function resolveConfig(rows) {
  const out = { ...DEFAULT_CONFIG };
  for (const r of rows) out[r.configKey] = coerceConfigValue(r.configValue);
  return out;
}
```

Add `configRows` (near `saveConfig`):

```javascript
// Shape a flat fields object into key-value upsert rows (values stringified).
export function configRows(fields) {
  return Object.entries(fields).map(([configKey, v]) => ({
    configKey, configValue: String(v),
  }));
}
```

Replace the existing `saveConfig` function with:

```javascript
// One row per setting; upsert merges on the unique configKey column.
export function saveConfig(fields) {
  return upsert(COLLECTIONS.config, configRows(fields), "configKey");
}
```

(Leave `loadAll` unchanged: it already does `config = cachedConfig || resolveConfig(configRecords)`, and `configRecords` is now the key-value rows.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test store.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add store.js store.test.js
git commit -m "Store config as key-value rows"
```

---

### Task 3: Point config files at the `configs` table

**Files:**
- Modify: `config.js` (`COLLECTIONS.config` value)
- Modify: `config.example.js` (`COLLECTIONS.config` value + the schema SQL comment)

**Interfaces:**
- Produces: `COLLECTIONS.config === "configs"`.

- [ ] **Step 1: Update `config.js`**

Change the `config` entry value in the `COLLECTIONS` export:

```javascript
export const COLLECTIONS = {
  predictions: "predictions",
  results: "results",
  config: "configs",
};
```

- [ ] **Step 2: Update `config.example.js`**

In `config.example.js`, change the `COLLECTIONS` export's `config` value to `"configs"` (same as above), and replace the old wide `config` table SQL in the comment with the key-value `configs` table:

Replace this block in the SQL comment:

```
//   create table config (
//     id uuid primary key default gen_random_uuid(),
//     "winner" int, "exactScore" int, "goalDiff" int,
//     "totalGoals" int, "eachTeamGoals" int
//   );
```

with:

```
//   create table configs (
//     id uuid primary key default gen_random_uuid(),
//     "configKey" text not null unique,
//     "configValue" text not null
//   );
//
//   insert into configs ("configKey","configValue") values
//     ('winner','3'),('exactScore','10'),('goalDiff','2'),
//     ('totalGoals','1'),('eachTeamGoals','1'),('advance','5');
```

And update the two `config`-table RLS lines in the comment to `configs`:

```
//   alter table configs enable row level security;
//   create policy anon_all on configs    for all to anon using (true) with check (true);
```

- [ ] **Step 3: Verify nothing else references the old table name**

Run: `grep -rn "\"config\"" --include=*.js . ; grep -rn "table config\b" --include=*.js .`
Expected: no remaining references to a `"config"` table value (only `COLLECTIONS.config` as a key, which is fine). The `config` JS key and `polla.config.cache` localStorage key are unrelated and stay.

- [ ] **Step 4: Sanity-check the modules load**

Run: `node -e "import('./store.js').then(m=>console.log('config table:', require('./config.js')?.COLLECTIONS?.config ?? 'n/a'))" 2>/dev/null || node --input-type=module -e "import {COLLECTIONS} from './config.js'; console.log('config table:', COLLECTIONS.config)"`
Expected: prints `config table: configs`.

- [ ] **Step 5: Commit**

```bash
git add config.js config.example.js
git commit -m "Point config collection at configs table"
```

---

### Task 4: Update the Admin save path

**Files:**
- Modify: `views/admin.js` (`configForm` save handler)

**Interfaces:**
- Consumes: `saveConfig(fields)` and `cacheConfig` from `store.js` (both already imported in admin.js).

- [ ] **Step 1: Update the save handler**

In `views/admin.js`, the weights save handler currently does:

```javascript
    const fields = {};
    WEIGHTS.forEach((k) => { fields[k] = Number(inputs[k].value); });
    save.disabled = true;
    ctx.setStatus("Saving weights…");
    try {
      const saved = await saveConfig(config.id ? config : null, fields);
      // Patch in-memory + cache (write-through) so no reload is needed and the
      // cached config stays fresh for this admin.
      ctx.data.config = saved;
      cacheConfig(saved);
      ctx.setStatus("Saved");
      ctx.rerender();
    }
    catch (e) { ctx.setStatus(`Save failed: ${e.message}`, true); }
    finally { save.disabled = false; }
```

Replace the `try` block body so it calls `saveConfig(fields)` and patches the
in-memory config from the (numeric) fields:

```javascript
    const fields = {};
    WEIGHTS.forEach((k) => { fields[k] = Number(inputs[k].value); });
    save.disabled = true;
    ctx.setStatus("Saving weights…");
    try {
      await saveConfig(fields);
      // Patch in-memory + cache (write-through) so no reload is needed and the
      // cached config stays fresh for this admin.
      ctx.data.config = { ...ctx.data.config, ...fields };
      cacheConfig(ctx.data.config);
      ctx.setStatus("Saved");
      ctx.rerender();
    }
    catch (e) { ctx.setStatus(`Save failed: ${e.message}`, true); }
    finally { save.disabled = false; }
```

(The `config` variable from `ctx.data` is still used to seed the input values
earlier in `configForm`; only the save call and patch change. `config.id` is no
longer referenced.)

- [ ] **Step 2: Verify the whole suite still passes**

Run: `node --test`
Expected: PASS (admin.js has no unit test; this confirms no import/usage broke across modules).

- [ ] **Step 3: Manual verification**

Serve the app, open Admin (code `pollo`), change a weight, Save. Confirm: status shows "Saved", the value persists after switching tabs and after reload (requires the migrated `configs` table in Supabase). With the table not yet migrated, expect a save failure surfaced via `setStatus` — that is the deploy-ordering note, not a code bug.

- [ ] **Step 4: Commit**

```bash
git add views/admin.js
git commit -m "Save weights via key-value upsert in admin"
```

---

## Self-review notes

- **Spec coverage:** schema/rename + migration SQL (Task 3), `resolveConfig`/`configRows`/`saveConfig` (Task 2), `api.upsert` (Task 1), admin save path (Task 4), caching unchanged (Task 2 leaves `loadAll`/cache as-is). All spec sections map to a task.
- **Type consistency:** `upsert(table, rows, onConflict)` signature identical across Tasks 1–2; `configRows`/`resolveConfig`/`saveConfig` names and shapes match the spec and across tasks; `COLLECTIONS.config === "configs"` used by `saveConfig`.
- **No placeholders:** every code step shows the actual code; the migration SQL is the user's manual step (called out in Global Constraints), not a code task.
- **Final:** after Task 4, run `node --test` (full suite) and do the Admin manual check against a migrated Supabase project.
