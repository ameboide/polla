import { test } from "node:test";
import assert from "node:assert/strict";
import { list, create, update, remove, normalize } from "./api.js";

function mockFetch(responder) {
  globalThis.fetch = async (url, opts = {}) => {
    const body = responder(url, opts);
    return { ok: true, status: 200, json: async () => body };
  };
}

test("normalize maps _id to id and keeps other fields flat", () => {
  assert.deepEqual(normalize({ _id: "x", player: "Ana", matches: [] }),
    { id: "x", player: "Ana", matches: [] });
});

test("list GETs /collection, sends x-apikey, returns normalized array", async () => {
  let seen;
  mockFetch((url, opts) => { seen = { url, opts }; return [{ _id: "1", player: "Ana" }]; });
  const rows = await list("predictions");
  assert.deepEqual(rows, [{ id: "1", player: "Ana" }]);
  assert.match(seen.url, /\/predictions$/);
  assert.equal(seen.opts.method, "GET");
  assert.ok(seen.opts.headers["x-apikey"]);
});

test("create POSTs a flat body (no data wrapper) and normalizes the result", async () => {
  let sent;
  mockFetch((url, opts) => { sent = { url, body: JSON.parse(opts.body) }; return { _id: "9", ...JSON.parse(opts.body) }; });
  const rec = await create("results", { matches: [{ matchId: "m1", homeGoals: 2, awayGoals: 1 }] });
  assert.match(sent.url, /\/results$/);
  assert.deepEqual(sent.body, { matches: [{ matchId: "m1", homeGoals: 2, awayGoals: 1 }] });
  assert.deepEqual(rec, { id: "9", matches: [{ matchId: "m1", homeGoals: 2, awayGoals: 1 }] });
});

test("update PUTs to /collection/:id with a flat body", async () => {
  let seen;
  mockFetch((url, opts) => { seen = { url, method: opts.method, body: JSON.parse(opts.body) }; return { _id: "7", ...JSON.parse(opts.body) }; });
  const rec = await update("predictions", "7", { player: "Bob", matches: [] });
  assert.equal(seen.method, "PUT");
  assert.match(seen.url, /\/predictions\/7$/);
  assert.deepEqual(seen.body, { player: "Bob", matches: [] });
  assert.deepEqual(rec, { id: "7", player: "Bob", matches: [] });
});

test("remove DELETEs /collection/:id and returns undefined", async () => {
  let seen;
  mockFetch((url, opts) => { seen = { url, method: opts.method }; return {}; });
  const out = await remove("config", "3");
  assert.equal(seen.method, "DELETE");
  assert.match(seen.url, /\/config\/3$/);
  assert.equal(out, undefined);
});
