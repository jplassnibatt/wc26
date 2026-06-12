import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { usePools } from './usePools';
import { isSpecialLocked } from '../data/specialBets';
import { getNicknames } from '../data/nicknames';
import { logError } from '../utils/logError';

// Loads every member's special picks (+ nicknames) for the active pool.
// Only attempts the read once the deadline has passed — before that the
// Firestore rules forbid reading other players' picks, so we skip entirely.
export function useSpecialStats(enabled) {
  const { activePoolId } = usePools();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled || !activePoolId || !isSpecialLocked()) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [betsSnap, names] = await Promise.all([
          getDocs(collection(db, 'pools', activePoolId, 'specialBets')),
          getNicknames(activePoolId),
        ]);
        if (cancelled) return;
        const list = betsSnap.docs.map((d) => {
          const data = d.data();
          return {
            uid: d.id,
            nickname: names[d.id] || '—',
            picks: data.picks || {},
            pointsAwarded: data.pointsAwarded || {},
          };
        });
        setMembers(list);
      } catch (e) {
        if (!cancelled) logError('SPECIAL_STATS_FAILED', 'Falha ao carregar estatísticas dos especiais', { e: String(e) });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [enabled, activePoolId]);

  return { members, loading };
}
