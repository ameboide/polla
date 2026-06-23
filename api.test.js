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
