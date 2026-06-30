// Pure diff helpers for the batch-edit grids (predict + admin results).

// Both score fields must be filled for an entry to be savable.
export function parseScore(homeStr, awayStr) {
  if (homeStr === "" || awayStr === "") return null;
  return { homeGoals: Number(homeStr), awayGoals: Number(awayStr) };
}

// An entry is dirty when its current inputs differ from the saved baseline.
// baseline is {homeGoals, awayGoals} or null (never saved).
// extra is optional {value, baseline}; when present, dirty if value !== baseline.
export function isDirty(baseline, homeStr, awayStr, extra) {
  const cur = parseScore(homeStr, awayStr);
  const extraDirty = extra ? extra.value !== extra.baseline : false;
  if (!cur) {
    // Incomplete: dirty if anything is typed, or if a baseline was cleared.
    if (!baseline) return extraDirty || homeStr !== "" || awayStr !== "";
    return true;
  }
  if (!baseline) return true;
  if (cur.homeGoals !== baseline.homeGoals || cur.awayGoals !== baseline.awayGoals) return true;
  return extraDirty;
}

// Reduce a list of {key, baseline, homeStr, awayStr[, extra]} into counts plus
// the subset that is dirty AND complete (ready to send). When an entry carries
// a truthy extra.value, it is folded into the saved fields as `advancer`.
export function summarizeEdits(entries) {
  const saveable = [];
  let dirtyCount = 0;
  let incompleteCount = 0;
  for (const e of entries) {
    if (!isDirty(e.baseline, e.homeStr, e.awayStr, e.extra)) continue;
    dirtyCount++;
    const fields = parseScore(e.homeStr, e.awayStr);
    if (fields) {
      if (e.extra && e.extra.value) fields.advancer = e.extra.value;
      saveable.push({ key: e.key, fields });
    } else incompleteCount++;
  }
  return { dirtyCount, incompleteCount, saveable };
}
