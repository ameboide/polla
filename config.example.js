// Copy this file to config.js and fill in your own values.
//
// Backend: Supabase (Postgres + PostgREST). Create a free project at
// supabase.com, then run this SQL in the project's SQL Editor to create the
// three tables and open Row-Level Security for anonymous access (this app has
// no server-side auth — players are identified client-side):
//
//   create table predictions (
//     id uuid primary key default gen_random_uuid(),
//     player text not null,
//     matches jsonb not null default '[]'
//   );
//   create table results (
//     id uuid primary key default gen_random_uuid(),
//     matches jsonb not null default '[]'
//   );
//   create table configs (
//     id uuid primary key default gen_random_uuid(),
//     "configKey" text not null unique,
//     "configValue" text not null
//   );
//
//   insert into configs ("configKey","configValue") values
//     ('winner','3'),('exactScore','10'),('goalDiff','2'),
//     ('totalGoals','1'),('eachTeamGoals','1'),('advance','5');
//
//   alter table predictions enable row level security;
//   alter table results     enable row level security;
//   alter table configs     enable row level security;
//
//   -- Open read+write to the anon role. Anyone can edit (matches the app's
//   -- open-pool trust model); tighten later if you add real auth.
//   create policy anon_all on predictions for all to anon using (true) with check (true);
//   create policy anon_all on results     for all to anon using (true) with check (true);
//   create policy anon_all on configs     for all to anon using (true) with check (true);
//
// Then copy Settings → API → Project URL and the anon/public key below.
export const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
export const SUPABASE_ANON_KEY = "REPLACE_WITH_ANON_PUBLIC_KEY";
export const ADMIN_SECRET = "change-me"; // code that unlocks the Admin tab
export const COLLECTIONS = {
  predictions: "predictions",
  results: "results",
  config: "configs",
};
