import { saveResult, saveConfig } from "../store.js";
import { renderBatchGrid } from "./batch-grid.js";

const WEIGHTS = ["winner", "exactScore", "goalDiff", "totalGoals", "eachTeamGoals"];

function configForm(ctx, registerDirty) {
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

  const initial = {};
  WEIGHTS.forEach((k) => { initial[k] = String(inputs[k].value); });
  registerDirty(() => WEIGHTS.some((k) => String(inputs[k].value) !== initial[k]));

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

function resultsSection(root, ctx) {
  root.appendChild(Object.assign(document.createElement("h3"), { textContent: "Actual results" }));
  renderBatchGrid(root, ctx, {
    fixtures: ctx.data.fixtures,
    existingFor: (fx) => ctx.data.results.find((r) => r.matchId === fx.id) || null,
    lockedFor: () => false,
    save: (existing, fields) => saveResult(existing, fields),
    buildFields: (fx, score) => ({ matchId: fx.id, ...score }),
  });
}

export function renderAdmin(root, ctx) {
  if (!ctx.isAdmin) { root.textContent = "Admin only."; return; }

  // Combine both editable areas into one unsaved-changes check so switching
  // tabs warns on either dirty weights OR a dirty results grid.
  let weightsDirty = () => false;
  let gridDirty = () => false;
  ctx.setUnsavedCheck(() => weightsDirty() || gridDirty());
  const gridCtx = { ...ctx, setUnsavedCheck: (fn) => { gridDirty = fn; } };

  root.appendChild(configForm(ctx, (fn) => { weightsDirty = fn; }));
  resultsSection(root, gridCtx);
}
