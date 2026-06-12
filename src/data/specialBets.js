// Tournament-wide "special" bets (single pick each, locked at kickoff of the opening match).
// Resolved by the admin once the tournament ends.

export const SPECIAL_POINTS = 10;

// Categories. `kind` drives the autocomplete source:
//   'player' -> autocomplete over every player in the squads
//   'team'   -> autocomplete over the 48 national teams
export const SPECIAL_CATEGORIES = [
  { id: 'topScorer', icon: '👟', kind: 'player' },
  { id: 'mvp', icon: '🏆', kind: 'player' },
  { id: 'youngPlayer', icon: '⭐', kind: 'player' },
  { id: 'surpriseTeam', icon: '🎁', kind: 'team' },
];

// Picks lock at the opening match kickoff (Mexico vs South Africa, 11 Jun 2026, 17:00 local).
export const SPECIAL_DEADLINE = '2026-06-11T16:00:00Z';

export function isSpecialLocked(now = new Date()) {
  return now.getTime() >= new Date(SPECIAL_DEADLINE).getTime();
}
