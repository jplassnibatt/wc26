// Per-match reveal/lock time. A match's bets become readable by other players
// (and the prediction editor closes) at kickoff.
import schedule from './schedule.json';
import { kickoffMs } from '../utils/matchTime';

export const MATCH_LOCK = {};
for (const phase of schedule.phases) {
  for (const match of phase.matches) {
    const ms = kickoffMs(match);
    if (ms != null) MATCH_LOCK[match.id] = ms;
  }
}

export function matchLockAt(matchId) {
  return MATCH_LOCK[matchId] ?? null;
}

export function isMatchLocked(matchId, now = Date.now()) {
  const t = MATCH_LOCK[matchId];
  return t != null && now >= t;
}
