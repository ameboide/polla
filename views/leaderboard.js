import { score } from "../scoring.js";

// The result used for scoring a match: the admin's entered result if present,
// otherwise the fixture's real result baked into fixtures.json. Matches with
// neither are simply omitted (treated as not yet played).
export function effectiveResults(fixtures, adminResults) {
  const byMatch = new Map(adminResults.map((r) => [r.matchId, r]));
  const out = [];
  for (const fx of fixtures) {
    const admin = byMatch.get(fx.id);
    if (admin) out.push({ matchId: fx.id, homeGoals: admin.homeGoals, awayGoals: admin.awayGoals });
    else if (fx.result) out.push({ matchId: fx.id, homeGoals: fx.result.homeGoals, awayGoals: fx.result.awayGoals });
  }
  return out;
}

// Points a single player earned per match: Map(matchId -> points). Only
// includes matches that have an effective result AND a prediction by player.
export function pointsByMatch(fixtures, predictions, results, config, player) {
  const eff = new Map(effectiveResults(fixtures, results).map((r) => [r.matchId, r]));
  const out = new Map();
  for (const fx of fixtures) {
    const r = eff.get(fx.id);
    const p = predictions.find((x) => x.player === player && x.matchId === fx.id);
    if (r && p) out.set(fx.id, score(p, r, config));
  }
  return out;
}

export function computeStandings(predictions, results, config) {
  const resultByMatch = new Map(results.map((r) => [r.matchId, r]));
  const totals = new Map();
  for (const p of predictions) {
    const r = resultByMatch.get(p.matchId);
    const pts = r ? score(p, r, config) : 0;
    totals.set(p.player, (totals.get(p.player) || 0) + pts);
  }
  return [...totals.entries()]
    .map(([player, points]) => ({ player, points }))
    .sort((a, b) => b.points - a.points || a.player.localeCompare(b.player));
}

export function renderLeaderboard(root, ctx) {
  const { fixtures, predictions, results, config } = ctx.data;
  const standings = computeStandings(predictions, effectiveResults(fixtures, results), config);
  const table = document.createElement("table");
  table.innerHTML = "<thead><tr><th>#</th><th>Player</th><th>Points</th></tr></thead>";
  const body = document.createElement("tbody");
  standings.forEach((row, i) => {
    const tr = document.createElement("tr");
    const rankTd = document.createElement("td"); rankTd.textContent = i + 1;
    const nameTd = document.createElement("td"); nameTd.textContent = row.player;
    const ptsTd = document.createElement("td"); ptsTd.textContent = row.points;
    tr.append(rankTd, nameTd, ptsTd);
    body.appendChild(tr);
  });
  table.appendChild(body);
  root.appendChild(standings.length ? table : document.createTextNode("No standings yet."));
}
