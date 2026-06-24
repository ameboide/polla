// A button that expands or collapses every day group (<details.day>) inside a
// container. If any group is closed it expands all; otherwise it collapses all.
// The label tracks the next action and stays correct when groups are toggled
// individually (the <details> "toggle" event doesn't bubble, so we capture).
export function makeCollapseAllControl(container) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "collapse-all";

  const groups = () => [...container.querySelectorAll("details.day")];
  function sync() {
    const all = groups();
    btn.disabled = all.length === 0;
    btn.textContent = all.some((d) => !d.open) ? "Expand all" : "Collapse all";
  }
  btn.addEventListener("click", () => {
    const open = groups().some((d) => !d.open); // any closed -> open them all
    groups().forEach((d) => { d.open = open; });
    sync();
  });
  container.addEventListener("toggle", sync, true);

  return { btn, sync };
}
