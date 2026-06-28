// Single source of truth for which tournament segment a match belongs to.
// Group stage (phase id "group") vs knockout (everything else: r32 → final).
// Used by the scoring write-path, the backfill script, and any per-segment UI,
// so the classification can never drift between them.
import schedule from '../data/schedule.json';

const groupPhase = schedule.phases.find((p) => p.id === 'group');
export const GROUP_MATCH_IDS = new Set((groupPhase?.matches || []).map((m) => m.id));

// Returns 'group' for group-stage matches, 'knockout' otherwise.
export function matchSegment(matchId) {
  return GROUP_MATCH_IDS.has(Number(matchId)) ? 'group' : 'knockout';
}

// Kickoff in epoch ms. schedule stores Portugal time (UTC+1 during the
// tournament), so subtract one hour — mirrors scripts/sync-results.mjs.
function kickoffMs(m) {
  const [y, mo, d] = m.date.split('-').map(Number);
  const [h, mi] = m.kickoff_bst.split(':').map(Number);
  return Date.UTC(y, mo - 1, d, h - 1, mi);
}

// Last group kickoff + ~2h: the moment the group stage is, for all practical
// purposes, finished. Gates the "Oráculo da Circunvalação" certificate so we
// never crown a leader mid-stage.
const LAST_GROUP_MS = (groupPhase?.matches || []).reduce((max, m) => Math.max(max, kickoffMs(m)), 0);
const GROUP_STAGE_END_MS = LAST_GROUP_MS ? LAST_GROUP_MS + 2 * 60 * 60 * 1000 : Infinity;

// True once the group stage is over (all group matches have been played).
export function groupStageComplete(now = Date.now()) {
  return now >= GROUP_STAGE_END_MS;
}
const finalMatch = schedule.phases.find((p) => p.id === 'final')?.matches[0];
// Tournament is "over" ~3h after the final kicks off.
const TOURNAMENT_END_MS = finalMatch ? kickoffMs(finalMatch) + 3 * 60 * 60 * 1000 : Infinity;

// Which leaderboard tab to open on, following the tournament's current phase:
// group stage → 'group'; once the group stage is over → 'knockout'; after the
// final ends → 'total'. The per-segment tabs always stay available regardless.
export function defaultLeaderboardTab(now = Date.now()) {
  if (now >= TOURNAMENT_END_MS) return 'total';
  return currentPhase(now) === 'group' ? 'group' : 'knockout';
}

// Each phase (schedule order) with the moment it is "done" — ~2.5h after its
// last kickoff (last match's final whistle, with margin).
const PHASE_ENDS = schedule.phases
  .filter((p) => p.matches?.length)
  .map((p) => ({
    id: p.id,
    end: p.matches.reduce((max, m) => Math.max(max, kickoffMs(m)), 0) + 2.5 * 60 * 60 * 1000,
  }));

// The phase the tournament is currently in: the first one not yet finished.
// Drives the default selected phase across the app (calendar, bets, my matches,
// summary). The day the group stage ends, this flips to 'r32' — so the calendar
// opens on the round of 32 — and advances round by round from there.
export function currentPhase(now = Date.now()) {
  const cur = PHASE_ENDS.find((p) => now < p.end);
  return cur ? cur.id : (PHASE_ENDS[PHASE_ENDS.length - 1]?.id || 'group');
}

// currentPhase restricted to the read-only bracket's rounds (no group / 3rd):
// up to the round of 32 → 'r32'; the 3rd-place day maps to the final.
export function currentBracketPhase(now = Date.now()) {
  const p = currentPhase(now);
  if (p === 'group') return 'r32';
  if (p === '3rd') return 'final';
  return p;
}
