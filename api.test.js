import { test } from "node:test";
import assert from "node:assert/strict";
import { list, create, update, remove, upsert } from "./api.js";

function mockFetch(responder) {
  globalThis.fetch = async (url, opts = {}) => {
    const body = responder(url, opts);
    return { ok: true, status: 200, json: async () => body };
  };
}

test("list GETs /table?select=*, sends apikey, returns the array", async () => {
  let seen;
  mockFetch((url, opts) => { seen = { url, opts }; return [{ id: "1", player: "Ana" }]; });
  const rows = await list("predictions");
  assert.deepEqual(rows, [{ id: "1", player: "Ana" }]);
  assert.match(seen.url, /\/predictions\?select=\*$/);
  assert.equal(seen.opts.method, "GET");
  assert.ok(seen.opts.headers.apikey);
  assert.match(seen.opts.headers.Authorization, /^Bearer /);
});

test("create POSTs a flat body and unwraps the returned row", async () => {
  let sent;
  mockFetch((url, opts) => { sent = { url, opts, body: JSON.parse(opts.body) }; return [{ id: "9", ...JSON.parse(opts.body) }]; });
  const rec = await create("results", { matches: [{ matchId: "m1", homeGoals: 2, awayGoals: 1 }] });
  assert.match(sent.url, /\/results$/);
  assert.equal(sent.opts.headers.Prefer, "return=representation");
  assert.deepEqual(sent.body, { matches: [{ matchId: "m1", homeGoals: 2, awayGoals: 1 }] });
  assert.deepEqual(rec, { id: "9", matches: [{ matchId: "m1", homeGoals: 2, awayGoals: 1 }] });
});

test("update PATCHes /table?id=eq.:id and unwraps the row", async () => {
  let seen;
  mockFetch((url, opts) => { seen = { url, method: opts.method, body: JSON.parse(opts.body) }; return [{ id: "7", ...JSON.parse(opts.body) }]; });
  const rec = await update("predictions", "7", { player: "Bob", matches: [] });
  assert.equal(seen.method, "PATCH");
  assert.match(seen.url, /\/predictions\?id=eq\.7$/);
  assert.deepEqual(seen.body, { player: "Bob", matches: [] });
  assert.deepEqual(rec, { id: "7", player: "Bob", matches: [] });
});

test("remove DELETEs /table?id=eq.:id and returns undefined", async () => {
  let seen;
  mockFetch((url, opts) => { seen = { url, method: opts.method }; return {}; });
  const out = await remove("config", "3");
  assert.equal(seen.method, "DELETE");
  assert.match(seen.url, /\/config\?id=eq\.3$/);
  assert.equal(out, undefined);
});

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
