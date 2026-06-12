import { useState, useEffect } from 'react';
import {
  collection, getDocs, doc, getDoc, setDoc, updateDoc, increment, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import Autocomplete from '../../components/Autocomplete';
import { ALL_TEAMS } from '../../data/playerIndex';
import { PHASE_POINTS, scoreBracket } from '../../data/bracket';
import { BRACKET_RESULTS_DOC } from '../../hooks/useBracket';
import { logError } from '../../utils/logError';

const PHASES = [
  { id: 'r16', label: 'Oitavos (16)', pts: PHASE_POINTS.r16 },
  { id: 'qf', label: 'Quartos (8)', pts: PHASE_POINTS.qf },
  { id: 'sf', label: 'Meias (4)', pts: PHASE_POINTS.sf },
  { id: 'final', label: 'Finalistas (2)', pts: PHASE_POINTS.final },
];

const teamLabel = (iso) => ALL_TEAMS.find((t) => t.id === iso)?.label || iso;

export default function BracketAdmin() {
  const [adv, setAdv] = useState({ r16: [], qf: [], sf: [], final: [], champion: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'bracketResults', BRACKET_RESULTS_DOC));
        if (snap.exists()) {
          const a = snap.data().advancers || {};
          setAdv({
            r16: a.r16 || [], qf: a.qf || [], sf: a.sf || [], final: a.final || [],
            champion: a.champion || '',
          });
        }
      } catch { /* ignore */ }
      setLoaded(true);
    })();
  }, []);

  const addTeam = (phase, iso) => {
    if (!iso) return;
    setAdv((a) => (a[phase].includes(iso) ? a : { ...a, [phase]: [...a[phase], iso] }));
  };
  const removeTeam = (phase, iso) =>
    setAdv((a) => ({ ...a, [phase]: a[phase].filter((x) => x !== iso) }));

  const saveAndCredit = async () => {
    setBusy(true);
    setDone('');
    try {
      const advancers = { r16: adv.r16, qf: adv.qf, sf: adv.sf, final: adv.final, champion: adv.champion };
      await setDoc(
        doc(db, 'bracketResults', BRACKET_RESULTS_DOC),
        { advancers, resolved: true, updatedAt: serverTimestamp() },
        { merge: true }
      );

      let credited = 0;
      const poolsSnap = await getDocs(collection(db, 'pools'));
      for (const poolDoc of poolsSnap.docs) {
        const poolId = poolDoc.id;
        const bracketsSnap = await getDocs(collection(db, 'pools', poolId, 'brackets'));
        for (const bDoc of bracketsSnap.docs) {
          const data = bDoc.data();
          const prev = data.pointsAwarded || 0;
          const { points } = scoreBracket({ slots: data.slots, picks: data.picks }, advancers);
          const delta = points - prev;
          if (delta !== 0) {
            await setDoc(bDoc.ref, { pointsAwarded: points }, { merge: true });
            const lbRef = doc(db, 'pools', poolId, 'leaderboard', data.userId);
            const lbSnap = await getDoc(lbRef);
            if (lbSnap.exists()) {
              await updateDoc(lbRef, {
                totalPoints: increment(delta),
                bracketPoints: increment(delta),
              });
            } else {
              let nickname = '';
              try {
                const us = await getDoc(doc(db, 'users', data.userId));
                if (us.exists()) nickname = us.data().nickname || '';
              } catch { /* best-effort */ }
              await setDoc(lbRef, {
                nickname,
                totalPoints: Math.max(0, delta),
                exactResultsCount: 0,
                correctOutcomeCount: 0,
                bracketPoints: Math.max(0, delta),
              });
            }
          }
          if (points > 0) credited += 1;
        }
      }
      setDone(`Guardado. ${credited} bracket(s) com pontos.`);
    } catch (err) {
      logError('BRACKET_RESOLVE_FAILED', 'Falha ao resolver bracket', { e: String(err) });
      setDone('Erro ao guardar.');
    }
    setBusy(false);
  };

  if (!loaded) return <div className="admin__section"><p className="admin__empty">A carregar...</p></div>;

  return (
    <div className="admin__section">
      <h3>Bracket — avançados reais</h3>
      <p style={{ color: 'var(--muted,#888)', fontSize: 14, marginTop: -4 }}>
        Adiciona as equipas que realmente chegaram a cada fase. Os pontos são
        creditados por delta (podes recalcular à medida que o torneio avança).
      </p>

      {PHASES.map((ph) => (
        <div key={ph.id} className="admin__bracket-phase">
          <h4>{ph.label} · +{ph.pts}/acerto</h4>
          <div className="admin__bracket-chips">
            {adv[ph.id].map((iso) => (
              <span key={iso} className="admin__bracket-chip">
                {teamLabel(iso)}
                <button onClick={() => removeTeam(ph.id, iso)} aria-label="remover">✕</button>
              </span>
            ))}
          </div>
          <Autocomplete
            options={ALL_TEAMS}
            value={null}
            onChange={(iso) => addTeam(ph.id, iso)}
            placeholder="Adicionar equipa..."
            emptyText="—"
          />
        </div>
      ))}

      <div className="admin__bracket-phase">
        <h4>Campeão · +{PHASE_POINTS.champion}</h4>
        <Autocomplete
          options={ALL_TEAMS}
          value={adv.champion || null}
          onChange={(iso) => setAdv((a) => ({ ...a, champion: iso || '' }))}
          placeholder="Escolher campeão..."
          emptyText="—"
        />
      </div>

      <button
        className="admin__btn admin__btn--primary"
        disabled={busy}
        onClick={saveAndCredit}
        style={{ marginTop: 12 }}
      >
        {busy ? '...' : 'Guardar e creditar pontos'}
      </button>
      {done && <p style={{ fontSize: 13, color: 'var(--muted,#888)', marginTop: 8 }}>{done}</p>}
    </div>
  );
}
