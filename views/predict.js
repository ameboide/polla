import { savePlayerPredictions, mergeMatches, flattenPredictions } from "../store.js";
import { renderBatchGrid } from "./batch-grid.js";
import { effectiveResults, pointsByMatch } from "./leaderboard.js";
import { resolveKnockout } from "./knockout.js";
import { makeAdvancerControl } from "./advancer-control.js";

function findPrediction(predictions, player, matchId) {
  return predictions.find((p) => p.player === player && p.matchId === matchId) || null;
}

function adminToolbar(root, ctx) {
  const { data, player } = ctx;
  const panel = document.createElement("div");
  panel.className = "admin-tools";

  const lbl = document.createElement("label");
  const cb = document.createElement("input");
  cb.type = "checkbox"; cb.checked = ctx.adminUnlockPast;
  cb.addEventListener("change", () => {
    if (!ctx.setUnlockPast(cb.checked)) cb.checked = ctx.adminUnlockPast; // reverted on cancel
  });
  lbl.append(cb, " Fill past predictions");

  const players = [...new Set(data.predictions.map((p) => p.player))].sort();
  const dl = document.createElement("datalist");
  dl.id = "known-players";
  players.forEach((n) => dl.appendChild(Object.assign(document.createElement("option"), { value: n })));

  const inp = document.createElement("input");
  inp.setAttribute("list", "known-players");
  inp.placeholder = "player name";
  inp.value = player;

  const actBtn = document.createElement("button");
  actBtn.textContent = "Act as";
  actBtn.addEventListener("click", () => {
    if (inp.value.trim() && !ctx.setActingAs(inp.value)) inp.value = player; // revert if guard cancelled
  });

  const meBtn = document.createElement("button");
  meBtn.textContent = "Me";
  meBtn.addEventListener("click", () => ctx.setActingAs(null));

  panel.append(lbl, document.createElement("br"), "Act as: ", inp, " ", actBtn, " ", meBtn, dl);
  root.appendChild(panel);
}

export function renderPredict(root, ctx) {
  const { data, player } = ctx;
  if (!player) { root.textContent = "Set your name to predict."; return; }
  if (ctx.isAdmin) adminToolbar(root, ctx);

  const resultByMatch = new Map(
    effectiveResults(data.fixtures, data.results).map((r) => [r.matchId, r])
  );
  const pts = pointsByMatch(data.fixtures, data.predictions, data.results, data.config, player);
  const scoresOf = (rec) => (rec ? { homeGoals: rec.homeGoals, awayGoals: rec.awayGoals } : null);

  const playerRecord = () => (data.predictionRecords || []).find((r) => r.player === player) || null;

  // Build combined fixture list: swap resolved knockout teams/labels/round onto
  // knockout fixtures so the grid shows real team names once they're known.
  const resolved = new Map(
    resolveKnockout(data.fixtures, data.results).map((k) => [k.id, k])
  );
  const matches = data.fixtures.map((fx) => {
    const k = resolved.get(fx.id);
    return k
      ? { ...fx, home: k.home, away: k.away, homeLabel: k.homeLabel, awayLabel: k.awayLabel, round: k.round, resolved: k.defined }
      : fx;
  });

  renderBatchGrid(root, ctx, {
    fixtures: matches,
    baselineFor: (fx) => scoresOf(findPrediction(data.predictions, player, fx.id)),
    lockedFor: (fx) =>
      (fx.round && !fx.resolved) ||
      (!ctx.adminUnlockPast && Date.now() >= Date.parse(fx.kickoff)),
    extraControl: (fx, api) =>
      makeAdvancerControl(
        fx,
        api,
        (findPrediction(data.predictions, player, fx.id) || {}).advancer || ""
      ),
    saveAll: async (saveable) => {
      const rec = playerRecord();
      const edits = saveable.map((s) => ({ matchId: s.key, ...s.fields }));
      const saved = await savePlayerPredictions(rec, player, mergeMatches(rec ? rec.matches : [], edits));
      // Patch in-memory records so the re-render reflects the save without re-fetching.
      const recs = data.predictionRecords || (data.predictionRecords = []);
      const i = recs.findIndex((r) => (saved.id && r.id === saved.id) || r.player === player);
      if (i >= 0) recs[i] = saved; else recs.push(saved);
      data.predictions = flattenPredictions(recs);
    },
    resultFor: (fx) => resultByMatch.get(fx.id) || null,
    pointsFor: (fx) => (pts.has(fx.id) ? pts.get(fx.id) : null),
    dayPoints: (fxs) => fxs.reduce((s, fx) => s + (pts.get(fx.id) || 0), 0),
    totalPoints: () => [...pts.values()].reduce((s, v) => s + v, 0),
  });
}
