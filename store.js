import { list, create, update } from "./api.js";
import { COLLECTIONS } from "./config.js";

export const DEFAULT_CONFIG = {
  winner: 3, exactScore: 10, goalDiff: 2, totalGoals: 1, eachTeamGoals: 1,
};

export function resolveConfig(records) {
  if (records.length > 0) return records[0];
  return { id: null, ...DEFAULT_CONFIG };
}

export async function loadFixtures() {
  const res = await fetch("fixtures.json");
  if (!res.ok) throw new Error(`fixtures.json -> ${res.status}`);
  return res.json();
}

export async function loadAll() {
  const [fixtures, predictions, results, configRecords] = await Promise.all([
    loadFixtures(),
    list(COLLECTIONS.predictions),
    list(COLLECTIONS.results),
    list(COLLECTIONS.config),
  ]);
  return { fixtures, predictions, results, config: resolveConfig(configRecords) };
}

function saveCollection(collection, existing, fields) {
  return existing && existing.id
    ? update(collection, existing.id, fields)
    : create(collection, fields);
}

export const savePrediction = (existing, fields) => saveCollection(COLLECTIONS.predictions, existing, fields);
export const saveResult = (existing, fields) => saveCollection(COLLECTIONS.results, existing, fields);
export const saveConfig = (existing, fields) => saveCollection(COLLECTIONS.config, existing, fields);
