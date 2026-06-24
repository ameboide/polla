import { effectiveResults } from "./leaderboard.js";
import { groupStandings } from "./groups.js";
import { flagFor } from "./flags.js";
import { simResults } from "./sim-store.js";

// Slot builders. A slot is one side of a knockout match before teams resolve.
const w = (g) => ({ kind: "winner", group: g });   // group winner -> "1X"
const r = (g) => ({ kind: "runner", group: g });   // group runner-up -> "2X"
const th = (...gs) => ({ kind: "third", groups: gs }); // best-third from a set
const mw = (m) => ({ kind: "matchWinner", match: m });
const ml = (m) => ({ kind: "matchLoser", match: m });

// The official 2026 FIFA World Cup knockout bracket (matches 73–104).
export const BRACKET = [
  { round: "Round of 32", matches: [
    { match: 73, slots: [r("A"), r("B")] },
    { match: 74, slots: [w("E"), th("A", "B", "C", "D", "F")] },
    { match: 75, slots: [w("F"), r("C")] },
    { match: 76, slots: [w("C"), r("F")] },
    { match: 77, slots: [w("I"), th("C", "D", "F", "G", "H")] },
    { match: 78, slots: [r("E"), r("I")] },
    { match: 79, slots: [w("A"), th("C", "E", "F", "H", "I")] },
    { match: 80, slots: [w("L"), th("E", "H", "I", "J", "K")] },
    { match: 81, slots: [w("D"), th("B", "E", "F", "I", "J")] },
    { match: 82, slots: [w("G"), th("A", "E", "H", "I", "J")] },
    { match: 83, slots: [r("K"), r("L")] },
    { match: 84, slots: [w("H"), r("J")] },
    { match: 85, slots: [w("B"), th("E", "F", "G", "I", "J")] },
    { match: 86, slots: [w("J"), r("H")] },
    { match: 87, slots: [w("K"), th("D", "E", "I", "J", "L")] },
    { match: 88, slots: [r("D"), r("G")] },
  ] },
  { round: "Round of 16", matches: [
    { match: 89, slots: [mw(74), mw(77)] },
    { match: 90, slots: [mw(73), mw(75)] },
    { match: 91, slots: [mw(76), mw(78)] },
    { match: 92, slots: [mw(79), mw(80)] },
    { match: 93, slots: [mw(83), mw(84)] },
    { match: 94, slots: [mw(81), mw(82)] },
    { match: 95, slots: [mw(86), mw(88)] },
    { match: 96, slots: [mw(85), mw(87)] },
  ] },
  { round: "Quarter-finals", matches: [
    { match: 97, slots: [mw(89), mw(90)] },
    { match: 98, slots: [mw(93), mw(94)] },
    { match: 99, slots: [mw(91), mw(92)] },
    { match: 100, slots: [mw(95), mw(96)] },
  ] },
  { round: "Semi-finals", matches: [
    { match: 101, slots: [mw(97), mw(98)] },
    { match: 102, slots: [mw(99), mw(100)] },
  ] },
  { round: "Third place", matches: [
    { match: 103, slots: [ml(101), ml(102)] },
  ] },
  { round: "Final", matches: [
    { match: 104, slots: [mw(101), mw(102)] },
  ] },
];

const MATCHES_PER_GROUP = 6; // 4 teams, round-robin

// The eight third-place slots and the group letters each may officially draw a
// third-placed team from.
const THIRD_SLOTS = BRACKET.flatMap((r) => r.matches)
  .map((m) => ({ match: m.match, third: m.slots.find((s) => s.kind === "third") }))
  .filter((x) => x.third)
  .map((x) => ({ match: x.match, groups: x.third.groups }));

// Assign qualifying third-place groups to slots respecting each slot's allowed
// set, one group per slot (Kuhn's bipartite matching). This approximates FIFA's
// official 495-row allocation table — it always yields a valid, clash-free
// assignment, but for a given set of qualifiers may pick a different valid
// matching than the official table.
function matchThirds(qualifying) {
  const byMatch = new Map(THIRD_SLOTS.map((s) => [s.match, s]));
  const groupToSlot = new Map();
  const slotToGroup = new Map();
  const augment = (slot, visited) => {
    for (const g of slot.groups) {
      if (!qualifying.has(g) || visited.has(g)) continue;
      visited.add(g);
      const occ = groupToSlot.get(g);
      if (occ === undefined || augment(byMatch.get(occ), visited)) {
        groupToSlot.set(g, slot.match);
        slotToGroup.set(slot.match, g);
        return true;
      }
    }
    return false;
  };
  for (const slot of THIRD_SLOTS) augment(slot, new Set());
  return slotToGroup;
}

