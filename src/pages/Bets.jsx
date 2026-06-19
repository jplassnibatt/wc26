import { useState, useMemo, lazy, Suspense, useEffect, useRef } from 'react';
import schedule from '../data/schedule.json';
import PhaseFilter from '../components/PhaseFilter';
import BetCard from '../components/BetCard';
import PoolManager from '../components/PoolManager';
import { useLanguage } from '../i18n/LanguageContext';
import { useBets, useMyBetsMap } from '../hooks/useBets';
import { usePools } from '../hooks/usePools';
import { useCachedScores } from '../hooks/useLiveScores';
import { groupMatchesByDate } from '../utils/matchOrder';
import { kickoffMs } from '../utils/matchTime';
import TimezoneNote from '../components/TimezoneNote';

// Lazy sub-views: Especiais/Bracket pull in the player index; defer them so the
// default "Apostar" (match betting) tab stays in the light initial chunk.
const SpecialBets = lazy(() => import('../components/SpecialBets'));
const BracketPredictor = lazy(() => import('../components/BracketPredictor'));
const PhaseSummary = lazy(() => import('../components/PhaseSummary'));
const Leaderboard = lazy(() => import('../components/Leaderboard'));

// compute absolute document Y for an element
function absoluteTopOf(el) {
  const rect = el.getBoundingClientRect();
  return window.scrollY + rect.top;
}

// Scroll so element's top ends up `offset` pixels below the viewport top,
// then run a short corrective loop to re-align if layout shifts happen.
function alignElementToOffset(el, offset = 0, smooth = true) {
  if (!el) return;
  const absoluteTop = absoluteTopOf(el);
  const targetScrollTop = Math.max(0, Math.round(absoluteTop - offset));
  window.scrollTo({ top: targetScrollTop, behavior: smooth ? 'smooth' : 'auto' });

  // corrective loop
  let attempts = 0;
  const maxAttempts = 8;
  const tolerance = 4; // px
  const check = () => {
    const rect = el.getBoundingClientRect();
    const currentTop = rect.top;
    const delta = currentTop - offset;
    if (Math.abs(delta) > tolerance && attempts < maxAttempts) {
      // scroll by delta to place element at desired offset
      window.scrollBy({ top: Math.round(delta), behavior: 'auto' });
      attempts += 1;
      setTimeout(check, 80);
    }
  };
  setTimeout(check, 120);
}

export default function Bets({ onTeamClick, initialView }) {
  const [activePhase, setActivePhase] = useState('group');
  const [view, setView] = useState(initialView ?? 'bet');
  const { t } = useLanguage();
  const { activePoolId, activePool } = usePools();
  const { saveBet } = useBets();
  const { betsMap, setBetsMap, loading } = useMyBetsMap();
  const cachedScores = useCachedScores();

  // Refs for auto-scroll behavior
  const listRef = useRef(null);
  const scrolledRef = useRef(false);

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

  // Reset scroll flag whenever the phase or view changes
  useEffect(() => {
    scrolledRef.current = false;
  }, [activePhase, view]);

  // Auto-scroll to today's date block when the bets "bet" view is shown.
  useEffect(() => {
    if (view !== 'bet') return;
    if (scrolledRef.current) return;
    if (loading) return;
    if (!matchesByDate || Object.keys(matchesByDate).length === 0) return;

    const root = listRef.current;
    if (!root) return;

    // compute offsets: header + phase filter + small gap
    const headerEl = document.querySelector('.app-header');
    const phaseFilterEl = document.querySelector('.phase-filter');
    const headerHeight = headerEl ? headerEl.getBoundingClientRect().height : 0;
    const phaseFilterHeight = phaseFilterEl ? phaseFilterEl.getBoundingClientRect().height : 0;
    const gap = 8;
    const totalOffset = headerHeight + phaseFilterHeight + gap;

    // Try to position the today's block; fall back to upcoming or first date
    const run = () => {
      // 1) Today's key in viewer timezone (YYYY-MM-DD)
      const now = new Date();
      const y = now.getFullYear();
      const mo = String(now.getMonth() + 1).padStart(2, '0');
      const da = String(now.getDate()).padStart(2, '0');
      const todayKey = `${y}-${mo}-${da}`;

      if (matchesByDate[todayKey]) {
        const el = root.querySelector(`[data-date="${todayKey}"]`);
        if (el) {
          alignElementToOffset(el, totalOffset, true);
          scrolledRef.current = true;
          return;
        }
      }

      // 2) Fallback: first upcoming date (kickoff >= now)
      const nowMs = Date.now();
      const dateKeys = Object.keys(matchesByDate).sort();
      let targetDateKey = null;
      for (const dateKey of dateKeys) {
        const matches = matchesByDate[dateKey];
        for (const match of matches) {
          const ms = kickoffMs(match);
          if (ms != null && ms >= nowMs) {
            targetDateKey = dateKey;
            break;
          }
        }
        if (targetDateKey) break;
      }

      // 3) Final fallback: first available date
      if (!targetDateKey && dateKeys.length > 0) {
        targetDateKey = dateKeys[0];
      }

      if (targetDateKey) {
        const el = root.querySelector(`[data-date="${targetDateKey}"]`);
        if (el) {
          alignElementToOffset(el, totalOffset, true);
          scrolledRef.current = true;
        }
      }
    };

    // Defer to next paints so layout is stable
    requestAnimationFrame(() => requestAnimationFrame(run));
  }, [view, matchesByDate, loading]);

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
        {/* keep special/bracket commented out if not desired in bottom toggle */}
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
              <div className="bets__list" ref={listRef}>
                {Object.entries(matchesByDate).map(([date, matches]) => {
                  const d = new Date(date + 'T00:00:00');
                  const label = d.toLocaleDateString(t('dateLocale'), {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  });

                  return (
                    <div key={date} className="schedule__day" data-date={date}>
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