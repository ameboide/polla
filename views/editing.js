// Pure diff helpers for the batch-edit grids (predict + admin results).

// Both score fields must be filled for an entry to be savable.
export function parseScore(homeStr, awayStr) {
  if (homeStr === "" || awayStr === "") return null;
  return { homeGoals: Number(homeStr), awayGoals: Number(awayStr) };
}

// An entry is dirty when its current inputs differ from the saved baseline.
// baseline is {homeGoals, awayGoals} or null (never saved).
export function isDirty(baseline, homeStr, awayStr) {
  const cur = parseScore(homeStr, awayStr);
  if (!cur) {
    // Incomplete: dirty if anything is typed, or if a baseline was cleared.
    if (!baseline) return homeStr !== "" || awayStr !== "";
    return true;
  }
  if (!baseline) return true;
  return cur.homeGoals !== baseline.homeGoals || cur.awayGoals !== baseline.awayGoals;
}

// Reduce a list of {key, baseline, homeStr, awayStr} into counts plus the
// subset that is dirty AND complete (ready to send).
export function summarizeEdits(entries) {
  const saveable = [];
  let dirtyCount = 0;
  let incompleteCount = 0;
  for (const e of entries) {
    if (!isDirty(e.baseline, e.homeStr, e.awayStr)) continue;
    dirtyCount++;
    const fields = parseScore(e.homeStr, e.awayStr);
    if (fields) saveable.push({ key: e.key, fields });
    else incompleteCount++;
  }
  return { dirtyCount, incompleteCount, saveable };
}
