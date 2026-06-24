import { savePrediction } from "../store.js";
import { groupFixturesByDay } from "./grouping.js";

function isLocked(fixture) {
  return Date.now() >= Date.parse(fixture.kickoff);
}

function findPrediction(predictions, player, matchId) {
  return predictions.find((p) => p.player === player && p.matchId === matchId) || null;
}

function predictionCard(fx, ctx) {
  const { data, player, refresh, setStatus } = ctx;
  const existing = findPrediction(data.predictions, player, fx.id);
  const locked = isLocked(fx);

  const card = document.createElement("div");
  card.className = "match" + (locked ? " locked" : "");

  const label = document.createElement("div");
  label.textContent = `[${fx.group}] ${fx.home} vs ${fx.away} — ${new Date(fx.kickoff).toLocaleString()}`;
  card.appendChild(label);

  const home = document.createElement("input");
  home.type = "number"; home.min = "0"; home.value = existing ? existing.homeGoals : "";
  const away = document.createElement("input");
  away.type = "number"; away.min = "0"; away.value = existing ? existing.awayGoals : "";
  home.disabled = away.disabled = locked;

  const save = document.createElement("button");
  save.textContent = locked ? "Locked" : "Save";
  save.disabled = locked;
  save.addEventListener("click", async () => {
    const fields = {
      player, matchId: fx.id,
      homeGoals: Number(home.value), awayGoals: Number(away.value),
    };
    if (home.value === "" || away.value === "") { setStatus("Enter both scores", true); return; }
    save.disabled = true;
    setStatus("Saving…");
    try { await savePrediction(existing, fields); setStatus("Saved"); await refresh(); }
    catch (e) { setStatus(`Save failed: ${e.message}`, true); }
    finally { save.disabled = false; }
  });

  card.append(" ", home, " - ", away, " ", save);
  return card;
}

export function renderPredict(root, ctx) {
  const { data, player } = ctx;
  if (!player) { root.textContent = "Set your name to predict."; return; }

  groupFixturesByDay(data.fixtures).forEach((day) => {
    const details = document.createElement("details");
    details.className = "day" + (day.isPast ? " past" : "");
    details.open = !day.isPast;

    const summary = document.createElement("summary");
    summary.textContent = `${day.label} — ${day.fixtures.length} matches`;
    details.appendChild(summary);

    day.fixtures.forEach((fx) => details.appendChild(predictionCard(fx, ctx)));
    root.appendChild(details);
  });
}
