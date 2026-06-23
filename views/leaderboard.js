import { score } from "../scoring.js";

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
    .sort((a, b) => b.points - a.points);
}

export function renderLeaderboard(root, ctx) {
  const { predictions, results, config } = ctx.data;
  const standings = computeStandings(predictions, results, config);
  const table = document.createElement("table");
  table.innerHTML = "<thead><tr><th>#</th><th>Player</th><th>Points</th></tr></thead>";
  const body = document.createElement("tbody");
  standings.forEach((row, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i + 1}</td><td>${row.player}</td><td>${row.points}</td>`;
    body.appendChild(tr);
  });
  table.appendChild(body);
  root.appendChild(standings.length ? table : document.createTextNode("No standings yet."));
}
