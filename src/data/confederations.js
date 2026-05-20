// Map team ISO codes to their FIFA confederation
export const teamConfederation = {
  // UEFA (Europe)
  at: 'UEFA', be: 'UEFA', ba: 'UEFA', hr: 'UEFA', cz: 'UEFA',
  'gb-eng': 'UEFA', fr: 'UEFA', de: 'UEFA', nl: 'UEFA', no: 'UEFA',
  pt: 'UEFA', 'gb-sct': 'UEFA', es: 'UEFA', se: 'UEFA', ch: 'UEFA',
  tr: 'UEFA',
  // CONMEBOL (South America)
  ar: 'CONMEBOL', br: 'CONMEBOL', co: 'CONMEBOL', ec: 'CONMEBOL',
  py: 'CONMEBOL', uy: 'CONMEBOL',
  // CAF (Africa)
  dz: 'CAF', cv: 'CAF', ci: 'CAF', cd: 'CAF', eg: 'CAF',
  gh: 'CAF', ma: 'CAF', sn: 'CAF', za: 'CAF', tn: 'CAF',
  // AFC (Asia)
  au: 'AFC', ir: 'AFC', iq: 'AFC', jp: 'AFC', jo: 'AFC',
  kr: 'AFC', qa: 'AFC', sa: 'AFC', uz: 'AFC',
  // CONCACAF (North/Central America & Caribbean)
  ca: 'CONCACAF', cw: 'CONCACAF', ht: 'CONCACAF', mx: 'CONCACAF',
  pa: 'CONCACAF', us: 'CONCACAF',
  // OFC (Oceania)
  nz: 'OFC',
};

export const confederationOrder = ['UEFA', 'CONMEBOL', 'CAF', 'AFC', 'CONCACAF', 'OFC'];
