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
