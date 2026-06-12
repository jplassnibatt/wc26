import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './useAuth';
import { usePools } from './usePools';
import { logError } from '../utils/logError';

export const BRACKET_RESULTS_DOC = 'global';

// A user's bracket prediction lives at pools/{poolId}/brackets/{uid}
// ({ slots, picks }). The actual advancers (shared across pools) live at the
// top-level bracketResults/global doc, admin-writable.
export function useBracket() {
  const { user } = useAuth();
  const { activePoolId } = usePools();
  const [pred, setPred] = useState({ slots: {}, picks: {} });
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
        const [mine, res] = await Promise.all([
          getDoc(doc(db, 'pools', activePoolId, 'brackets', user.uid)),
          getDoc(doc(db, 'bracketResults', BRACKET_RESULTS_DOC)),
        ]);
        if (cancelled) return;
        setPred(mine.exists()
          ? { slots: mine.data().slots || {}, picks: mine.data().picks || {} }
          : { slots: {}, picks: {} });
        setResults(res.exists() ? res.data() : null);
      } catch (e) {
        if (!cancelled) logError('BRACKET_LOAD_FAILED', 'Falha ao carregar bracket', { e: String(e) });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, activePoolId]);

  const save = useCallback(
    async (next) => {
      setPred(next);
      if (!user || !activePoolId) return;
      try {
        await setDoc(
          doc(db, 'pools', activePoolId, 'brackets', user.uid),
          { userId: user.uid, slots: next.slots, picks: next.picks, updatedAt: serverTimestamp() },
          { merge: true }
        );
      } catch (e) {
        logError('BRACKET_SAVE_FAILED', 'Falha ao guardar bracket', { e: String(e) });
      }
    },
    [user, activePoolId]
  );

  return { pred, results, loading, save };
}
