import { useState, useMemo, lazy, Suspense } from 'react';
import schedule from '../data/schedule.json';
import PhaseFilter from '../components/PhaseFilter';
import BetCard from '../components/BetCard';
import PoolManager from '../components/PoolManager';
import { useLanguage } from '../i18n/LanguageContext';
import { useBets, useMyBetsMap } from '../hooks/useBets';
import { usePools } from '../hooks/usePools';
import { useCachedScores } from '../hooks/useLiveScores';
import { groupMatchesByDate } from '../utils/matchOrder';
import TimezoneNote from '../components/TimezoneNote';

// Lazy sub-views: Especiais/Bracket pull in the player index; defer them so the
// default "Apostar" (match betting) tab stays in the light initial chunk.
const SpecialBets = lazy(() => import('../components/SpecialBets'));
const BracketPredictor = lazy(() => import('../components/BracketPredictor'));
const PhaseSummary = lazy(() => import('../components/PhaseSummary'));
const Leaderboard = lazy(() => import('../components/Leaderboard'));

export default function Bets({ onTeamClick }) {
  const [activePhase, setActivePhase] = useState('group');
  const [view, setView] = useState('bet');
  const { t } = useLanguage();
  const { activePoolId, activePool } = usePools();
  const { saveBet } = useBets();
  const { betsMap, setBetsMap, loading } = useMyBetsMap();
  const cachedScores = useCachedScores();

  const translatedPhases = useMemo(
    () => schedule.phases.map((p) => ({ ...p, name: t(`phase.${p.id}`) })),
    [t]
  );

  const phase = schedule.phases.find((p) => p.id === activePhase);

  const matchesByDate = useMemo(
    () => (phase ? groupMatchesByDate(phase.matches) : {}),
    [phase]
  );

  const handleSave = async (matchId, scoreA, scoreB) => {
    await saveBet(matchId, scoreA, scoreB);
    setBetsMap((prev) => ({
      ...prev,
      [matchId]: { ...prev[matchId], predictedScoreA: scoreA, predictedScoreB: scoreB },
    }));
  };

  // No active pool — show CTA
  if (!activePoolId) {
    return (
      <div className="bets">
        <div className="bets__no-pool">
          <span className="bets__no-pool-icon">🎯</span>
          <h2 className="bets__no-pool-title">{t('poolRequired')}</h2>
          <p className="bets__no-pool-desc">{t('poolRequiredDesc')}</p>
        </div>
        <PoolManager />
      </div>
    );
  }

  return (
    <div className="bets">
      {activePool && (
        <div className="bets__pool-header">
          <span className="bets__pool-name">{activePool.name}</span>
          <span className="bets__pool-code">{activePool.inviteCode}</span>
        </div>
      )}

      <div className="bets__view-toggle">
        <button
          className={`teams__view-chip ${view === 'bet' ? 'teams__view-chip--active' : ''}`}
          onClick={() => setView('bet')}
        >
          🎯 {t('betTab')}
        </button>
        <button
          className={`teams__view-chip ${view === 'special' ? 'teams__view-chip--active' : ''}`}
          onClick={() => setView('special')}
        >
          🃏 {t('specialTab')}
        </button>
        <button
          className={`teams__view-chip ${view === 'bracket' ? 'teams__view-chip--active' : ''}`}
          onClick={() => setView('bracket')}
        >
          🏆 {t('bracketTab')}
        </button>
        <button
          className={`teams__view-chip ${view === 'summary' ? 'teams__view-chip--active' : ''}`}
          onClick={() => setView('summary')}
        >
          📋 {t('summaryTab')}
        </button>
        <button
          className={`teams__view-chip ${view === 'ranking' ? 'teams__view-chip--active' : ''}`}
          onClick={() => setView('ranking')}
        >
          🏅 {t('rankingTab')}
        </button>
      </div>

      <Suspense fallback={<div className="bets__loading">{t('loading')}</div>}>
      {view === 'ranking' ? (
        <Leaderboard />
      ) : view === 'special' ? (
        <SpecialBets />
      ) : view === 'bracket' ? (
        <BracketPredictor />
      ) : view === 'summary' ? (
        <PhaseSummary />
      ) : (
        <>
          <PhaseFilter
            phases={translatedPhases}
            active={activePhase}
            onSelect={setActivePhase}
          />

          <TimezoneNote />

          {loading ? (
            <div className="bets__loading">{t('loading')}</div>
          ) : (
            <div className="bets__list">
              {Object.entries(matchesByDate).map(([date, matches]) => {
                const d = new Date(date + 'T00:00:00');
                const label = d.toLocaleDateString(t('dateLocale'), {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                });

                return (
                  <div key={date} className="schedule__day">
                    <h3 className="schedule__day-label">{label}</h3>
                    {matches.map((match) => (
                      <BetCard
                        key={match.id}
                        match={match}
                        bet={betsMap[match.id]}
                        matchScore={cachedScores[String(match.id)]}
                        onSave={handleSave}
                        onTeamClick={onTeamClick}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      </Suspense>
    </div>
  );
}
