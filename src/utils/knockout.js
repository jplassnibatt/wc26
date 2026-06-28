// Resolves knockout fixtures to REAL teams as the tournament unfolds, filling in
// only slots that are already certain (the user's rule: "só as que já são
// certas"). It is purely reactive to the `matchResults`-backed scores map, so it
// updates by itself every time a new result lands — no manual maintenance.
//
// What is "certain":
//   - 1st / 2nd of a group  -> only once that group has played all its matches
//     (the final table order, incl. tiebreakers, is then settled).
//   - Winner / loser feeders (W73 / L101) -> once that match is finished and both
//     of its teams are already resolved.
//   - The 8 best third-placed slots (e.g. "3C/E/F/H/I") -> resolved once ALL 12
//     groups are complete, via FIFA's official allocation table (Annexe C, see
//     thirdPlaceAllocation.js): the set of 8 qualifying thirds keys into the
//     table, which says exactly which group's third faces each group winner.
import schedule from '../data/schedule.json';
import { computeStandings } from './standings';
import { THIRD_PLACE_ALLOCATION } from '../data/thirdPlaceAllocation';

const phaseById = Object.fromEntries(schedule.phases.map((p) => [p.id, p]));
const GROUP_MATCHES = phaseById.group?.matches || [];
// All knockout phases in bracket order so winner feeders resolve front-to-back.
const KNOCKOUT_PHASES = ['r32', 'r16', 'qf', 'sf', '3rd', 'final'];

const KO_BY_ID = Object.fromEntries(
  KNOCKOUT_PHASES.flatMap((pid) => (phaseById[pid]?.matches || []).map((m) => [m.id, m]))
);

// Raw home/away slot strings for a knockout match (e.g. ['2A', '3C/E/F/H/I']).
export function matchSlots(id) {
  const m = KO_BY_ID[id];
  return m ? [m.home, m.away] : [null, null];
}

// Parse a slot string into a structured source.
//   'W73' -> winner of match 73    'L101' -> loser of match 101
//   '1C'  -> 1st of group C        '3C/E/F/H/I' -> a best-third pool
export function parseSlot(str) {
  if (!str) return null;
  const w = /^W(\d+)$/.exec(str);
  if (w) return { type: 'winner', match: Number(w[1]) };
  const l = /^L(\d+)$/.exec(str);
  if (l) return { type: 'loser', match: Number(l[1]) };
  return { type: 'group', pos: str[0], groups: str.match(/[A-L]/g) || [] };
}

const POS_INDEX = { 1: 0, 2: 1, 3: 2 };

// Decide the winner/loser of a finished knockout match. Needs both teams known
// and a decisive result; a knockout draw with no shootout data stays unresolved.
function outcome(matchId, resolved, results) {
  const r = results?.[String(matchId)];
  if (!r || (r.status && r.status !== 'finished')) return null;
  const teams = resolved[matchId];
  if (!teams || !teams.home || !teams.away) return null;
  // Admin-recorded advancer (match decided in extra time / penalties) takes
  // precedence over the score logic, so a 90' draw still resolves the bracket.
  if (r.advancer === teams.home) return { winner: teams.home, loser: teams.away };
  if (r.advancer === teams.away) return { winner: teams.away, loser: teams.home };
  if (r.scoreHome == null || r.scoreAway == null) return null;
  let winner;
  if (r.scoreHome > r.scoreAway) winner = 'home';
  else if (r.scoreAway > r.scoreHome) winner = 'away';
  else if (r.penHome != null && r.penAway != null) winner = r.penHome > r.penAway ? 'home' : 'away';
  else return null; // drew, no shootout recorded — can't be certain
  const loser = winner === 'home' ? 'away' : 'home';
  return { winner: teams[winner], loser: teams[loser] };
}

