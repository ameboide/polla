// Ephemeral "what-if" results used to simulate group outcomes. Kept only in
// memory (never persisted to the DB and gone on reload), shared by the Groups
// and Knockout views so a simulation in one shows up in the other.
const sims = new Map();

// A complete sim needs both scores; a blank/partial entry clears that match.
export function setSim(matchId, homeGoals, awayGoals) {
  const blank = (v) => v === "" || v === null || v === undefined;
  if (blank(homeGoals) || blank(awayGoals)) sims.delete(matchId);
  else sims.set(matchId, { homeGoals: Number(homeGoals), awayGoals: Number(awayGoals) });
}

export function getSim(matchId) {
  return sims.get(matchId) || null;
}

export function clearSims() {
  sims.clear();
}

// Shaped like the stored results rows so it can be concatenated with them.
export function simResults() {
  return [...sims.entries()].map(([matchId, v]) => ({ matchId, ...v }));
}
