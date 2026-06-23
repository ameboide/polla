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
    .sort((a, b) => b.points - a.points || a.player.localeCompare(b.player));
}

export function renderLeaderboard(root, ctx) {
  const { predictions, results, config } = ctx.data;
  const standings = computeStandings(predictions, results, config);
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
