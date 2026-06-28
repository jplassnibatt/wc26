import { useState, useEffect, useRef, useCallback } from 'react';
import { doc, setDoc, getDocs, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { usePools } from './usePools';
import { getTodayMatches, mapApiStatus, extractScore } from '../utils/footballApi';

const POLL_INTERVAL = 60_000;

export function useLiveScores() {
  const { activePoolId } = usePools();
  const [liveData, setLiveData] = useState({});
  const [hasLive, setHasLive] = useState(false);
  const timerRef = useRef(null);

  const fetchScores = useCallback(async () => {
    try {
      const data = await getTodayMatches();
      if (!data.matches) return;

      const updates = {};
      let anyLive = false;

      for (const m of data.matches) {
        const status = mapApiStatus(m.status);
        const score = extractScore(m);
        updates[m.id] = { status, score, apiMatchId: m.id };
        if (status === 'live') anyLive = true;

        if (status === 'finished' && score && score.home != null && score.away != null && activePoolId) {
          await setDoc(
            doc(db, 'pools', activePoolId, 'matches', String(m.id)),
            { status, scoreHome: score.home, scoreAway: score.away },
            { merge: true }
          );
        }
      }

      setLiveData(updates);
      setHasLive(anyLive);
    } catch {
      // Silently fail — will retry on next poll
    }
  }, [activePoolId]);

  useEffect(() => {
    fetchScores();
    return () => clearInterval(timerRef.current);
  }, [fetchScores]);

  useEffect(() => {
    clearInterval(timerRef.current);
    if (hasLive) {
      timerRef.current = setInterval(fetchScores, POLL_INTERVAL);
    }
    return () => clearInterval(timerRef.current);
  }, [hasLive, fetchScores]);

  return { liveData, hasLive, refetch: fetchScores };
}

export function useCachedScores() {
  const [scores, setScores] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Source of truth for results is the admin-posted `matchResults`
        // (keyed by matchId). Mapped to the shape BetCard/MatchCard expect.
        const snap = await getDocs(collection(db, 'matchResults'));
        if (cancelled) return;
        const map = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          map[d.id] = {
            status: data.status || 'finished',
            scoreHome: data.scoreA,
            scoreAway: data.scoreB,
            scorers: data.scorers || [],
            // Knockout extras (Track A): who advanced + how it was decided, so
            // the bracket resolves matches settled in extra time / penalties.
            advancer: data.advancer ?? null,
            decidedBy: data.decidedBy ?? null,
            penHome: data.penA ?? null,
            penAway: data.penB ?? null,
          };
        });
        setScores(map);
      } catch {
        if (!cancelled) setScores({});
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return scores;
}
