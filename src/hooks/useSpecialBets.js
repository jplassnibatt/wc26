import { useState, useEffect, useCallback } from 'react';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './useAuth';
import { usePools } from './usePools';
import { logError } from '../utils/logError';

// User's special-bet picks live at pools/{poolId}/specialBets/{uid}, one doc
// holding all categories: { picks: { topScorer, mvp, youngPlayer, surpriseTeam },
// pointsAwarded: { ... } }. The correct answers (shared across every pool) live
// at the top-level `specialResults/global` doc, admin-writable.

export const SPECIAL_RESULTS_DOC = 'global';

export function useSpecialBets() {
  const { user } = useAuth();
  const { activePoolId } = usePools();
  const [picks, setPicks] = useState({});
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !activePoolId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [mineSnap, resultsSnap] = await Promise.all([
          getDoc(doc(db, 'pools', activePoolId, 'specialBets', user.uid)),
          getDoc(doc(db, 'specialResults', SPECIAL_RESULTS_DOC)),
        ]);
        if (cancelled) return;
        setPicks(mineSnap.exists() ? mineSnap.data().picks || {} : {});
        setResults(resultsSnap.exists() ? resultsSnap.data() : null);
      } catch (e) {
        if (!cancelled) logError('SPECIAL_LOAD_FAILED', 'Falha ao carregar apostas especiais', { e: String(e) });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, activePoolId]);

  const savePick = useCallback(
    async (categoryId, optionId) => {
      if (!user || !activePoolId) throw new Error('NO_POOL');
      const ref = doc(db, 'pools', activePoolId, 'specialBets', user.uid);
      const existing = await getDoc(ref);
      const prevPicks = existing.exists() ? existing.data().picks || {} : {};
      const nextPicks = { ...prevPicks, [categoryId]: optionId || null };

      // Per-category timestamp (epoch ms). Picks made on time predate this field
      // (so they have no stamp); late picks under an exception are stamped, which
      // lets scoring exclude only the late ones from the final total.
      const prevPickedAt = existing.exists() ? existing.data().pickedAt || {} : {};
      const nextPickedAt = { ...prevPickedAt, [categoryId]: Date.now() };

      const data = {
        userId: user.uid,
        picks: nextPicks,
        pickedAt: nextPickedAt,
        updatedAt: serverTimestamp(),
      };
      if (!existing.exists()) data.createdAt = serverTimestamp();

      await setDoc(ref, data, { merge: true });
      setPicks(nextPicks);
    },
    [user, activePoolId]
  );

  return { picks, results, loading, savePick };
}
