import { test } from "node:test";
import assert from "node:assert/strict";
import { groupFixturesByDay } from "./grouping.js";

const fx = (id, kickoff) => ({ id, group: "A", home: "X", away: "Y", kickoff });

test("groups fixtures by day, days and matches sorted chronologically", () => {
  const fixtures = [
    fx("m3", "2026-06-15T12:00:00Z"),
    fx("m1", "2026-06-11T12:00:00Z"),
    fx("m2", "2026-06-11T18:00:00Z"),
    fx("m4", "2026-06-12T12:00:00Z"),
  ];
  const groups = groupFixturesByDay(fixtures, Date.parse("2026-06-13T00:00:00Z"));
  assert.equal(groups.length, 3);
  assert.deepEqual(groups.map((g) => g.dayKey), ["2026-06-11", "2026-06-12", "2026-06-15"]);
  assert.deepEqual(groups[0].fixtures.map((f) => f.id), ["m1", "m2"]);
});

test("marks a day past when its last match has already started", () => {
  const fixtures = [fx("m1", "2026-06-11T12:00:00Z"), fx("m2", "2026-06-20T12:00:00Z")];
  const now = Date.parse("2026-06-15T00:00:00Z");
  const groups = groupFixturesByDay(fixtures, now);
  assert.equal(groups[0].isPast, true);
  assert.equal(groups[1].isPast, false);
});

test("a day is not past while one of its matches is still upcoming", () => {
  const fixtures = [fx("m1", "2026-06-15T10:00:00Z"), fx("m2", "2026-06-15T22:00:00Z")];
  const groups = groupFixturesByDay(fixtures, Date.parse("2026-06-15T12:00:00Z"));
  assert.equal(groups.length, 1);
  assert.equal(groups[0].isPast, false);
});
