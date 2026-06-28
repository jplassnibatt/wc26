export function calculatePoints(predictedA, predictedB, actualA, actualB) {
  if (actualA == null || actualB == null) return null;

  // Exact result — 5 points
  if (predictedA === actualA && predictedB === actualB) {
    return { points: 5, type: 'exact' };
  }

  // Correct outcome (win/draw/loss) — 3 points
  const predictedOutcome = Math.sign(predictedA - predictedB);
  const actualOutcome = Math.sign(actualA - actualB);
  if (predictedOutcome === actualOutcome) {
    return { points: 3, type: 'outcome' };
  }

  // One correct goal count — 1 point
  if (predictedA === actualA || predictedB === actualB) {
    return { points: 1, type: 'partial' };
  }

  return { points: 0, type: 'miss' };
}

// Knockout scoring (Track A). The base is the 90' (normal-time) result, scored
// exactly like the group stage (5/3/1). When the match ACTUALLY goes beyond 90'
// (extra time or penalties), two extra layers reward the user who predicted a
// draw and called it:
//   +3  predicted advancer is correct
//   +2  predicted "how it ends" (et|pens) is correct
//   +5  BOOST: exact 90' draw AND advancer AND how-it-ends all correct
// A match decided in 90' is worth only the 5/3/1 base.
//   bet:    { predictedScoreA, predictedScoreB, predictedAdvancer, predictedDecidedBy }
//   actual: { a90, b90, decidedBy: '90'|'et'|'pens', advancer: iso|null }
export function scoreKnockout(bet, actual) {
  const base = calculatePoints(bet.predictedScoreA, bet.predictedScoreB, actual.a90, actual.b90);
  if (!base) return null;
  let points = base.points;
  const beyond90 = actual.decidedBy === 'et' || actual.decidedBy === 'pens';
  if (beyond90) {
    const advOk = !!bet.predictedAdvancer && bet.predictedAdvancer === actual.advancer;
    const decOk = !!bet.predictedDecidedBy && bet.predictedDecidedBy === actual.decidedBy;
    if (advOk) points += 3;
    if (decOk) points += 2;
    if (base.type === 'exact' && advOk && decOk) points += 5;
  }
  return { points, type: base.type };
}
