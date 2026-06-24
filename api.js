import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

// Supabase exposes every table as a PostgREST endpoint under /rest/v1. The anon
// key is public by design — it's safe to ship because Row-Level Security (see
// the SQL in config.example.js) governs what it may actually do.
const BASE = `${SUPABASE_URL}/rest/v1`;

function headers(hasBody, prefer) {
  const h = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };
  if (hasBody) h["Content-Type"] = "application/json";
  if (prefer) h.Prefer = prefer;
  return h;
}

async function request(method, path, body, prefer) {
  const opts = { method, headers: headers(Boolean(body), prefer) };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) throw new Error(`supabase ${method} ${path} -> ${res.status}`);
  if (method === "DELETE") return undefined;
  return res.json();
}

export async function list(table) {
  const rows = await request("GET", `/${table}?select=*`);
  return Array.isArray(rows) ? rows : [];
}

// Insert one row. Prefer: return=representation makes PostgREST echo the
// inserted row (with its generated id); it comes back as a single-element array.
export async function create(table, fields) {
  const rows = await request("POST", `/${table}`, fields, "return=representation");
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function update(table, id, fields) {
  const rows = await request("PATCH", `/${table}?id=eq.${id}`, fields, "return=representation");
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function remove(table, id) {
  await request("DELETE", `/${table}?id=eq.${id}`);
}
