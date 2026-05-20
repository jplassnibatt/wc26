import { useState, useMemo } from 'react';
import schedule from '../data/schedule.json';
import PhaseFilter from '../components/PhaseFilter';
import BetCard from '../components/BetCard';
import Leaderboard from '../components/Leaderboard';
import PoolManager from '../components/PoolManager';
import { useLanguage } from '../i18n/LanguageContext';
import { useBets, useMyBetsMap } from '../hooks/useBets';
import { usePools } from '../hooks/usePools';
import { useCachedScores } from '../hooks/useLiveScores';

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

  const matchesByDate = useMemo(() => {
    if (!phase) return {};
    const grouped = {};
    for (const match of phase.matches) {
      if (!grouped[match.date]) grouped[match.date] = [];
      grouped[match.date].push(match);
    }
    return grouped;
  }, [phase]);

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
          className={`teams__view-chip ${view === 'ranking' ? 'teams__view-chip--active' : ''}`}
          onClick={() => setView('ranking')}
        >
          🏅 {t('rankingTab')}
        </button>
      </div>

      {view === 'ranking' ? (
        <Leaderboard />
      ) : (
        <>
          <PhaseFilter
            phases={translatedPhases}
            active={activePhase}
            onSelect={setActivePhase}
          />

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
    </div>
  );
}
