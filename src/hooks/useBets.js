import { useState, useEffect, useCallback } from 'react';
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  collection,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './useAuth';
import { usePools } from './usePools';
import { matchLockAt } from '../data/matchLock';
import { logError } from '../utils/logError';

export function useBets() {
  const { user } = useAuth();
  const { activePoolId } = usePools();

  const saveBet = useCallback(
    async (matchId, predictedScoreA, predictedScoreB) => {
      if (!user || !activePoolId) {
        logError('NO_POOL', 'Tentativa de guardar aposta sem pool activo', {
          userId: user?.uid,
          matchId,
        });
        throw new Error('NO_POOL');
      }
      const docId = `${user.uid}_${matchId}`;
      const ref = doc(db, 'pools', activePoolId, 'bets', docId);
      const existing = await getDoc(ref);

      const data = {
        userId: user.uid,
        matchId,
        predictedScoreA,
        predictedScoreB,
        // Kickoff time (epoch ms). The rules use this to reveal this bet to
        // other players only once the match has started (anti-copy).
        lockAt: matchLockAt(matchId),
        updatedAt: serverTimestamp(),
      };

      if (!existing.exists()) {
        data.createdAt = serverTimestamp();
        data.pointsAwarded = null;
      }

      await setDoc(ref, data, { merge: true });

      // Analytics: track bet submission
      try {
        await addDoc(collection(db, 'analytics'), {
          type: 'bet',
          userId: user.uid,
          matchId,
          poolId: activePoolId,
          submittedAt: serverTimestamp(),
        });
      } catch {}
    },
    [user, activePoolId]
  );

  return { saveBet };
}

export function useMyBetsMap() {
  const { user } = useAuth();
  const { activePoolId } = usePools();
  const [betsMap, setBetsMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !activePoolId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const q = query(
          collection(db, 'pools', activePoolId, 'bets'),
          where('userId', '==', user.uid)
        );
        const snap = await getDocs(q);
        if (cancelled) return;
        const map = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          map[data.matchId] = data;
        });
        setBetsMap(map);
      } catch (err) {
        if (!cancelled) {
          logError('BETS_LOAD_FAILED', 'Falha ao carregar apostas do utilizador', { e: String(err) });
          setBetsMap({});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, activePoolId]);

  return { betsMap, setBetsMap, loading };
}
