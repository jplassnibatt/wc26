import { kickoffMs, localDateKey } from './matchTime';

// Matches are sorted by absolute kickoff instant and grouped by the date in
// the viewer's timezone — FIFA match ids are not strictly chronological, and
// a late kickoff can fall on a different day depending on where you are.
export function compareKickoff(a, b) {
  return (kickoffMs(a) ?? 0) - (kickoffMs(b) ?? 0);
}

export function groupMatchesByDate(matches) {
  const grouped = {};
  for (const match of [...matches].sort(compareKickoff)) {
    const key = localDateKey(match);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(match);
  }
  return grouped;
}
