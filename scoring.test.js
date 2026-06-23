import { test } from "node:test";
import assert from "node:assert/strict";
import { score, outcome } from "./scoring.js";

const W = { winner: 5, exactScore: 10, goalDiff: 3, totalGoals: 2, eachTeamGoals: 1 };

test("outcome classifies result", () => {
  assert.equal(outcome({ homeGoals: 2, awayGoals: 1 }), "home");
  assert.equal(outcome({ homeGoals: 1, awayGoals: 1 }), "draw");
  assert.equal(outcome({ homeGoals: 0, awayGoals: 3 }), "away");
});

test("exact score earns every component", () => {
  // 2-1 vs 2-1: winner+exact+goalDiff+totalGoals+both teams = 5+10+3+2+1+1
  assert.equal(score({ homeGoals: 2, awayGoals: 1 }, { homeGoals: 2, awayGoals: 1 }, W), 22);
});

test("correct outcome only", () => {
  // 3-0 vs 1-0: same winner(home), diff goalDiff(3 vs1), diff total(3 vs1),
  // away team goals match(0), home team 3 vs 1 no.
  assert.equal(score({ homeGoals: 3, awayGoals: 0 }, { homeGoals: 1, awayGoals: 0 }, W), 5 + 1);
});

test("goal difference without exact", () => {
  // 2-1 vs 3-2: winner home both, goalDiff 1==1, total 3 vs 5 no, teams no.
  assert.equal(score({ homeGoals: 2, awayGoals: 1 }, { homeGoals: 3, awayGoals: 2 }, W), 5 + 3);
});

test("total goals without exact or diff", () => {
  // 3-0 vs 0-3: winner home vs away no, goalDiff 3 vs -3 no, total 3==3 yes, teams no.
  assert.equal(score({ homeGoals: 3, awayGoals: 0 }, { homeGoals: 0, awayGoals: 3 }, W), 2);
});

test("each-team-goals gives partial credit", () => {
  // 2-0 vs 2-3: home goals 2==2 (yes), away 0 vs3 no, winner home vs away no,
  // diff 2 vs -1 no, total 2 vs5 no => only one team = 1.
  assert.equal(score({ homeGoals: 2, awayGoals: 0 }, { homeGoals: 2, awayGoals: 3 }, W), 1);
});

test("zero weights score zero", () => {
  const Z = { winner: 0, exactScore: 0, goalDiff: 0, totalGoals: 0, eachTeamGoals: 0 };
  assert.equal(score({ homeGoals: 1, awayGoals: 1 }, { homeGoals: 1, awayGoals: 1 }, Z), 0);
});
