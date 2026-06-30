import { test } from "node:test";
import assert from "node:assert/strict";
import { stageOf, groupByStage } from "./stages.js";

test("stageOf classifies by round presence", () => {
  assert.equal(stageOf({ round: "Round of 16" }), "knockout");
  assert.equal(stageOf({ group: "A" }), "group");
  assert.equal(stageOf({ round: null }), "group"); // matchIndex group entry
  assert.equal(stageOf(undefined), "group");
});

const G = (id, ko) => ({ id, kickoff: ko, group: "A" });          // group fixture
const K = (id, ko) => ({ id, kickoff: ko, round: "Round of 32" }); // knockout fixture

test("groupByStage partitions in order, preserving fixture order", () => {
  const fx = [G("m1", "2026-06-11T19:00:00Z"), K("m73", "2026-06-28T19:00:00Z"), G("m2", "2026-06-12T19:00:00Z")];
  const out = groupByStage(fx, Date.parse("2026-06-01T00:00:00Z"));
  assert.deepEqual(out.map((s) => s.key), ["group", "knockout"]);
  assert.deepEqual(out[0].fixtures.map((f) => f.id), ["m1", "m2"]);
  assert.deepEqual(out[1].fixtures.map((f) => f.id), ["m73"]);
});

test("groupByStage: group is current when it has an upcoming match", () => {
  const fx = [G("m1", "2026-06-11T19:00:00Z"), K("m73", "2026-06-28T19:00:00Z")];
  const out = groupByStage(fx, Date.parse("2026-06-10T00:00:00Z")); // before group match
  assert.equal(out.find((s) => s.key === "group").current, true);
  assert.equal(out.find((s) => s.key === "knockout").current, false);
});

test("groupByStage: knockout is current when group is all past but knockout upcoming", () => {
  const fx = [G("m1", "2026-06-11T19:00:00Z"), K("m73", "2026-06-28T19:00:00Z")];
  const out = groupByStage(fx, Date.parse("2026-06-20T00:00:00Z")); // group done, ko upcoming
  assert.equal(out.find((s) => s.key === "knockout").current, true);
  assert.equal(out.find((s) => s.key === "group").current, false);
});

test("groupByStage: all past -> last present stage is current", () => {
  const fx = [G("m1", "2026-06-11T19:00:00Z"), K("m73", "2026-06-28T19:00:00Z")];
  const out = groupByStage(fx, Date.parse("2026-07-30T00:00:00Z"));
  assert.equal(out.find((s) => s.key === "knockout").current, true);
});

test("groupByStage: single stage present is current; empty -> []", () => {
  const only = groupByStage([G("m1", "2026-06-11T19:00:00Z")], Date.parse("2026-07-30T00:00:00Z"));
  assert.deepEqual(only.map((s) => s.key), ["group"]);
  assert.equal(only[0].current, true);
  assert.deepEqual(groupByStage([], Date.now()), []);
});
