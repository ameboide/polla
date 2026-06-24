import { effectiveResults } from "./leaderboard.js";
import { flagFor } from "./flags.js";

// Standard football table for each group: 3 points a win, 1 a draw. Only matches
// with an effective result (admin entry or fixture's real score) count as played.
// Every team is listed even before kickoff. Sorted by points, then goal
// difference, then goals for, then name.
export function groupStandings(fixtures, results) {
  const eff = new Map(effectiveResults(fixtures, results).map((r) => [r.matchId, r]));
  const groups = new Map();
  const ensure = (group, team) => {
    if (!groups.has(group)) groups.set(group, new Map());
    const g = groups.get(group);
    if (!g.has(team)) {
      g.set(team, { team, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 });
    }
    return g.get(team);
  };

  for (const fx of fixtures) {
    if (fx.group == null) continue;
    ensure(fx.group, fx.home);
    ensure(fx.group, fx.away);
    const r = eff.get(fx.id);
    if (!r) continue;
    const h = ensure(fx.group, fx.home);
    const a = ensure(fx.group, fx.away);
    h.played++; a.played++;
    h.gf += r.homeGoals; h.ga += r.awayGoals;
    a.gf += r.awayGoals; a.ga += r.homeGoals;
    if (r.homeGoals > r.awayGoals) { h.won++; a.lost++; h.points += 3; }
    else if (r.homeGoals < r.awayGoals) { a.won++; h.lost++; a.points += 3; }
    else { h.drawn++; a.drawn++; h.points++; a.points++; }
  }

  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([group, teams]) => ({
      group,
      standings: [...teams.values()]
        .map((t) => ({ ...t, gd: t.gf - t.ga }))
        .sort((x, y) => y.points - x.points || y.gd - x.gd || y.gf - x.gf || x.team.localeCompare(y.team)),
    }));
}

const COLS = [
  ["played", "P"], ["won", "W"], ["drawn", "D"], ["lost", "L"],
  ["gf", "GF"], ["ga", "GA"], ["gd", "GD"], ["points", "Pts"],
];

function standingsTable(standings) {
  const table = document.createElement("table");
  table.className = "group-table";
  table.innerHTML =
    "<thead><tr><th>Team</th>" + COLS.map(([, h]) => `<th>${h}</th>`).join("") + "</tr></thead>";
  const body = document.createElement("tbody");
  standings.forEach((t) => {
    const tr = document.createElement("tr");
    const nameTd = document.createElement("td");
    nameTd.textContent = `${flagFor(t.team)} ${t.team}`;
    tr.appendChild(nameTd);
    COLS.forEach(([key]) => {
      const td = document.createElement("td");
      td.textContent = t[key];
      if (key === "points") td.className = "pts";
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });
  table.appendChild(body);
  return table;
}

function matchList(fixtures, group, eff) {
  const list = document.createElement("ul");
  list.className = "group-matches";
  fixtures
    .filter((fx) => fx.group === group)
    .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff))
    .forEach((fx) => {
      const r = eff.get(fx.id);
      const li = document.createElement("li");
      li.textContent = r
        ? `${flagFor(fx.home)} ${fx.home} ${r.homeGoals}-${r.awayGoals} ${fx.away} ${flagFor(fx.away)}`
        : `${flagFor(fx.home)} ${fx.home} vs ${fx.away} ${flagFor(fx.away)} — not played`;
      list.appendChild(li);
    });
  return list;
}

export function renderGroups(root, ctx) {
  const { fixtures, results } = ctx.data;
  const eff = new Map(effectiveResults(fixtures, results).map((r) => [r.matchId, r]));
  const tables = groupStandings(fixtures, results);
  if (!tables.length) {
    root.appendChild(document.createTextNode("No groups to show."));
    return;
  }
  tables.forEach(({ group, standings }) => {
    const section = document.createElement("section");
    section.className = "group";
    section.appendChild(Object.assign(document.createElement("h2"), { textContent: `Group ${group}` }));
    section.appendChild(standingsTable(standings));
    section.appendChild(matchList(fixtures, group, eff));
    root.appendChild(section);
  });
}
