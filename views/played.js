import { score } from "../scoring.js";
import { effectiveResults } from "./leaderboard.js";
import { groupFixturesByDay } from "./grouping.js";
import { flagFor } from "./flags.js";
import { makeCollapseAllControl } from "./collapse-all.js";

// Fixtures whose kickoff has passed. Predictions are only revealed to other
// players once a match has started, so nobody can copy before kickoff.
export function pastFixtures(fixtures, now) {
  return fixtures.filter((fx) => now >= Date.parse(fx.kickoff));
}

// Every player's prediction for one match, scored against the result (or null
// points if no result yet), sorted best-first then by name.
export function predictionRows(predictions, matchId, result, config) {
  return predictions
    .filter((p) => p.matchId === matchId)
    .map((p) => ({
      player: p.player,
      homeGoals: p.homeGoals,
      awayGoals: p.awayGoals,
      points: result ? score(p, result, config) : null,
    }))
    .sort((a, b) => (b.points ?? -1) - (a.points ?? -1) || a.player.localeCompare(b.player));
}

export function renderPlayed(root, ctx) {
  const { fixtures, predictions, results, config } = ctx.data;
  const past = pastFixtures(fixtures, Date.now());
  if (!past.length) {
    root.appendChild(document.createTextNode("No matches have kicked off yet."));
    return;
  }
  const resultByMatch = new Map(effectiveResults(fixtures, results).map((r) => [r.matchId, r]));

  const collapseAll = makeCollapseAllControl(root);
  const toolbar = document.createElement("div");
  toolbar.className = "group-toolbar";
  toolbar.appendChild(collapseAll.btn);
  root.appendChild(toolbar);

  groupFixturesByDay(past).forEach((day) => {
    const details = document.createElement("details");
    details.className = "day" + (day.isPast ? " past" : "");
    details.open = !day.isPast;
    details.appendChild(Object.assign(document.createElement("summary"), {
      textContent: `${day.label} — ${day.fixtures.length} matches`,
    }));

    day.fixtures.forEach((fx) => {
      const result = resultByMatch.get(fx.id) || null;
      const card = document.createElement("div");
      card.className = "match";

      const head = document.createElement("div");
      head.className = "match-head";
      head.appendChild(Object.assign(document.createElement("span"), {
        textContent: `[${fx.group}] ${flagFor(fx.home)} ${fx.home} vs ${fx.away} ${flagFor(fx.away)}`,
      }));
      head.appendChild(Object.assign(document.createElement("span"), {
        className: "match-time",
        textContent: result ? `${result.homeGoals}-${result.awayGoals}` : "—",
      }));
      card.appendChild(head);

      const rows = predictionRows(predictions, fx.id, result, config);
      if (!rows.length) {
        card.appendChild(Object.assign(document.createElement("div"), {
          className: "result-info", textContent: "No predictions.",
        }));
      } else {
        const table = document.createElement("table");
        const body = document.createElement("tbody");
        rows.forEach((r) => {
          const tr = document.createElement("tr");
          const nameTd = document.createElement("td"); nameTd.textContent = r.player;
          const predTd = document.createElement("td"); predTd.textContent = `${r.homeGoals}-${r.awayGoals}`;
          const ptsTd = document.createElement("td"); ptsTd.textContent = r.points === null ? "" : `${r.points} pts`;
          tr.append(nameTd, predTd, ptsTd);
          body.appendChild(tr);
        });
        table.appendChild(body);
        card.appendChild(table);
      }
      details.appendChild(card);
    });
    root.appendChild(details);
  });

  collapseAll.sync();
}
