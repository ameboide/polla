// The knockout bracket: feed tree, team resolution, and advancer logic.
// Pure module — no DOM, no storage. The Knockout/Predict/Played/Leaderboard
// views all read resolved matchups from here.

export const KO_ROUNDS = [
  "Round of 32", "Round of 16", "Quarter-finals", "Semi-finals", "Third place", "Final",
];

// Each node: the match number, its round, and the two feeder matches whose
// WINNERS fill its [home, away] slots (null for Round of 32 — teams come from
// fixtures.json). The third-place match (103) is fed by the LOSERS of 101/102.
const R32 = [73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88];
export const KO_TREE = [
  ...R32.map((match) => ({ match, round: "Round of 32", feeds: null })),
  { match: 89, round: "Round of 16", feeds: [73, 76] },
  { match: 90, round: "Round of 16", feeds: [75, 77] },
  { match: 91, round: "Round of 16", feeds: [74, 78] },
  { match: 92, round: "Round of 16", feeds: [79, 80] },
  { match: 93, round: "Round of 16", feeds: [83, 84] },
  { match: 94, round: "Round of 16", feeds: [81, 82] },
  { match: 95, round: "Round of 16", feeds: [86, 88] },
  { match: 96, round: "Round of 16", feeds: [85, 87] },
  { match: 97, round: "Quarter-finals", feeds: [89, 90] },
  { match: 98, round: "Quarter-finals", feeds: [91, 92] },
  { match: 99, round: "Quarter-finals", feeds: [93, 94] },
  { match: 100, round: "Quarter-finals", feeds: [95, 96] },
  { match: 101, round: "Semi-finals", feeds: [97, 98] },
  { match: 102, round: "Semi-finals", feeds: [99, 100] },
  { match: 103, round: "Third place", feeds: [101, 102], losers: true },
  { match: 104, round: "Final", feeds: [101, 102] },
];

// The team that goes through: higher score, or the explicit advancer on a draw.
export function advancerOf(result, home, away) {
  if (!result) return null;
  if (result.homeGoals > result.awayGoals) return home;
  if (result.homeGoals < result.awayGoals) return away;
  return result.advancer || null;
}

// The eliminated team (only meaningful once a result and both teams exist).
function loserOf(result, home, away) {
  const w = advancerOf(result, home, away);
  if (!w || !home || !away) return null;
  return w === home ? away : home;
}

// A prediction's implied pick — same rule as advancerOf.
export function predictedAdvancer(prediction, home, away) {
  return advancerOf(prediction, home, away);
}

// Effective result for a match id: admin entry, else the fixture's baked result.
function effectiveResultMap(fixtures, results) {
  const admin = new Map(results.map((r) => [r.matchId, r]));
  const out = new Map();
  for (const fx of fixtures) {
    const a = admin.get(fx.id);
    if (a) out.set(fx.id, a);
    else if (fx.result) out.set(fx.id, fx.result);
  }
  return out;
}

// Resolve every knockout match's teams from R32 fixtures + prior winners.
export function resolveKnockout(fixtures, results) {
  const fxById = new Map(fixtures.map((f) => [f.id, f]));
  const eff = effectiveResultMap(fixtures, results);
  const id = (n) => `m${n}`;
  const memo = new Map();

  function resolve(node) {
    if (memo.has(node.match)) return memo.get(node.match);
    const fx = fxById.get(id(node.match)) || {};
    const result = eff.get(id(node.match)) || null;
    let home, away, homeLabel, awayLabel;
    if (!node.feeds) {
      home = fx.home ?? null; away = fx.away ?? null;
      homeLabel = home; awayLabel = away;
    } else {
      const [hf, af] = node.feeds;
      const pick = (m) => node.losers ? feederLoser(m) : feederWinner(m);
      home = pick(hf); away = pick(af);
      const verb = node.losers ? "Loser" : "Winner";
      homeLabel = home || `${verb} ${hf}`;
      awayLabel = away || `${verb} ${af}`;
    }
    const winner = advancerOf(result, home, away);
    const loser = loserOf(result, home, away);
    const m = {
      id: id(node.match), match: node.match, round: node.round,
      kickoff: fx.kickoff || null, home, away, homeLabel, awayLabel,
      defined: home != null && away != null, result, winner, loser,
    };
    memo.set(node.match, m);
    return m;
  }
  const byMatch = new Map(KO_TREE.map((n) => [n.match, n]));
  function feederWinner(m) { return resolve(byMatch.get(m)).winner; }
  function feederLoser(m) { return resolve(byMatch.get(m)).loser; }

  return KO_TREE.map(resolve);
}

// Top-to-bottom display order per round: DFS the tree from the Final so each
// round lines up with its feeders (R32 numbering is out of tree order).
export function koDisplayOrder() {
  const byMatch = new Map(KO_TREE.map((n) => [n.match, n]));
  const leaves = (m) => {
    const node = byMatch.get(m);
    return node.feeds ? node.feeds.flatMap(leaves) : [m];
  };
  const r32order = leaves(104);
  const firstLeaf = (m) => r32order.indexOf(leaves(m)[0]);
  const out = {};
  for (const r of KO_ROUNDS) {
    out[r] = KO_TREE.filter((n) => n.round === r).map((n) => n.match)
      .sort((a, b) => firstLeaf(a) - firstLeaf(b));
  }
  return out;
}
