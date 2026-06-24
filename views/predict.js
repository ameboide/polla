import { savePlayerPredictions, mergeMatches } from "../store.js";
import { renderBatchGrid } from "./batch-grid.js";
import { effectiveResults, pointsByMatch } from "./leaderboard.js";

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

  renderBatchGrid(root, ctx, {
    fixtures: data.fixtures,
    baselineFor: (fx) => scoresOf(findPrediction(data.predictions, player, fx.id)),
    lockedFor: (fx) => !ctx.adminUnlockPast && Date.now() >= Date.parse(fx.kickoff),
    saveAll: (saveable) => {
      const rec = playerRecord();
      const edits = saveable.map((s) => ({ matchId: s.key, ...s.fields }));
      return savePlayerPredictions(rec, player, mergeMatches(rec ? rec.matches : [], edits));
    },
    resultFor: (fx) => resultByMatch.get(fx.id) || null,
    pointsFor: (fx) => (pts.has(fx.id) ? pts.get(fx.id) : null),
    dayPoints: (fxs) => fxs.reduce((s, fx) => s + (pts.get(fx.id) || 0), 0),
    totalPoints: () => [...pts.values()].reduce((s, v) => s + v, 0),
  });
}
