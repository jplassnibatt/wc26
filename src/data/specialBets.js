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

// One-off exception: in pool WC26-GXFD these users got a late extension to fill
// their special bets (until 28 Jun end of day, Portugal/UTC+1) — see
// SpecialBetsAdmin (exclusion + adjustments-log note applied on resolve). The
// deadline is also enforced in firestore.rules, keyed by e-mail.
//
// Exclusion from the FINAL total differs per user:
//   - emails NOT listed in `baselineLateCategories` → ALL their special points
//     are excluded from the total.
//   - emails IN `baselineLateCategories` (Ricardo) → only the listed categories
//     (the ones filled in the reopening) are excluded; their other (on-time)
//     categories count. Ricardo only had 'surpriseTeam' left to fill.
export const SPECIAL_EXCEPTION = {
  poolCode: 'WC26-GXFD',
  emails: ['22444@aegmmaia.pt', 'tatianalopes4@hotmail.com', 'ricardojbd@gmail.com'],
  baselineLateCategories: { 'ricardojbd@gmail.com': ['surpriseTeam'] },
  deadline: '2026-06-28T23:00:00Z',
};

// True while the named users may still edit specials in the exception pool.
export function isSpecialExceptionActive(poolCode, email, now = new Date()) {
  const ex = SPECIAL_EXCEPTION;
  if (poolCode !== ex.poolCode || !email) return false;
  return ex.emails.includes(email.toLowerCase())
    && now.getTime() < new Date(ex.deadline).getTime();
}
