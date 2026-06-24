// Groups fixtures into day buckets for the predict/admin views.
// Returns chronologically-ordered days, each with its matches sorted by
// kickoff. `isPast` is true once every match that day has kicked off, so the
// view can collapse finished days by default. `now` is injectable for tests.
export function groupFixturesByDay(fixtures, now = Date.now()) {
  const sorted = [...fixtures].sort(
    (a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff)
  );

  const byDay = new Map();
  for (const fx of sorted) {
    const d = new Date(fx.kickoff);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(fx);
  }

  return [...byDay.entries()].map(([dayKey, dayFixtures]) => {
    const lastKickoff = Math.max(...dayFixtures.map((f) => Date.parse(f.kickoff)));
    return {
      dayKey,
      label: formatDayLabel(dayFixtures[0].kickoff),
      isPast: lastKickoff < now,
      fixtures: dayFixtures,
    };
  });
}

export function formatDayLabel(kickoff) {
  return new Date(kickoff).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
