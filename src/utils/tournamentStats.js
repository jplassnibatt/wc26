// Tournament-wide stats derived from the same `matchResults`-backed map that
// useCachedScores() returns ({ matchId: { status, scoreHome, scoreAway,
// scorers } }). Results — including scorers — are written automatically by the
// ESPN sync (scripts/sync-results.mjs), so nothing here needs manual entry.
import schedule from '../data/schedule.json';

const GROUP_MATCHES = (schedule.phases.find((p) => p.id === 'group') ?? { matches: [] }).matches;

// matchId -> { home, away } ISOs. Only group games have static teams; knockout
// fixtures are TBD placeholders, so they're absent here on purpose.
const GROUP_ISOS = {};
for (const m of GROUP_MATCHES) {
  GROUP_ISOS[String(m.id)] = { home: m.home_iso, away: m.away_iso };
}

const TEAM_NAME = Object.fromEntries(schedule.teams.map((t) => [t.iso, t.name]));

function isFinished(r) {
  return r && r.status === 'finished' && r.scoreHome != null && r.scoreAway != null;
}

// Top scorers across all finished matches. Own goals never count toward a
// player's tally (Golden Boot rules). The team flag is attributed via the match
// side for group games; knockout games (TBD line-ups) leave teamIso null, so
// the goal still counts but no flag is shown until the bracket resolves.
export function topScorers(scores) {
  const tally = {}; // key -> { name, teamIso, goals, pens }
  for (const [id, r] of Object.entries(scores)) {
    if (!isFinished(r)) continue;
    const isos = GROUP_ISOS[id];
    for (const s of r.scorers || []) {
      if (!s?.name || s.og) continue;
      const teamIso = isos ? (s.side === 'A' ? isos.home : isos.away) : null;
      const key = `${s.name}__${teamIso ?? '?'}`;
      const e = tally[key] || (tally[key] = { name: s.name, teamIso, goals: 0, pens: 0 });
      e.goals++;
      if (s.pen) e.pens++;
    }
  }
  return Object.values(tally)
    .map((e) => ({ ...e, teamName: e.teamIso ? TEAM_NAME[e.teamIso] : '' }))
    .sort((a, b) => b.goals - a.goals || b.pens - a.pens || a.name.localeCompare(b.name));
}

// Best defenses (fewest goals conceded) over finished GROUP matches, where both
// teams are known. Clean sheet = a match conceding zero. Sorted by goals
// against, then clean sheets, then fewer games played (so a tidy 2-game record
// isn't beaten by a 3-game one with the same total).
export function bestDefenses(scores) {
  const rows = {}; // iso -> { iso, played, ga, cleanSheets }
  const ensure = (iso) => (rows[iso] ??= { iso, played: 0, ga: 0, cleanSheets: 0 });
  for (const [id, r] of Object.entries(scores)) {
    if (!isFinished(r)) continue;
    const isos = GROUP_ISOS[id];
    if (!isos) continue;
    const gh = Number(r.scoreHome), ga = Number(r.scoreAway);
    const home = ensure(isos.home), away = ensure(isos.away);
    home.played++; away.played++;
    home.ga += ga; away.ga += gh;
    if (ga === 0) home.cleanSheets++;
    if (gh === 0) away.cleanSheets++;
  }
  return Object.values(rows)
    .map((e) => ({ ...e, name: TEAM_NAME[e.iso] }))
    .sort(
      (a, b) =>
        a.ga - b.ga ||
        b.cleanSheets - a.cleanSheets ||
        a.played - b.played ||
        a.name.localeCompare(b.name)
    );
}
