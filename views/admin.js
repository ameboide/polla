import { saveResult, saveConfig } from "../store.js";
import { groupFixturesByDay } from "./grouping.js";

const WEIGHTS = ["winner", "exactScore", "goalDiff", "totalGoals", "eachTeamGoals"];

function configForm(ctx) {
  const { config, } = ctx.data;
  const form = document.createElement("div");
  form.className = "match";
  form.appendChild(Object.assign(document.createElement("h3"), { textContent: "Scoring weights" }));

  const inputs = {};
  WEIGHTS.forEach((key) => {
    const wrap = document.createElement("label");
    wrap.textContent = ` ${key}: `;
    const inp = document.createElement("input");
    inp.type = "number"; inp.value = config[key]; inp.min = "0";
    inputs[key] = inp;
    wrap.appendChild(inp);
    form.append(wrap, document.createElement("br"));
  });

  const save = document.createElement("button");
  save.textContent = "Save weights";
  save.addEventListener("click", async () => {
    const fields = {};
    WEIGHTS.forEach((k) => { fields[k] = Number(inputs[k].value); });
    save.disabled = true;
    ctx.setStatus("Saving weights…");
    try { await saveConfig(config.id ? config : null, fields); ctx.setStatus("Saved"); await ctx.refresh(); }
    catch (e) { ctx.setStatus(`Save failed: ${e.message}`, true); }
    finally { save.disabled = false; }
  });
  form.appendChild(save);
  return form;
}

function resultCard(fx, ctx) {
  const { results } = ctx.data;
  const existing = results.find((r) => r.matchId === fx.id) || null;
  const card = document.createElement("div");
  card.className = "match";
  card.appendChild(Object.assign(document.createElement("div"),
    { textContent: `[${fx.group}] ${fx.home} vs ${fx.away} — ${new Date(fx.kickoff).toLocaleString()}` }));

  const home = document.createElement("input");
  home.type = "number"; home.min = "0"; home.value = existing ? existing.homeGoals : "";
  const away = document.createElement("input");
  away.type = "number"; away.min = "0"; away.value = existing ? existing.awayGoals : "";

  const save = document.createElement("button");
  save.textContent = "Save result";
  save.addEventListener("click", async () => {
    if (home.value === "" || away.value === "") { ctx.setStatus("Enter both scores", true); return; }
    const fields = { matchId: fx.id, homeGoals: Number(home.value), awayGoals: Number(away.value) };
    save.disabled = true;
    ctx.setStatus("Saving result…");
    try { await saveResult(existing, fields); ctx.setStatus("Saved"); await ctx.refresh(); }
    catch (e) { ctx.setStatus(`Save failed: ${e.message}`, true); }
    finally { save.disabled = false; }
  });

  card.append(" ", home, " - ", away, " ", save);
  return card;
}

function resultsSection(ctx) {
  const section = document.createElement("div");
  section.appendChild(Object.assign(document.createElement("h3"), { textContent: "Actual results" }));

  groupFixturesByDay(ctx.data.fixtures).forEach((day) => {
    const details = document.createElement("details");
    details.className = "day" + (day.isPast ? " past" : "");
    details.open = !day.isPast;

    const summary = document.createElement("summary");
    summary.textContent = `${day.label} — ${day.fixtures.length} matches`;
    details.appendChild(summary);

    day.fixtures.forEach((fx) => details.appendChild(resultCard(fx, ctx)));
    section.appendChild(details);
  });
  return section;
}

export function renderAdmin(root, ctx) {
  if (!ctx.isAdmin) { root.textContent = "Admin only."; return; }
  root.appendChild(configForm(ctx));
  root.appendChild(resultsSection(ctx));
}
