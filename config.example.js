// Copy this file to config.js and fill in your own values.
// config.js is git-ignored so your real key/secret never get committed.
//
// Backend: restdb.io. Create a database with three collections —
//   predictions: { player: text, matches: json }   (one record per player)
//   results:     { matches: json }                  (a single record)
//   config:      { winner, exactScore, goalDiff, totalGoals, eachTeamGoals: number }
// Then create a CORS-enabled API key (Settings → API keys → enable CORS for
// your app's origin) and paste the values below.
export const API_BASE = "https://yourdb-abcd.restdb.io/rest"; // your DB's REST root
export const API_KEY = "REPLACE_WITH_CORS_API_KEY";
export const ADMIN_SECRET = "change-me"; // code that unlocks the Admin tab
export const COLLECTIONS = {
  predictions: "predictions",
  results: "results",
  config: "config",
};
