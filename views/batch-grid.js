import { groupFixturesByDay } from "./grouping.js";
import { summarizeEdits, isDirty } from "./editing.js";
import { flagFor } from "./flags.js";

// Renders a day-grouped grid of score inputs with one batch "Save" bar.
// Edits are tracked against each fixture's saved baseline; dirty cards are
// highlighted, the save button shows the count, and ctx.setUnsavedCheck is
// wired so app.js can guard tab switches / page unload.
//
// opts:
//   fixtures        — array of fixtures to render
//   baselineFor(fx) — {homeGoals,awayGoals} shown by default and used as the
//                     dirty baseline, or null (e.g. a fixture's real result
//                     prefilled before any saved record exists).
//   lockedFor(fx)   — bool; locked inputs are disabled and never dirty
//   saveAll(saveable) — persist all dirty+complete edits in ONE call; saveable
//                       is [{key:matchId, fields:{homeGoals,awayGoals}}].
//                       Returns a promise; throwing keeps the edits.
// Optional read-only display hooks (omit to hide; admin omits all):
//   resultFor(fx)   — actual {homeGoals,awayGoals} to show, or null
//   pointsFor(fx)   — points earned on fx, or null
//   dayPoints(fxs)  — subtotal shown in a day's header
//   totalPoints()   — grand total shown in a banner above the grid
export function renderBatchGrid(root, ctx, opts) {
  const entries = []; // {fx, baseline, home, away, card}

  if (opts.totalPoints) {
    const banner = document.createElement("div");
    banner.className = "total-banner";
    banner.textContent = `Total: ${opts.totalPoints()} pts`;
    root.appendChild(banner);
  }

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
    try {
      await opts.saveAll(saveable); // one record write
      ctx.setStatus(`Saved ${saveable.length}`);
      await ctx.refresh(); // re-renders with fresh baselines, clearing dirty state
    } catch (e) {
      // Nothing persisted — keep the user's edits and let them retry.
      ctx.setStatus(`Save failed: ${e.message} — changes kept`, true);
      button.disabled = false;
    }
  });

  groupFixturesByDay(opts.fixtures).forEach((day) => {
    const details = document.createElement("details");
    details.className = "day" + (day.isPast ? " past" : "");
    details.open = !day.isPast;
    const summary = document.createElement("summary");
    let summaryText = `${day.label} — ${day.fixtures.length} matches`;
    if (opts.dayPoints) summaryText += ` · ${opts.dayPoints(day.fixtures)} pts`;
    summary.textContent = summaryText;
    details.appendChild(summary);

    day.fixtures.forEach((fx) => {
      const baseline = opts.baselineFor(fx);
      const locked = opts.lockedFor(fx);

      const card = document.createElement("div");
      card.className = "match" + (locked ? " locked" : "");

      // Header: teams on the left, kickoff time right-aligned (the date already
      // shows in the day group header, so only the time is needed here).
      const head = document.createElement("div");
      head.className = "match-head";
      head.appendChild(Object.assign(document.createElement("span"), {
        textContent: `[${fx.group}] ${fx.home} vs ${fx.away}`,
      }));
      head.appendChild(Object.assign(document.createElement("span"), {
        className: "match-time",
        textContent: new Date(fx.kickoff).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }));
      card.appendChild(head);

      const home = document.createElement("input");
      home.type = "number"; home.min = "0"; home.value = baseline ? baseline.homeGoals : "";
      const away = document.createElement("input");
      away.type = "number"; away.min = "0"; away.value = baseline ? baseline.awayGoals : "";
      home.disabled = away.disabled = locked;
      if (!locked) {
        home.addEventListener("input", recompute);
        away.addEventListener("input", recompute);
      }

      // [flag] [input] - [input] [flag]
      const homeFlag = Object.assign(document.createElement("span"), {
        className: "flag", textContent: flagFor(fx.home), title: fx.home,
      });
      const awayFlag = Object.assign(document.createElement("span"), {
        className: "flag", textContent: flagFor(fx.away), title: fx.away,
      });
      card.append(homeFlag, " ", home, " - ", away, " ", awayFlag);

      const result = opts.resultFor ? opts.resultFor(fx) : null;
      if (result) {
        const info = document.createElement("div");
        info.className = "result-info";
        let txt = `Actual: ${result.homeGoals}-${result.awayGoals}`;
        const pts = opts.pointsFor ? opts.pointsFor(fx) : null;
        if (pts !== null && pts !== undefined) txt += ` · ${pts} pts`;
        info.textContent = txt;
        card.appendChild(info);
      }

      details.appendChild(card);
      entries.push({ fx, baseline, home, away, card });
    });
    root.appendChild(details);
  });

  ctx.setUnsavedCheck(() => summarizeEdits(snapshot()).dirtyCount > 0);
  recompute();
}
