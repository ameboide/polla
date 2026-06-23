import { test } from "node:test";
import assert from "node:assert/strict";
import { list, create, update, remove, normalize } from "./api.js";

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

test("update puts {data:{...}} to the record URL and normalizes", async () => {
  let seen;
  mockFetch((url, opts) => { seen = { url, body: JSON.parse(opts.body), method: opts.method }; return { id: "7", data: JSON.parse(opts.body).data }; });
  const rec = await update("results", "7", { matchId: "m1", homeGoals: 1, awayGoals: 0 });
  assert.equal(seen.method, "PUT");
  assert.match(seen.url, /\/collections\/results\/records\/7$/);
  assert.deepEqual(seen.body, { data: { matchId: "m1", homeGoals: 1, awayGoals: 0 } });
  assert.deepEqual(rec, { id: "7", matchId: "m1", homeGoals: 1, awayGoals: 0 });
});

test("remove deletes the record URL and returns undefined", async () => {
  let seen;
  mockFetch((url, opts) => { seen = { url, method: opts.method }; return {}; });
  const out = await remove("predictions", "3");
  assert.equal(seen.method, "DELETE");
  assert.match(seen.url, /\/collections\/predictions\/records\/3$/);
  assert.equal(out, undefined);
});