// Returns { [matchId]: { home: iso|null, away: iso|null } } for every knockout
// match, with isos only where the team is already certain.
export function resolveKnockout(results) {
  const { groups, thirds } = computeStandings(results || {});
  const groupComplete = (g) => {
    const rows = groups[g] || [];
    return rows.length > 0 && rows.every((r) => r.played === rows.length - 1);
  };

  // Best-third allocation is only knowable once EVERY group is finished (the set
  // of 8 qualifying thirds is then settled). The 8 qualifiers, alphabetically,
  // key into FIFA's Annexe C table -> { '1A': 'E', … } (winner of A plays E's 3rd).
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
      // Best-third pool: look at the group winner on the other side of this
      // match, then ask the allocation table which group's third they face.
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

// Like resolveKnockout, but also derives the certain winner of each knockout
// match and the champion (winner of the final). Used by the read-only bracket.
export function resolveWinners(results) {
  const teams = resolveKnockout(results);
  const winners = {};
  for (const pid of KNOCKOUT_PHASES) {
    for (const m of phaseById[pid]?.matches || []) {
      winners[m.id] = outcome(m.id, teams, results)?.winner || null;
    }
  }
  const finalMatch = phaseById.final?.matches?.[0];
  return { teams, winners, champion: finalMatch ? winners[finalMatch.id] || null : null };
}

// Winner-feeder match ids for a knockout match: [homeFeeder, awayFeeder] (null
// for group slots, i.e. the R32).
function feederIds(id) {
  const w = (s) => {
    const p = parseSlot(s);
    return p && p.type === 'winner' ? p.match : null;
  };
  const [h, a] = matchSlots(id);
  return [w(h), w(a)];
}

// Walk one half of the bracket from its semi-final root, collecting the match
// ids of each round in top-to-bottom order (home feeder first) so columns line
// up pair-by-pair toward the centre.
function halfFromRoot(sfId) {
  const rounds = { sf: sfId == null ? [] : [sfId], qf: [], r16: [], r32: [] };
  const order = ['sf', 'qf', 'r16', 'r32'];
  for (let i = 0; i < order.length - 1; i++) {
    for (const id of rounds[order[i]]) {
      const [h, a] = feederIds(id);
      if (h != null) rounds[order[i + 1]].push(h);
      if (a != null) rounds[order[i + 1]].push(a);
    }
  }
  return rounds;
}

// Ordered match ids per knockout round (schedule order), for the round-by-round
// mobile view of the read-only bracket.
export const ROUND_IDS = Object.fromEntries(
  ['r32', 'r16', 'qf', 'sf', 'final'].map((pid) => [
    pid,
    (phaseById[pid]?.matches || []).map((m) => m.id),
  ])
);

// Static split of the bracket into its two halves + the final, derived from the
// schedule's feeder graph. The final's home feeder is the left half, away the right.
export const BRACKET_SIDES = (() => {
  const finalMatch = phaseById.final?.matches?.[0];
  if (!finalMatch) return { finalId: null, left: halfFromRoot(null), right: halfFromRoot(null) };
  const [leftRoot, rightRoot] = feederIds(finalMatch.id);
  return { finalId: finalMatch.id, left: halfFromRoot(leftRoot), right: halfFromRoot(rightRoot) };
})();

// Human-friendly label for an unresolved slot, e.g. "1.º Grupo A",
// "Melhor 3.º (C/E/F/H/I)", "Venc. jogo 73". Needs the i18n `t`.
export function slotLabel(str, t) {
  const src = parseSlot(str);
  if (!src) return str || '';
  if (src.type === 'winner') return `${t('slotWinnerOf')} ${src.match}`;
  if (src.type === 'loser') return `${t('slotLoserOf')} ${src.match}`;
  if (src.groups.length === 1) {
    const pos = src.pos === '1' ? t('slotFirst') : src.pos === '2' ? t('slotSecond') : t('slotThird');
    return `${pos} ${t('group')} ${src.groups[0]}`;
  }
  return `${t('slotBestThird')} (${src.groups.join('/')})`;
}
