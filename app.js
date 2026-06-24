import { ADMIN_SECRET } from "./config.js";
import { loadAll } from "./store.js";
import { renderPredict } from "./views/predict.js";
import { renderLeaderboard } from "./views/leaderboard.js";
import { renderAdmin } from "./views/admin.js";

const viewRoot = document.getElementById("view");
const statusEl = document.getElementById("status");
const identityEl = document.getElementById("identity");

const renderers = { predict: renderPredict, leaderboard: renderLeaderboard, admin: renderAdmin };
let activeTab = "predict";
let data = null;
let unsavedCheck = () => false;

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

function renderIdentity() {
  const player = getPlayer();
  identityEl.textContent = player ? `Hi, ${player}` : "";
  // Admin tab stays visible for everyone; clicking it prompts for the code
  // (see selectTab). Show a lock hint until unlocked.
  const adminBtn = document.querySelector('nav button[data-tab="admin"]');
  adminBtn.textContent = isAdmin() ? "Admin" : "Admin 🔒";
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
    data, player: getPlayer(), isAdmin: isAdmin(), refresh, setStatus,
    setUnsavedCheck: (fn) => { unsavedCheck = fn; },
  };
}

function renderActive() {
  if (!data) return;
  document.querySelectorAll("nav button").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === activeTab));
  viewRoot.innerHTML = "";
  unsavedCheck = () => false; // the view re-registers if it tracks edits
  renderers[activeTab](viewRoot, ctx());
}

function selectTab(tab) {
  if (tab === activeTab) return;
  if (unsavedCheck() && !confirm("You have unsaved changes. Leave without saving?")) return;
  if (tab === "admin" && !isAdmin()) {
    const code = (prompt("Admin code:") || "").trim();
    if (code === ADMIN_SECRET) { localStorage.setItem("polla.admin", "1"); renderIdentity(); }
    else { setStatus("Wrong admin code", true); return; }
  }
  activeTab = tab;
  renderActive();
}

window.addEventListener("beforeunload", (e) => {
  if (unsavedCheck()) { e.preventDefault(); e.returnValue = ""; }
});

document.querySelectorAll("nav button").forEach((b) =>
  b.addEventListener("click", () => selectTab(b.dataset.tab)));

renderIdentity();
refresh();
