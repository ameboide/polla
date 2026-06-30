// Stage classification + partitioning shared by the match lists (Predict,
// Admin, Played) and the partial leaderboard's stage filter.

export const STAGES = [
  { key: "group", label: "Group stage" },
  { key: "knockout", label: "Knockout stage" },
];

// A match's (or matchIndex entry's) stage. Knockout fixtures/entries carry a
// truthy `round`; group ones do not.
export function stageOf(m) {
  return m && m.round ? "knockout" : "group";
}

// Partition fixtures into the non-empty stages (STAGES order), preserving each
// stage's fixture order. Exactly one returned stage is current: the first with
// an upcoming match (kickoff > now), else the last present stage.
export function groupByStage(fixtures, now) {
  const buckets = new Map(STAGES.map((s) => [s.key, []]));
  for (const fx of fixtures) buckets.get(stageOf(fx)).push(fx);
  const present = STAGES
    .filter((s) => buckets.get(s.key).length)
    .map((s) => ({ key: s.key, label: s.label, fixtures: buckets.get(s.key) }));
  let currentKey = null;
  for (const s of present) {
    if (s.fixtures.some((fx) => Date.parse(fx.kickoff) > now)) { currentKey = s.key; break; }
  }
  if (currentKey === null && present.length) currentKey = present[present.length - 1].key;
  return present.map((s) => ({ ...s, current: s.key === currentKey }));
}
