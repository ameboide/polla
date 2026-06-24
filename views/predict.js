import { savePrediction } from "../store.js";
import { renderBatchGrid } from "./batch-grid.js";
import { effectiveResults, pointsByMatch } from "./leaderboard.js";

function findPrediction(predictions, player, matchId) {
  return predictions.find((p) => p.player === player && p.matchId === matchId) || null;
}

export function renderPredict(root, ctx) {
  const { data, player } = ctx;
  if (!player) { root.textContent = "Set your name to predict."; return; }

  const resultByMatch = new Map(
    effectiveResults(data.fixtures, data.results).map((r) => [r.matchId, r])
  );
  const pts = pointsByMatch(data.fixtures, data.predictions, data.results, data.config, player);
  const scoresOf = (rec) => (rec ? { homeGoals: rec.homeGoals, awayGoals: rec.awayGoals } : null);

  renderBatchGrid(root, ctx, {
    fixtures: data.fixtures,
    existingFor: (fx) => findPrediction(data.predictions, player, fx.id),
    baselineFor: (fx) => scoresOf(findPrediction(data.predictions, player, fx.id)),
    lockedFor: (fx) => Date.now() >= Date.parse(fx.kickoff),
    save: (existing, fields) => savePrediction(existing, fields),
    buildFields: (fx, score) => ({ player, matchId: fx.id, ...score }),
    resultFor: (fx) => resultByMatch.get(fx.id) || null,
    pointsFor: (fx) => (pts.has(fx.id) ? pts.get(fx.id) : null),
    dayPoints: (fxs) => fxs.reduce((s, fx) => s + (pts.get(fx.id) || 0), 0),
    totalPoints: () => [...pts.values()].reduce((s, v) => s + v, 0),
  });
}
