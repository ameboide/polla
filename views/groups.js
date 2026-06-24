import { effectiveResults } from "./leaderboard.js";
import { flagFor } from "./flags.js";
import { setSim, getSim, clearSims, simResults } from "./sim-store.js";

// Head-to-head mini-table among a set of tied teams: points/goals counted only
// from matches played between those teams.
function headToHead(tiedNames, matches) {
  const stat = new Map([...tiedNames].map((n) => [n, { points: 0, gf: 0, ga: 0 }]));
  for (const m of matches) {
    if (!tiedNames.has(m.home) || !tiedNames.has(m.away)) continue;
    const h = stat.get(m.home);
    const a = stat.get(m.away);
    h.gf += m.homeGoals; h.ga += m.awayGoals;
    a.gf += m.awayGoals; a.ga += m.homeGoals;
    if (m.homeGoals > m.awayGoals) h.points += 3;
    else if (m.homeGoals < m.awayGoals) a.points += 3;
    else { h.points += 1; a.points += 1; }
  }
  return stat;
}

// Official 2026 tiebreakers: overall points, then (among teams still level) the
// head-to-head mini-table — points, goal difference, goals scored — then overall
// goal difference and goals scored. Fair-play (cards) and FIFA ranking come next
// officially, but fixtures carry no card/ranking data, so we stop there and use
// the team name as a deterministic final fallback.
// (Head-to-head uses one mini-table over the whole tied set; it does not
// recursively re-split a partially separated tie.)
function sortStandings(teams, matches) {
  teams.sort((a, b) => b.points - a.points);
  const out = [];
  for (let i = 0; i < teams.length;) {
    let j = i;
    while (j < teams.length && teams[j].points === teams[i].points) j++;
    const tied = teams.slice(i, j);
    if (tied.length > 1) {
      const h2h = headToHead(new Set(tied.map((t) => t.team)), matches);
      tied.sort((x, y) => {
        const hx = h2h.get(x.team);
        const hy = h2h.get(y.team);
        return (hy.points - hx.points)
          || ((hy.gf - hy.ga) - (hx.gf - hx.ga))
          || (hy.gf - hx.gf)
          || (y.gd - x.gd)
          || (y.gf - x.gf)
          || x.team.localeCompare(y.team);
      });
    }
    out.push(...tied);
    i = j;
  }
  return out;
}