// Resolve every slot against the current standings. A group winner/runner-up
// slot is "defined" once that group's six matches are all played; until then
// it carries the criterion label plus the team currently in that position
// (shown greyed). Third-place and match-feed slots have no single current team,
// so they stay as a greyed criterion.
// Simulated results (sims) shift the standings used for the provisional team in
// each slot, but completeness is judged on REAL results only — so a group
// filled in purely by simulation still reads as undefined (greyed criterion).
export function buildBracket(fixtures, results, sims = []) {
  const byGroup = new Map(groupStandings(fixtures, results.concat(sims)).map((g) => [g.group, g.standings]));
  const realPlayed = new Set(effectiveResults(fixtures, results).map((x) => x.matchId));
  const playedInGroup = (set, g) => fixtures.filter((fx) => fx.group === g && set.has(fx.id)).length;
  const complete = (g) => playedInGroup(realPlayed, g) >= MATCHES_PER_GROUP;

  // Third-place allocation, sim-aware: a group's third counts once that group is
  // complete in the combined (real+sim) results. Rank the best eight, then match
  // them to slots. These stay greyed (defined:false) — provisional, not official.
  const combinedPlayed = new Set(effectiveResults(fixtures, results.concat(sims)).map((x) => x.matchId));
  const thirds = [...byGroup.keys()]
    .filter((g) => playedInGroup(combinedPlayed, g) >= MATCHES_PER_GROUP)
    .map((g) => ({ group: g, t: byGroup.get(g)[2] }))
    .filter((x) => x.t)
    .map((x) => ({ group: x.group, team: x.t.team, points: x.t.points, gd: x.t.gd, gf: x.t.gf }))
    .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.group.localeCompare(b.group))
    .slice(0, 8);
  const teamByGroup = new Map(thirds.map((t) => [t.group, t.team]));
  const slotToGroup = matchThirds(new Set(thirds.map((t) => t.group)));

  function resolve(slot, matchNo) {
    if (slot.kind === "winner" || slot.kind === "runner") {
      const pos = slot.kind === "winner" ? 0 : 1;
      const label = (pos === 0 ? "1" : "2") + slot.group;
      const team = (byGroup.get(slot.group) || [])[pos]?.team || null;
      if (complete(slot.group) && team) return { defined: true, label, team };
      return { defined: false, label, team }; // team is the provisional occupant
    }
    if (slot.kind === "third") {
      const g = slotToGroup.get(matchNo);
      return { defined: false, label: `3rd ${slot.groups.join("/")}`, team: g ? teamByGroup.get(g) : undefined };
    }
    if (slot.kind === "matchWinner") return { defined: false, label: `Winner ${slot.match}` };
    return { defined: false, label: `Loser ${slot.match}` };
  }

  return BRACKET.map((round) => ({
    round: round.round,
    matches: round.matches.map((m) => ({ match: m.match, slots: m.slots.map((s) => resolve(s, m.match)) })),
  }));
}

// Visual top-to-bottom order of matches in each round. A bracket only lines up
// if a round's matches follow the tournament tree (R32 is numbered 73–88 but
// feeds R16 out of order), so we DFS the feeds from the Final and order every
// round by the position of its left-most Round-of-32 leaf.
export function displayOrder() {
  const byNo = new Map(BRACKET.flatMap((r) => r.matches).map((m) => [m.match, m]));
  const leaves = (no) => {
    const feeds = byNo.get(no).slots.filter((s) => s.kind === "matchWinner").map((s) => s.match);
    return feeds.length ? feeds.flatMap(leaves) : [no];
  };
  const r32 = leaves(104);
  const firstLeafIndex = (no) => r32.indexOf(leaves(no)[0]);
  const out = {};
  for (const r of BRACKET) {
    out[r.round] = r.matches.map((m) => m.match).sort((a, b) => firstLeafIndex(a) - firstLeafIndex(b));
  }
  return out;
}

function matchCard(m) {
  const card = document.createElement("div");
  card.className = "bk-match";
  card.appendChild(Object.assign(document.createElement("span"), {
    className: "bk-num", textContent: `Match ${m.match}`,
  }));
  m.slots.forEach((s) => card.appendChild(slotEl(s)));
  return card;
}

function slotEl(slot) {
  const el = document.createElement("div");
  el.className = "bk-slot" + (slot.defined ? "" : " undefined");
  if (slot.defined) {
    el.textContent = `${flagFor(slot.team)} ${slot.team}`.trim();
  } else {
    el.appendChild(Object.assign(document.createElement("span"), {
      className: "bk-crit", textContent: slot.label,
    }));
    if (slot.team) {
      el.appendChild(Object.assign(document.createElement("span"), {
        className: "bk-prov", textContent: `${flagFor(slot.team)} ${slot.team}`.trim(),
      }));
    }
  }
  return el;
}

export function renderBracket(root, ctx) {
  const { fixtures, results } = ctx.data;
  const rounds = buildBracket(fixtures, results, simResults());
  const byNo = new Map(rounds.flatMap((r) => r.matches).map((m) => [m.match, m]));
  const order = displayOrder();

  const wrap = document.createElement("div");
  wrap.className = "bracket";
  // Equal-height columns + space-around (see CSS) center each round's matches
  // in the gaps between their feeders, giving the staircase bracket look.
  rounds.forEach(({ round }) => {
    if (round === "Third place") return; // sits outside the tree; rendered below
    const col = document.createElement("div");
    col.className = "bk-round";
    col.appendChild(Object.assign(document.createElement("h2"), { textContent: round }));
    const body = document.createElement("div");
    body.className = "bk-body";
    order[round].forEach((no) => body.appendChild(matchCard(byNo.get(no))));
    col.appendChild(body);
    wrap.appendChild(col);
  });
  root.appendChild(wrap);

  const third = rounds.find((r) => r.round === "Third place");
  if (third) {
    const tp = document.createElement("div");
    tp.className = "bk-thirdplace";
    tp.appendChild(Object.assign(document.createElement("h2"), { textContent: "Third place" }));
    third.matches.forEach((m) => tp.appendChild(matchCard(m)));
    root.appendChild(tp);
  }
}
