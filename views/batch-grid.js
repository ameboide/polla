import { groupFixturesByDay } from "./grouping.js";
import { summarizeEdits, isDirty } from "./editing.js";

// Renders a day-grouped grid of score inputs with one batch "Save" bar.
// Edits are tracked against each fixture's saved baseline; dirty cards are
// highlighted, the save button shows the count, and ctx.setUnsavedCheck is
// wired so app.js can guard tab switches / page unload.
//
// opts:
//   fixtures        — array of fixtures to render
//   existingFor(fx) — saved record to upsert against (carries the id) or null
//   baselineFor(fx) — {homeGoals,awayGoals} shown by default and used as the
//                     dirty baseline, or null. May differ from existingFor:
//                     e.g. a fixture's real result prefilled before any admin
//                     record exists (editing it then CREATES a record).
//   lockedFor(fx)   — bool; locked inputs are disabled and never dirty
//   save(existing, fields) — upsert one record, returns a promise
//   buildFields(fx, score) — {homeGoals,awayGoals} -> the payload to save
export function renderBatchGrid(root, ctx, opts) {
  const entries = []; // {fx, existing, baseline, home, away, card}

  const bar = document.createElement("div");
  bar.className = "save-bar";
  const button = document.createElement("button");
  bar.appendChild(button);
  root.appendChild(bar);

  const snapshot = () =>
    entries.map((e) => ({
      key: e.fx.id,
      baseline: e.baseline,
      homeStr: e.home.value,
      awayStr: e.away.value,
    }));

  function recompute() {
    const s = summarizeEdits(snapshot());
    for (const e of entries) {
      e.card.classList.toggle("dirty", isDirty(e.baseline, e.home.value, e.away.value));
    }
    const n = s.saveable.length;
    button.disabled = n === 0;
    button.textContent =
      `Save ${n} change${n === 1 ? "" : "s"}` +
      (s.incompleteCount ? ` (${s.incompleteCount} incomplete)` : "");
  }

  button.addEventListener("click", async () => {
    const { saveable } = summarizeEdits(snapshot());
    if (!saveable.length) return;
    button.disabled = true;
    ctx.setStatus(`Saving ${saveable.length}…`);
    const byKey = new Map(entries.map((e) => [e.fx.id, e]));
    const results = await Promise.allSettled(
      saveable.map((s) => {
        const e = byKey.get(s.key);
        return opts.save(e.existing, opts.buildFields(e.fx, s.fields));
      })
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed === results.length) {
      // Nothing persisted — keep the user's edits and let them retry.
      ctx.setStatus(`All ${failed} saves failed — changes kept`, true);
      button.disabled = false;
      return;
    }
    if (failed) ctx.setStatus(`Saved ${results.length - failed}, ${failed} failed`, true);
    else ctx.setStatus(`Saved ${results.length}`);
    await ctx.refresh(); // re-renders with fresh baselines, clearing dirty state
  });

  groupFixturesByDay(opts.fixtures).forEach((day) => {
    const details = document.createElement("details");
    details.className = "day" + (day.isPast ? " past" : "");
    details.open = !day.isPast;
    const summary = document.createElement("summary");
    summary.textContent = `${day.label} — ${day.fixtures.length} matches`;
    details.appendChild(summary);

    day.fixtures.forEach((fx) => {
      const existing = opts.existingFor(fx);
      const baseline = opts.baselineFor(fx);
      const locked = opts.lockedFor(fx);

      const card = document.createElement("div");
      card.className = "match" + (locked ? " locked" : "");
      card.appendChild(Object.assign(document.createElement("div"), {
        textContent: `[${fx.group}] ${fx.home} vs ${fx.away} — ${new Date(fx.kickoff).toLocaleString()}`,
      }));

      const home = document.createElement("input");
      home.type = "number"; home.min = "0"; home.value = baseline ? baseline.homeGoals : "";
      const away = document.createElement("input");
      away.type = "number"; away.min = "0"; away.value = baseline ? baseline.awayGoals : "";
      home.disabled = away.disabled = locked;
      if (!locked) {
        home.addEventListener("input", recompute);
        away.addEventListener("input", recompute);
      }

      card.append(" ", home, " - ", away);
      details.appendChild(card);
      entries.push({ fx, existing, baseline, home, away, card });
    });
    root.appendChild(details);
  });

  ctx.setUnsavedCheck(() => summarizeEdits(snapshot()).dirtyCount > 0);
  recompute();
}
