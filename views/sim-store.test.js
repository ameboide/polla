import { test } from "node:test";
import assert from "node:assert/strict";
import { setSim, getSim, clearSims, simResults } from "./sim-store.js";

test("setSim stores a complete score; simResults shapes it like a result row", () => {
  clearSims();
  setSim("m1", 2, 1);
  assert.deepEqual(getSim("m1"), { homeGoals: 2, awayGoals: 1 });
  assert.deepEqual(simResults(), [{ matchId: "m1", homeGoals: 2, awayGoals: 1 }]);
});

test("setSim coerces string inputs to numbers", () => {
  clearSims();
  setSim("m1", "3", "0");
  assert.deepEqual(getSim("m1"), { homeGoals: 3, awayGoals: 0 });
});

test("a blank or partial entry removes the simulation", () => {
  clearSims();
  setSim("m1", 1, 0);
  setSim("m1", 1, "");
  assert.equal(getSim("m1"), null);
});

test("clearSims drops everything", () => {
  clearSims();
  setSim("m1", 1, 0);
  setSim("m2", 2, 2);
  clearSims();
  assert.equal(simResults().length, 0);
});
