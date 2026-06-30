import { score } from "../scoring.js";
import { effectiveResults } from "./leaderboard.js";
import { resolveKnockout, advancerOf, predictedAdvancer } from "./knockout.js";
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
// info: optional { round, home, away } for knockout matches — adds advancer
// bonus and exposes each row's advancer pick.
export function predictionRows(predictions, matchId, result, config, info) {
  return predictions
    .filter((p) => p.matchId === matchId)
    .map((p) => {
      let points = result ? score(p, result, config) : null;
      if (points !== null && info && info.round) {
        const a = advancerOf(result, info.home, info.away);
        const pick = predictedAdvancer(p, info.home, info.away);
        if (a && pick && a === pick) points += config.advance || 0;
      }
      const row = {
        player: p.player,
        homeGoals: p.homeGoals,
        awayGoals: p.awayGoals,
        points,
      };
      if (info && info.round) row.advancer = p.advancer;
      return row;
    })
    .sort((a, b) => (b.points ?? -1) - (a.points ?? -1) || a.player.localeCompare(b.player));
}

export function renderPlayed(root, ctx) {
  const { fixtures, predictions, results, config } = ctx.data;
  const resolved = resolveKnockout(fixtures, results);
  const resolvedById = new Map(resolved.map((k) => [k.id, k]));
  // Group fixtures keep their own home/away; knockout fixtures take resolved teams.
  const allMatches = fixtures.map((fx) => {
    const k = resolvedById.get(fx.id);
    return k ? { ...fx, home: k.home, away: k.away, round: k.round } : fx;
  });
  const past = pastFixtures(allMatches, Date.now());
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
      const k = resolvedById.get(fx.id);
      const info = k && k.round ? { round: k.round, home: k.home, away: k.away } : null;
      const card = document.createElement("div");
      card.className = "match";

      const head = document.createElement("div");
      head.className = "match-head";
      const tag = fx.group ? `[${fx.group}]` : `[${fx.round}]`;
      const homeName = fx.home || (k ? k.homeLabel : "?");
      const awayName = fx.away || (k ? k.awayLabel : "?");
      head.appendChild(Object.assign(document.createElement("span"), {
        textContent: `${tag} ${flagFor(homeName)} ${homeName} vs ${awayName} ${flagFor(awayName)}`,
      }));
      let scoreText = result ? `${result.homeGoals}-${result.awayGoals}` : "—";
      if (result && info) {
        const adv = advancerOf(result, info.home, info.away);
        if (result.homeGoals === result.awayGoals && adv) scoreText += ` (${adv} adv.)`;
      }
      head.appendChild(Object.assign(document.createElement("span"), {
        className: "match-time", textContent: scoreText,
      }));
      card.appendChild(head);

      const rows = predictionRows(predictions, fx.id, result, config, info);
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
          const predTd = document.createElement("td");
          predTd.textContent = r.advancer
            ? `${r.homeGoals}-${r.awayGoals} (${r.advancer})`
            : `${r.homeGoals}-${r.awayGoals}`;
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
