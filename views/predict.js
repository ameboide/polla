import { savePrediction } from "../store.js";
import { renderBatchGrid } from "./batch-grid.js";

function findPrediction(predictions, player, matchId) {
  return predictions.find((p) => p.player === player && p.matchId === matchId) || null;
}

export function renderPredict(root, ctx) {
  const { data, player } = ctx;
  if (!player) { root.textContent = "Set your name to predict."; return; }

  renderBatchGrid(root, ctx, {
    fixtures: data.fixtures,
    existingFor: (fx) => findPrediction(data.predictions, player, fx.id),
    lockedFor: (fx) => Date.now() >= Date.parse(fx.kickoff),
    save: (existing, fields) => savePrediction(existing, fields),
    buildFields: (fx, score) => ({ player, matchId: fx.id, ...score }),
  });
}
