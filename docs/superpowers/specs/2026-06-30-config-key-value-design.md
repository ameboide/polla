# Config table: key-value rows

Date: 2026-06-30

## Problem

The `config` table is a single wide row with one column per scoring weight
(`winner`, `exactScore`, `goalDiff`, `totalGoals`, `eachTeamGoals`, `advance`).
Adding a setting requires a schema change (a new column) — exactly what happened
when `advance` was added. We want a flexible key-value shape so new settings can
be added without altering the table, including non-numeric settings in future
(tournament name, lock dates, feature flags).

## Decisions (settled with the user)

- Table becomes key-value: one row per setting, columns `configKey` / `configValue`.
- `configValue` is **text**, to allow non-numeric settings later without migration.
- Column names are `configKey`/`configValue` (NOT `key`/`value`) to avoid SQL
  reserved-word friction; quoted in SQL to preserve camelCase (like the existing
  `"winner"` columns).
- On read, a value that looks numeric is coerced to a `Number`; otherwise it stays
  a string. So scoring weights come through as numbers and future text settings
  stay text.
- The Admin form keeps editing only the numeric scoring weights for now (storage
  flexibility is the goal; no UI for arbitrary settings yet — YAGNI).

## Schema

```sql
create table config (
  id uuid primary key default gen_random_uuid(),
  "configKey" text not null unique,
  "configValue" text not null
);

insert into config ("configKey","configValue") values
  ('winner','3'),('exactScore','10'),('goalDiff','2'),
  ('totalGoals','1'),('eachTeamGoals','1'),('advance','5');

alter table config enable row level security;
create policy anon_all on config for all to anon using (true) with check (true);
```

`config.example.js` carries this SQL (replacing the old wide-table SQL). The live
Supabase project is migrated by the user (the classifier blocks Claude from DB
writes): drop the existing `config` table and recreate + re-seed as above.

## store.js

### `resolveConfig(rows)`
Input is now `[{ id, configKey, configValue }, ...]`. Build a flat config object:

- Start from `DEFAULT_CONFIG` (unchanged: the numeric defaults).
- Overlay each row: `obj[row.configKey] = coerce(row.configValue)`.
- `coerce(s)`: if `s` is a non-empty string and `Number(s)` is finite (not `NaN`),
  return `Number(s)`; otherwise return `s` unchanged.
- No `id` field on the returned object (the single-row id concept is gone).
- `resolveConfig([])` returns exactly `DEFAULT_CONFIG`'s values (empty table →
  pure defaults), matching today's empty behavior.

`DEFAULT_CONFIG` stays as-is and remains the fallback for any key missing from the
table, so scoring never sees `undefined` weights.

### `configRows(fields)` (new pure helper)
Extract the fields-to-rows shaping as a pure, exported function so it is unit
testable without the network:

```js
export function configRows(fields) {
  return Object.entries(fields).map(([configKey, v]) => ({
    configKey, configValue: String(v),
  }));
}
```

### `saveConfig(fields)`
Signature drops the `existing` argument (no id to thread). Upsert on `configKey`:

```js
export function saveConfig(fields) {
  return upsert(COLLECTIONS.config, configRows(fields), "configKey");
}
```

Returns the upserted rows (PostgREST representation).

### Caching
`readCachedConfig` / `cacheConfig` are unchanged — they already store and return
the assembled flat config object. `loadAll` is unchanged in shape:
`config = cachedConfig || resolveConfig(configRecords)`; `configRecords` is now
the key-value rows.

## api.js

Add an upsert helper (PostgREST merge-duplicates upsert; relies on the
`configKey` unique constraint):

```js
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

`request`/`headers` already support a `prefer` argument and a JSON body, so no
other api.js change is needed.

## admin.js

`configForm` is unchanged in its UI (still renders inputs for the `WEIGHTS`
array). Only the save path changes:

- Build `fields` from the weight inputs (unchanged); values are `Number(...)` as
  today.
- Call `saveConfig(fields)` (was `saveConfig(config.id ? config : null, fields)`).
- After save, patch in place: `ctx.data.config = { ...ctx.data.config, ...fields }`
  (fields are already numbers), then `cacheConfig(ctx.data.config)` and
  `ctx.rerender()`. No reload needed.

No other admin.js behavior changes.

## Tests

- `store.test.js`:
  - `resolveConfig` with key-value rows assembles a flat object; numeric strings
    coerce to numbers; a non-numeric value (e.g. `{configKey:'name',configValue:'Polla'}`)
    stays a string; missing keys fall back to `DEFAULT_CONFIG`.
  - `resolveConfig([])` returns the defaults (no id).
  - `configRows(fields)` produces `[{configKey, configValue:'<string>'}, ...]`
    (numbers stringified), preserving entry order.
- `api.test.js`: `upsert` issues `POST /<table>?on_conflict=<col>` with
  `Prefer: resolution=merge-duplicates,return=representation` and the rows as the
  JSON body; returns an array.

## Out of scope (YAGNI)

- No admin UI for arbitrary (non-weight) settings.
- No typed/validated schema per key; coercion is the simple numeric-or-string rule.
- No automatic data migration tooling — the user runs the SQL once in Supabase.
