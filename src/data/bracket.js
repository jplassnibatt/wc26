// Knockout bracket model, derived from the schedule. The schedule encodes the
// bracket structure in each knockout match's home/away strings:
//   group slots  -> '2A', '1C', '3A/B/C/D/F' (position + the group(s) it draws from)
//   feeders      -> 'W73' (winner of match 73), 'L101' (loser of match 101)
import schedule from './schedule.json';

// Champion path only (3rd-place playoff is excluded).
export const BRACKET_PHASES = ['r32', 'r16', 'qf', 'sf', 'final'];

// Escalating points: a team you predicted to REACH a phase that actually does.
export const PHASE_POINTS = { r16: 3, qf: 5, sf: 8, final: 12, champion: 20 };

// Teams grouped by their group letter (the candidate pool for R32 slots).
const GROUP_TEAMS = {};
for (const t of schedule.teams) {
  (GROUP_TEAMS[t.group] ||= []).push({ id: t.iso, label: t.name, group: t.group });
}

function parseSource(str) {
  if (!str) return null;
  const w = /^W(\d+)$/.exec(str);
  if (w) return { type: 'winner', match: Number(w[1]) };
  const l = /^L(\d+)$/.exec(str);
  if (l) return { type: 'loser', match: Number(l[1]) };
  // Group slot: leading position digit + any group letters.
  return { type: 'group', pos: str[0], groups: str.match(/[A-L]/g) || [], raw: str };
}

const phaseById = Object.fromEntries(schedule.phases.map((p) => [p.id, p]));

export const BRACKET = BRACKET_PHASES.map((pid) => ({
  id: pid,
  matches: (phaseById[pid]?.matches || []).map((m) => ({
    id: m.id,
    phase: pid,
    label: m.label,
    home: parseSource(m.home),
    away: parseSource(m.away),
  })),
}));

const matchIdsByPhase = Object.fromEntries(
  BRACKET.map((p) => [p.id, p.matches.map((m) => m.id)])
);
export const FINAL_MATCH_ID = matchIdsByPhase.final[0];

// Candidate team options for a group-based slot (used by the R32 pickers).
// `exclude` removes teams already assigned to OTHER slots so the same team
// can't be placed in two places.
export function candidatesFor(source, exclude = []) {
  if (!source || source.type !== 'group') return [];
  const ex = new Set(exclude);
  const seen = new Set();
  const out = [];
  for (const g of source.groups) {
    for (const t of GROUP_TEAMS[g] || []) {
      if (!seen.has(t.id) && !ex.has(t.id)) {
        seen.add(t.id);
        out.push({ id: t.id, label: t.label, sublabel: `${g}`, group: g });
      }
    }
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

// Resolve the two team isos for a match given a prediction { slots, picks }.
// Group slots come from the user's R32 assignments (slots['<id>H'/'<id>A']);
// feeder slots come from the user's predicted winner of the feeding match.
export function matchTeams(match, pred) {
  const side = (source, key) => {
    if (!source) return null;
    if (source.type === 'group') return pred?.slots?.[`${match.id}${key}`] || null;
    if (source.type === 'winner') return pred?.picks?.[source.match] || null;
    return null;
  };
  return { home: side(match.home, 'H'), away: side(match.away, 'A') };
}

// The teams the prediction sends INTO each phase (winners of the previous round).
export function predictedAdvancers(pred) {
  const winners = (phaseId) =>
    matchIdsByPhase[phaseId].map((id) => pred?.picks?.[id]).filter(Boolean);
  return {
    r16: winners('r32'),
    qf: winners('r16'),
    sf: winners('qf'),
    final: winners('sf'),
    champion: pred?.picks?.[FINAL_MATCH_ID] || null,
  };
}

// Score a prediction against the actual advancers
// (actual = { r16:[iso], qf:[iso], sf:[iso], final:[iso], champion: iso }).
export function scoreBracket(pred, actual) {
  const adv = predictedAdvancers(pred);
  const breakdown = {};
  let points = 0;
  for (const ph of ['r16', 'qf', 'sf', 'final']) {
    const set = new Set(actual?.[ph] || []);
    const hit = (adv[ph] || []).filter((t) => set.has(t)).length;
    breakdown[ph] = hit;
    points += hit * PHASE_POINTS[ph];
  }
  const champHit = adv.champion && adv.champion === actual?.champion ? 1 : 0;
  breakdown.champion = champHit;
  points += champHit * PHASE_POINTS.champion;
  return { points, breakdown };
}

// Drop winner picks that are no longer valid (their team isn't in the match
// anymore because an upstream pick changed). Keeps the bracket consistent.
export function normalizePrediction(pred) {
  const picks = { ...(pred.picks || {}) };
  let changed = true;
  while (changed) {
    changed = false;
    for (const phase of BRACKET) {
      for (const m of phase.matches) {
        const { home, away } = matchTeams(m, { slots: pred.slots, picks });
        const w = picks[m.id];
        if (w && w !== home && w !== away) {
          delete picks[m.id];
          changed = true;
        }
      }
    }
  }
  return { slots: pred.slots || {}, picks };
}
