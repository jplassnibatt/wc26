import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { usePools } from './usePools';
import schedule from '../data/schedule.json';
import { getNicknames } from '../data/nicknames';
import { logError } from '../utils/logError';

// Aggregates every finished match in a phase with all members' predictions and
// their awarded points. Only finished matches are queried, so all their bets
// are already past kickoff and therefore readable under the rules.
export function usePhaseSummary(phaseId, enabled) {
  const { activePoolId } = usePools();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled || !activePoolId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const phase = schedule.phases.find((p) => p.id === phaseId);
        if (!phase) {
          if (!cancelled) { setMatches([]); setLoading(false); }
          return;
        }

        const [resultsSnap, names] = await Promise.all([
          getDocs(collection(db, 'matchResults')),
          getNicknames(activePoolId),
        ]);
        if (cancelled) return;

        const results = {};
        resultsSnap.docs.forEach((d) => { results[d.id] = d.data(); });

        const finished = phase.matches.filter((m) => {
          const r = results[String(m.id)];
          return r && (r.status === 'finished' || r.scoreA != null);
        });

        const built = await Promise.all(
          finished.map(async (m) => {
            const r = results[String(m.id)];
            const bSnap = await getDocs(
              query(collection(db, 'pools', activePoolId, 'bets'), where('matchId', '==', m.id))
            );
            const bets = bSnap.docs
              .map((d) => {
                const x = d.data();
                return {
                  uid: x.userId,
                  nickname: names[x.userId] || '—',
                  a: x.predictedScoreA,
                  b: x.predictedScoreB,
                  points: x.pointsAwarded,
                };
              })
              .filter((x) => x.a != null && x.b != null);
            return {
              id: m.id,
              home: m.home,
              away: m.away,
              homeIso: m.home_iso,
              awayIso: m.away_iso,
              scoreA: r.scoreA,
              scoreB: r.scoreB,
              bets,
            };
          })
        );
        if (cancelled) return;
        setMatches(built);
      } catch (e) {
        if (!cancelled) logError('PHASE_SUMMARY_FAILED', `Falha no resumo da fase ${phaseId}`, { e: String(e) });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [enabled, activePoolId, phaseId]);

  return { matches, loading };
}
