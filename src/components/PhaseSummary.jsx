import { useState, useMemo } from 'react';
import schedule from '../data/schedule.json';
import PhaseFilter from './PhaseFilter';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../hooks/useAuth';
import { usePhaseSummary } from '../hooks/usePhaseSummary';

export default function PhaseSummary() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [phaseId, setPhaseId] = useState('group');
  const { matches, loading } = usePhaseSummary(phaseId, true);

  const translatedPhases = useMemo(
    () => schedule.phases.map((p) => ({ ...p, name: t(`phase.${p.id}`) })),
    [t]
  );

  const teamName = (iso, fallback) => (iso ? t(`team.${iso}`) : fallback);

  const summary = useMemo(() => {
    if (!matches.length) return null;

    const byUser = {}; // uid -> { nickname, points, exacts }
    const exactHits = [];
    let trickiest = null; // { match, rate, total }

    for (const m of matches) {
      const label = `${teamName(m.homeIso, m.home)} ${m.scoreA}–${m.scoreB} ${teamName(m.awayIso, m.away)}`;
      let outcomeOk = 0;
      const total = m.bets.length;

      for (const b of m.bets) {
        if (!byUser[b.uid]) byUser[b.uid] = { uid: b.uid, nickname: b.nickname, points: 0, exacts: 0 };
        byUser[b.uid].points += b.points || 0;
        if (b.points === 5) {
          byUser[b.uid].exacts += 1;
          exactHits.push({ uid: b.uid, nickname: b.nickname, label, score: `${b.a}–${b.b}` });
        }
        if ((b.points || 0) >= 3) outcomeOk += 1;
      }

      if (total > 0) {
        const rate = outcomeOk / total;
        if (!trickiest || rate < trickiest.rate) {
          trickiest = { label, rate, total, outcomeOk };
        }
      }
    }

    const ranking = Object.values(byUser).sort(
      (a, b) => b.points - a.points || b.exacts - a.exacts || a.nickname.localeCompare(b.nickname)
    );

    return { ranking, exactHits, trickiest, finishedCount: matches.length };
  }, [matches, t]);

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="phase-summary">
      <PhaseFilter phases={translatedPhases} active={phaseId} onSelect={setPhaseId} />

      {loading ? (
        <div className="bets__loading">{t('loading')}</div>
      ) : !summary ? (
        <div className="phase-summary__empty">
          <span className="phase-summary__empty-icon">🧮</span>
          <p>{t('summaryEmpty')}</p>
        </div>
      ) : (
        <div className="phase-summary__body">
          <p className="phase-summary__count">
            {summary.finishedCount} {summary.finishedCount === 1 ? t('summaryOneMatch') : t('summaryManyMatches')}
          </p>

          <div className="phase-summary__card">
            <h3 className="phase-summary__card-title">🏆 {t('summaryTopPhase')}</h3>
            {summary.ranking.map((r, i) => (
              <div
                key={r.uid}
                className={`phase-summary__rank ${r.uid === user?.uid ? 'phase-summary__rank--me' : ''}`}
              >
                <span className="phase-summary__rank-pos">{i < 3 ? medals[i] : i + 1}</span>
                <span className="phase-summary__rank-name">{r.nickname}</span>
                {r.exacts > 0 && <span className="phase-summary__rank-exacts">🎯 {r.exacts}</span>}
                <span className="phase-summary__rank-pts">{r.points} {t('pts')}</span>
              </div>
            ))}
          </div>

          <div className="phase-summary__card">
            <h3 className="phase-summary__card-title">🎯 {t('summaryExactHits')}</h3>
            {summary.exactHits.length === 0 ? (
              <p className="phase-summary__none">{t('summaryNoExact')}</p>
            ) : (
              summary.exactHits.map((h, i) => (
                <div key={i} className="phase-summary__hit">
                  <span className="phase-summary__hit-name">{h.nickname}</span>
                  <span className="phase-summary__hit-match">{h.label}</span>
                </div>
              ))
            )}
          </div>

          {summary.trickiest && (
            <div className="phase-summary__card">
              <h3 className="phase-summary__card-title">🧩 {t('summaryTrickiest')}</h3>
              <p className="phase-summary__trickiest">{summary.trickiest.label}</p>
              <p className="phase-summary__trickiest-sub">
                {summary.trickiest.outcomeOk}/{summary.trickiest.total} {t('summaryGotOutcome')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
