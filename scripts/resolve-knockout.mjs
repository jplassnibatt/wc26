// Standalone port of the app's group-standings + knockout-bracket resolution
// (src/utils/standings.js + src/utils/knockout.js), so admin scripts can map a
// knockout matchId -> { home, away } iso codes from the live `matchResults`.
//
// Kept faithful to the app logic. `results` is the same shape the app uses:
//   { [matchId]: { status, scoreHome, scoreAway, advancer, decidedBy, penHome, penAway } }
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const schedule = JSON.parse(
  readFileSync(join(__dirname, '..', 'src', 'data', 'schedule.json'), 'utf8')
);
const { THIRD_PLACE_ALLOCATION } = await import(
  pathToFileURL(join(__dirname, '..', 'src', 'data', 'thirdPlaceAllocation.js')).href
);

const phaseById = Object.fromEntries(schedule.phases.map((p) => [p.id, p]));
const GROUP_MATCHES = (phaseById.group ?? { matches: [] }).matches;
const KNOCKOUT_PHASES = ['r32', 'r16', 'qf', 'sf', '3rd', 'final'];
const KO_BY_ID = Object.fromEntries(
  KNOCKOUT_PHASES.flatMap((pid) => (phaseById[pid]?.matches || []).map((m) => [m.id, m]))
);

export function matchSlots(id) {
  const m = KO_BY_ID[id];
  return m ? [m.home, m.away] : [null, null];
}

function parseSlot(str) {
  if (!str) return null;
  const w = /^W(\d+)$/.exec(str);
  if (w) return { type: 'winner', match: Number(w[1]) };
  const l = /^L(\d+)$/.exec(str);
  if (l) return { type: 'loser', match: Number(l[1]) };
  return { type: 'group', pos: str[0], groups: str.match(/[A-L]/g) || [] };
}

const POS_INDEX = { 1: 0, 2: 1, 3: 2 };

function outcome(matchId, resolved, results) {
  const r = results?.[String(matchId)];
  if (!r || (r.status && r.status !== 'finished')) return null;
  const teams = resolved[matchId];
  if (!teams || !teams.home || !teams.away) return null;
  if (r.advancer === teams.home) return { winner: teams.home, loser: teams.away };
  if (r.advancer === teams.away) return { winner: teams.away, loser: teams.home };
  if (r.scoreHome == null || r.scoreAway == null) return null;
  let winner;
  if (r.scoreHome > r.scoreAway) winner = 'home';
  else if (r.scoreAway > r.scoreHome) winner = 'away';
  else if (r.penHome != null && r.penAway != null) winner = r.penHome > r.penAway ? 'home' : 'away';
  else return null;
  const loser = winner === 'home' ? 'away' : 'home';
  return { winner: teams[winner], loser: teams[loser] };
}

// ---- standings (port of standings.js) ----
function cmpBasic(a, b) {
  return b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf;
}
function headToHead(tied, played) {
  const inTie = new Set(tied.map((r) => r.iso));
  const sub = {};
  for (const r of tied) sub[r.iso] = { pts: 0, gf: 0, ga: 0 };
  for (const p of played) {
    if (!inTie.has(p.home) || !inTie.has(p.away)) continue;
    sub[p.home].gf += p.gh; sub[p.home].ga += p.ga;
    sub[p.away].gf += p.ga; sub[p.away].ga += p.gh;
    if (p.gh > p.ga) sub[p.home].pts += 3;
    else if (p.gh < p.ga) sub[p.away].pts += 3;
    else { sub[p.home].pts += 1; sub[p.away].pts += 1; }
  }
  return sub;
}
function sortGroup(rows, played) {
  const sorted = [...rows].sort(cmpBasic);
  const out = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && cmpBasic(sorted[i], sorted[j]) === 0) j++;
    const tied = sorted.slice(i, j);
    if (tied.length > 1) {
      const sub = headToHead(tied, played);
      tied.sort((a, b) => {
        const sa = sub[a.iso], sb = sub[b.iso];
        return sb.pts - sa.pts || (sb.gf - sb.ga) - (sa.gf - sa.ga) || sb.gf - sa.gf
          || a.name.localeCompare(b.name);
      });
    }
    out.push(...tied);
    i = j;
  }
  return out;
}
export function computeStandings(results) {
  const rows = {};
  for (const t of schedule.teams) {
    rows[t.iso] = { iso: t.iso, name: t.name, group: t.group, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0 };
  }
  const played = [];
  for (const m of GROUP_MATCHES) {
    const r = results[String(m.id)];
    if (!r || r.status !== 'finished' || r.scoreHome == null || r.scoreAway == null) continue;
    const home = rows[m.home_iso];
    const away = rows[m.away_iso];
    if (!home || !away) continue;
    const gh = Number(r.scoreHome), ga = Number(r.scoreAway);
    home.played++; away.played++;
    home.gf += gh; home.ga += ga;
    away.gf += ga; away.ga += gh;
    if (gh > ga) { home.won++; away.lost++; home.pts += 3; }
    else if (gh < ga) { away.won++; home.lost++; away.pts += 3; }
    else { home.drawn++; away.drawn++; home.pts++; away.pts++; }
    played.push({ home: m.home_iso, away: m.away_iso, gh, ga });
  }
  const groups = {};
  for (const row of Object.values(rows)) (groups[row.group] ??= []).push(row);
  for (const g of Object.keys(groups)) groups[g] = sortGroup(groups[g], played);
  const thirds = Object.values(groups)
    .map((g) => g[2])
    .filter(Boolean)
    .sort((a, b) => cmpBasic(a, b) || a.name.localeCompare(b.name));
  return { groups, thirds };
}

// ---- bracket resolution (port of knockout.js resolveKnockout) ----
export function resolveKnockout(results) {
  const { groups, thirds } = computeStandings(results || {});
  const groupComplete = (g) => {
    const rows = groups[g] || [];
    return rows.length > 0 && rows.every((r) => r.played === rows.length - 1);
  };
  const allGroupsComplete = Object.keys(groups).every(groupComplete);
  const thirdMap = allGroupsComplete
    ? THIRD_PLACE_ALLOCATION[thirds.slice(0, 8).map((r) => r.group).sort().join('')] || null
    : null;

  const resolved = {};
  const resolveSide = (slot, match) => {
    const src = parseSlot(slot);
    if (!src) return null;
    if (src.type === 'group') {
      if (src.groups.length === 1) {
        const g = src.groups[0];
        if (!groupComplete(g)) return null;
        return groups[g]?.[POS_INDEX[src.pos]]?.iso || null;
      }
      if (src.pos !== '3' || !thirdMap) return null;
      const otherSrc = parseSlot(match.home === slot ? match.away : match.home);
      if (!otherSrc || otherSrc.type !== 'group' || otherSrc.pos !== '1' || otherSrc.groups.length !== 1) {
        return null;
      }
      const thirdGroup = thirdMap[`1${otherSrc.groups[0]}`];
      return thirdGroup ? groups[thirdGroup]?.[2]?.iso || null : null;
    }
    if (src.type === 'winner') return outcome(src.match, resolved, results)?.winner || null;
    if (src.type === 'loser') return outcome(src.match, resolved, results)?.loser || null;
    return null;
  };
  for (const pid of KNOCKOUT_PHASES) {
    for (const m of phaseById[pid]?.matches || []) {
      resolved[m.id] = { home: resolveSide(m.home, m), away: resolveSide(m.away, m) };
    }
  }
  return resolved;
}

export const teamName = (iso) => schedule.teams.find((t) => t.iso === iso)?.name || iso;
export const matchById = (id) => KO_BY_ID[id] || null;
