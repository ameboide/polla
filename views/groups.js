import { effectiveResults } from "./leaderboard.js";
import { flagFor } from "./flags.js";
import { setSim, getSim, clearSims, simResults } from "./sim-store.js";

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
