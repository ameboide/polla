import { resolveKnockout, koDisplayOrder, KO_ROUNDS } from "./knockout.js";
import { flagFor } from "./flags.js";

function teamSpan(label, team, isWinner) {
  const el = document.createElement("div");
  el.className = "bk-slot" + (team ? "" : " undefined") + (isWinner ? " winner" : "");
  el.textContent = team ? `${flagFor(team)} ${team}`.trim() : label;
  return el;
}

function matchCard(m) {
  const card = document.createElement("div");
  card.className = "bk-match";
  const head = document.createElement("span");
  head.className = "bk-num";
  head.textContent = m.result
    ? `Match ${m.match} · ${m.result.homeGoals}-${m.result.awayGoals}`
    : `Match ${m.match}`;
  card.appendChild(head);
  card.appendChild(teamSpan(m.homeLabel, m.home, m.winner && m.winner === m.home));
  card.appendChild(teamSpan(m.awayLabel, m.away, m.winner && m.winner === m.away));
  return card;
}

export function renderBracket(root, ctx) {
  const { fixtures, results } = ctx.data;
  const resolved = resolveKnockout(fixtures, results);
  const byNo = new Map(resolved.map((m) => [m.match, m]));
  const order = koDisplayOrder();

  const wrap = document.createElement("div");
  wrap.className = "bracket";
  for (const round of KO_ROUNDS) {
    if (round === "Third place") continue; // rendered separately below
    const col = document.createElement("div");
    col.className = "bk-round";
    col.appendChild(Object.assign(document.createElement("h2"), { textContent: round }));
    const body = document.createElement("div");
    body.className = "bk-body";
    order[round].forEach((no) => body.appendChild(matchCard(byNo.get(no))));
    col.appendChild(body);
    wrap.appendChild(col);
  }
  root.appendChild(wrap);

  const third = byNo.get(103);
  if (third) {
    const tp = document.createElement("div");
    tp.className = "bk-thirdplace";
    tp.appendChild(Object.assign(document.createElement("h2"), { textContent: "Third place" }));
    tp.appendChild(matchCard(third));
    root.appendChild(tp);
  }
}
