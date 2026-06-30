import { score } from "../scoring.js";
import { advancerOf, predictedAdvancer, resolveKnockout } from "./knockout.js";

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

// matchId -> { round, home, away }. Group matches have round: null so the
// advancer bonus is never applied to them.
export function matchIndex(fixtures, results) {
  const idx = new Map();
  for (const fx of fixtures) {
    if (fx.group != null) idx.set(fx.id, { round: null, home: fx.home, away: fx.away });
  }
  for (const k of resolveKnockout(fixtures, results)) {
    idx.set(k.id, { round: k.round, home: k.home, away: k.away });
  }
  return idx;
}

function bonus(prediction, result, info, config) {
  if (!info || !info.round) return 0;
  const actual = advancerOf(result, info.home, info.away);
  const pick = predictedAdvancer(prediction, info.home, info.away);
  return actual && pick && actual === pick ? (config.advance || 0) : 0;
}

// Points a single player earned per match: Map(matchId -> points). Only
// includes matches that have an effective result AND a prediction by player.
export function pointsByMatch(fixtures, predictions, results, config, player) {
  const eff = new Map(effectiveResults(fixtures, results).map((r) => [r.matchId, r]));
  const resolved = new Map(resolveKnockout(fixtures, results).map((k) => [k.id, k]));
  const out = new Map();
  for (const fx of fixtures) {
    const r = eff.get(fx.id);
    const p = predictions.find((x) => x.player === player && x.matchId === fx.id);
    if (!r || !p) continue;
    let pts = score(p, r, config);
    const k = resolved.get(fx.id);
    if (k && k.round) pts += bonus(p, r, { round: k.round, home: k.home, away: k.away }, config);
    out.set(fx.id, pts);
  }
  return out;
}

// Unique player names appearing in predictions, sorted.
export function allPlayers(predictions) {
  return [...new Set(predictions.map((p) => p.player))].sort((a, b) => a.localeCompare(b));
}

// Match ids predicted by EVERY selected player (intersection). Empty if no
// players selected. This is the set the partial leaderboard scores over, so
// each selected player is judged on the exact same matches.
export function eligibleMatchIds(predictions, selectedPlayers) {
  if (selectedPlayers.length === 0) return new Set();
  const predictedBy = new Map(selectedPlayers.map((p) => [p, new Set()]));
  for (const pr of predictions) {
    const set = predictedBy.get(pr.player);
    if (set) set.add(pr.matchId);
  }
  const sets = [...predictedBy.values()];
  const [first, ...rest] = sets;
  return new Set([...first].filter((id) => rest.every((s) => s.has(id))));
}

// Standings restricted to the selected players and only the matches all of
// them predicted. Returns { standings, matchCount }.
export function partialStandings(predictions, results, config, selectedPlayers, index) {
  const eligible = eligibleMatchIds(predictions, selectedPlayers);
  const selected = new Set(selectedPlayers);
  const subset = predictions.filter((p) => selected.has(p.player) && eligible.has(p.matchId));
  return { standings: computeStandings(subset, results, config, index), matchCount: eligible.size };
}

export function computeStandings(predictions, results, config, index) {
  const resultByMatch = new Map(results.map((r) => [r.matchId, r]));
  const totals = new Map();
  for (const p of predictions) {
    const r = resultByMatch.get(p.matchId);
    let pts = r ? score(p, r, config) : 0;
    if (r && index) pts += bonus(p, r, index.get(p.matchId), config);
    totals.set(p.player, (totals.get(p.player) || 0) + pts);
  }
  return [...totals.entries()]
    .map(([player, points]) => ({ player, points }))
    .sort((a, b) => b.points - a.points || a.player.localeCompare(b.player));
}

// Build a standings table element, or a placeholder when empty.
function standingsTable(standings, emptyText) {
  if (!standings.length) return document.createTextNode(emptyText);
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
  return table;
}

export function renderLeaderboard(root, ctx) {
  const { fixtures, predictions, results, config } = ctx.data;
  const eff = effectiveResults(fixtures, results);
  const index = matchIndex(fixtures, results);

  root.appendChild(standingsTable(computeStandings(predictions, eff, config, index), "No standings yet."));

  // Partial leaderboard: a selectable subset of players scored only on the
  // matches all of them predicted. Starts with everyone selected.
  const players = allPlayers(predictions);
  if (players.length === 0) return;

  const section = document.createElement("section");
  section.className = "partial-leaderboard";
  const h = document.createElement("h2");
  h.textContent = "Partial leaderboard";
  section.appendChild(h);

  const note = document.createElement("p");
  note.className = "partial-note";
  section.appendChild(note);

  const picker = document.createElement("div");
  picker.className = "player-picker";
  const selected = new Set(players);
  const checks = players.map((player) => {
    const label = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = true;
    cb.value = player;
    cb.addEventListener("change", () => {
      if (cb.checked) selected.add(player); else selected.delete(player);
      renderPartial();
    });
    label.append(cb, document.createTextNode(" " + player));
    picker.appendChild(label);
    return cb;
  });
  section.appendChild(picker);

  const tableHolder = document.createElement("div");
  section.appendChild(tableHolder);

  function renderPartial() {
    const chosen = players.filter((p) => selected.has(p));
    const { standings, matchCount } = partialStandings(predictions, eff, config, chosen, index);
    note.textContent = chosen.length
      ? `Scoring ${chosen.length} player(s) over ${matchCount} match(es) all of them predicted.`
      : "Select at least one player.";
    tableHolder.innerHTML = "";
    tableHolder.appendChild(standingsTable(standings, "No common matches yet."));
  }
  renderPartial();
  root.appendChild(section);
}
