// Supabase config. SUPABASE_URL + SUPABASE_ANON_KEY come from your project's
// Settings → API. The anon key is public by design — safe to ship because
// Row-Level Security governs access (see config.example.js for the SQL).
export const SUPABASE_URL = "https://kljyczhzwlzamuquoksy.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_doJ7sgIaQoFKcU2CrWvp-A_UCX29z6h";
export const ADMIN_SECRET = "pollo"; // client-side code that unlocks the Admin tab
export const COLLECTIONS = {
  predictions: "predictions",
  results: "results",
  config: "config",
};
