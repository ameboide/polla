import { list, create, update } from "./api.js";
import { COLLECTIONS } from "./config.js";

export const DEFAULT_CONFIG = {
  winner: 3, exactScore: 10, goalDiff: 2, totalGoals: 1, eachTeamGoals: 1,
};

export function resolveConfig(records) {
  if (records.length > 0) return records[0];
  return { id: null, ...DEFAULT_CONFIG };
}

// Each predictions record is { id, player, matches: [{matchId,homeGoals,awayGoals}] }.
// Flatten to the {player, matchId, homeGoals, awayGoals} rows the views/scoring expect.
export function flattenPredictions(records) {
  return records.flatMap((r) =>
    (r.matches || []).map((m) => ({
      player: r.player,
      matchId: m.matchId,
      homeGoals: m.homeGoals,
      awayGoals: m.awayGoals,
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
    byId.set(e.matchId, { matchId: e.matchId, homeGoals: e.homeGoals, awayGoals: e.awayGoals });
  }
  return [...byId.values()];
}

export async function loadFixtures() {
  const res = await fetch("fixtures.json");
  if (!res.ok) throw new Error(`fixtures.json -> ${res.status}`);
  return res.json();
}

export async function loadAll() {
  const [fixtures, predictionRecords, resultRecords, configRecords] = await Promise.all([
    loadFixtures(),
    list(COLLECTIONS.predictions),
    list(COLLECTIONS.results),
    list(COLLECTIONS.config),
  ]);
  const resultsRecord = resultRecords[0] || null;
  return {
    fixtures,
    config: resolveConfig(configRecords),
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

export function saveConfig(existing, fields) {
  return existing && existing.id
    ? update(COLLECTIONS.config, existing.id, fields)
    : create(COLLECTIONS.config, fields);
}
