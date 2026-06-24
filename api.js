import { API_BASE, API_KEY } from "./config.js";

function headers(hasBody) {
  const h = { "x-apikey": API_KEY };
  if (hasBody) h["Content-Type"] = "application/json";
  return h;
}

async function request(method, path, fields) {
  const opts = { method, headers: headers(Boolean(fields)) };
  if (fields) opts.body = JSON.stringify(fields);
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) throw new Error(`restdb ${method} ${path} -> ${res.status}`);
  if (method === "DELETE") return undefined;
  return res.json();
}

// restdb records carry an `_id`; expose it as `id` and keep the rest flat.
export function normalize(record) {
  if (!record || typeof record !== "object") return record;
  const { _id, ...rest } = record;
  return { id: _id, ...rest };
}

export async function list(collection) {
  const body = await request("GET", `/${collection}`);
  return (Array.isArray(body) ? body : []).map(normalize);
}

export async function create(collection, fields) {
  return normalize(await request("POST", `/${collection}`, fields));
}

export async function update(collection, id, fields) {
  return normalize(await request("PUT", `/${collection}/${id}`, fields));
}

export async function remove(collection, id) {
  await request("DELETE", `/${collection}/${id}`);
}
