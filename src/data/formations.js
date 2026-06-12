// Reusable formation templates. Each team only stores its formation key + an
// ordered list of 11 names (lineup.xi); the on-pitch coordinates come from here.
//
// Coordinates are percentages on a VERTICAL pitch:
//   x: 0 = left touchline, 100 = right touchline
//   y: 0 = own goal line (GK), 100 = opponent goal (attack)
// The slot order MUST match the order names are listed in lineup.xi
// (GK, then defence left→right, midfield left→right, attack left→right).

export const FORMATIONS = {
  '4-3-3': [
    { x: 50, y: 8, role: 'GR' },
    { x: 14, y: 26, role: 'LE' }, { x: 38, y: 23, role: 'DC' }, { x: 62, y: 23, role: 'DC' }, { x: 86, y: 26, role: 'LD' },
    { x: 28, y: 50, role: 'MC' }, { x: 50, y: 46, role: 'MC' }, { x: 72, y: 50, role: 'MC' },
    { x: 18, y: 76, role: 'EE' }, { x: 50, y: 82, role: 'PL' }, { x: 82, y: 76, role: 'ED' },
  ],
  '4-2-3-1': [
    { x: 50, y: 8, role: 'GR' },
    { x: 14, y: 26, role: 'LE' }, { x: 38, y: 23, role: 'DC' }, { x: 62, y: 23, role: 'DC' }, { x: 86, y: 26, role: 'LD' },
    { x: 36, y: 42, role: 'MD' }, { x: 64, y: 42, role: 'MD' },
    { x: 20, y: 64, role: 'EE' }, { x: 50, y: 62, role: 'MO' }, { x: 80, y: 64, role: 'ED' },
    { x: 50, y: 84, role: 'PL' },
  ],
  '4-4-2': [
    { x: 50, y: 8, role: 'GR' },
    { x: 14, y: 26, role: 'LE' }, { x: 38, y: 23, role: 'DC' }, { x: 62, y: 23, role: 'DC' }, { x: 86, y: 26, role: 'LD' },
    { x: 16, y: 54, role: 'ME' }, { x: 40, y: 50, role: 'MC' }, { x: 60, y: 50, role: 'MC' }, { x: 84, y: 54, role: 'MD' },
    { x: 38, y: 80, role: 'PL' }, { x: 62, y: 80, role: 'PL' },
  ],
  '4-1-4-1': [
    { x: 50, y: 8, role: 'GR' },
    { x: 14, y: 26, role: 'LE' }, { x: 38, y: 23, role: 'DC' }, { x: 62, y: 23, role: 'DC' }, { x: 86, y: 26, role: 'LD' },
    { x: 50, y: 40, role: 'TR' },
    { x: 16, y: 60, role: 'ME' }, { x: 40, y: 56, role: 'MC' }, { x: 60, y: 56, role: 'MC' }, { x: 84, y: 60, role: 'MD' },
    { x: 50, y: 82, role: 'PL' },
  ],
  '3-4-3': [
    { x: 50, y: 8, role: 'GR' },
    { x: 26, y: 24, role: 'DC' }, { x: 50, y: 22, role: 'DC' }, { x: 74, y: 24, role: 'DC' },
    { x: 12, y: 50, role: 'ALE' }, { x: 40, y: 48, role: 'MC' }, { x: 60, y: 48, role: 'MC' }, { x: 88, y: 50, role: 'ALD' },
    { x: 22, y: 78, role: 'EE' }, { x: 50, y: 82, role: 'PL' }, { x: 78, y: 78, role: 'ED' },
  ],
  '3-5-2': [
    { x: 50, y: 8, role: 'GR' },
    { x: 26, y: 24, role: 'DC' }, { x: 50, y: 22, role: 'DC' }, { x: 74, y: 24, role: 'DC' },
    { x: 10, y: 52, role: 'ALE' }, { x: 35, y: 48, role: 'MC' }, { x: 50, y: 44, role: 'MC' }, { x: 65, y: 48, role: 'MC' }, { x: 90, y: 52, role: 'ALD' },
    { x: 38, y: 80, role: 'PL' }, { x: 62, y: 80, role: 'PL' },
  ],
  '5-3-2': [
    { x: 50, y: 8, role: 'GR' },
    { x: 10, y: 28, role: 'LE' }, { x: 30, y: 24, role: 'DC' }, { x: 50, y: 22, role: 'DC' }, { x: 70, y: 24, role: 'DC' }, { x: 90, y: 28, role: 'LD' },
    { x: 30, y: 52, role: 'MC' }, { x: 50, y: 48, role: 'MC' }, { x: 70, y: 52, role: 'MC' },
    { x: 38, y: 80, role: 'PL' }, { x: 62, y: 80, role: 'PL' },
  ],
};

// Combines a team's lineup (formation + ordered names) with the template.
export function buildXI(lineup) {
  const template = FORMATIONS[lineup?.formation];
  if (!template || !Array.isArray(lineup?.xi)) return [];
  return template.map((slot, i) => ({ ...slot, name: lineup.xi[i] || '' }));
}
