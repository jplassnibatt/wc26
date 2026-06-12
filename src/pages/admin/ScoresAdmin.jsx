import { useState, useMemo } from 'react';
import {
  collection, getDocs, doc, getDoc, setDoc, updateDoc, writeBatch, query, where, increment,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { calculatePoints } from '../../utils/scoring';
import schedule from '../../data/schedule.json';
import { logError } from '../../utils/logError';

// Flatten all matches from all phases
const ALL_MATCHES = schedule.phases.flatMap((p) => p.matches);

export default function ScoresAdmin() {
  const [scores, setScores] = useState({}); // { matchId: { scoreA, scoreB } }
  const [saving, setSaving] = useState(null); // matchId being saved
  const [saved, setSaved] = useState({}); // { matchId: true }
  const [filter, setFilter] = useState('pending'); // 'all' | 'pending' | 'finished'
  const [inputValues, setInputValues] = useState({}); // { matchId: { a, b } }

  // Load existing scores from Firestore (stored in pools as match results)
  const [matchResults, setMatchResults] = useState({});
  const [loaded, setLoaded] = useState(false);

  useState(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'matchResults'));
        const results = {};
        snap.docs.forEach((d) => {
          results[d.id] = d.data();
        });
        setMatchResults(results);

        // Pre-fill input values
        const inputs = {};
        for (const [id, data] of Object.entries(results)) {
          inputs[id] = { a: String(data.scoreA), b: String(data.scoreB) };
        }
        setInputValues(inputs);
      } catch {}
      setLoaded(true);
    })();
  });

  const filteredMatches = useMemo(() => {
    return ALL_MATCHES.filter((m) => {
      const hasResult = !!matchResults[String(m.id)];
      if (filter === 'pending') return !hasResult;
      if (filter === 'finished') return hasResult;
      return true;
    });
  }, [filter, matchResults]);

  const handleInput = (matchId, side, value) => {
    setInputValues((prev) => ({
      ...prev,
      [matchId]: { ...prev[matchId], [side]: value },
    }));
  };

  const handleSaveScore = async (match) => {
    const vals = inputValues[String(match.id)];
    if (!vals || vals.a === '' || vals.b === '' || vals.a == null || vals.b == null) return;

    const scoreA = parseInt(vals.a);
    const scoreB = parseInt(vals.b);
    if (isNaN(scoreA) || isNaN(scoreB) || scoreA < 0 || scoreB < 0) return;

    setSaving(match.id);
    setSaved((prev) => ({ ...prev, [match.id]: false }));

    try {
      // Save match result
      await setDoc(doc(db, 'matchResults', String(match.id)), {
        matchId: match.id,
        scoreA,
        scoreB,
        status: 'finished',
        updatedAt: new Date(),
      });

      // Score all bets across ALL pools
      const poolsSnap = await getDocs(collection(db, 'pools'));
      for (const poolDoc of poolsSnap.docs) {
        const poolId = poolDoc.id;
        const betsSnap = await getDocs(
          query(
            collection(db, 'pools', poolId, 'bets'),
            where('matchId', '==', match.id)
          )
        );

        if (betsSnap.empty) continue;

        const batch = writeBatch(db);
        // Credit the DELTA vs what each bet was already awarded, so re-posting
        // or recalculating a result never double-counts. The previous bet type
        // is derived from its previous points (5=exact, 3=outcome, else none).
        const deltas = {}; // uid -> { points, exact, outcome }

        for (const betDoc of betsSnap.docs) {
          const bet = betDoc.data();
          const result = calculatePoints(
            bet.predictedScoreA, bet.predictedScoreB, scoreA, scoreB
          );
          if (!result) continue;

          const prev = bet.pointsAwarded; // number already awarded, or null if never scored
          batch.update(betDoc.ref, { pointsAwarded: result.points });

          if (!deltas[bet.userId]) deltas[bet.userId] = { points: 0, exact: 0, outcome: 0 };
          deltas[bet.userId].points += result.points - (prev ?? 0);
          deltas[bet.userId].exact += (result.type === 'exact' ? 1 : 0) - (prev === 5 ? 1 : 0);
          deltas[bet.userId].outcome += (result.type === 'outcome' ? 1 : 0) - (prev === 3 ? 1 : 0);
        }

        await batch.commit();

        // Apply leaderboard deltas atomically (increment), upserting the entry
        // if it's somehow missing so points are never silently dropped.
        for (const [uid, d] of Object.entries(deltas)) {
          if (d.points === 0 && d.exact === 0 && d.outcome === 0) continue;
          const lbRef = doc(db, 'pools', poolId, 'leaderboard', uid);
          const lbSnap = await getDoc(lbRef);
          if (lbSnap.exists()) {
            await updateDoc(lbRef, {
              totalPoints: increment(d.points),
              exactResultsCount: increment(d.exact),
              correctOutcomeCount: increment(d.outcome),
            });
          } else {
            let nickname = '';
            try {
              const us = await getDoc(doc(db, 'users', uid));
              if (us.exists()) nickname = us.data().nickname || '';
            } catch { /* nickname is best-effort */ }
            await setDoc(lbRef, {
              nickname,
              totalPoints: Math.max(0, d.points),
              exactResultsCount: Math.max(0, d.exact),
              correctOutcomeCount: Math.max(0, d.outcome),
            });
          }
        }
      }

      setMatchResults((prev) => ({
        ...prev,
        [String(match.id)]: { scoreA, scoreB, status: 'finished' },
      }));
      setSaved((prev) => ({ ...prev, [match.id]: true }));
    } catch (err) {
      console.error('Score save error:', err);
      logError('SCORE_SAVE_FAILED', `Failed to save score for match ${match.id}`, {
        matchId: match.id,
        scoreA,
        scoreB,
      });
    }
    setSaving(null);
  };

  if (!loaded) return <div className="admin__section"><p className="admin__empty">A carregar...</p></div>;

  const finishedCount = Object.keys(matchResults).length;
  const totalCount = ALL_MATCHES.length;

  return (
    <div className="admin__section">
      <h3>Resultados ({finishedCount}/{totalCount})</h3>

      <div className="admin__filter">
        {['all', 'pending', 'finished'].map((f) => (
          <button
            key={f}
            className={`admin__filter-chip ${filter === f ? 'admin__filter-chip--active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendentes' : 'Concluídos'}
          </button>
        ))}
      </div>

      <table className="admin__table">
        <thead>
          <tr>
            <th>#</th>
            <th>Jogo</th>
            <th>Data</th>
            <th>Resultado</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filteredMatches.map((match) => {
            const result = matchResults[String(match.id)];
            const vals = inputValues[String(match.id)] || { a: '', b: '' };
            const isSaving = saving === match.id;
            const isSaved = saved[match.id];

            return (
              <tr key={match.id}>
                <td>{match.id}</td>
                <td style={{ fontWeight: 600 }}>
                  {match.home_iso ? `${match.home} vs ${match.away}` : (match.label || `Jogo ${match.id}`)}
                </td>
                <td>{match.date}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      className="admin__score-input"
                      type="number"
                      min="0"
                      value={vals.a}
                      onChange={(e) => handleInput(String(match.id), 'a', e.target.value)}
                    />
                    <span style={{ fontWeight: 700 }}>:</span>
                    <input
                      className="admin__score-input"
                      type="number"
                      min="0"
                      value={vals.b}
                      onChange={(e) => handleInput(String(match.id), 'b', e.target.value)}
                    />
                  </div>
                </td>
                <td>
                  {result ? (
                    <span className="admin__badge admin__badge--finished">Concluído</span>
                  ) : (
                    <span className="admin__badge admin__badge--pending">Pendente</span>
                  )}
                </td>
                <td>
                  <button
                    className="admin__btn admin__btn--primary admin__btn--small"
                    onClick={() => handleSaveScore(match)}
                    disabled={isSaving}
                  >
                    {isSaving ? '...' : isSaved ? '✓' : result ? 'Recalcular' : 'Guardar'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
