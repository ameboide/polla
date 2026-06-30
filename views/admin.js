import { saveResults, saveConfig, mergeMatches, resultsMatches, cacheConfig } from "../store.js";
import { renderBatchGrid } from "./batch-grid.js";
import { resolveKnockout } from "./knockout.js";
import { makeAdvancerControl } from "./advancer-control.js";

const WEIGHTS = ["winner", "exactScore", "goalDiff", "totalGoals", "eachTeamGoals", "advance"];

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
    try {
      await saveConfig(fields);
      // Patch in-memory + cache (write-through) so no reload is needed and the
      // cached config stays fresh for this admin.
      ctx.data.config = { ...ctx.data.config, ...fields };
      cacheConfig(ctx.data.config);
      ctx.setStatus("Saved");
      ctx.rerender();
    }
    catch (e) { ctx.setStatus(`Save failed: ${e.message}`, true); }
    finally { save.disabled = false; }
  });
  form.appendChild(save);
  return form;
}

function resultsSection(root, ctx) {
  root.appendChild(Object.assign(document.createElement("h3"), { textContent: "Actual results" }));
  const adminResult = (fx) => ctx.data.results.find((r) => r.matchId === fx.id) || null;
  const resolved = new Map(resolveKnockout(ctx.data.fixtures, ctx.data.results).map((k) => [k.id, k]));
  const matches = ctx.data.fixtures.map((fx) => {
    const k = resolved.get(fx.id);
    return k ? { ...fx, home: k.home, away: k.away, round: k.round, resolved: k.defined } : fx;
  });
  renderBatchGrid(root, ctx, {
    fixtures: matches,
    // Prefill with the admin's saved result, else the fixture's real score
    // (from fixtures.json) so unentered matches show their actual result.
    baselineFor: (fx) => {
      const r = adminResult(fx);
      if (r) return { homeGoals: r.homeGoals, awayGoals: r.awayGoals };
      return fx.result ? { homeGoals: fx.result.homeGoals, awayGoals: fx.result.awayGoals } : null;
    },
    lockedFor: (fx) => Boolean(fx.round && !fx.resolved),
    extraControl: (fx, api) => makeAdvancerControl(fx, api, (adminResult(fx) || {}).advancer || ""),
    // All results live in one record; merge edits into its matches array.
    saveAll: async (saveable) => {
      const rec = ctx.data.resultsRecord || null;
      const edits = saveable.map((s) => ({ matchId: s.key, ...s.fields }));
      const saved = await saveResults(rec, mergeMatches(rec ? rec.matches : [], edits));
      // Patch in-memory so the re-render reflects the save without re-fetching.
      ctx.data.resultsRecord = saved;
      ctx.data.results = resultsMatches(saved);
    },
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
