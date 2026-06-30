import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { usePools } from './usePools';
import { isMatchLocked } from '../data/matchLock';
import { getNicknames } from '../data/nicknames';
import { logError } from '../utils/logError';

// Loads every member's prediction (+ nicknames) for one match. Only runs once
// the match has kicked off — before that the rules forbid reading other
// players' bets, which would make the whole collection query fail.
export function useMatchStats(matchId, enabled) {
  const { activePoolId } = usePools();
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    if (!enabled || !activePoolId || !isMatchLocked(matchId)) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(false);
      try {
        const [betsSnap, names] = await Promise.all([
          getDocs(query(collection(db, 'pools', activePoolId, 'bets'), where('matchId', '==', matchId))),
          getNicknames(activePoolId),
        ]);
        if (cancelled) return;
        const list = betsSnap.docs
          .map((d) => {
            const data = d.data();
            return {
              uid: data.userId,
              nickname: names[data.userId] || '—',
              a: data.predictedScoreA,
              b: data.predictedScoreB,
              points: data.pointsAwarded,
              // Knockout extras (only set when the 90' guess was a draw): who the
              // player predicted to advance and how. Surfaced in the bets list.
              advancer: data.predictedAdvancer ?? null,
              decidedBy: data.predictedDecidedBy ?? null,
            };
          })
          .filter((x) => x.a != null && x.b != null);
        setBets(list);
      } catch (e) {
        if (!cancelled) {
          setError(true);
          logError('MATCH_STATS_FAILED', `Falha ao carregar palpites do jogo ${matchId}`, { e: String(e) });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [enabled, activePoolId, matchId, reloadKey]);

  return { bets, loading, error, reload };
}
