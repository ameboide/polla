// Shared advancer picker for knockout matches.
// Used by predict.js (player predictions) and admin.js (result entry).
// Returns null for group matches; otherwise returns a home/away <select>
// that is shown only while the entered score is a level draw.
//
// makeAdvancerControl(fx, api, savedAdvancer)
//   fx            — the fixture object (needs .round, .home, .away)
//   api           — { homeInput, awayInput, recompute } from batch-grid.js
//   savedAdvancer — previously-saved team name string, or "" / null
//
// Returns null | { el, value(), baseline, reset() }
export function makeAdvancerControl(fx, api, savedAdvancer) {
  if (!fx.round) return null; // group match — no advancer

  const baseline = savedAdvancer || "";

  const wrap = document.createElement("div");
  wrap.className = "advancer";

  const select = document.createElement("select");
  select.innerHTML = `<option value="">— advances —</option>`;
  for (const team of [fx.home, fx.away]) {
    if (!team) continue;
    const opt = document.createElement("option");
    opt.value = team;
    opt.textContent = team;
    select.appendChild(opt);
  }
  select.value = baseline;
  wrap.appendChild(select);

  const sync = () => {
    const draw =
      api.homeInput.value !== "" &&
      api.homeInput.value === api.awayInput.value;
    wrap.style.display = draw ? "" : "none";
    if (!draw) select.value = ""; // a decisive score has no manual advancer
    api.recompute();
  };
  api.homeInput.addEventListener("input", sync);
  api.awayInput.addEventListener("input", sync);
  select.addEventListener("change", api.recompute);
  sync();

  return {
    el: wrap,
    value: () => select.value,
    baseline,
    reset: () => {
      select.value = baseline;
    },
  };
}