// Standard football table for each group: 3 points a win, 1 a draw. Only matches
// with an effective result (admin entry or fixture's real score) count as played.
// Every team is listed even before kickoff. See sortStandings for tiebreakers.
export function groupStandings(fixtures, results) {
  const eff = new Map(effectiveResults(fixtures, results).map((r) => [r.matchId, r]));
  const groups = new Map();
  const ensureGroup = (g) => {
    if (!groups.has(g)) groups.set(g, { teams: new Map(), matches: [] });
    return groups.get(g);
  };
  const ensureTeam = (G, team) => {
    if (!G.teams.has(team)) {
      G.teams.set(team, { team, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 });
    }
    return G.teams.get(team);
  };

  for (const fx of fixtures) {
    if (fx.group == null) continue;
    const G = ensureGroup(fx.group);
    ensureTeam(G, fx.home);
    ensureTeam(G, fx.away);
    const r = eff.get(fx.id);
    if (!r) continue;
    const h = ensureTeam(G, fx.home);
    const a = ensureTeam(G, fx.away);
    h.played++; a.played++;
    h.gf += r.homeGoals; h.ga += r.awayGoals;
    a.gf += r.awayGoals; a.ga += r.homeGoals;
    if (r.homeGoals > r.awayGoals) { h.won++; a.lost++; h.points += 3; }
    else if (r.homeGoals < r.awayGoals) { a.won++; h.lost++; a.points += 3; }
    else { h.drawn++; a.drawn++; h.points += 1; a.points += 1; }
    G.matches.push({ home: fx.home, away: fx.away, homeGoals: r.homeGoals, awayGoals: r.awayGoals });
  }

  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([group, G]) => ({
      group,
      standings: sortStandings([...G.teams.values()].map((t) => ({ ...t, gd: t.gf - t.ga })), G.matches),
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

// Build the match list for a group. Played matches show their real score;
// unplayed ones get score inputs that write to the sim store. onSim is called
// after each edit so the caller can refresh the standings table in place.
function matchList(fixtures, group, realIds, onSim) {
  const list = document.createElement("ul");
  list.className = "group-matches";
  fixtures
    .filter((fx) => fx.group === group)
    .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff))
    .forEach((fx) => {
      const li = document.createElement("li");
      const real = realIds.get(fx.id);
      if (real) {
        li.textContent = `${flagFor(fx.home)} ${fx.home} ${real.homeGoals}-${real.awayGoals} ${fx.away} ${flagFor(fx.away)}`;
      } else {
        li.className = "sim-row";
        const sim = getSim(fx.id);
        const home = document.createElement("input");
        const away = document.createElement("input");
        [home, away].forEach((inp) => { inp.type = "number"; inp.min = "0"; inp.className = "sim-input"; });
        home.value = sim ? sim.homeGoals : "";
        away.value = sim ? sim.awayGoals : "";
        const onInput = () => { setSim(fx.id, home.value, away.value); onSim(); };
        home.addEventListener("input", onInput);
        away.addEventListener("input", onInput);
        li.append(
          `${flagFor(fx.home)} ${fx.home} `, home,
          document.createTextNode(" - "), away,
          ` ${fx.away} ${flagFor(fx.away)}`,
        );
      }
      list.appendChild(li);
    });
  return list;
}

export function renderGroups(root, ctx) {
  const { fixtures, results, predictions } = ctx.data;
  const player = ctx.player;
  // Played = has a real (admin/fixture) result; only unplayed matches simulate.
  const realIds = new Map(effectiveResults(fixtures, results).map((r) => [r.matchId, r]));
  const unplayed = fixtures.filter((fx) => !realIds.has(fx.id));
  // Standings recompute from real results plus the current simulations.
  const standingsFor = (group) =>
    (groupStandings(fixtures, results.concat(simResults())).find((g) => g.group === group) || {}).standings || [];

  if (!fixtures.length) {
    root.appendChild(document.createTextNode("No groups to show."));
    return;
  }

  const toolbar = document.createElement("div");
  toolbar.className = "sim-toolbar";
  const fillBtn = document.createElement("button");
  fillBtn.type = "button";
  fillBtn.textContent = "Fill with my predictions";
  fillBtn.disabled = !player;
  fillBtn.addEventListener("click", () => {
    unplayed.forEach((fx) => {
      const p = predictions.find((x) => x.player === player && x.matchId === fx.id);
      if (p) setSim(fx.id, p.homeGoals, p.awayGoals);
    });
    ctx.rerender();
  });
  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.textContent = "Clear simulations";
  clearBtn.addEventListener("click", () => { clearSims(); ctx.rerender(); });
  toolbar.append(fillBtn, " ", clearBtn);
  if (simResults().length) {
    toolbar.append(Object.assign(document.createElement("span"), {
      className: "sim-count", textContent: ` ${simResults().length} simulated`,
    }));
  }
  root.appendChild(toolbar);

  groupStandings(fixtures, results.concat(simResults())).forEach(({ group }) => {
    const section = document.createElement("section");
    section.className = "group";
    section.appendChild(Object.assign(document.createElement("h2"), { textContent: `Group ${group}` }));
    const tableHolder = document.createElement("div");
    tableHolder.appendChild(standingsTable(standingsFor(group)));
    section.appendChild(tableHolder);
    // Refresh just the table on each sim edit, keeping input focus.
    const refresh = () => tableHolder.replaceChildren(standingsTable(standingsFor(group)));
    section.appendChild(matchList(fixtures, group, realIds, refresh));
    root.appendChild(section);
  });
}
