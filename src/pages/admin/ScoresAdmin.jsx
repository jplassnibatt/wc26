import { useState, useMemo } from 'react';
import {
  collection, getDocs, doc, getDoc, setDoc, updateDoc, writeBatch, query, where, increment,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { calculatePoints, scoreKnockout } from '../../utils/scoring';
import { matchSegment } from '../../utils/phases';
import { resolveKnockout } from '../../utils/knockout';
import schedule from '../../data/schedule.json';
import { logError } from '../../utils/logError';

// Flatten all matches from all phases
const ALL_MATCHES = schedule.phases.flatMap((p) => p.matches);
const TEAM_NAME = Object.fromEntries(schedule.teams.map((t) => [t.iso, t.name]));

// Previous scored "type" for delta maths. New bets store `scoredType`; older
// ones predate it, so fall back to the group-stage points→type mapping (5/3).
function prevScoredType(bet) {
  if (bet.scoredType) return bet.scoredType;
  const p = bet.pointsAwarded;
  return p === 5 ? 'exact' : p === 3 ? 'outcome' : null;
}

export default function ScoresAdmin() {
  const [scores, setScores] = useState({}); // { matchId: { scoreA, scoreB } }
  const [saving, setSaving] = useState(null); // matchId being saved
  const [saved, setSaved] = useState({}); // { matchId: true }
  const [filter, setFilter] = useState('pending'); // 'all' | 'pending' | 'finished'
  const [inputValues, setInputValues] = useState({}); // { matchId: { a, b } }
  // Knockout-only, when 90' is a draw: { matchId: { advancer: iso, decidedBy: 'et'|'pens' } }
  const [koInputs, setKoInputs] = useState({});

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
        const ko = {};
        for (const [id, data] of Object.entries(results)) {
          inputs[id] = { a: String(data.scoreA), b: String(data.scoreB) };
          if (data.advancer || data.decidedBy) ko[id] = { advancer: data.advancer || null, decidedBy: data.decidedBy || null };
        }
        setInputValues(inputs);
        setKoInputs(ko);
      } catch {}
      setLoaded(true);
    })();
  });

  // Resolved knockout teams (from results so far), to pick the advancer on draws.
  const resolvedKO = useMemo(() => {
    const scoresMap = {};
    for (const [id, d] of Object.entries(matchResults)) {
      scoresMap[id] = {
        status: d.status || 'finished', scoreHome: d.scoreA, scoreAway: d.scoreB,
        penHome: d.penA, penAway: d.penB, advancer: d.advancer,
      };
    }
    return resolveKnockout(scoresMap);
  }, [matchResults]);

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
      // Knockout: derive how it was decided + who advanced. Decisive 90' → from
      // the score; 90' draw → from the admin's picks (resolved teams + ET/pens).
      const segment = matchSegment(match.id); // 'group' | 'knockout'
      const isKO = segment === 'knockout';
      let decidedBy = '90';
      let advancer = null;
      const teams = isKO ? (resolvedKO[String(match.id)] || {}) : {};
      if (isKO) {
        if (scoreA !== scoreB) {
          decidedBy = '90';
          advancer = scoreA > scoreB ? (teams.home || null) : (teams.away || null);
        } else {
          const ko = koInputs[String(match.id)] || {};
          decidedBy = ko.decidedBy || null;
          advancer = ko.advancer || null;
        }
      }

      // Save match result
      await setDoc(doc(db, 'matchResults', String(match.id)), {
        matchId: match.id,
        scoreA,
        scoreB,
        status: 'finished',
        updatedAt: new Date(),
        ...(isKO ? { decidedBy, advancer, homeIso: teams.home || null, awayIso: teams.away || null } : {}),
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
        // comes from `scoredType` (older bets fall back to points→type).
        const deltas = {}; // uid -> { points, exact, outcome }

        for (const betDoc of betsSnap.docs) {
          const bet = betDoc.data();
          const result = isKO
            ? scoreKnockout(bet, { a90: scoreA, b90: scoreB, decidedBy, advancer })
            : calculatePoints(bet.predictedScoreA, bet.predictedScoreB, scoreA, scoreB);
          if (!result) continue;

          const prevPoints = bet.pointsAwarded ?? 0;
          const prevType = prevScoredType(bet);
          batch.update(betDoc.ref, { pointsAwarded: result.points, scoredType: result.type });

          if (!deltas[bet.userId]) deltas[bet.userId] = { points: 0, exact: 0, outcome: 0 };
          deltas[bet.userId].points += result.points - prevPoints;
          deltas[bet.userId].exact += (result.type === 'exact' ? 1 : 0) - (prevType === 'exact' ? 1 : 0);
          deltas[bet.userId].outcome += (result.type === 'outcome' ? 1 : 0) - (prevType === 'outcome' ? 1 : 0);
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
              [segment === 'group' ? 'groupPoints' : 'knockoutPoints']: increment(d.points),
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
              groupPoints: segment === 'group' ? Math.max(0, d.points) : 0,
              knockoutPoints: segment === 'knockout' ? Math.max(0, d.points) : 0,
            });
          }
        }
      }

      setMatchResults((prev) => ({
        ...prev,
        [String(match.id)]: { scoreA, scoreB, status: 'finished', ...(isKO ? { decidedBy, advancer } : {}) },
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
            const isKO = matchSegment(match.id) === 'knockout';
            const koTeams = resolvedKO[String(match.id)] || {};
            const ko = koInputs[String(match.id)] || {};
            const enteredDraw = vals.a !== '' && vals.b !== '' && Number(vals.a) === Number(vals.b);
            const setKo = (patch) => setKoInputs((prev) => ({
              ...prev, [String(match.id)]: { ...prev[String(match.id)], ...patch },
            }));

            return (
              <tr key={match.id}>
                <td>{match.id}</td>
                <td style={{ fontWeight: 600 }}>
                  {match.home_iso
                    ? `${match.home} vs ${match.away}`
                    : (koTeams.home && koTeams.away
                        ? `${TEAM_NAME[koTeams.home] || koTeams.home} vs ${TEAM_NAME[koTeams.away] || koTeams.away}`
                        : (match.label || `Jogo ${match.id}`))}
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
                  {isKO && enteredDraw && koTeams.home && koTeams.away && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                      <button
                        type="button"
                        className={`admin__btn admin__btn--small ${ko.advancer === koTeams.home ? 'admin__btn--primary' : 'admin__btn--ghost'}`}
                        onClick={() => setKo({ advancer: koTeams.home })}
                      >➜ {TEAM_NAME[koTeams.home] || koTeams.home}</button>
                      <button
                        type="button"
                        className={`admin__btn admin__btn--small ${ko.advancer === koTeams.away ? 'admin__btn--primary' : 'admin__btn--ghost'}`}
                        onClick={() => setKo({ advancer: koTeams.away })}
                      >➜ {TEAM_NAME[koTeams.away] || koTeams.away}</button>
                      <button
                        type="button"
                        className={`admin__btn admin__btn--small ${ko.decidedBy === 'et' ? 'admin__btn--primary' : 'admin__btn--ghost'}`}
                        onClick={() => setKo({ decidedBy: 'et' })}
                      >Prol.</button>
                      <button
                        type="button"
                        className={`admin__btn admin__btn--small ${ko.decidedBy === 'pens' ? 'admin__btn--primary' : 'admin__btn--ghost'}`}
                        onClick={() => setKo({ decidedBy: 'pens' })}
                      >Pen</button>
                    </div>
                  )}
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
