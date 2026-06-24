import { test } from "node:test";
import assert from "node:assert/strict";
import { parseScore, isDirty, summarizeEdits } from "./editing.js";

test("parseScore returns null unless both fields are filled", () => {
  assert.equal(parseScore("", "1"), null);
  assert.equal(parseScore("2", ""), null);
  assert.deepEqual(parseScore("2", "1"), { homeGoals: 2, awayGoals: 1 });
});

test("isDirty: empty inputs with no baseline are clean", () => {
  assert.equal(isDirty(null, "", ""), false);
});

test("isDirty: a complete new entry is dirty", () => {
  assert.equal(isDirty(null, "2", "1"), true);
});

test("isDirty: matching the baseline exactly is clean", () => {
  assert.equal(isDirty({ homeGoals: 2, awayGoals: 1 }, "2", "1"), false);
});

test("isDirty: differing from the baseline is dirty", () => {
  assert.equal(isDirty({ homeGoals: 2, awayGoals: 1 }, "3", "1"), true);
});

test("isDirty: clearing a field that had a baseline is dirty", () => {
  assert.equal(isDirty({ homeGoals: 2, awayGoals: 1 }, "2", ""), true);
});

test("isDirty: a partial entry with no baseline is dirty (needs completing)", () => {
  assert.equal(isDirty(null, "2", ""), true);
});

test("summarizeEdits splits saveable from incomplete and counts dirty", () => {
  const entries = [
    { key: "m1", baseline: null, homeStr: "2", awayStr: "1" },           // saveable new
    { key: "m2", baseline: { homeGoals: 0, awayGoals: 0 }, homeStr: "0", awayStr: "0" }, // clean
    { key: "m3", baseline: { homeGoals: 1, awayGoals: 1 }, homeStr: "2", awayStr: "1" }, // saveable update
    { key: "m4", baseline: null, homeStr: "3", awayStr: "" },            // dirty but incomplete
  ];
  const s = summarizeEdits(entries);
  assert.equal(s.dirtyCount, 3);
  assert.equal(s.incompleteCount, 1);
  assert.deepEqual(s.saveable.map((x) => x.key), ["m1", "m3"]);
  assert.deepEqual(s.saveable[0].fields, { homeGoals: 2, awayGoals: 1 });
});
