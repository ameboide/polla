import { list, create, update, upsert } from "./api.js";
import { COLLECTIONS } from "./config.js";

export const DEFAULT_CONFIG = {
  winner: 3, exactScore: 10, goalDiff: 2, totalGoals: 1, eachTeamGoals: 1, advance: 5,
};

// A config row's value is text; turn it into a number when it clearly is one,
// otherwise keep the string (so future non-numeric settings pass through).
function coerceConfigValue(s) {
  return typeof s === "string" && s.trim() !== "" && Number.isFinite(Number(s))
    ? Number(s)
    : s;
}

// Assemble a flat config object from key-value rows, filling any missing key
// from DEFAULT_CONFIG. (No single-row id — each key is its own row.)
export function resolveConfig(rows) {
  const out = { ...DEFAULT_CONFIG };
  for (const r of rows) out[r.configKey] = coerceConfigValue(r.configValue);
  return out;
}

// Scoring config changes almost never, but a GET for it ran on every page load
// (1 of 3 calls). Cache it in localStorage with a short TTL so most loads skip
// that GET, cutting requests and load latency; admin saves write through (see
// cacheConfig) so the editor never sees a stale value.
const CONFIG_CACHE_KEY = "polla.config.cache";
const CONFIG_TTL_MS = 5 * 60 * 1000;

export function readCachedConfig() {
  if (typeof localStorage === "undefined") return null;
  try {
    const { at, value } = JSON.parse(localStorage.getItem(CONFIG_CACHE_KEY) || "null") || {};
    return at && Date.now() - at <= CONFIG_TTL_MS ? value : null;
  } catch { return null; }
}

export function cacheConfig(value) {
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify({ at: Date.now(), value })); } catch {}
}

// Each predictions record is { id, player, matches: [{matchId,homeGoals,awayGoals,advancer?}] }.
// Flatten to the {player, matchId, homeGoals, awayGoals, advancer?} rows the views/scoring expect.
export function flattenPredictions(records) {
  return records.flatMap((r) =>
    (r.matches || []).map((m) => ({
      player: r.player,
      matchId: m.matchId,
      homeGoals: m.homeGoals,
      awayGoals: m.awayGoals,
      advancer: m.advancer,
    }))
  );
}

// The single results record is { id, matches: [...] }. Return just the matches.
export function resultsMatches(record) {
  return record && record.matches ? record.matches : [];
}

// Overlay edited matches (by matchId) onto an existing matches array.
export function mergeMatches(existing, edits) {
  const byId = new Map((existing || []).map((m) => [m.matchId, { ...m }]));
  for (const e of edits) {
    const m = { matchId: e.matchId, homeGoals: e.homeGoals, awayGoals: e.awayGoals };
    if (e.advancer != null) m.advancer = e.advancer;
    byId.set(e.matchId, m);
  }
  return [...byId.values()];
}

export async function loadFixtures() {
  const res = await fetch("fixtures.json");
  if (!res.ok) throw new Error(`fixtures.json -> ${res.status}`);
  return res.json();
}

export async function loadAll() {
  const cachedConfig = readCachedConfig();
  const [fixtures, predictionRecords, resultRecords, configRecords] = await Promise.all([
    loadFixtures(),
    list(COLLECTIONS.predictions),
    list(COLLECTIONS.results),
    cachedConfig ? Promise.resolve(null) : list(COLLECTIONS.config),
  ]);
  const config = cachedConfig || resolveConfig(configRecords);
  if (!cachedConfig) cacheConfig(config);
  const resultsRecord = resultRecords[0] || null;
  return {
    fixtures,
    config,
    // Raw records for upserts:
    predictionRecords,
    resultsRecord,
    // Flattened views consumed by predict/leaderboard/scoring:
    predictions: flattenPredictions(predictionRecords),
    results: resultsMatches(resultsRecord),
  };
}

// One record per player: { player, matches: [...] }.
export function savePlayerPredictions(existingRecord, player, matches) {
  const fields = { player, matches };
  return existingRecord && existingRecord.id
    ? update(COLLECTIONS.predictions, existingRecord.id, fields)
    : create(COLLECTIONS.predictions, fields);
}

// A single results record holding every match: { matches: [...] }.
export function saveResults(existingRecord, matches) {
  const fields = { matches };
  return existingRecord && existingRecord.id
    ? update(COLLECTIONS.results, existingRecord.id, fields)
    : create(COLLECTIONS.results, fields);
}

// Shape a flat fields object into key-value upsert rows (values stringified).
export function configRows(fields) {
  return Object.entries(fields).map(([configKey, v]) => ({
    configKey, configValue: String(v),
  }));
}

// One row per setting; upsert merges on the unique configKey column.
export function saveConfig(fields) {
  return upsert(COLLECTIONS.config, configRows(fields), "configKey");
}
