import { API_BASE, API_KEY, API_ENV } from "./config.js";

function headers(hasBody) {
  const h = { "x-api-key": API_KEY, "X-Reqres-Env": API_ENV };
  if (hasBody) h["Content-Type"] = "application/json";
  return h;
}

async function request(method, path, fields) {
  const opts = { method, headers: headers(Boolean(fields)) };
  if (fields) opts.body = JSON.stringify({ data: fields });
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) throw new Error(`reqres ${method} ${path} -> ${res.status}`);
  if (method === "DELETE") return undefined;
  return res.json();
}

export function normalize(record) {
  const { id, data } = record;
  return { id, ...(data ?? {}) };
}

export async function list(collection) {
  const body = await request("GET", `/collections/${collection}/records`);
  const rows = Array.isArray(body) ? body : (body.data ?? []);
  return rows.map(normalize);
}

export async function create(collection, fields) {
  const body = await request("POST", `/collections/${collection}/records`, fields);
  return normalize(body.data ? body : { id: body.id, data: body.data ?? fields });
}

export async function update(collection, id, fields) {
  const body = await request("PUT", `/collections/${collection}/records/${id}`, fields);
  return normalize(body.data ? body : { id, data: fields });
}

export async function remove(collection, id) {
  await request("DELETE", `/collections/${collection}/records/${id}`);
}
