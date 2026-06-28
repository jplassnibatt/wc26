import { useState, useMemo, Suspense } from 'react';
import schedule from '../data/schedule.json';
import PhaseFilter from '../components/PhaseFilter';
import BetCard from '../components/BetCard';
import SkeletonBetList from '../components/SkeletonBetCard';
import PoolManager from '../components/PoolManager';
import { useLanguage } from '../i18n/LanguageContext';
import { useBets, useMyBetsMap } from '../hooks/useBets';
import { usePools } from '../hooks/usePools';
import { useCachedScores } from '../hooks/useLiveScores';
import { useScrollToToday } from '../hooks/useScrollToToday';
import { groupMatchesByDate } from '../utils/matchOrder';
import { resolveKnockout } from '../utils/knockout';
import { currentPhase } from '../utils/phases';
import TimezoneNote from '../components/TimezoneNote';
import lazyWithReload from '../utils/lazyWithReload';

// Lazy sub-views: Especiais/Bracket pull in the player index; defer them so the
// default "Apostar" (match betting) tab stays in the light initial chunk.
// lazyWithReload recovers from stale chunks after a deploy.
const SpecialBets = lazyWithReload(() => import('../components/SpecialBets'));
const BracketPredictor = lazyWithReload(() => import('../components/BracketPredictor'));
const PhaseSummary = lazyWithReload(() => import('../components/PhaseSummary'));
const Leaderboard = lazyWithReload(() => import('../components/Leaderboard'));

export default function Bets({ onTeamClick }) {
  const [activePhase, setActivePhase] = useState(currentPhase);
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
  // Fill knockout fixtures with the teams already certain from group results,
  // so the betting cards show real teams instead of "2A vs 2B".
  const resolvedKO = useMemo(() => resolveKnockout(cachedScores), [cachedScores]);

  const matchesByDate = useMemo(
    () => (phase ? groupMatchesByDate(phase.matches) : {}),
    [phase]
  );

  // Land on today's fixtures, but only in the match-betting view and while
  // viewing the tournament's current phase. The list grows as bets + live scores
  // load in, so the hook re-pins today to the top until it settles or the user scrolls.
  const dayRefs = useScrollToToday(matchesByDate, view === 'bet' && activePhase === currentPhase());

  const handleSave = async (matchId, scoreA, scoreB, extra = {}) => {
    await saveBet(matchId, scoreA, scoreB, extra);
    setBetsMap((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        predictedScoreA: scoreA,
        predictedScoreB: scoreB,
        predictedAdvancer: extra.predictedAdvancer ?? null,
        predictedDecidedBy: extra.predictedDecidedBy ?? null,
      },
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
            <SkeletonBetList />
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
                  <div
                    key={date}
                    className="schedule__day"
                    ref={(el) => {
                      if (el) dayRefs.current[date] = el;
                      else delete dayRefs.current[date];
                    }}
                  >
                    <h3 className="schedule__day-label">{label}</h3>
                    {matches.map((match) => (
                      <BetCard
                        key={match.id}
                        match={match}
                        bet={betsMap[match.id]}
                        matchScore={cachedScores[String(match.id)]}
                        resolvedHome={resolvedKO[match.id]?.home}
                        resolvedAway={resolvedKO[match.id]?.away}
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
