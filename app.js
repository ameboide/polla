import { ADMIN_SECRET } from "./config.js";
import { loadAll } from "./store.js";
import { renderPredict } from "./views/predict.js";
import { renderLeaderboard } from "./views/leaderboard.js";
import { renderPlayed } from "./views/played.js";
import { renderGroups } from "./views/groups.js";
import { renderBracket } from "./views/bracket.js";
import { renderAdmin } from "./views/admin.js";

const viewRoot = document.getElementById("view");
const statusEl = document.getElementById("status");
const identityEl = document.getElementById("identity");

const renderers = { predict: renderPredict, leaderboard: renderLeaderboard, groups: renderGroups, bracket: renderBracket, played: renderPlayed, admin: renderAdmin };
let activeTab = "predict";
let data = null;
let unsavedCheck = () => false;
let viewCleanup = () => {}; // teardown for the current view (e.g. kickoff timers)
let actingAs = null;    // admin impersonation: name to act as, or null = self
let unlockPast = false; // admin: bypass kickoff lock to fill past predictions

function setStatus(msg, isError = false) {
  statusEl.textContent = msg || "";
  statusEl.classList.toggle("error", Boolean(isError));
}

function getPlayer() {
  let name = localStorage.getItem("polla.player");
  if (!name) {
    name = (prompt("Enter your name:") || "").trim();
    if (name) localStorage.setItem("polla.player", name);
  }
  return name;
}

function isAdmin() {
  return localStorage.getItem("polla.admin") === "1";
}

// Effective player: the impersonated name if an admin set one, else self.
function actingPlayer() {
  return actingAs || getPlayer();
}

function renderIdentity() {
  const self = getPlayer();
  identityEl.textContent = self
    ? (actingAs && actingAs !== self ? `Hi, ${self} — acting as ${actingAs}` : `Hi, ${self}`)
    : "";
  // Admin tab stays visible for everyone; clicking it prompts for the code
  // (see selectTab). Show a lock hint until unlocked.
  const adminBtn = document.querySelector('nav button[data-tab="admin"]');
  adminBtn.textContent = isAdmin() ? "Admin" : "Admin 🔒";
}

// Run fn only after clearing any unsaved edits (re-rendering discards them).
// Returns whether it ran, so callers can revert a toggled control on cancel.
function withUnsavedGuard(fn) {
  if (unsavedCheck() && !confirm("Discard unsaved changes?")) return false;
  fn();
  return true;
}

async function refresh() {
  setStatus("Loading…");
  try {
    data = await loadAll();
    setStatus("");
    renderActive();
  } catch (e) {
    setStatus(`Load failed: ${e.message}`, true);
  }
}

function ctx() {
  return {
    data, player: actingPlayer(), isAdmin: isAdmin(), refresh, rerender: renderActive, setStatus,
    setUnsavedCheck: (fn) => { unsavedCheck = fn; },
    registerCleanup: (fn) => { viewCleanup = fn; },
    adminUnlockPast: unlockPast,
    setUnlockPast: (b) => withUnsavedGuard(() => { unlockPast = b; renderActive(); }),
    setActingAs: (name) => withUnsavedGuard(() => {
      actingAs = name ? name.trim() || null : null;
      renderIdentity();
      renderActive();
    }),
  };
}

function renderActive() {
  if (!data) return;
  viewCleanup();              // tear down the outgoing view (clears kickoff timers)
  viewCleanup = () => {};
  document.querySelectorAll("nav button").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === activeTab));
  viewRoot.innerHTML = "";
  unsavedCheck = () => false; // the view re-registers if it tracks edits
  renderers[activeTab](viewRoot, ctx());
}

// The active tab lives in the URL hash (#leaderboard, #bracket, …) so a refresh
// or a shared link reopens the same panel.
function hashTab() {
  const t = location.hash.replace(/^#/, "");
  return renderers[t] ? t : null;
}
function setHash(tab) {
  if (location.hash.replace(/^#/, "") !== tab) location.hash = tab;
}

// fromHash: the change originated from the URL (hashchange / initial load), so
// the hash is already correct and we only revert it when a switch is refused.
function selectTab(tab, fromHash = false) {
  if (tab === activeTab) { setHash(tab); return; }
  if (unsavedCheck() && !confirm("You have unsaved changes. Leave without saving?")) {
    setHash(activeTab); // keep the URL on the panel we stayed on
    return;
  }
  if (tab === "admin" && !isAdmin()) {
    const code = (prompt("Admin code:") || "").trim();
    if (code === ADMIN_SECRET) { localStorage.setItem("polla.admin", "1"); renderIdentity(); }
    else { setStatus("Wrong admin code", true); setHash(activeTab); return; }
  }
  activeTab = tab;
  setHash(tab);
  renderActive();
}

window.addEventListener("beforeunload", (e) => {
  if (unsavedCheck()) { e.preventDefault(); e.returnValue = ""; }
});

document.querySelectorAll("nav button").forEach((b) =>
  b.addEventListener("click", () => selectTab(b.dataset.tab)));

window.addEventListener("hashchange", () => {
  const t = hashTab();
  if (t) selectTab(t, true);
});

// Open the tab named in the URL hash (if any); otherwise seed the hash.
const initialTab = hashTab();
if (initialTab) activeTab = initialTab;
else setHash(activeTab);

renderIdentity();
refresh();
