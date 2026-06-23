export function outcome({ homeGoals, awayGoals }) {
  if (homeGoals > awayGoals) return "home";
  if (homeGoals < awayGoals) return "away";
  return "draw";
}

export function score(prediction, result, config) {
  let pts = 0;
  if (outcome(prediction) === outcome(result)) pts += config.winner;
  if (prediction.homeGoals === result.homeGoals && prediction.awayGoals === result.awayGoals)
    pts += config.exactScore;
  if (prediction.homeGoals - prediction.awayGoals === result.homeGoals - result.awayGoals)
    pts += config.goalDiff;
  if (prediction.homeGoals + prediction.awayGoals === result.homeGoals + result.awayGoals)
    pts += config.totalGoals;
  if (prediction.homeGoals === result.homeGoals) pts += config.eachTeamGoals;
  if (prediction.awayGoals === result.awayGoals) pts += config.eachTeamGoals;
  return pts;
}
